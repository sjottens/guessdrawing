"use client";

import type { RoomState } from "@guessdrawing/shared";
import { getGameClient, type ClientSnapshot } from "@/lib/game-client";
import { Chat } from "./Chat";
import { DrawingBoard } from "./DrawingBoard";
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
  const isDrawer = room.drawerId === room.you;
  const me = room.players.find((p) => p.id === room.you);
  const canDraw = room.phase === "lobby" || (room.phase === "drawing" && isDrawer);

  let overlay: React.ReactNode = null;
  if (room.phase === "choosing") overlay = <WordChoice room={room} />;
  else if (room.phase === "turnEnd") overlay = <TurnEnd room={room} />;
  else if (room.phase === "gameEnd") overlay = <Scoreboard room={room} />;

  let placeholder = "Zeg hallo…";
  if (room.phase === "drawing") {
    if (isDrawer) placeholder = "Alleen wie het weet ziet dit…";
    else if (me?.hasGuessed) placeholder = "Chat met wie het al weet…";
    else placeholder = "Typ je gok hier…";
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-3 p-2 sm:p-4">
      <header className="flex items-center justify-between gap-2">
        <Logo small />
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-indigo-900/40 px-2 py-1 font-mono text-sm font-bold tracking-widest text-white">
            {room.code}
          </span>
          <button className="btn rounded-lg bg-white/15 px-3 py-1 text-sm text-white hover:bg-white/25" onClick={onLeave}>
            Verlaten
          </button>
        </div>
      </header>

      {snapshot.reconnecting && (
        <div className="rounded-xl bg-amber-300 px-3 py-2 text-center text-sm font-bold text-amber-950">
          Verbinding kwijt — opnieuw verbinden…
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-3 lg:grid-cols-[220px_1fr_280px]">
        <section className="card order-1 self-start overflow-hidden lg:order-2">
          {room.phase === "lobby" ? <Lobby room={room} /> : room.phase !== "gameEnd" && <TurnHeader room={room} />}
          <div className="p-2">
            <DrawingBoard canDraw={canDraw} overlay={overlay} />
          </div>
        </section>
        <aside className="order-3 lg:order-1">
          <PlayerList room={room} />
        </aside>
        <aside className="order-2 h-64 lg:order-3 lg:h-auto lg:max-h-[calc(100dvh-6rem)]">
          <Chat messages={snapshot.messages} onSend={(t) => getGameClient().sendChat(t)} placeholder={placeholder} />
        </aside>
      </div>
    </main>
  );
}
