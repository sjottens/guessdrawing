import type { Point, Stroke } from "./drawing";
import type { ChatMessage, RoomState } from "./types";

/*
 * Messages over the WebSocket, as JSON. Joining happens when the socket
 * opens: GET /rooms/:code/ws?name=...&token=...
 */

export type ErrorCode = "ROOM_NOT_FOUND" | "ROOM_FULL" | "INVALID_NAME" | "NOT_ALLOWED";

export type ClientMessage =
  | { type: "chat"; text: string }
  /** Host only. */
  | { type: "start" }
  /** Drawer picks one of the offered words (by index). */
  | { type: "choose"; index: number }
  /** Host only: back to the lobby after the game ended. */
  | { type: "reset" }
  /** Start a new stroke (may already contain the first points). */
  | { type: "draw:begin"; stroke: Stroke }
  /** Append points to a stroke started with draw:begin. */
  | { type: "draw:points"; id: string; points: Point[] }
  /** Remove your most recent stroke. */
  | { type: "draw:undo" }
  | { type: "draw:clear" }
  /** Leave the room for good (closing the socket alone keeps your seat for a while). */
  | { type: "leave" }
  | { type: "ping" };

export type ServerMessage =
  | { type: "state"; state: RoomState }
  | { type: "chat"; message: ChatMessage }
  | { type: "draw:begin"; stroke: Stroke }
  | { type: "draw:points"; id: string; points: Point[] }
  | { type: "draw:remove"; id: string }
  | { type: "draw:clear" }
  /** Full drawing, sent on (re)join so late joiners see the current picture. */
  | { type: "draw:sync"; strokes: Stroke[] }
  /** Join failed; the server closes the socket right after. */
  | { type: "error"; error: ErrorCode; message: string }
  | { type: "pong" };

/** Response of POST /rooms. */
export interface CreateRoomResponse {
  code: string;
}

/** Client sends a ping this often; the server drops sockets that stay silent much longer. */
export const PING_INTERVAL_MS = 10_000;
export const CONNECTION_TIMEOUT_MS = 25_000;
