import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WORDS_BY_LANG } from "../src/game/words.js";
import { makeRoom } from "./helpers.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("languages", () => {
  it("reports the room's word language, Dutch by default", () => {
    expect(makeRoom().join("Anna").state.lang).toBe("nl");
    expect(makeRoom({ lang: "en" }).join("Anna").state.lang).toBe("en");
  });

  it("offers words from the room's own list", () => {
    const { join } = makeRoom({ lang: "en", words: WORDS_BY_LANG.en });
    const a = join("Anna");
    const b = join("Bram");
    a.emit({ type: "start" });
    // Only the drawer gets word choices.
    const choices = [a, b].map((c) => c.state.wordChoices).find(Boolean) ?? [];
    expect(choices.length).toBeGreaterThan(0);
    for (const w of choices) expect(WORDS_BY_LANG.en).toContain(w);
  });

  it("tags server notices with a key and params for translation", () => {
    const { join } = makeRoom();
    const a = join("Anna");
    join("Bram");
    const joined = a.chat.find((m) => m.key === "joined" && m.params?.name === "Bram");
    expect(joined?.text).toBe("Bram doet mee");
  });

  it("has an English word list without duplicates", () => {
    const en = WORDS_BY_LANG.en;
    expect(en.length).toBeGreaterThan(200);
    expect(new Set(en).size).toBe(en.length);
  });
});
