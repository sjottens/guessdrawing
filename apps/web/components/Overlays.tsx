"use client";

import type { RoomState } from "@guessdrawing/shared";
import { getGameClient } from "@/lib/game-client";

export function WordChoice({ room }: { room: RoomState }) {
  const drawer = room.players.find((p) => p.id === room.drawerId);
  if (!room.wordChoices) {
    return (
      <div className="text-center text-white">
        <p className="text-4xl">🤔</p>
        <p className="mt-2 text-lg font-black">{drawer?.name ?? "De tekenaar"} kiest een woord…</p>
      </div>
    );
  }
  return (
    <div className="text-center">
      <p className="mb-4 text-xl font-black text-white">Kies een woord om te tekenen</p>
      <div className="flex flex-wrap justify-center gap-3">
        {room.wordChoices.map((w, i) => (
          <button
            key={w}
            className="btn rounded-xl bg-white px-5 py-3 text-lg text-indigo-900 shadow-lg hover:bg-amber-100"
            onClick={() => getGameClient().socket.emit("game:choose", i)}
          >
            {w}
          </button>
        ))}
      </div>
    </div>
  );
}

const reasonText = {
  allGuessed: "Iedereen heeft het geraden! 🎉",
  timeUp: "De tijd is om! ⏰",
  drawerLeft: "De tekenaar is weg 😕",
} as const;

export function TurnEnd({ room }: { room: RoomState }) {
  const rows = [...room.players].sort((a, b) => b.turnPoints - a.turnPoints);
  return (
    <div className="w-full max-w-xs text-center text-white">
      <p className="font-bold text-indigo-100">{room.turnEndReason ? reasonText[room.turnEndReason] : ""}</p>
      <p className="mt-1 text-sm text-indigo-200">Het woord was</p>
      <p className="text-3xl font-black text-amber-300">{room.word}</p>
      <ul className="mt-3 space-y-1 text-sm">
        {rows.map((p) => (
          <li key={p.id} className="flex justify-between gap-4 font-bold">
            <span className="truncate">{p.name}</span>
            <span className={p.turnPoints > 0 ? "text-emerald-300" : "text-slate-300"}>+{p.turnPoints}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Scoreboard({ room }: { room: RoomState }) {
  const rows = [...room.players].sort((a, b) => b.score - a.score);
  const topScore = rows[0]?.score ?? 0;
  const isHost = room.hostId === room.you;
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="w-full max-w-sm text-center">
      <p className="text-3xl sm:text-4xl">🏆</p>
      <p className="text-xl font-black text-white sm:text-2xl">
        {rows.filter((p) => p.score === topScore).map((p) => p.name).join(" & ")} wint!
      </p>
      <ol className="mt-3 space-y-1">
        {rows.map((p, i) => (
          <li
            key={p.id}
            className={`flex items-center gap-3 rounded-xl px-3 py-1.5 text-sm font-bold sm:text-base ${
              p.score === topScore ? "bg-amber-300 text-amber-950" : "bg-white/90 text-slate-800"
            }`}
          >
            <span className="w-7 text-left">{medals[i] ?? `#${i + 1}`}</span>
            <span className="flex-1 truncate text-left">{p.name}</span>
            <span className="tabular-nums">{p.score}</span>
          </li>
        ))}
      </ol>
      {isHost ? (
        <button className="btn-primary mt-4" onClick={() => getGameClient().socket.emit("game:reset")}>
          Nog een keer spelen
        </button>
      ) : (
        <p className="mt-5 text-sm font-semibold text-indigo-100">Wachten tot de host een nieuw spel start…</p>
      )}
    </div>
  );
}
