import { randomUUID } from "node:crypto";
import {
  MAX_PLAYERS,
  RECONNECT_GRACE_MS,
  type ChatMessage,
  type PlayerId,
  type PlayerInfo,
  type RoomCode,
  type RoomState,
} from "@guessdrawing/shared";
import type { GameSocket, IO } from "./types.js";

export interface Player {
  id: PlayerId;
  name: string;
  /** Secret token from the client; lets a player reclaim their seat. */
  token: string;
  score: number;
  socketId: string | null;
  disconnectTimer: NodeJS.Timeout | null;
}

export interface RoomOptions {
  reconnectGraceMs: number;
}

export const defaultRoomOptions: RoomOptions = {
  reconnectGraceMs: RECONNECT_GRACE_MS,
};

export type JoinResult =
  | { ok: true; player: Player; rejoined: boolean }
  | { ok: false; error: "ROOM_FULL" };

export class Room {
  readonly players = new Map<PlayerId, Player>();
  hostId: PlayerId | null = null;

  constructor(
    readonly code: RoomCode,
    protected readonly io: IO,
    protected readonly options: RoomOptions,
    /** Called when the last player is gone, so the manager can drop the room. */
    private readonly onEmpty: (room: Room) => void,
  ) {}

  get isEmpty(): boolean {
    return this.players.size === 0;
  }

  findByToken(token: string): Player | undefined {
    for (const p of this.players.values()) if (p.token === token) return p;
    return undefined;
  }

  join(socket: GameSocket, name: string, token: string): JoinResult {
    const existing = this.findByToken(token);
    if (existing) {
      // Reconnect (or second join from the same tab): take over the seat.
      if (existing.socketId && existing.socketId !== socket.id) {
        this.io.sockets.sockets.get(existing.socketId)?.leave(this.code);
      }
      if (existing.disconnectTimer) clearTimeout(existing.disconnectTimer);
      existing.disconnectTimer = null;
      const wasDisconnected = existing.socketId === null;
      existing.socketId = socket.id;
      existing.name = name;
      this.attachSocket(socket, existing);
      if (wasDisconnected) this.systemMessage(`${existing.name} is terug`);
      this.onPlayerReconnected(existing);
      this.broadcastState();
      return { ok: true, player: existing, rejoined: true };
    }

    if (this.players.size >= MAX_PLAYERS) return { ok: false, error: "ROOM_FULL" };

    const player: Player = {
      id: randomUUID(),
      name,
      token,
      score: 0,
      socketId: socket.id,
      disconnectTimer: null,
    };
    this.players.set(player.id, player);
    if (!this.hostId) this.hostId = player.id;
    this.attachSocket(socket, player);
    this.systemMessage(`${player.name} doet mee`);
    this.onPlayerJoined(player);
    this.broadcastState();
    return { ok: true, player, rejoined: false };
  }

  private attachSocket(socket: GameSocket, player: Player): void {
    socket.data.roomCode = this.code;
    socket.data.playerId = player.id;
    void socket.join(this.code);
  }

  /** Socket dropped: keep the seat for a while so the player can come back. */
  handleDisconnect(socket: GameSocket): void {
    const player = this.playerForSocket(socket);
    if (!player) return;
    player.socketId = null;
    player.disconnectTimer = setTimeout(() => this.removePlayer(player.id), this.options.reconnectGraceMs);
    this.onPlayerDisconnected(player);
    this.broadcastState();
  }

  /** Player chose to leave: remove immediately. */
  leave(socket: GameSocket): void {
    const player = this.playerForSocket(socket);
    if (!player) return;
    void socket.leave(this.code);
    socket.data.roomCode = undefined;
    socket.data.playerId = undefined;
    this.removePlayer(player.id);
  }

  playerForSocket(socket: GameSocket): Player | undefined {
    const id = socket.data.playerId;
    if (!id || socket.data.roomCode !== this.code) return undefined;
    const player = this.players.get(id);
    return player && player.socketId === socket.id ? player : undefined;
  }

  removePlayer(id: PlayerId): void {
    const player = this.players.get(id);
    if (!player) return;
    if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    this.players.delete(id);
    if (this.players.size === 0) {
      this.dispose();
      this.onEmpty(this);
      return;
    }
    if (this.hostId === id) {
      // Prefer a connected player as the new host.
      const next = [...this.players.values()].find((p) => p.socketId) ?? this.players.values().next().value!;
      this.hostId = next.id;
      this.systemMessage(`${next.name} is nu de host`);
    }
    this.systemMessage(`${player.name} heeft de kamer verlaten`);
    this.onPlayerRemoved(player);
    this.broadcastState();
  }

  // Hooks for game logic.
  protected onPlayerJoined(_player: Player): void {}
  protected onPlayerReconnected(_player: Player): void {}
  protected onPlayerDisconnected(_player: Player): void {}
  protected onPlayerRemoved(_player: Player): void {}

  dispose(): void {
    for (const p of this.players.values()) if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
  }

  // ---- Chat ----

  handleChat(socket: GameSocket, text: string): void {
    const player = this.playerForSocket(socket);
    if (!player) return;
    this.broadcastChat({ id: randomUUID(), kind: "chat", playerId: player.id, name: player.name, text });
  }

  broadcastChat(message: ChatMessage): void {
    this.io.to(this.code).emit("chat:message", message);
  }

  systemMessage(text: string): void {
    this.broadcastChat({ id: randomUUID(), kind: "system", text });
  }

  // ---- State ----

  protected playerInfo(p: Player): PlayerInfo {
    return {
      id: p.id,
      name: p.name,
      score: p.score,
      connected: p.socketId !== null,
      isHost: p.id === this.hostId,
    };
  }

  protected stateFor(player: Player): RoomState {
    return {
      code: this.code,
      phase: "lobby",
      hostId: this.hostId ?? "",
      players: [...this.players.values()].map((p) => this.playerInfo(p)),
      maxPlayers: MAX_PLAYERS,
      you: player.id,
    };
  }

  broadcastState(): void {
    for (const p of this.players.values()) {
      if (p.socketId) this.io.to(p.socketId).emit("room:state", this.stateFor(p));
    }
  }
}
