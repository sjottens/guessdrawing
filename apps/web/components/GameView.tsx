"use client";

import type { RoomState } from "@guessdrawing/shared";
import { getGameClient, type ClientSnapshot } from "@/lib/game-client";
import { useT } from "@/lib/i18n";
import { Chat } from "./Chat";
import { DrawingBoard } from "./DrawingBoard";
import { LangSwitch } from "./LangSwitch";
import { Lobby } from "./Lobby";
import { Logo } from "./Logo";
import { Scoreboard, TurnEnd, WordChoice } from "./Overlays";
import { PlayerList } from "./PlayerList";
import { TurnHeader } from "./TurnHeader";

export function GameView({
  snapshot,
  room,
  onLeave,
}: {
  snapshot: ClientSnapshot;
  room: RoomState;
  onLeave: () => void;
}) {
  const { t } = useT();
  const isDrawer = room.drawerId === room.you;
  const me = room.players.find((p) => p.id === room.you);
  const canDraw = room.phase === "lobby" || (room.phase === "drawing" && isDrawer);

  let overlay: React.ReactNode = null;
  if (room.phase === "choosing") overlay = <WordChoice room={room} />;
  else if (room.phase === "turnEnd") overlay = <TurnEnd room={room} />;
  else if (room.phase === "gameEnd") overlay = <Scoreboard room={room} />;

  let placeholder = t("chat.hello");
  if (room.phase === "drawing") {
    if (isDrawer) placeholder = t("chat.drawerHint");
    else if (me?.hasGuessed) placeholder = t("chat.knowers");
    else placeholder = t("chat.guessHere");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-7xl flex-col gap-3 p-2 sm:gap-4 sm:p-5">
      <header className="flex items-center justify-between gap-2 px-1">
        <Logo small compact />
        <div className="flex items-center gap-2">
          <LangSwitch />
          <span className="hidden font-mono text-[11px] tracking-[0.18em] text-fg/40 uppercase md:inline">{t("room.label")}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-sm tracking-[0.25em] text-fg">
            {room.code}
          </span>
          <button className="btn-secondary px-4 py-1.5 text-sm" onClick={onLeave}>
            {t("room.leave")}
          </button>
        </div>
      </header>

      {snapshot.reconnecting && (
        <div className="flex animate-pop items-center justify-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-medium text-gold">
          <span className="h-2 w-2 animate-pulse rounded-full bg-gold" />
          {t("room.reconnecting")}
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-[240px_1fr_300px] lg:content-start">
        <section className="panel order-1 animate-rise self-start overflow-hidden lg:order-2">
          {room.phase === "lobby" ? <Lobby room={room} /> : room.phase !== "gameEnd" && <TurnHeader room={room} />}
          <div className="p-2">
            <DrawingBoard canDraw={canDraw} overlay={overlay} />
          </div>
        </section>
        <aside className="order-3 animate-rise [animation-delay:80ms] lg:order-1">
          <PlayerList room={room} />
        </aside>
        {/* On desktop the chat takes no height of its own, so it matches the drawing card's height. */}
        <aside className="relative order-2 h-72 animate-rise [animation-delay:160ms] lg:order-3 lg:h-auto">
          <div className="h-full lg:absolute lg:inset-0">
            <Chat messages={snapshot.messages} onSend={(t) => getGameClient().sendChat(t)} placeholder={placeholder} />
          </div>
        </aside>
      </div>
    </main>
  );
}
