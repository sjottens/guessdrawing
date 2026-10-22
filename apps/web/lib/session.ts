const TOKEN_KEY = "gd-session-token";
const NAME_KEY = "gd-name";

function randomId(): string {
  // crypto.randomUUID only exists on https/localhost; getRandomValues works everywhere.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * One token per browser tab (sessionStorage): a reload keeps your seat,
 * while a second tab counts as a new player (handy for testing).
 */
export function getSessionToken(): string {
  try {
    let token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) {
      token = randomId();
      sessionStorage.setItem(TOKEN_KEY, token);
    }
    return token;
  } catch {
    return randomId();
  }
}

export function getStoredName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function storeName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignore */
  }
}
