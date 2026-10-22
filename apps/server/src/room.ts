import { randomInt, randomUUID } from "node:crypto";
import {
  CHOOSE_WORD_MS,
  DRAWER_AWAY_MS,
  DRAW_TIME_MS,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  RECONNECT_GRACE_MS,
  TOTAL_ROUNDS,
  TURN_END_MS,
  WORD_CHOICES,
  levenshtein,
  normalizeGuess,
  type ChatMessage,
  type GamePhase,
  type PlayerId,
  type PlayerInfo,
  type Point,
  type RoomCode,
  type RoomState,
  type TurnEndReason,
} from "@guessdrawing/shared";
import { Drawing, parsePoints, parseStroke } from "./drawing.js";
import { drawerPoints, guessPoints } from "./scoring.js";
import type { GameSocket, IO } from "./types.js";
import { WORDS, hintCount, letterIndexes, maskWord, pickWords } from "./words.js";

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

export type JoinResult = { ok: true; player: Player; rejoined: boolean } | { ok: false; error: "ROOM_FULL" };

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

export class Room {
  readonly players = new Map<PlayerId, Player>();
  hostId: PlayerId | null = null;
  readonly drawing = new Drawing();

  phase: GamePhase = "lobby";
  round = 0;
  turn: Turn | null = null;
  /** Players who already drew this round. */
  private drawnThisRound = new Set<PlayerId>();
  private usedWords = new Set<string>();

  /** The one timer that ends the current phase. */
  private phaseTimer: NodeJS.Timeout | null = null;
  private phaseEndsAt: number | null = null;
  private phaseDurationMs: number | null = null;
  private hintTimers: NodeJS.Timeout[] = [];
  private drawerAwayTimer: NodeJS.Timeout | null = null;

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

  get inGame(): boolean {
    return this.phase === "choosing" || this.phase === "drawing" || this.phase === "turnEnd";
  }

  findByToken(token: string): Player | undefined {
    for (const p of this.players.values()) if (p.token === token) return p;
    return undefined;
  }

