import { DurableObject } from "cloudflare:workers";
import {
  CONNECTION_TIMEOUT_MS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  isValidRoomCode,
  normalizeRoomCode,
  type CreateRoomResponse,
} from "@guessdrawing/shared";
import { Room, errorMessage, type Connection } from "./game/room.js";
import { randomInt } from "./game/random.js";

export interface Env {
  ROOMS: DurableObjectNamespace<GameRoom>;
  /** Comma separated list of allowed browser origins; empty or "*" allows all. */
  CORS_ORIGIN?: string;
}

/** A room that was created but never joined is forgotten after this long. */
const UNUSED_ROOM_TTL_MS = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Worker: routes HTTP requests to the right room
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const allowed = isOriginAllowed(origin, env);
    const cors = corsHeaders(origin, allowed);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (url.pathname === "/" || url.pathname === "/health") {
      return Response.json({ ok: true }, { headers: cors });
    }

    if (!allowed) return new Response("Origin not allowed", { status: 403 });

    // POST /rooms -> create a room with a fresh code
    if (url.pathname === "/rooms" && request.method === "POST") {
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = Array.from({ length: ROOM_CODE_LENGTH }, () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)]).join("");
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        if (await stub.init()) {
          return Response.json({ code } satisfies CreateRoomResponse, { headers: cors });
        }
      }
      return Response.json({ error: "Kon geen kamer maken" }, { status: 503, headers: cors });
    }

    // GET /rooms/:code/ws -> WebSocket into the room
    const match = url.pathname.match(/^\/rooms\/([^/]+)\/ws$/);
    if (match) {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return new Response("Expected a WebSocket", { status: 426 });
      }
      const code = normalizeRoomCode(decodeURIComponent(match[1]!));
      if (!isValidRoomCode(code)) return notFoundSocket();
      return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(request);
    }

    return new Response("Not found", { status: 404, headers: cors });
  },
} satisfies ExportedHandler<Env>;

function isOriginAllowed(origin: string | null, env: Env): boolean {
  const list = (env.CORS_ORIGIN ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (list.length === 0 || list.includes("*") || !origin) return true;
  return list.includes(origin);
}

function corsHeaders(origin: string | null, allowed: boolean): HeadersInit {
  if (!allowed || !origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

/** Browsers can't read the status of a failed WebSocket upgrade, so accept and explain. */
function notFoundSocket(): Response {
  const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
  server.accept();
  server.send(errorMessage("ROOM_NOT_FOUND"));
  server.close(4004, "ROOM_NOT_FOUND");
  return new Response(null, { status: 101, webSocket: client });
}

// ---------------------------------------------------------------------------
// Durable Object: one instance per room code, holds the game in memory
// ---------------------------------------------------------------------------

export class GameRoom extends DurableObject<Env> {
  private room: Room | null = null;
  private created: boolean | null = null;
  /** Open sockets: when we last heard from them and how to tear them down. */
  private readonly sockets = new Map<WebSocket, { lastSeen: number; drop: () => void }>();
  private livenessTimer: ReturnType<typeof setInterval> | null = null;

  /** Marks the room as created. Returns false if the code is already taken. */
  async init(): Promise<boolean> {
    if (await this.isCreated()) return false;
    await this.ctx.storage.put("created", Date.now());
    this.created = true;
    await this.ctx.storage.setAlarm(Date.now() + UNUSED_ROOM_TTL_MS);
    return true;
  }

  private async isCreated(): Promise<boolean> {
    this.created ??= (await this.ctx.storage.get("created")) !== undefined;
    return this.created;
  }

  /** Clean up rooms that were created but are (still) empty. */
  async alarm(): Promise<void> {
    if (!this.room || this.room.isEmpty) await this.forget();
  }

  private async forget(): Promise<void> {
    this.room?.dispose();
    this.room = null;
    this.created = false;
    await this.ctx.storage.deleteAll();
  }

  async fetch(request: Request): Promise<Response> {
    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    server.accept();

    if (!(await this.isCreated())) {
      server.send(errorMessage("ROOM_NOT_FOUND"));
      server.close(4004, "ROOM_NOT_FOUND");
      return new Response(null, { status: 101, webSocket: client });
    }

    const url = new URL(request.url);
    const code = normalizeRoomCode(decodeURIComponent(url.pathname.split("/")[2] ?? ""));
    this.room ??= new Room(code, undefined, () => {
      // Last player left: forget the room so the code stops working.
      void this.forget();
    });
    const room = this.room;

    const conn: Connection = {
      send: (data) => {
        try {
          server.send(data);
        } catch {
          /* socket already closed */
        }
      },
      close: (closeCode, reason) => {
        try {
          server.close(closeCode, reason);
        } catch {
          /* already closed */
        }
      },
    };

    let closed = false;
    const onClose = () => {
      if (closed) return;
      closed = true;
      this.sockets.delete(server);
      room.handleClose(conn);
      this.updateLiveness();
    };
    server.addEventListener("message", (event) => {
      const entry = this.sockets.get(server);
      if (entry) entry.lastSeen = Date.now();
      if (typeof event.data !== "string" || event.data.length > 100_000) return;
      let msg: unknown;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      room.handleMessage(conn, msg);
    });
    server.addEventListener("close", onClose);
    server.addEventListener("error", onClose);

    if (room.connect(conn, url.searchParams.get("name"), url.searchParams.get("token"))) {
      const drop = () => {
        conn.close(4008, "Timed out");
        onClose();
      };
      this.sockets.set(server, { lastSeen: Date.now(), drop });
      this.updateLiveness();
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Phones that lose signal often don't close their socket cleanly. Clients
   * ping regularly; sockets that go quiet are closed so the player shows as away.
   */
  private updateLiveness(): void {
    if (this.sockets.size > 0 && !this.livenessTimer) {
      this.livenessTimer = setInterval(() => {
        const now = Date.now();
        for (const { lastSeen, drop } of [...this.sockets.values()]) {
          if (now - lastSeen > CONNECTION_TIMEOUT_MS) drop();
        }
      }, 5_000);
    } else if (this.sockets.size === 0 && this.livenessTimer) {
      clearInterval(this.livenessTimer);
      this.livenessTimer = null;
    }
  }
}
