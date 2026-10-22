export const MAX_PLAYERS = 8;
export const MIN_PLAYERS_TO_START = 2;
export const MAX_NAME_LENGTH = 20;
export const MAX_CHAT_LENGTH = 100;

/** Characters used for room codes (no easily confused characters like O/0, I/1). */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 5;

/** How long a disconnected player keeps their seat before being removed. */
export const RECONNECT_GRACE_MS = 30_000;
