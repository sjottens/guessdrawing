import { createServer, type Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import {
  MAX_CHAT_LENGTH,
  isValidRoomCode,
  normalizeRoomCode,
  sanitizeName,
  type Ack,
  type JoinPayload,
  type RoomCode,
} from "@guessdrawing/shared";
import { RoomManager } from "./rooms.js";
import { defaultRoomOptions, type RoomOptions } from "./room.js";
import type { GameSocket, IO } from "./types.js";

export interface GameServerOptions {
  /** Allowed browser origins for CORS; "*" allows any. */
  corsOrigin?: string | string[];
  room?: Partial<RoomOptions>;
}

export interface GameServer {
  http: HttpServer;
  io: IO;
  rooms: RoomManager;
}

export function createGameServer(opts: GameServerOptions = {}): GameServer {
  const http = createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
      return;
    }
    res.writeHead(404).end();
  });

  const io: IO = new Server(http, {
    cors: { origin: opts.corsOrigin ?? "*" },
    // Strokes can be sent in bursts; keep a sane upper limit per message.
    maxHttpBufferSize: 1e6,
  });

  const rooms = new RoomManager(io, { ...defaultRoomOptions, ...opts.room });

  const roomOf = (socket: GameSocket) => {
    const code = socket.data.roomCode;
    return code ? rooms.get(code) : undefined;
  };

  io.on("connection", (socket) => {
    socket.on("room:join", (payload: JoinPayload, ack: (res: Ack<{ code: RoomCode }>) => void) => {
      const reply = typeof ack === "function" ? ack : () => {};
      const name = sanitizeName(payload?.name);
      const token = typeof payload?.sessionToken === "string" ? payload.sessionToken.slice(0, 100) : "";
      if (!name) return reply({ ok: false, error: "INVALID_NAME", message: "Kies eerst een naam" });
      if (!token) return reply({ ok: false, error: "NOT_ALLOWED", message: "Ongeldige sessie" });

      // Leave a previous room if this socket was in one.
      const current = roomOf(socket);
      const wantedCode = payload.code ? normalizeRoomCode(payload.code) : "";
      if (current && current.code !== wantedCode) current.leave(socket);

      let room;
      if (wantedCode) {
        room = isValidRoomCode(wantedCode) ? rooms.get(wantedCode) : undefined;
        if (!room) return reply({ ok: false, error: "ROOM_NOT_FOUND", message: "Deze kamer bestaat niet (meer)" });
      } else {
        room = rooms.create();
      }

      const result = room.join(socket, name, token);
      if (!result.ok) return reply({ ok: false, error: "ROOM_FULL", message: "Deze kamer zit vol" });
      reply({ ok: true, data: { code: room.code } });
    });

    socket.on("room:leave", () => roomOf(socket)?.leave(socket));

    socket.on("chat:send", (text) => {
      if (typeof text !== "string") return;
      const clean = text.replace(/\s+/g, " ").trim().slice(0, MAX_CHAT_LENGTH);
      if (!clean) return;
      roomOf(socket)?.handleChat(socket, clean);
    });

    socket.on("draw:begin", (stroke) => roomOf(socket)?.handleDrawBegin(socket, stroke));
    socket.on("draw:points", (payload) => roomOf(socket)?.handleDrawPoints(socket, payload));
    socket.on("draw:undo", () => roomOf(socket)?.handleUndo(socket));
    socket.on("draw:clear", () => roomOf(socket)?.handleClear(socket));

    socket.on("disconnect", () => roomOf(socket)?.handleDisconnect(socket));
  });

  return { http, io, rooms };
}
