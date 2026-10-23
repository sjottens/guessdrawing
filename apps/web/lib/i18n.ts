"use client";

import { useCallback, useSyncExternalStore } from "react";
import { isLang, type ChatMessage, type Lang } from "@guessdrawing/shared";

const nl = {
  "meta.title": "Guessdrawing — teken en raad",

  "home.tagline": "Realtime · {min}–{max} spelers · gratis",
  "home.eyebrow": "Een tekenspel voor vrienden",
  "home.title1": "Teken het.",
  "home.title2": "Raad het.",
  "home.intro":
    "Eén speler tekent, de rest raadt live mee. Maak een kamer, deel de link en ontdek wie het snelst ziet wat er bedoeld wordt.",
  "home.name": "Jouw naam",
  "home.namePlaceholder": "bijv. Picasso",
  "home.create": "Nieuwe kamer maken",
  "home.creating": "Kamer maken…",
  "home.orJoin": "of join met een code",
  "home.code": "Kamercode",
  "home.join": "Join",
  "home.step1.title": "Maak een kamer",
  "home.step1.text": "Kies een naam en je krijgt meteen een eigen kamer.",
  "home.step2.title": "Deel de link",
  "home.step2.text": "Nodig {min} tot {max} vrienden uit, geen account nodig.",
  "home.step3.title": "Teken & raad",
  "home.step3.text": "{seconds} seconden per beurt. Wie snel raadt, scoort meer.",
  "home.live": "Live",
  "home.guessed": "Geraden",
  "home.whatIsIt": "Wat wordt dit…?",

  "shape.star": "Een ster",
  "shape.heart": "Een hart",
  "shape.house": "Een huis",
  "shape.fish": "Een vis",
  "shape.sun": "Een zon",

  "join.invited": "Je bent uitgenodigd",
  "join.title": "Join kamer",
  "join.placeholder": "Hoe heet je?",
  "join.submit": "Meedoen",

  "room.failed": "Dat ging mis",
  "room.backHome": "Terug naar start",
  "room.connecting": "Verbinden met kamer {code}…",
  "room.homeLink": "Naar de startpagina",
  "room.label": "Kamer",
  "room.leave": "Verlaten",
  "room.reconnecting": "Verbinding kwijt — opnieuw verbinden…",

  "lobby.label": "Lobby",
  "lobby.waiting": "Wachten op spelers",
  "lobby.doodle": "Teken alvast wat terwijl je wacht.",
  "lobby.words": "Woorden: {lang}",
  "lobby.share": "Link delen",
  "lobby.copied": "Gekopieerd",
  "lobby.shareTitle": "Doe mee met Guessdrawing!",
  "lobby.start": "Start spel",
  "lobby.needPlayers": "Je hebt minstens {n} spelers nodig",
  "lobby.hostStarts": "Host start het spel",

  "players.title": "Spelers",
  "players.you": "jij",
  "players.offline": "Verbinding kwijt",
  "players.drawing": "Tekent nu",
  "players.guessed": "Geraden",

  "turn.round": "Ronde",
  "turn.drawThis": "Teken dit woord",
  "turn.youGuessed": "Je hebt het geraden!",
  "turn.guess": "Raad het woord · {n} letters",
  "turn.chooseWord": "Kies een woord!",
  "turn.choosing": "{name} kiest een woord…",
  "turn.next": "Volgende beurt komt eraan…",
  "drawer": "De tekenaar",

  "chat.title": "Chat & gokken",
  "chat.send": "Versturen",
  "chat.hello": "Zeg hallo…",
  "chat.drawerHint": "Alleen wie het weet ziet dit…",
  "chat.knowers": "Chat met wie het al weet…",
  "chat.guessHere": "Typ je gok hier…",

  "tool.color": "Kleur {color}",
  "tool.size": "Dikte {n}",
  "tool.eraser": "Gum",
  "tool.undo": "Ongedaan maken (Ctrl+Z)",
  "tool.clear": "Alles wissen",

  "choice.wait": "Even geduld…",
  "choice.otherChoosing": "{name} kiest een woord",
  "choice.yourTurn": "Jij bent aan de beurt",
  "choice.pick": "Kies een woord om te tekenen",
  "end.allGuessed": "Iedereen heeft het geraden!",
  "end.timeUp": "De tijd is om",
  "end.drawerLeft": "De tekenaar is weg",
  "end.turn": "Einde beurt",
  "end.wordWas": "Het woord was",
  "end.final": "Eindstand",
  "end.wins": "wint",
  "end.winPlural": "winnen",
  "end.again": "Nog een keer spelen",
  "end.waitHost": "Wachten tot de host een nieuw spel start…",
  "and": "&",

  "lang.nl": "Nederlands",
  "lang.en": "Engels",
  "lang.switch": "Taal",

  "error.nameFirst": "Kies eerst een naam",
  "error.invalidCode": "Vul een geldige kamercode in",
  "error.createFailed": "Kon geen kamer maken (fout {status} van {url})",
  "error.unreachable": "Server is niet bereikbaar",
  "error.noRoom": "Geen kamer",
  "error.noResponse": "Server reageert niet",
  "error.connectFailed": "Verbinding mislukt",
  "error.ROOM_NOT_FOUND": "Deze kamer bestaat niet (meer)",
  "error.ROOM_FULL": "Deze kamer zit vol",
  "error.INVALID_NAME": "Kies eerst een naam",
  "error.NOT_ALLOWED": "Ongeldige sessie",

  "chat.gameStart": "Het spel begint! Ronde 1",
  "chat.tooFew": "Te weinig spelers over, terug naar de lobby",
  "chat.joined": "{name} doet mee",
  "chat.back": "{name} is terug",
  "chat.left": "{name} heeft de kamer verlaten",
  "chat.newHost": "{name} is nu de host",
  "chat.drawerAway": "{name} is weg, de beurt wordt overgeslagen",
  "chat.round": "Ronde {round}",
  "chat.choosing": "{name} kiest een woord…",
  "chat.drawing": "{name} is aan het tekenen!",
  "chat.wordWas": "{prefix}Het woord was: {word}",
  "chat.reason.allGuessed": "Iedereen heeft het geraden! ",
  "chat.reason.timeUp": "De tijd is om! ",
  "chat.winner": "{name} wint met {score} punten!",
  "chat.tie": "Gelijkspel tussen {names}!",
  "chat.tieAnd": "en",
  "chat.almost": "\"{guess}\" is bijna goed!",
  "chat.guessed": "{name} heeft het woord geraden!",
  "chat.youGuessed": "Goed zo! Het woord is \"{word}\" (+{points})",
};

