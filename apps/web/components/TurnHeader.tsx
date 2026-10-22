"use client";

import type { RoomState } from "@guessdrawing/shared";
import { useCountdown } from "@/lib/use-countdown";

export function TurnHeader({ room }: { room: RoomState }) {
  const { secondsLeft, fraction } = useCountdown(room);
  const isDrawer = room.drawerId === room.you;
  const drawer = room.players.find((p) => p.id === room.drawerId);

  let center: React.ReactNode = null;
  if (room.phase === "drawing") {
    if (room.word) {
      center = (
        <div className="text-center">
          <p className="text-xs font-bold uppercase text-slate-400">{isDrawer ? "Teken dit woord" : "Je hebt het geraden!"}</p>
          <p className="text-xl font-black tracking-wide text-emerald-600 sm:text-2xl">{room.word}</p>
        </div>
      );
    } else if (room.hint) {
      center = (
        <div className="text-center">
          <p className="text-xs font-bold uppercase text-slate-400">Raad het woord ({room.hint.replace(/[^_\p{L}\p{N}]/gu, "").length} letters)</p>
          <p className="font-mono text-xl font-black tracking-[0.35em] text-indigo-900 sm:text-2xl">{room.hint}</p>
        </div>
      );
    }
  } else if (room.phase === "choosing") {
    center = (
      <p className="text-center font-bold text-slate-500">
        {isDrawer ? "Kies een woord!" : `${drawer?.name ?? "De tekenaar"} kiest een woord…`}
      </p>
    );
  } else if (room.phase === "turnEnd") {
    center = <p className="text-center font-bold text-slate-500">Volgende beurt komt eraan…</p>;
  }

  const urgent = room.phase === "drawing" && secondsLeft !== null && secondsLeft <= 10;

  return (
    <div className="relative flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
      <div className="shrink-0 whitespace-nowrap text-sm font-black text-indigo-900">
        Ronde {room.round}/{room.totalRounds}
      </div>
      <div className="min-w-0 flex-1">{center}</div>
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-4 text-lg font-black tabular-nums ${
          urgent ? "animate-pulse border-rose-400 text-rose-600" : "border-indigo-200 text-indigo-900"
        }`}
      >
        {secondsLeft ?? "–"}
      </div>
      {secondsLeft !== null && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-100">
          <div
            className={`h-full transition-[width] duration-300 ease-linear ${urgent ? "bg-rose-400" : "bg-indigo-400"}`}
            style={{ width: `${fraction * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
