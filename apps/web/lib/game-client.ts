"use client";

import { useSyncExternalStore } from "react";
import {
  CONNECTION_TIMEOUT_MS,
  PING_INTERVAL_MS,
  type ChatMessage,
  type ClientMessage,
  type CreateRoomRequest,
  type CreateRoomResponse,
  type ErrorCode,
  type Lang,
  type RoomCode,
  type RoomState,
  type ServerMessage,
} from "@guessdrawing/shared";
import { DrawingStore } from "./drawing-store";
import { getSessionToken } from "./session";

export interface ClientSnapshot {
  /** True once we lost the connection while in a room. */
  reconnecting: boolean;
  room: RoomState | null;
  messages: ChatMessage[];
}

/** Failures as codes, so the UI can show them in the player's language (see i18n `error.*`). */
export type ClientError = "createFailed" | "unreachable" | "noRoom" | "noResponse" | "connectFailed" | ErrorCode;

export type Result<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: ClientError; params?: Record<string, string | number> };

const MAX_MESSAGES = 150;
const JOIN_TIMEOUT_MS = 8_000;
const MAX_RECONNECT_DELAY_MS = 5_000;

function serverUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SERVER_URL?.trim();
  if (configured) {
    // Be forgiving: "guessdrawing.x.workers.dev", a trailing slash or "/health" all work.
    const withScheme = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`;
    return withScheme.replace(/\/health\/?$/i, "").replace(/\/+$/, "");
  }
  // Local development: the worker runs on port 8787 of the same host (also works from a phone on your network).
  return `${window.location.protocol}//${window.location.hostname}:8787`;
}

function socketUrl(code: RoomCode, name: string): string {
  const base = serverUrl().replace(/^http/, "ws");
  const params = new URLSearchParams({ name, token: getSessionToken() });
  return `${base}/rooms/${encodeURIComponent(code)}/ws?${params}`;
}

class GameClient {
  readonly drawing = new DrawingStore();
  private snapshot: ClientSnapshot = { reconnecting: false, room: null, messages: [] };
  private readonly listeners = new Set<() => void>();

  private ws: WebSocket | null = null;
  /** The room we want to be in, so we can rejoin automatically after a reconnect. */
  private target: { code: RoomCode; name: string } | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private lastMessageAt = 0;
  /** Whether we've been in the target room; only then do we retry on our own. */
  private joinedTarget = false;

  constructor() {
    // Phones suspend background tabs; reconnect right away when the player comes back.
    const wake = () => {
      if (document.visibilityState === "visible") this.ensureConnected();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", () => this.ensureConnected());
  }

  // ---- store for React ----

  private update(patch: Partial<ClientSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.listeners) l();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): ClientSnapshot => this.snapshot;

  // ---- rooms ----

  /** `lang` picks the language of the words to draw in this room. */
  async createRoom(lang: Lang): Promise<Result<{ code: RoomCode }>> {
    try {
      // A plain-text body keeps this a "simple" request: no CORS preflight round trip.
      const body: CreateRoomRequest = { lang };
      const res = await fetch(`${serverUrl()}/rooms`, { method: "POST", body: JSON.stringify(body) });
      if (!res.ok) return { ok: false, error: "createFailed", params: { status: res.status, url: serverUrl() } };
      const { code } = (await res.json()) as CreateRoomResponse;
      return { ok: true, data: { code } };
    } catch {
      return { ok: false, error: "unreachable" };
    }
  }

  /** Connects to a room. Resolves once the server accepted (or refused) us. */
  join(code: RoomCode, name: string): Promise<Result> {
    if (this.snapshot.room && this.snapshot.room.code !== code) {
      this.update({ room: null, messages: [] });
      this.drawing.clear();
    }
    this.target = { code, name };
    this.joinedTarget = false;
    this.reconnectAttempts = 0;
    return this.open();
  }

  leave(): void {
    this.target = null;
    this.send({ type: "leave" });
    this.closeSocket();
    this.update({ room: null, messages: [], reconnecting: false });
    this.drawing.clear();
  }

