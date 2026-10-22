import type { Point, Stroke } from "./drawing";
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

  /** Host only. */
  "game:start": () => void;
  /** Drawer picks one of the offered words (by index). */
  "game:choose": (index: number) => void;
  /** Host only: back to the lobby after the game ended. */
  "game:reset": () => void;

  /** Start a new stroke (may already contain the first points). */
  "draw:begin": (stroke: Stroke) => void;
  /** Append points to a stroke started with draw:begin. */
  "draw:points": (payload: { id: string; points: Point[] }) => void;
  /** Remove your most recent stroke. */
  "draw:undo": () => void;
  "draw:clear": () => void;
}

export interface ServerToClientEvents {
  "room:state": (state: RoomState) => void;
  "chat:message": (message: ChatMessage) => void;

  "draw:begin": (stroke: Stroke) => void;
  "draw:points": (payload: { id: string; points: Point[] }) => void;
  "draw:remove": (strokeId: string) => void;
  "draw:clear": () => void;
  /** Full drawing, sent on (re)join so late joiners see the current picture. */
  "draw:sync": (strokes: Stroke[]) => void;
}
