"use client";

import type { RoomState } from "@guessdrawing/shared";
import { useT } from "@/lib/i18n";
import { useCountdown } from "@/lib/use-countdown";

/** The masked word as letter tiles; spaces and dashes stay visible. */
function HintTiles({ hint }: { hint: string }) {
  const words = hint.split(" ");
  return (
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5">
      {words.map((word, w) => (
        <div key={w} className="flex gap-1">
          {[...word].map((ch, i) =>
            ch === "_" || /[\p{L}\p{N}]/u.test(ch) ? (
              <span
                key={i}
                className={`flex h-8 w-6 items-center justify-center rounded-md border-b-2 font-mono text-base font-medium uppercase sm:h-9 sm:w-7 sm:text-lg ${
                  ch === "_" ? "border-white/25 bg-white/[0.04]" : "animate-pop border-accent bg-accent/15 text-fg"
                }`}
              >
                {ch === "_" ? "" : ch}
              </span>
            ) : (
              <span key={i} className="flex h-8 items-center font-mono text-fg/50 sm:h-9">
                {ch}
              </span>
            ),
          )}
        </div>
      ))}
    </div>
  );
}

function TimerRing({ seconds, fraction, urgent }: { seconds: number | null; fraction: number; urgent: boolean }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg viewBox="0 0 48 48" className="h-full w-full -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
        {seconds !== null && (
          <circle
            cx="24"
            cy="24"
            r={r}
            fill="none"
            stroke={urgent ? "var(--color-hot)" : "var(--color-accent)"}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - fraction)}
            className="transition-[stroke-dashoffset] duration-300 ease-linear"
            style={{ filter: `drop-shadow(0 0 6px ${urgent ? "rgba(255,107,61,0.7)" : "rgba(109,139,255,0.7)"})` }}
          />
        )}
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-mono text-sm tabular-nums ${
          urgent ? "animate-pulse text-hot" : "text-fg"
        }`}
      >
        {seconds ?? "–"}
      </span>
    </div>
  );
}

export function TurnHeader({ room }: { room: RoomState }) {
  const { t } = useT();
  const { secondsLeft, fraction } = useCountdown(room);
  const isDrawer = room.drawerId === room.you;
  const drawer = room.players.find((p) => p.id === room.drawerId);

  let center: React.ReactNode = null;
  if (room.phase === "drawing") {
    if (room.word) {
      center = (
        <div className="text-center">
          <p className="eyebrow">{isDrawer ? t("turn.drawThis") : t("turn.youGuessed")}</p>
          <p className="mt-0.5 animate-pop text-2xl font-medium tracking-tight text-mint sm:text-3xl">{room.word}</p>
        </div>
      );
    } else if (room.hint) {
      center = (
        <div className="text-center">
          <p className="eyebrow mb-1.5">{t("turn.guess", { n: room.hint.replace(/[^_\p{L}\p{N}]/gu, "").length })}</p>
          <HintTiles hint={room.hint} />
        </div>
      );
    }
  } else if (room.phase === "choosing") {
    center = (
      <p className="text-center text-fg/60">
        {isDrawer ? t("turn.chooseWord") : t("turn.choosing", { name: drawer?.name ?? t("drawer") })}
      </p>
    );
  } else if (room.phase === "turnEnd") {
    center = <p className="text-center text-fg/60">{t("turn.next")}</p>;
  }

  const urgent = room.phase === "drawing" && secondsLeft !== null && secondsLeft <= 10;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
      <div className="shrink-0">
        <p className="eyebrow">{t("turn.round")}</p>
        <p className="font-mono text-lg">
          {room.round}
          <span className="text-fg/35">/{room.totalRounds}</span>
        </p>
      </div>
      <div className="min-w-0 flex-1">{center}</div>
      <TimerRing seconds={secondsLeft} fraction={fraction} urgent={urgent} />
    </div>
  );
}
