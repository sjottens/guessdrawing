import { afterEach, describe, expect, it } from "vitest";
import type { ChatMessage, RoomState } from "@guessdrawing/shared";
import { join, startServer, waitFor, type TestClient } from "./helpers.js";
import { guessPoints } from "../src/scoring.js";
import { maskWord, hintCount } from "../src/words.js";

let server: Awaited<ReturnType<typeof startServer>>;
afterEach(async () => server?.close());

const fast = { chooseMs: 300, drawMs: 600, turnEndMs: 50, rounds: 1, drawerAwayMs: 100, words: ["olifant", "giraf", "zebra"] };

async function setup(n: number, room = fast) {
  server = await startServer({ room });
  const clients: (TestClient & { chat: ChatMessage[] })[] = [];
  let code: string | undefined;
  for (let i = 0; i < n; i++) {
    const c = (await server.connect()) as TestClient & { chat: ChatMessage[] };
    c.chat = [];
    c.on("chat:message", (m) => c.chat.push(m));
    const res = await join(c, `P${i}`, `tok-${i}`, code);
    if (!res.ok) throw new Error(res.message);
    code = res.data.code;
    clients.push(c);
  }
  await waitFor(() => clients.every((c) => c.lastState()?.players.length === n));
  return clients;
}

const phase = (c: TestClient, p: RoomState["phase"]) => waitFor(() => c.lastState()?.phase === p && c.lastState());

describe("game", () => {
  it("only the host can start, and needs two players", async () => {
    const [a, b] = await setup(2);
    b!.emit("game:start");
    await new Promise((r) => setTimeout(r, 50));
    expect(a!.lastState()!.phase).toBe("lobby");
    a!.emit("game:start");
    await phase(a!, "choosing");
  });

  it("plays a full turn: choose, hidden word, correct guess, points", async () => {
    const [a, b, c] = await setup(3, { ...fast, drawMs: 5000 });
    a!.emit("game:start");
    const s = await phase(a!, "choosing");
    expect(s.drawerId).toBe(s.you); // first player draws first
    expect(s.wordChoices).toHaveLength(3);
    expect((await phase(b!, "choosing")).wordChoices).toBeNull();

    a!.emit("game:choose", 1);
    const drawerState = await phase(a!, "drawing");
    const word = drawerState.word!;
    expect(word).toBe(s.wordChoices![1]);
    const guesserState = await phase(b!, "drawing");
    expect(guesserState.word).toBeNull();
    expect(guesserState.hint).toBe("_".repeat(word.length));

    // Guessing: correct answer (case/accents ignored) is not shown to others.
    b!.emit("chat:send", word.toUpperCase());
    await waitFor(() => c!.chat.some((m) => m.kind === "correct"));
    expect(c!.chat.some((m) => m.text.toLowerCase().includes(word))).toBe(false);
    const afterGuess = await waitFor(() => b!.lastState()?.word === word && b!.lastState());
    const bInfo = afterGuess.players.find((p) => p.id === afterGuess.you)!;
    expect(bInfo.hasGuessed).toBe(true);
    expect(bInfo.score).toBeGreaterThan(400);

    // Messages from players who know the word only go to other knowers.
    b!.emit("chat:send", "makkelijk!");
    await waitFor(() => a!.chat.some((m) => m.kind === "secret"));
    await new Promise((r) => setTimeout(r, 30));
    expect(c!.chat.some((m) => m.text === "makkelijk!")).toBe(false);

    // A near miss gives a private hint.
    c!.emit("chat:send", word.slice(0, -1));
    await waitFor(() => c!.chat.some((m) => m.kind === "close"));
    expect(b!.chat.some((m) => m.kind === "close" && m.text.includes("bijna"))).toBe(false);

    // Last guesser -> turn ends early, drawer got points per guesser.
    c!.emit("chat:send", word);
    const end = await phase(a!, "turnEnd");
    expect(end.turnEndReason).toBe("allGuessed");
    const drawer = end.players.find((p) => p.id === end.you)!;
    expect(drawer.turnPoints).toBe(120);
  });

  it("auto-picks a word, ends on time, rotates drawers and ends the game", async () => {
    const [a, b] = await setup(2);
    a!.emit("game:start");
    const first = await phase(a!, "choosing");
    await phase(a!, "drawing"); // auto choose after chooseMs
    const ended = await waitFor(() => a!.states.find((s) => s.phase === "turnEnd"), 3000);
    expect(ended.turnEndReason).toBe("timeUp");
    const second = await waitFor(() => b!.states.find((s) => s.phase === "choosing" && s.drawerId !== first.drawerId), 3000);
    expect(second.wordChoices).toHaveLength(3);
    const final = await waitFor(() => a!.states.find((s) => s.phase === "gameEnd"), 4000);
    expect(final.round).toBe(2);

    // Host goes back to the lobby; scores reset.
    a!.emit("game:reset");
    const lobby = await phase(a!, "lobby");
    expect(lobby.players.every((p) => p.score === 0)).toBe(true);
  });

  it("only the drawer may draw during a turn", async () => {
    const [a, b] = await setup(2, { ...fast, chooseMs: 5000, drawMs: 5000 });
    a!.emit("game:start");
    await phase(a!, "choosing");
    a!.emit("game:choose", 0);
    await phase(b!, "drawing");
    const got: string[] = [];
    a!.on("draw:begin", (s) => got.push(s.id));
    b!.on("draw:begin", (s) => got.push(s.id));
    const stroke = { tool: "pen", color: "#000000", size: 0.006, points: [[0.5, 0.5]] } as const;
    b!.emit("draw:begin", { ...stroke, id: "guesser", points: [[0.5, 0.5]] });
    a!.emit("draw:begin", { ...stroke, id: "drawer", points: [[0.5, 0.5]] });
    await waitFor(() => got.length >= 1);
    await new Promise((r) => setTimeout(r, 30));
    expect(got).toEqual(["drawer"]);
  });

  it("skips the turn when the drawer disconnects", async () => {
    const [a, b, c] = await setup(3, { ...fast, chooseMs: 5000, drawMs: 5000 });
    a!.emit("game:start");
    await phase(a!, "choosing");
    a!.emit("game:choose", 0);
    await phase(b!, "drawing");
    a!.disconnect();
    const end = await phase(b!, "turnEnd");
    expect(end.turnEndReason).toBe("drawerLeft");
    const next = await phase(c!, "choosing");
    expect(next.drawerId).not.toBe(end.drawerId);
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
