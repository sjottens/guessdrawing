import {
  CHOOSE_WORD_MS,
  DRAWER_AWAY_MS,
  DRAW_TIME_MS,
  MAX_CHAT_LENGTH,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  RECONNECT_GRACE_MS,
  TOTAL_ROUNDS,
  TURN_END_MS,
  WORD_CHOICES,
  levenshtein,
  normalizeGuess,
  sanitizeName,
  type ChatMessage,
  type ErrorCode,
  type GamePhase,
  type PlayerId,
  type PlayerInfo,
  type RoomCode,
  type RoomState,
  type ServerMessage,
  type TurnEndReason,
} from "@guessdrawing/shared";
import { Drawing, parsePoints, parseStroke } from "./drawing.js";
import { randomId, randomInt } from "./random.js";
import { drawerPoints, guessPoints } from "./scoring.js";
import { WORDS, hintCount, letterIndexes, maskWord, pickWords } from "./words.js";

/** One client connection. The room doesn't care whether it's a WebSocket or a test double. */
export interface Connection {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

type Timer = ReturnType<typeof setTimeout>;

export interface Player {
  id: PlayerId;
  name: string;
  /** Secret token from the client; lets a player reclaim their seat. */
  token: string;
  score: number;
  conn: Connection | null;
  disconnectTimer: Timer | null;
}

export interface RoomOptions {
  reconnectGraceMs: number;
  rounds: number;
  chooseMs: number;
  drawMs: number;
  turnEndMs: number;
  drawerAwayMs: number;
  words: readonly string[];
}

export const defaultRoomOptions: RoomOptions = {
  reconnectGraceMs: RECONNECT_GRACE_MS,
  rounds: TOTAL_ROUNDS,
  chooseMs: CHOOSE_WORD_MS,
  drawMs: DRAW_TIME_MS,
  turnEndMs: TURN_END_MS,
  drawerAwayMs: DRAWER_AWAY_MS,
  words: WORDS,
};

/** Everything that belongs to a single drawing turn. */
interface Turn {
  drawerId: PlayerId;
  choices: string[];
  word: string | null;
  revealed: Set<number>;
  guessed: Set<PlayerId>;
  points: Map<PlayerId, number>;
  drawStartedAt: number;
  endReason: TurnEndReason | null;
}

const errorText: Record<ErrorCode, string> = {
  ROOM_NOT_FOUND: "Deze kamer bestaat niet (meer)",
  ROOM_FULL: "Deze kamer zit vol",
  INVALID_NAME: "Kies eerst een naam",
  NOT_ALLOWED: "Ongeldige sessie",
};

export function errorMessage(error: ErrorCode): string {
  return JSON.stringify({ type: "error", error, message: errorText[error] } satisfies ServerMessage);
}

export class Room {
  readonly players = new Map<PlayerId, Player>();
  private readonly connections = new Map<Connection, PlayerId>();
  hostId: PlayerId | null = null;
  readonly drawing = new Drawing();

  phase: GamePhase = "lobby";
  round = 0;
  turn: Turn | null = null;
  /** Players who already drew this round. */
  private drawnThisRound = new Set<PlayerId>();
  private usedWords = new Set<string>();

  /** The one timer that ends the current phase. */
  private phaseTimer: Timer | null = null;
  private phaseEndsAt: number | null = null;
  private phaseDurationMs: number | null = null;
  private hintTimers: Timer[] = [];
  private drawerAwayTimer: Timer | null = null;

  constructor(
    readonly code: RoomCode,
    private readonly options: RoomOptions = defaultRoomOptions,
    /** Called when the last player is gone. */
    private readonly onEmpty: (room: Room) => void = () => {},
  ) {}

  get isEmpty(): boolean {
    return this.players.size === 0;
  }

  get inGame(): boolean {
    return this.phase === "choosing" || this.phase === "drawing" || this.phase === "turnEnd";
  }

  // =========================================================================
  // Connecting, leaving, reconnecting
  // =========================================================================

