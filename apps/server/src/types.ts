import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, PlayerId, RoomCode, ServerToClientEvents } from "@guessdrawing/shared";

export interface SocketData {
  roomCode?: RoomCode;
  playerId?: PlayerId;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type InterServerEvents = {};

export type IO = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
