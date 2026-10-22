import type { ChatMessage, ClientMessage, RoomState, ServerMessage, Stroke } from "@guessdrawing/shared";
import { Room, defaultRoomOptions, type Connection, type RoomOptions } from "../src/game/room.js";

/** In-memory stand-in for a WebSocket. */
export class FakeConn implements Connection {
  messages: ServerMessage[] = [];
  closed: { code?: number; reason?: string } | null = null;
  constructor(public room: Room) {}

  send(data: string): void {
    this.messages.push(JSON.parse(data) as ServerMessage);
  }
  close(code?: number, reason?: string): void {
    this.closed = { code, reason };
  }

  /** Client -> server. */
  emit(msg: ClientMessage | Record<string, unknown>): void {
    this.room.handleMessage(this, msg);
  }
  /** Simulates the socket dropping. */
  drop(): void {
    this.room.handleClose(this);
  }

  of<T extends ServerMessage["type"]>(type: T): Extract<ServerMessage, { type: T }>[] {
    return this.messages.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type);
  }
  get state(): RoomState {
    const s = this.of("state").at(-1);
    if (!s) throw new Error("no state received");
    return s.state;
  }
  get chat(): ChatMessage[] {
    return this.of("chat").map((m) => m.message);
  }
  get me() {
    return this.state.players.find((p) => p.id === this.state.you)!;
  }
}

export function makeRoom(opts: Partial<RoomOptions> = {}, onEmpty = () => {}) {
  const room = new Room("ABCDE", { ...defaultRoomOptions, ...opts }, onEmpty);
  const join = (name: string, token = `tok-${name}`) => {
    const conn = new FakeConn(room);
    room.connect(conn, name, token);
    return conn;
  };
  return { room, join };
}

export const stroke = (id: string, points: Stroke["points"] = [[0.1, 0.1]]): Stroke => ({
  id,
  tool: "pen",
  color: "#000000",
  size: 0.006,
  points,
});