  /** A new connection wants to join. Returns false (and closes it) when refused. */
  connect(conn: Connection, rawName: unknown, rawToken: unknown): boolean {
    const name = sanitizeName(rawName);
    const token = typeof rawToken === "string" ? rawToken.slice(0, 100) : "";
    if (!name) return this.refuse(conn, "INVALID_NAME");
    if (!token) return this.refuse(conn, "NOT_ALLOWED");

    const existing = [...this.players.values()].find((p) => p.token === token);
    if (existing) {
      // Reconnect (or the same tab again): take over the seat.
      if (existing.conn && existing.conn !== conn) {
        this.connections.delete(existing.conn);
        existing.conn.close(4000, "Replaced by a newer connection");
      }
      if (existing.disconnectTimer) clearTimeout(existing.disconnectTimer);
      existing.disconnectTimer = null;
      const wasDisconnected = existing.conn === null;
      existing.conn = conn;
      existing.name = name;
      this.connections.set(conn, existing.id);
      this.sendTo(existing, { type: "draw:sync", strokes: this.drawing.snapshot() });
      if (wasDisconnected) this.systemMessage(`${existing.name} is terug`);
      if (this.turn?.drawerId === existing.id && this.drawerAwayTimer) {
        clearTimeout(this.drawerAwayTimer);
        this.drawerAwayTimer = null;
      }
      this.broadcastState();
      return true;
    }

    if (this.players.size >= MAX_PLAYERS) return this.refuse(conn, "ROOM_FULL");

    const player: Player = { id: randomId(), name, token, score: 0, conn, disconnectTimer: null };
    this.players.set(player.id, player);
    this.connections.set(conn, player.id);
    if (!this.hostId) this.hostId = player.id;
    this.sendTo(player, { type: "draw:sync", strokes: this.drawing.snapshot() });
    this.systemMessage(`${player.name} doet mee`);
    this.broadcastState();
    return true;
  }

  private refuse(conn: Connection, error: ErrorCode): false {
    conn.send(errorMessage(error));
    conn.close(4001, error);
    return false;
  }

  /** Connection dropped: keep the seat for a while so the player can come back. */
  handleClose(conn: Connection): void {
    const player = this.playerFor(conn);
    this.connections.delete(conn);
    if (!player) return;
    player.conn = null;
    player.disconnectTimer = setTimeout(() => this.removePlayer(player.id), this.options.reconnectGraceMs);
    this.armDrawerAwayTimer();
    this.broadcastState();
  }

  /** If the drawer is offline, skip their turn unless they come back soon. */
  private armDrawerAwayTimer(): void {
    const drawer = this.turn ? this.players.get(this.turn.drawerId) : undefined;
    if (!drawer || drawer.conn || this.drawerAwayTimer) return;
    if (this.phase !== "choosing" && this.phase !== "drawing") return;
    this.drawerAwayTimer = setTimeout(() => {
      this.drawerAwayTimer = null;
      this.systemMessage(`${drawer.name} is weg, de beurt wordt overgeslagen`);
      this.endTurn("drawerLeft");
    }, this.options.drawerAwayMs);
  }

  /** Player chose to leave: remove immediately. */
  private leave(player: Player): void {
    const conn = player.conn;
    if (conn) {
      this.connections.delete(conn);
      player.conn = null;
      conn.close(1000, "Left the room");
    }
    this.removePlayer(player.id);
  }

  private playerFor(conn: Connection): Player | undefined {
    const id = this.connections.get(conn);
    const player = id ? this.players.get(id) : undefined;
    return player && player.conn === conn ? player : undefined;
  }

  removePlayer(id: PlayerId): void {
    const player = this.players.get(id);
    if (!player) return;
    if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    this.players.delete(id);
    this.drawnThisRound.delete(id);
    if (this.players.size === 0) {
      this.dispose();
      this.onEmpty(this);
      return;
    }
    this.systemMessage(`${player.name} heeft de kamer verlaten`);
    if (this.hostId === id) {
      // Prefer a connected player as the new host.
      const next = [...this.players.values()].find((p) => p.conn) ?? this.players.values().next().value!;
      this.hostId = next.id;
      this.systemMessage(`${next.name} is nu de host`);
    }

    if (this.inGame && this.players.size < MIN_PLAYERS_TO_START) {
      this.systemMessage("Te weinig spelers over, terug naar de lobby");
      this.toLobby();
      return;
    }
    if (this.turn && this.turn.drawerId === id && (this.phase === "choosing" || this.phase === "drawing")) {
      this.endTurn("drawerLeft");
      return;
    }
    if (this.phase === "drawing" && this.everyoneGuessed()) {
      this.endTurn("allGuessed");
      return;
    }
    this.broadcastState();
  }

  dispose(): void {
    this.clearTimers();
    for (const p of this.players.values()) if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
  }

  // =========================================================================
  // Incoming messages
  // =========================================================================

