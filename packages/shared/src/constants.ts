export const MAX_PLAYERS = 8;
export const MIN_PLAYERS_TO_START = 2;
export const MAX_NAME_LENGTH = 20;
export const MAX_CHAT_LENGTH = 100;

/** Characters used for room codes (no easily confused characters like O/0, I/1). */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 5;

/** How long a disconnected player keeps their seat before being removed. */
export const RECONNECT_GRACE_MS = 30_000;

export const TOTAL_ROUNDS = 3;
export const CHOOSE_WORD_MS = 15_000;
export const DRAW_TIME_MS = 80_000;
export const TURN_END_MS = 6_000;
export const WORD_CHOICES = 3;
/** If the drawer is gone this long, their turn is skipped. */
export const DRAWER_AWAY_MS = 10_000;

/** Points for a correct guess: from MAX (instant) down to MIN (last second). */
export const GUESS_POINTS_MAX = 500;
export const GUESS_POINTS_MIN = 100;
/** Points the drawer gets for every player who guesses the word. */
export const DRAWER_POINTS_PER_GUESS = 60;
