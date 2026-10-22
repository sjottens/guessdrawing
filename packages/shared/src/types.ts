export type RoomCode = string;
export type PlayerId = string;

export interface PlayerInfo {
  id: PlayerId;
  name: string;
  score: number;
  connected: boolean;
  isHost: boolean;
}

export type GamePhase = "lobby";

/**
 * The room state as seen by one specific player. The server sends a
 * personalised copy to every player so secret info never leaks.
 */
export interface RoomState {
  code: RoomCode;
  phase: GamePhase;
  hostId: PlayerId;
  players: PlayerInfo[];
  maxPlayers: number;
  /** The id of the player receiving this state. */
  you: PlayerId;
}

export type ChatKind = "chat" | "system";

export interface ChatMessage {
  id: string;
  kind: ChatKind;
  playerId?: PlayerId;
  name?: string;
  text: string;
}