  // =========================================================================
  // Joining, leaving, reconnecting
  // =========================================================================

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
      if (this.turn?.drawerId === existing.id && this.drawerAwayTimer) {
        clearTimeout(this.drawerAwayTimer);
        this.drawerAwayTimer = null;
      }
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
    this.broadcastState();
    return { ok: true, player, rejoined: false };
  }

  private attachSocket(socket: GameSocket, player: Player): void {
    socket.data.roomCode = this.code;
    socket.data.playerId = player.id;
    void socket.join(this.code);
    socket.emit("draw:sync", this.drawing.snapshot());
  }

  /** Socket dropped: keep the seat for a while so the player can come back. */
  handleDisconnect(socket: GameSocket): void {
    const player = this.playerForSocket(socket);
    if (!player) return;
    player.socketId = null;
    player.disconnectTimer = setTimeout(() => this.removePlayer(player.id), this.options.reconnectGraceMs);
    this.armDrawerAwayTimer();
    this.broadcastState();
  }

  /** If the drawer is offline, skip their turn unless they come back soon. */
  private armDrawerAwayTimer(): void {
    const drawer = this.turn ? this.players.get(this.turn.drawerId) : undefined;
    if (!drawer || drawer.socketId || this.drawerAwayTimer) return;
    if (this.phase !== "choosing" && this.phase !== "drawing") return;
    this.drawerAwayTimer = setTimeout(() => {
      this.drawerAwayTimer = null;
      this.systemMessage(`${drawer.name} is weg, de beurt wordt overgeslagen`);
      this.endTurn("drawerLeft");
    }, this.options.drawerAwayMs);
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
    this.drawnThisRound.delete(id);
    if (this.players.size === 0) {
      this.dispose();
      this.onEmpty(this);
      return;
    }
    this.systemMessage(`${player.name} heeft de kamer verlaten`);
    if (this.hostId === id) {
      // Prefer a connected player as the new host.
      const next = [...this.players.values()].find((p) => p.socketId) ?? this.players.values().next().value!;
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
  // Game flow: lobby -> (choosing -> drawing -> turnEnd)* -> gameEnd
  // =========================================================================

  startGame(socket: GameSocket): boolean {
    const player = this.playerForSocket(socket);
    if (!player || player.id !== this.hostId || this.phase !== "lobby") return false;
    const connected = [...this.players.values()].filter((p) => p.socketId).length;
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
  resetGame(socket: GameSocket): void {
    const player = this.playerForSocket(socket);
    if (!player || player.id !== this.hostId || this.phase !== "gameEnd") return;
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
    let drawer = [...this.players.values()].find((p) => !this.drawnThisRound.has(p.id) && p.socketId);
    if (!drawer) {
      this.round++;
      this.drawnThisRound.clear();
      if (this.round > this.options.rounds) return this.endGame();
      this.systemMessage(`Ronde ${this.round}`);
      drawer = [...this.players.values()].find((p) => p.socketId);
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

  handleChoose(socket: GameSocket, index: unknown): void {
    const player = this.playerForSocket(socket);
    if (!player || this.phase !== "choosing" || this.turn?.drawerId !== player.id) return;
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
    {
      const prefix = reason === "allGuessed" ? "Iedereen heeft het geraden! " : reason === "timeUp" ? "De tijd is om! " : "";
      this.systemMessage(`${prefix}Het woord was: ${turn.word}`);
    }
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
    const guessers = [...this.players.values()].filter((p) => p.id !== turn.drawerId && p.socketId);
    return guessers.length > 0 && guessers.every((p) => turn.guessed.has(p.id));
  }

  // =========================================================================
  // Chat & guessing
  // =========================================================================

  handleChat(socket: GameSocket, text: string): void {
    const player = this.playerForSocket(socket);
    if (!player) return;
    const turn = this.turn;
    const message: ChatMessage = { id: randomUUID(), kind: "chat", playerId: player.id, name: player.name, text };

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
      this.sendTo(player, { id: randomUUID(), kind: "close", text: `"${text}" is bijna goed!` });
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

    this.broadcastChat({ id: randomUUID(), kind: "correct", text: `${player.name} heeft het woord geraden!` });
    this.sendTo(player, { id: randomUUID(), kind: "close", text: `Goed zo! Het woord is "${turn.word}" (+${points})` });

    if (this.everyoneGuessed()) this.endTurn("allGuessed");
    else this.broadcastState();
  }

  broadcastChat(message: ChatMessage): void {
    this.io.to(this.code).emit("chat:message", message);
  }

  private sendTo(player: Player, message: ChatMessage): void {
    if (player.socketId) this.io.to(player.socketId).emit("chat:message", message);
  }

  private sendToKnowers(message: ChatMessage): void {
    const turn = this.turn;
    if (!turn) return;
    for (const p of this.players.values()) {
      if (p.id === turn.drawerId || turn.guessed.has(p.id)) this.sendTo(p, message);
    }
  }

  systemMessage(text: string): void {
    this.broadcastChat({ id: randomUUID(), kind: "system", text });
  }

  // =========================================================================
  // Drawing
  // =========================================================================

  /** Who may draw right now. In the lobby everyone can doodle. */
  private canDraw(player: Player): boolean {
    if (this.phase === "lobby") return true;
    return this.phase === "drawing" && this.turn?.drawerId === player.id;
  }

  handleDrawBegin(socket: GameSocket, raw: unknown): void {
    const player = this.playerForSocket(socket);
    if (!player || !this.canDraw(player)) return;
    const stroke = parseStroke(raw);
    if (!stroke || !this.drawing.begin(player.id, stroke)) return;
    socket.to(this.code).emit("draw:begin", stroke);
  }

  handleDrawPoints(socket: GameSocket, raw: unknown): void {
    const player = this.playerForSocket(socket);
    if (!player || !this.canDraw(player) || !raw || typeof raw !== "object") return;
    const { id, points: rawPoints } = raw as { id?: unknown; points?: unknown };
    if (typeof id !== "string") return;
    const points: Point[] | null = parsePoints(rawPoints);
    if (!points || points.length === 0 || !this.drawing.append(player.id, id, points)) return;
    socket.to(this.code).emit("draw:points", { id, points });
  }

  handleUndo(socket: GameSocket): void {
    const player = this.playerForSocket(socket);
    if (!player || !this.canDraw(player)) return;
    const id = this.drawing.undo(player.id);
    if (id) this.io.to(this.code).emit("draw:remove", id);
  }

  handleClear(socket: GameSocket): void {
    const player = this.playerForSocket(socket);
    if (!player || !this.canDraw(player)) return;
    this.clearDrawing();
  }

  clearDrawing(): void {
    this.drawing.clear();
    this.io.to(this.code).emit("draw:clear");
  }

  // =========================================================================
  // State
  // =========================================================================

  private playerInfo(p: Player): PlayerInfo {
    const turn = this.turn;
    return {
      id: p.id,
      name: p.name,
      score: p.score,
      connected: p.socketId !== null,
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

  broadcastState(): void {
    for (const p of this.players.values()) {
      if (p.socketId) this.io.to(p.socketId).emit("room:state", this.stateFor(p));
    }
  }
}
