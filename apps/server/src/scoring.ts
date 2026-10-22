import { DRAWER_POINTS_PER_GUESS, GUESS_POINTS_MAX, GUESS_POINTS_MIN } from "@guessdrawing/shared";

/** Faster guesses earn more: linear from MAX (0 ms) to MIN (time up). */
export function guessPoints(elapsedMs: number, durationMs: number): number {
  const left = Math.min(1, Math.max(0, 1 - elapsedMs / durationMs));
  return Math.round(GUESS_POINTS_MIN + (GUESS_POINTS_MAX - GUESS_POINTS_MIN) * left);
}

export function drawerPoints(): number {
  return DRAWER_POINTS_PER_GUESS;
}