  send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }

  sendChat(text: string): void {
    this.send({ type: "chat", text });
  }

  // ---- connection handling ----

  private open(): Promise<Result> {
    const target = this.target;
    if (!target) return Promise.resolve({ ok: false, error: "noRoom" });
    this.closeSocket();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;

    return new Promise((resolve) => {
      let settled = false;
      const settle = (r: Result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(r);
      };
      const timeout = setTimeout(() => {
        settle({ ok: false, error: "noResponse" });
        ws.close();
      }, JOIN_TIMEOUT_MS);

      let ws: WebSocket;
      try {
        ws = new WebSocket(socketUrl(target.code, target.name));
      } catch {
        settle({ ok: false, error: "unreachable" });
        return;
      }
      this.ws = ws;
      let refused = false;

      ws.onopen = () => {
        this.lastMessageAt = Date.now();
        this.startPing();
      };

      ws.onmessage = (event) => {
        if (this.ws !== ws) return;
        this.lastMessageAt = Date.now();
        let msg: ServerMessage;
        try {
          msg = JSON.parse(event.data as string) as ServerMessage;
        } catch {
          return;
        }
        if (msg.type === "error") {
          // The room is gone or full: stop trying.
          refused = true;
          this.target = null;
          this.update({ room: null, reconnecting: false });
          settle({ ok: false, error: msg.error });
          return;
        }
        if (msg.type === "state") {
          this.reconnectAttempts = 0;
          this.joinedTarget = true;
          settle({ ok: true, data: undefined });
        }
        this.handle(msg);
      };

      ws.onclose = () => {
        if (this.ws !== ws) return;
        this.ws = null;
        this.stopPing();
        settle({ ok: false, error: "connectFailed" });
        if (!refused && this.target && this.joinedTarget) this.scheduleReconnect();
        else if (!this.joinedTarget) this.target = null;
      };
    });
  }

  private handle(msg: ServerMessage): void {
    switch (msg.type) {
      case "state":
        return this.update({ room: msg.state, reconnecting: false });
      case "chat":
        return this.update({ messages: [...this.snapshot.messages, msg.message].slice(-MAX_MESSAGES) });
      case "draw:sync":
        return this.drawing.reset(msg.strokes);
      case "draw:begin":
        return this.drawing.begin(msg.stroke);
      case "draw:points":
        return this.drawing.append(msg.id, msg.points);
      case "draw:remove":
        return this.drawing.remove(msg.id);
      case "draw:clear":
        return this.drawing.clear();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.update({ reconnecting: true });
    const delay = Math.min(MAX_RECONNECT_DELAY_MS, 500 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.open();
    }, delay);
  }

  /** Reconnect now if we should be in a room but aren't connected. */
  private ensureConnected(): void {
    if (!this.target || !this.joinedTarget) return;
    const state = this.ws?.readyState;
    if (state === WebSocket.OPEN && Date.now() - this.lastMessageAt < CONNECTION_TIMEOUT_MS) return;
    if (state === WebSocket.CONNECTING) return;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    void this.open();
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      // No sign of life from the server for a while: assume the line is dead.
      if (Date.now() - this.lastMessageAt > CONNECTION_TIMEOUT_MS) {
        this.ws?.close();
        return;
      }
      this.send({ type: "ping" });
    }, PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  private closeSocket(): void {
    const ws = this.ws;
    this.ws = null;
    this.stopPing();
    if (ws && ws.readyState <= WebSocket.OPEN) ws.close(1000);
  }
}

let client: GameClient | null = null;

export function getGameClient(): GameClient {
  if (typeof window === "undefined") throw new Error("GameClient is browser-only");
  client ??= new GameClient();
  return client;
}

const serverSnapshot: ClientSnapshot = { reconnecting: false, room: null, messages: [] };

export function useGameClient(): ClientSnapshot {
  return useSyncExternalStore(
    (l) => getGameClient().subscribe(l),
    () => getGameClient().getSnapshot(),
    () => serverSnapshot,
  );
}
