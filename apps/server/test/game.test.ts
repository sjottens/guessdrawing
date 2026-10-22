import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { guessPoints } from "../src/game/scoring.js";
import { hintCount, maskWord } from "../src/game/words.js";
import { makeRoom, stroke } from "./helpers.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const opts = { chooseMs: 15_000, drawMs: 80_000, turnEndMs: 5_000, rounds: 1, drawerAwayMs: 10_000, words: ["olifant", "giraf", "zebra"] };

function setup(n: number, o = opts) {
  const { join, room } = makeRoom(o);
  const players = Array.from({ length: n }, (_, i) => join(`P${i}`));
  return { room, players };
}

describe("game", () => {
  it("only the host can start, and needs two players", () => {
    const { players: [a, b] } = setup(2);
    b!.emit({ type: "start" });
    expect(a!.state.phase).toBe("lobby");
    a!.emit({ type: "start" });
    expect(a!.state.phase).toBe("choosing");

    const { players: [solo] } = setup(1);
    solo!.emit({ type: "start" });
    expect(solo!.state.phase).toBe("lobby");
  });

  it("plays a full turn: choose, hidden word, correct guess, points", () => {
    const { players: [a, b, c] } = setup(3);
    a!.emit({ type: "start" });
    expect(a!.state.drawerId).toBe(a!.state.you);
    expect(a!.state.wordChoices).toHaveLength(3);
    expect(b!.state.wordChoices).toBeNull();

    const choice = a!.state.wordChoices![1]!;
    a!.emit({ type: "choose", index: 1 });
    expect(a!.state.phase).toBe("drawing");
    expect(a!.state.word).toBe(choice);
    expect(b!.state.word).toBeNull();
    expect(b!.state.hint).toBe("_".repeat(choice.length));

    // Correct answer (case ignored) is not shown to others; faster = more points.
    vi.advanceTimersByTime(8_000);
    b!.emit({ type: "chat", text: choice.toUpperCase() });
    expect(c!.chat.some((m) => m.kind === "correct")).toBe(true);
    expect(c!.chat.some((m) => m.text.toLowerCase().includes(choice))).toBe(false);
    expect(b!.state.word).toBe(choice);
    expect(b!.me.hasGuessed).toBe(true);
    expect(b!.me.score).toBe(guessPoints(8_000, 80_000));

    // Players who know the word chat privately.
    b!.emit({ type: "chat", text: "makkelijk!" });
    expect(a!.chat.some((m) => m.kind === "secret" && m.text === "makkelijk!")).toBe(true);
    expect(c!.chat.some((m) => m.text === "makkelijk!")).toBe(false);

    // Near miss gives a private hint.
    c!.emit({ type: "chat", text: choice.slice(0, -1) });
    expect(c!.chat.some((m) => m.kind === "close")).toBe(true);
    expect(b!.chat.filter((m) => m.kind === "close").every((m) => !m.text.includes("bijna"))).toBe(true);

    // Last guesser -> turn ends early; drawer gets points per guesser.
    c!.emit({ type: "chat", text: choice });
    expect(a!.state.phase).toBe("turnEnd");
    expect(a!.state.turnEndReason).toBe("allGuessed");
    expect(a!.me.turnPoints).toBe(120);
    expect(c!.state.word).toBe(choice);
  });

  it("reveals hints over time but never the whole word", () => {
    const { players: [a, b] } = setup(2, { ...opts, words: ["olifant"] });
    a!.emit({ type: "start" });
    a!.emit({ type: "choose", index: 0 });
    expect(b!.state.hint).toBe("_______");
    vi.advanceTimersByTime(79_000);
    const hidden = [...b!.state.hint!].filter((ch) => ch === "_").length;
    expect(hidden).toBe(7 - hintCount("olifant"));
  });

  it("auto-picks a word, ends on time, rotates drawers and ends the game", () => {
    const { players: [a, b] } = setup(2);
    a!.emit({ type: "start" });
    const firstDrawer = a!.state.drawerId;
    vi.advanceTimersByTime(15_000);
    expect(a!.state.phase).toBe("drawing");
    vi.advanceTimersByTime(80_000);
    expect(a!.state.phase).toBe("turnEnd");
    expect(a!.state.turnEndReason).toBe("timeUp");
    vi.advanceTimersByTime(5_000);
    expect(b!.state.phase).toBe("choosing");
    expect(b!.state.drawerId).not.toBe(firstDrawer);
    vi.advanceTimersByTime(15_000 + 80_000 + 5_000);
    expect(a!.state.phase).toBe("gameEnd");

    a!.emit({ type: "reset" });
    expect(a!.state.phase).toBe("lobby");
    expect(a!.state.players.every((p) => p.score === 0)).toBe(true);
  });

  it("only the drawer may draw during a turn", () => {
    const { players: [a, b] } = setup(2);
    a!.emit({ type: "start" });
    a!.emit({ type: "choose", index: 0 });
    b!.emit({ type: "draw:begin", stroke: stroke("guesser") });
    a!.emit({ type: "draw:begin", stroke: stroke("drawer") });
    expect(b!.of("draw:begin").map((m) => m.stroke.id)).toEqual(["drawer"]);
    expect(a!.of("draw:begin")).toHaveLength(0);
  });

  it("skips the turn when the drawer is away too long", () => {
    const { players: [a, b, c] } = setup(3);
    a!.emit({ type: "start" });
    a!.emit({ type: "choose", index: 0 });
    a!.drop();
    vi.advanceTimersByTime(10_000);
    expect(b!.state.phase).toBe("turnEnd");
    expect(b!.state.turnEndReason).toBe("drawerLeft");
    vi.advanceTimersByTime(5_000);
    expect(c!.state.phase).toBe("choosing");
    expect(c!.state.drawerId).not.toBe(a!.state.you);
  });

  it("the drawer can come back in time and keep drawing", () => {
    const { room, players: [a, b] } = setup(2);
    a!.emit({ type: "start" });
    a!.emit({ type: "choose", index: 0 });
    a!.drop();
    vi.advanceTimersByTime(5_000);
    const a2 = new (a!.constructor as typeof import("./helpers.js").FakeConn)(room);
    room.connect(a2, "P0", "tok-P0");
    vi.advanceTimersByTime(10_000);
    expect(b!.state.phase).toBe("drawing");
    expect(a2.state.word).not.toBeNull();
  });

  it("goes back to the lobby when too few players remain", () => {
    const { players: [a, b] } = setup(2);
    a!.emit({ type: "start" });
    b!.emit({ type: "leave" });
    expect(a!.state.phase).toBe("lobby");
  });
});

describe("helpers", () => {
  it("scores faster guesses higher", () => {
    expect(guessPoints(0, 80_000)).toBe(500);
    expect(guessPoints(80_000, 80_000)).toBe(100);
    expect(guessPoints(40_000, 80_000)).toBe(300);
  });

  it("masks words and keeps spaces visible", () => {
    expect(maskWord("ijs beer", new Set([0]))).toBe("i__ ____");
    expect(hintCount("olifant")).toBe(2);
    expect(hintCount("ei")).toBe(0);
  });
});