export type MessageKey = keyof typeof nl;

const en: Record<MessageKey, string> = {
  "meta.title": "Guessdrawing — draw and guess",

  "home.tagline": "Realtime · {min}–{max} players · free",
  "home.eyebrow": "A drawing game for friends",
  "home.title1": "Draw it.",
  "home.title2": "Guess it.",
  "home.intro":
    "One player draws, everyone else guesses live. Create a room, share the link and find out who is quickest to see what it's meant to be.",
  "home.name": "Your name",
  "home.namePlaceholder": "e.g. Picasso",
  "home.create": "Create a new room",
  "home.creating": "Creating room…",
  "home.orJoin": "or join with a code",
  "home.code": "Room code",
  "home.join": "Join",
  "home.step1.title": "Create a room",
  "home.step1.text": "Pick a name and you instantly get your own room.",
  "home.step2.title": "Share the link",
  "home.step2.text": "Invite {min} to {max} friends, no account needed.",
  "home.step3.title": "Draw & guess",
  "home.step3.text": "{seconds} seconds per turn. Guess fast to score more.",
  "home.live": "Live",
  "home.guessed": "Guessed",
  "home.whatIsIt": "What is it…?",

  "shape.star": "A star",
  "shape.heart": "A heart",
  "shape.house": "A house",
  "shape.fish": "A fish",
  "shape.sun": "A sun",

  "join.invited": "You're invited",
  "join.title": "Join room",
  "join.placeholder": "What's your name?",
  "join.submit": "Join game",

  "room.failed": "Something went wrong",
  "room.backHome": "Back to start",
  "room.connecting": "Connecting to room {code}…",
  "room.homeLink": "To the home page",
  "room.label": "Room",
  "room.leave": "Leave",
  "room.reconnecting": "Connection lost — reconnecting…",

  "lobby.label": "Lobby",
  "lobby.waiting": "Waiting for players",
  "lobby.doodle": "Doodle something while you wait.",
  "lobby.words": "Words: {lang}",
  "lobby.share": "Share link",
  "lobby.copied": "Copied",
  "lobby.shareTitle": "Join me on Guessdrawing!",
  "lobby.start": "Start game",
  "lobby.needPlayers": "You need at least {n} players",
  "lobby.hostStarts": "The host starts the game",

  "players.title": "Players",
  "players.you": "you",
  "players.offline": "Connection lost",
  "players.drawing": "Drawing",
  "players.guessed": "Guessed",

  "turn.round": "Round",
  "turn.drawThis": "Draw this word",
  "turn.youGuessed": "You guessed it!",
  "turn.guess": "Guess the word · {n} letters",
  "turn.chooseWord": "Pick a word!",
  "turn.choosing": "{name} is picking a word…",
  "turn.next": "Next turn coming up…",
  "drawer": "The drawer",

  "chat.title": "Chat & guesses",
  "chat.send": "Send",
  "chat.hello": "Say hi…",
  "chat.drawerHint": "Only players who know it see this…",
  "chat.knowers": "Chat with those who know it…",
  "chat.guessHere": "Type your guess here…",

  "tool.color": "Colour {color}",
  "tool.size": "Size {n}",
  "tool.eraser": "Eraser",
  "tool.undo": "Undo (Ctrl+Z)",
  "tool.clear": "Clear all",

  "choice.wait": "Hang on…",
  "choice.otherChoosing": "{name} is picking a word",
  "choice.yourTurn": "It's your turn",
  "choice.pick": "Pick a word to draw",
  "end.allGuessed": "Everyone guessed it!",
  "end.timeUp": "Time's up",
  "end.drawerLeft": "The drawer left",
  "end.turn": "End of turn",
  "end.wordWas": "The word was",
  "end.final": "Final scores",
  "end.wins": "wins",
  "end.winPlural": "win",
  "end.again": "Play again",
  "end.waitHost": "Waiting for the host to start a new game…",
  "and": "&",

  "lang.nl": "Dutch",
  "lang.en": "English",
  "lang.switch": "Language",

  "error.nameFirst": "Pick a name first",
  "error.invalidCode": "Enter a valid room code",
  "error.createFailed": "Couldn't create a room (error {status} from {url})",
  "error.unreachable": "The server can't be reached",
  "error.noRoom": "No room",
  "error.noResponse": "The server isn't responding",
  "error.connectFailed": "Connection failed",
  "error.ROOM_NOT_FOUND": "This room doesn't exist (anymore)",
  "error.ROOM_FULL": "This room is full",
  "error.INVALID_NAME": "Pick a name first",
  "error.NOT_ALLOWED": "Invalid session",

  "chat.gameStart": "The game begins! Round 1",
  "chat.tooFew": "Too few players left, back to the lobby",
  "chat.joined": "{name} joined",
  "chat.back": "{name} is back",
  "chat.left": "{name} left the room",
  "chat.newHost": "{name} is now the host",
  "chat.drawerAway": "{name} is gone, skipping their turn",
  "chat.round": "Round {round}",
  "chat.choosing": "{name} is picking a word…",
  "chat.drawing": "{name} is drawing!",
  "chat.wordWas": "{prefix}The word was: {word}",
  "chat.reason.allGuessed": "Everyone guessed it! ",
  "chat.reason.timeUp": "Time's up! ",
  "chat.winner": "{name} wins with {score} points!",
  "chat.tie": "It's a tie between {names}!",
  "chat.tieAnd": "and",
  "chat.almost": "\"{guess}\" is very close!",
  "chat.guessed": "{name} guessed the word!",
  "chat.youGuessed": "Well done! The word is \"{word}\" (+{points})",
};

