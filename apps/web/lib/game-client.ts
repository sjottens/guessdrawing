"use client";

import { io, type Socket } from "socket.io-client";
import { useSyncExternalStore } from "react";
import type {
  Ack,
  ChatMessage,
  ClientToServerEvents,
  RoomCode,
  RoomState,
  ServerToClientEvents,
} from "@guessdrawing/shared";
import { DrawingStore } from "./drawing-store";
import { getSessionToken } from "./session";

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface ClientSnapshot {
  connected: boolean;
  /** True once we lost the connection while in a room. */
  reconnecting: boolean;
  room: RoomState | null;
  messages: ChatMessage[];
}

const MAX_MESSAGES = 150;

function serverUrl(): string {
  if (process.env.NEXT_PUBLIC_SERVER_URL) return process.env.NEXT_PUBLIC_SERVER_URL;
  // Handy for testing on a phone in the same network.
  return `${window.location.protocol}//${window.location.hostname}:4000`;
}

class GameClient {
  readonly socket: ClientSocket;
  readonly drawing = new DrawingStore();
  private snapshot: ClientSnapshot = { connected: false, reconnecting: false, room: null, messages: [] };
  private readonly listeners = new Set<() => void>();
  /** The room we want to be in, so we can rejoin automatically after a reconnect. */
  private target: { code: RoomCode; name: string } | null = null;

  constructor() {
    this.socket = io(serverUrl(), { autoConnect: true, transports: ["websocket", "polling"] });

    this.socket.on("connect", () => {
      this.update({ connected: true });
      if (this.target) {
        void this.join(this.target.code, this.target.name).then((res) => {
          if (!res.ok) {
            this.target = null;
            this.update({ room: null, reconnecting: false });
          }
        });
      }
    });
    this.socket.on("disconnect", () => {
      this.update({ connected: false, reconnecting: this.target !== null });
    });
    this.socket.on("room:state", (room) => {
      this.update({ room, reconnecting: false });
    });
    this.socket.on("draw:sync", (strokes) => this.drawing.reset(strokes));
    this.socket.on("draw:begin", (stroke) => this.drawing.begin(stroke));
    this.socket.on("draw:points", ({ id, points }) => this.drawing.append(id, points));
    this.socket.on("draw:remove", (id) => this.drawing.remove(id));
    this.socket.on("draw:clear", () => this.drawing.clear());
    this.socket.on("chat:message", (message) => {
      const messages = [...this.snapshot.messages, message].slice(-MAX_MESSAGES);
      this.update({ messages });
    });
  }

  private update(patch: Partial<ClientSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.listeners) l();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): ClientSnapshot => this.snapshot;

  /** Join a room by code, or create a new one when no code is given. */
  join(code: RoomCode | undefined, name: string): Promise<Ack<{ code: RoomCode }>> {
    return new Promise((resolve) => {
      const switching = this.snapshot.room && this.snapshot.room.code !== code;
      if (switching) {
        this.update({ room: null, messages: [] });
        this.drawing.clear();
      }
      this.socket
        .timeout(8000)
        .emit("room:join", { code, name, sessionToken: getSessionToken() }, (err, res) => {
          if (err) {
            resolve({ ok: false, error: "NOT_ALLOWED", message: "Server reageert niet" });
            return;
          }
          if (res.ok) this.target = { code: res.data.code, name };
          resolve(res);
        });
    });
  }

  leave(): void {
    this.target = null;
    this.socket.emit("room:leave");
    this.update({ room: null, messages: [], reconnecting: false });
    this.drawing.clear();
  }

  sendChat(text: string): void {
    this.socket.emit("chat:send", text);
  }
}

let client: GameClient | null = null;

export function getGameClient(): GameClient {
  if (typeof window === "undefined") throw new Error("GameClient is browser-only");
  client ??= new GameClient();
  return client;
}

const serverSnapshot: ClientSnapshot = { connected: false, reconnecting: false, room: null, messages: [] };

export function useGameClient(): ClientSnapshot {
  return useSyncExternalStore(
    (l) => getGameClient().subscribe(l),
    () => getGameClient().getSnapshot(),
    () => serverSnapshot,
  );
}
