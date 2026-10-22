import type { ChatMessage, RoomCode, RoomState } from "./types";

export type ErrorCode =
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "INVALID_NAME"
  | "NOT_IN_ROOM"
  | "NOT_ALLOWED";

export type Ack<T> =
  | { ok: true; data: T }
  | { ok: false; error: ErrorCode; message: string };

export interface JoinPayload {
  /** Leave empty to create a new room. */
  code?: RoomCode;
  name: string;
  /** Secret per browser tab, used to reclaim a seat after reconnecting. */
  sessionToken: string;
}

export interface ClientToServerEvents {
  "room:join": (payload: JoinPayload, ack: (res: Ack<{ code: RoomCode }>) => void) => void;
  "room:leave": () => void;
  "chat:send": (text: string) => void;
}

export interface ServerToClientEvents {
  "room:state": (state: RoomState) => void;
  "chat:message": (message: ChatMessage) => void;
}