  /** Handles one (untrusted) message from a client. */
  handleMessage(conn: Connection, raw: unknown): void {
    const player = this.playerFor(conn);
    if (!player || !raw || typeof raw !== "object") return;
    const msg = raw as Record<string, unknown>;
    switch (msg.type) {
      case "ping":
        conn.send(JSON.stringify({ type: "pong" } satisfies ServerMessage));
        return;
      case "chat":
        return this.handleChat(player, msg.text);
      case "start":
        return void this.startGame(player);
      case "choose":
        return this.handleChoose(player, msg.index);
      case "reset":
        return this.resetGame(player);
      case "draw:begin":
        return this.handleDrawBegin(player, msg.stroke);
      case "draw:points":
        return this.handleDrawPoints(player, msg.id, msg.points);
      case "draw:undo":
        return this.handleUndo(player);
      case "draw:clear":
        return this.handleClear(player);
      case "leave":
        return this.leave(player);
    }
  }

  // =========================================================================
  // Game flow: lobby -> (choosing -> drawing -> turnEnd)* -> gameEnd
  // =========================================================================

  private startGame(player: Player): boolean {
    if (player.id !== this.hostId || this.phase !== "lobby") return false;
    const connected = [...this.players.values()].filter((p) => p.conn).length;
    if (connected < MIN_PLAYERS_TO_START) return false;

    for (const p of this.players.values()) p.score = 0;
    this.round = 1;
    this.drawnThisRound.clear();
    this.usedWords.clear();
    this.systemMessage("Het spel begint! Ronde 1");
    this.nextTurn();
    return true;
  }

  /** Host: back to the lobby after the scoreboard. */
  private resetGame(player: Player): void {
    if (player.id !== this.hostId || this.phase !== "gameEnd") return;
    this.toLobby();
  }

  private toLobby(): void {
    this.clearTimers();
    this.phase = "lobby";
    this.round = 0;
    this.turn = null;
    for (const p of this.players.values()) p.score = 0;
    this.clearDrawing();
    this.broadcastState();
  }

  private nextTurn(): void {
    // The next player in join order who hasn't drawn yet this round.
    // Players who join mid-round simply get a turn later in the round.
    let drawer = [...this.players.values()].find((p) => !this.drawnThisRound.has(p.id) && p.conn);
    if (!drawer) {
      this.round++;
      this.drawnThisRound.clear();
      if (this.round > this.options.rounds) return this.endGame();
      this.systemMessage(`Ronde ${this.round}`);
      drawer = [...this.players.values()].find((p) => p.conn);
      if (!drawer) return this.endGame();
    }
    this.drawnThisRound.add(drawer.id);

    const choices = pickWords(WORD_CHOICES, this.usedWords, this.options.words);
    this.turn = {
      drawerId: drawer.id,
      choices,
      word: null,
      revealed: new Set(),
      guessed: new Set(),
      points: new Map(),
      drawStartedAt: 0,
      endReason: null,
    };
    this.clearDrawing();
    this.setPhase("choosing", this.options.chooseMs, () => this.chooseWord(randomInt(choices.length)));
    this.systemMessage(`${drawer.name} kiest een woord…`);
    this.broadcastState();
  }

  private handleChoose(player: Player, index: unknown): void {
    if (this.phase !== "choosing" || this.turn?.drawerId !== player.id) return;
    if (typeof index !== "number" || !Number.isInteger(index) || !this.turn.choices[index]) return;
    this.chooseWord(index);
  }

  private chooseWord(index: number): void {
    const turn = this.turn;
    if (!turn) return;
    const word = turn.choices[index]!;
    turn.word = word;
    turn.drawStartedAt = Date.now();
    this.usedWords.add(word);

    this.setPhase("drawing", this.options.drawMs, () => this.endTurn("timeUp"));
    this.scheduleHints(word);
    this.armDrawerAwayTimer();
    const drawer = this.players.get(turn.drawerId);
    this.systemMessage(`${drawer?.name ?? "De tekenaar"} is aan het tekenen!`);
    this.broadcastState();
  }

  /** Reveal a few letters spread over the second part of the turn. */
  private scheduleHints(word: string): void {
    const n = hintCount(word);
    for (let k = 0; k < n; k++) {
      const at = this.options.drawMs * (0.3 + (0.55 * k) / Math.max(1, n - 1));
      this.hintTimers.push(
        setTimeout(() => {
          const turn = this.turn;
          if (!turn || this.phase !== "drawing") return;
          const hidden = letterIndexes(word).filter((i) => !turn.revealed.has(i));
          // Always keep at least two letters hidden.
          if (hidden.length <= 2) return;
          turn.revealed.add(hidden[randomInt(hidden.length)]!);
          this.broadcastState();
        }, at),
      );
    }
  }

