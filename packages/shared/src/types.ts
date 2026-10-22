export type RoomCode = string;
export type PlayerId = string;

export interface PlayerInfo {
  id: PlayerId;
  name: string;
  score: number;
  connected: boolean;
  isHost: boolean;
  isDrawing: boolean;
  /** Guessed the word this turn. */
  hasGuessed: boolean;
  /** Points earned in the current/last turn (shown at the end of a turn). */
  turnPoints: number;
}

export type GamePhase = "lobby" | "choosing" | "drawing" | "turnEnd" | "gameEnd";

export type TurnEndReason = "allGuessed" | "timeUp" | "drawerLeft";

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

  round: number;
  totalRounds: number;
  drawerId: PlayerId | null;
  /** Word mask like "k_t" — underscores for hidden letters. */
  hint: string | null;
  /** The real word: only for the drawer, players who guessed it, and after the turn. */
  word: string | null;
  /** Only for the drawer while choosing. */
  wordChoices: string[] | null;
  /** Milliseconds left in the current phase (choosing/drawing/turnEnd). */
  timeLeftMs: number | null;
  /** Total length of the current phase, for progress bars. */
  phaseDurationMs: number | null;
  turnEndReason: TurnEndReason | null;
}

/**
 * chat: normal message · system: notices · correct: someone guessed it ·
 * close: private "almost!" · secret: only visible to the drawer and players who guessed.
 */
export type ChatKind = "chat" | "system" | "correct" | "close" | "secret";

export interface ChatMessage {
  id: string;
  kind: ChatKind;
  playerId?: PlayerId;
  name?: string;
  text: string;
}
