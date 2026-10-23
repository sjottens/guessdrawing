import type { Lang } from "@guessdrawing/shared";
import wordsEn from "../data/words.en.json";
import wordsNl from "../data/words.nl.json";
import { randomInt } from "./random.js";

export const WORDS_BY_LANG: Record<Lang, readonly string[]> = { nl: wordsNl, en: wordsEn };

/** Dutch words, the default. */
export const WORDS: readonly string[] = wordsNl;

/** Picks `count` distinct random words, avoiding `exclude` when possible. */
export function pickWords(count: number, exclude: ReadonlySet<string> = new Set(), list = WORDS): string[] {
  let pool = list.filter((w) => !exclude.has(w));
  if (pool.length < count) pool = [...list];
  const picked: string[] = [];
  while (picked.length < count && pool.length > 0) {
    picked.push(pool.splice(randomInt(pool.length), 1)[0]!);
  }
  return picked;
}

/** Letters (not spaces/dashes) that can be hidden. */
export function letterIndexes(word: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < word.length; i++) if (/[\p{L}\p{N}]/u.test(word[i]!)) out.push(i);
  return out;
}

export function maskWord(word: string, revealed: ReadonlySet<number>): string {
  return [...word].map((c, i) => (/[\p{L}\p{N}]/u.test(c) && !revealed.has(i) ? "_" : c)).join("");
}

/** How many letters to reveal over the course of a turn. */
export function hintCount(word: string): number {
  return Math.min(3, Math.floor(letterIndexes(word).length / 3));
}