const dictionaries: Record<Lang, Record<MessageKey, string>> = { nl, en };

export type Params = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: Params) => string;

export function translate(lang: Lang, key: MessageKey, params: Params = {}): string {
  const text = dictionaries[lang][key] ?? nl[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

// ---- current language: a tiny store so every component re-renders on a switch ----

const STORAGE_KEY = "gd-lang";
let current: Lang | null = null;
const listeners = new Set<() => void>();

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    /* storage blocked */
  }
  return navigator.language?.toLowerCase().startsWith("nl") ? "nl" : "en";
}

export function getLang(): Lang {
  current ??= detect();
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* storage blocked */
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The prerendered HTML is Dutch; the browser switches right after loading if needed. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, () => "nl");
}

export function useT(): { lang: Lang; t: Translate } {
  const lang = useLang();
  const t = useCallback<Translate>((key, params) => translate(lang, key, params), [lang]);
  return { lang, t };
}

/** Text of a chat message in the reader's language (server notices carry a key). */
export function chatText(m: ChatMessage, t: Translate): string {
  if (!m.key) return m.text;
  const p = m.params ?? {};
  const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? v : "");
  const params: Params = {};
  for (const [k, v] of Object.entries(p)) params[k] = Array.isArray(v) ? v.join(", ") : v;

  switch (m.key) {
    case "drawing":
      return t("chat.drawing", { name: str(p.name) || t("drawer") });
    case "wordWas": {
      const reason = p.reason === "allGuessed" || p.reason === "timeUp" ? t(`chat.reason.${p.reason}`) : "";
      return t("chat.wordWas", { word: str(p.word), prefix: reason });
    }
    case "tie": {
      const names = Array.isArray(p.names) ? p.names : [];
      const joined = names.length > 1 ? `${names.slice(0, -1).join(", ")} ${t("chat.tieAnd")} ${names.at(-1)}` : names.join("");
      return t("chat.tie", { names: joined });
    }
    default:
      return t(`chat.${m.key}`, params);
  }
}