  private endTurn(reason: TurnEndReason): void {
    const turn = this.turn;
    if (!turn || (this.phase !== "choosing" && this.phase !== "drawing")) return;
    turn.endReason = reason;
    if (!turn.word) {
      // Nothing was drawn yet (drawer left while choosing): go straight on.
      this.clearTimers();
      this.nextTurn();
      return;
    }
    const prefix = reason === "allGuessed" ? "Iedereen heeft het geraden! " : reason === "timeUp" ? "De tijd is om! " : "";
    this.systemMessage(`${prefix}Het woord was: ${turn.word}`);
    this.setPhase("turnEnd", this.options.turnEndMs, () => this.nextTurn());
    this.broadcastState();
  }

  private endGame(): void {
    this.clearTimers();
    this.phase = "gameEnd";
    this.turn = null;
    const ranking = [...this.players.values()].sort((a, b) => b.score - a.score);
    const top = ranking[0];
    if (top) {
      const winners = ranking.filter((p) => p.score === top.score).map((p) => p.name);
      this.systemMessage(
        winners.length > 1 ? `Gelijkspel tussen ${winners.join(" en ")}!` : `${top.name} wint met ${top.score} punten!`,
      );
    }
    this.broadcastState();
  }

  private setPhase(phase: GamePhase, durationMs: number, onTimeout: () => void): void {
    this.clearTimers();
    this.phase = phase;
    this.phaseDurationMs = durationMs;
    this.phaseEndsAt = Date.now() + durationMs;
    this.phaseTimer = setTimeout(onTimeout, durationMs);
  }

  private clearTimers(): void {
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    if (this.drawerAwayTimer) clearTimeout(this.drawerAwayTimer);
    for (const t of this.hintTimers) clearTimeout(t);
    this.phaseTimer = null;
    this.drawerAwayTimer = null;
    this.hintTimers = [];
    this.phaseEndsAt = null;
    this.phaseDurationMs = null;
  }

  private everyoneGuessed(): boolean {
    const turn = this.turn;
    if (!turn) return false;
    const guessers = [...this.players.values()].filter((p) => p.id !== turn.drawerId && p.conn);
    return guessers.length > 0 && guessers.every((p) => turn.guessed.has(p.id));
  }

  // =========================================================================
  // Chat & guessing
  // =========================================================================

  private handleChat(player: Player, raw: unknown): void {
    if (typeof raw !== "string") return;
    const text = raw.replace(/\s+/g, " ").trim().slice(0, MAX_CHAT_LENGTH);
    if (!text) return;
    const turn = this.turn;
    const message: ChatMessage = { id: randomId(), kind: "chat", playerId: player.id, name: player.name, text };

    if (this.phase !== "drawing" || !turn?.word) {
      this.broadcastChat(message);
      return;
    }

    // The drawer and players who already know the word chat in a private channel.
    if (player.id === turn.drawerId || turn.guessed.has(player.id)) {
      this.sendToKnowers({ ...message, kind: "secret" });
      return;
    }

    const guess = normalizeGuess(text);
    const answer = normalizeGuess(turn.word);
    if (guess === answer) {
      this.registerCorrectGuess(player, turn);
      return;
    }

    this.broadcastChat(message);
    if (answer.length >= 4 && levenshtein(guess, answer) === 1) {
      this.sendChat(player, { id: randomId(), kind: "close", text: `"${text}" is bijna goed!` });
    }
  }

  private registerCorrectGuess(player: Player, turn: Turn): void {
    const points = guessPoints(Date.now() - turn.drawStartedAt, this.options.drawMs);
    turn.guessed.add(player.id);
    turn.points.set(player.id, points);
    player.score += points;

    const drawer = this.players.get(turn.drawerId);
    if (drawer) {
      const bonus = drawerPoints();
      drawer.score += bonus;
      turn.points.set(drawer.id, (turn.points.get(drawer.id) ?? 0) + bonus);
    }

    this.broadcastChat({ id: randomId(), kind: "correct", text: `${player.name} heeft het woord geraden!` });
    this.sendChat(player, { id: randomId(), kind: "close", text: `Goed zo! Het woord is "${turn.word}" (+${points})` });

    if (this.everyoneGuessed()) this.endTurn("allGuessed");
    else this.broadcastState();
  }

