"use client";

import type { RoomState } from "@guessdrawing/shared";
import { getGameClient } from "@/lib/game-client";
import { useT } from "@/lib/i18n";
import { Avatar } from "./Avatar";

export function WordChoice({ room }: { room: RoomState }) {
  const { t } = useT();
  const drawer = room.players.find((p) => p.id === room.drawerId);
  if (!room.wordChoices) {
    return (
      <div className="flex flex-col items-center text-center">
        {drawer && <Avatar id={drawer.id} name={drawer.name} size="lg" ring />}
        <p className="mt-4 text-xl font-medium tracking-tight">{t("choice.otherChoosing", { name: drawer?.name ?? t("drawer") })}</p>
        <p className="eyebrow mt-2 animate-pulse">{t("choice.wait")}</p>
      </div>
    );
  }
  return (
    <div className="text-center">
      <p className="eyebrow">{t("choice.yourTurn")}</p>
      <p className="mt-2 mb-6 text-2xl font-medium tracking-tight sm:text-3xl">{t("choice.pick")}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {room.wordChoices.map((w, i) => (
          <button
            key={w}
            className="btn animate-pop border border-white/15 bg-white/[0.06] px-6 py-3.5 text-lg text-fg hover:-translate-y-0.5 hover:border-accent hover:bg-accent hover:shadow-[0_0_40px_-6px_var(--color-accent)]"
            style={{ animationDelay: `${i * 80}ms` }}
            onClick={() => getGameClient().send({ type: "choose", index: i })}
          >
            {w}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TurnEnd({ room }: { room: RoomState }) {
  const { t } = useT();
  const rows = [...room.players].sort((a, b) => b.turnPoints - a.turnPoints);
  return (
    <div className="w-full max-w-xs text-center">
      <p className="eyebrow">{room.turnEndReason ? t(`end.${room.turnEndReason}`) : t("end.turn")}</p>
      <p className="mt-3 text-sm text-fg/50">{t("end.wordWas")}</p>
      <p className="animate-pop text-4xl font-medium tracking-tight text-gold">{room.word}</p>
      <ul className="mt-5 space-y-1.5 text-sm">
        {rows.map((p, i) => (
          <li
            key={p.id}
            className="flex animate-pop items-center gap-3 rounded-full bg-white/[0.05] py-1 pr-4 pl-1"
            style={{ animationDelay: `${150 + i * 60}ms` }}
          >
            <Avatar id={p.id} name={p.name} size="sm" />
            <span className="flex-1 truncate text-left">{p.name}</span>
            <span className={`font-mono ${p.turnPoints > 0 ? "text-mint" : "text-fg/35"}`}>+{p.turnPoints}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Scoreboard({ room }: { room: RoomState }) {
  const { t } = useT();
  const rows = [...room.players].sort((a, b) => b.score - a.score);
  const topScore = rows[0]?.score ?? 0;
  const isHost = room.hostId === room.you;
  const winners = rows.filter((p) => p.score === topScore);
  return (
    <div className="w-full max-w-sm text-center">
      <p className="eyebrow">{t("end.final")}</p>
      <p className="mt-2 animate-pop text-3xl font-medium tracking-tight sm:text-4xl">
        <span className="text-gold">{winners.map((p) => p.name).join(` ${t("and")} `)}</span>{" "}
        {winners.length > 1 ? t("end.winPlural") : t("end.wins")}!
      </p>
      <ol className="mt-5 space-y-1.5">
        {rows.map((p, i) => {
          const top = p.score === topScore;
          return (
            <li
              key={p.id}
              className={`flex animate-pop items-center gap-3 rounded-full py-1 pr-4 pl-1 text-sm sm:text-base ${
                top ? "border border-gold/40 bg-gold/15 shadow-[0_0_30px_-10px_var(--color-gold)]" : "bg-white/[0.05]"
              }`}
              style={{ animationDelay: `${150 + i * 70}ms` }}
            >
              <Avatar id={p.id} name={p.name} size="sm" />
              <span className="w-6 font-mono text-xs text-fg/40">0{i + 1}</span>
              <span className="flex-1 truncate text-left font-medium">{p.name}</span>
              <span className={`font-mono tabular-nums ${top ? "text-gold" : ""}`}>{p.score}</span>
            </li>
          );
        })}
      </ol>
      {isHost ? (
        <button className="btn-accent mt-6" onClick={() => getGameClient().send({ type: "reset" })}>
          {t("end.again")}
        </button>
      ) : (
        <p className="eyebrow mt-6">{t("end.waitHost")}</p>
      )}
    </div>
  );
}
