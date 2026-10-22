import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, type RoomCode } from "@guessdrawing/shared";
import { randomInt } from "node:crypto";
import { Room, defaultRoomOptions, type RoomOptions } from "./room.js";
import type { IO } from "./types.js";

export class RoomManager {
  private readonly rooms = new Map<RoomCode, Room>();

  constructor(
    private readonly io: IO,
    private readonly options: RoomOptions = defaultRoomOptions,
  ) {}

  get(code: RoomCode): Room | undefined {
    return this.rooms.get(code);
  }

  get size(): number {
    return this.rooms.size;
  }

  create(): Room {
    let code: string;
    do {
      code = Array.from({ length: ROOM_CODE_LENGTH }, () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)]).join("");
    } while (this.rooms.has(code));
    const room = new Room(code, this.io, this.options, (r) => this.rooms.delete(r.code));
    this.rooms.set(code, room);
    return room;
  }
}