  private broadcastChat(message: ChatMessage): void {
    this.broadcast({ type: "chat", message });
  }

  private sendChat(player: Player, message: ChatMessage): void {
    this.sendTo(player, { type: "chat", message });
  }

  private sendToKnowers(message: ChatMessage): void {
    const turn = this.turn;
    if (!turn) return;
    for (const p of this.players.values()) {
      if (p.id === turn.drawerId || turn.guessed.has(p.id)) this.sendChat(p, message);
    }
  }

  private systemMessage(text: string): void {
    this.broadcastChat({ id: randomId(), kind: "system", text });
  }

  // =========================================================================
  // Drawing
  // =========================================================================

  /** Who may draw right now. In the lobby everyone can doodle. */
  private canDraw(player: Player): boolean {
    if (this.phase === "lobby") return true;
    return this.phase === "drawing" && this.turn?.drawerId === player.id;
  }

  private handleDrawBegin(player: Player, raw: unknown): void {
    if (!this.canDraw(player)) return;
    const stroke = parseStroke(raw);
    if (!stroke || !this.drawing.begin(player.id, stroke)) return;
    this.broadcast({ type: "draw:begin", stroke }, player);
  }

  private handleDrawPoints(player: Player, id: unknown, rawPoints: unknown): void {
    if (!this.canDraw(player) || typeof id !== "string") return;
    const points = parsePoints(rawPoints);
    if (!points || points.length === 0 || !this.drawing.append(player.id, id, points)) return;
    this.broadcast({ type: "draw:points", id, points }, player);
  }

  private handleUndo(player: Player): void {
    if (!this.canDraw(player)) return;
    const id = this.drawing.undo(player.id);
    if (id) this.broadcast({ type: "draw:remove", id });
  }

  private handleClear(player: Player): void {
    if (!this.canDraw(player)) return;
    this.clearDrawing();
  }

  private clearDrawing(): void {
    this.drawing.clear();
    this.broadcast({ type: "draw:clear" });
  }

  // =========================================================================
  // Sending
  // =========================================================================

  private sendTo(player: Player, message: ServerMessage): void {
    player.conn?.send(JSON.stringify(message));
  }

  /** Send to every connected player, optionally skipping one. */
  private broadcast(message: ServerMessage, except?: Player): void {
    const data = JSON.stringify(message);
    for (const p of this.players.values()) if (p !== except) p.conn?.send(data);
  }

  private playerInfo(p: Player): PlayerInfo {
    const turn = this.turn;
    return {
      id: p.id,
      name: p.name,
      score: p.score,
      connected: p.conn !== null,
      isHost: p.id === this.hostId,
      isDrawing: turn?.drawerId === p.id && this.phase !== "gameEnd",
      hasGuessed: turn?.guessed.has(p.id) ?? false,
      turnPoints: turn?.points.get(p.id) ?? 0,
    };
  }

  stateFor(player: Player): RoomState {
    const turn = this.turn;
    const isDrawer = turn?.drawerId === player.id;
    const knowsWord = isDrawer || (turn?.guessed.has(player.id) ?? false) || this.phase === "turnEnd";
    return {
      code: this.code,
      phase: this.phase,
      hostId: this.hostId ?? "",
      players: [...this.players.values()].map((p) => this.playerInfo(p)),
      maxPlayers: MAX_PLAYERS,
      you: player.id,
      round: this.round,
      totalRounds: this.options.rounds,
      drawerId: this.inGame ? (turn?.drawerId ?? null) : null,
      hint: turn?.word && this.phase === "drawing" ? maskWord(turn.word, turn.revealed) : null,
      word: turn?.word && knowsWord ? turn.word : null,
      wordChoices: isDrawer && this.phase === "choosing" ? (turn?.choices ?? null) : null,
      timeLeftMs: this.phaseEndsAt ? Math.max(0, this.phaseEndsAt - Date.now()) : null,
      phaseDurationMs: this.phaseDurationMs,
      turnEndReason: this.phase === "turnEnd" ? (turn?.endReason ?? null) : null,
    };
  }

  /** Every player gets their own copy, so secrets (the word) never leak. */
  private broadcastState(): void {
    for (const p of this.players.values()) this.sendTo(p, { type: "state", state: this.stateFor(p) });
  }
}
