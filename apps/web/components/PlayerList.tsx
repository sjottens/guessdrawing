import type { RoomState } from "@guessdrawing/shared";

export function PlayerList({ room }: { room: RoomState }) {
  const players = [...room.players].sort((a, b) => b.score - a.score);
  return (
    <ul className="card divide-y divide-slate-100 overflow-hidden">
      {players.map((p, i) => (
        <li key={p.id} className={`flex items-center gap-2 px-3 py-2 ${p.id === room.you ? "bg-indigo-50" : ""}`}>
          <span className="w-6 text-sm font-black text-slate-400">#{i + 1}</span>
          <span className={`min-w-0 flex-1 truncate font-bold ${p.connected ? "" : "text-slate-400 line-through"}`}>
            {p.name}
            {p.id === room.you && <span className="font-semibold text-indigo-500"> (jij)</span>}
          </span>
          {p.isHost && <span title="Host">👑</span>}
          {!p.connected && <span title="Verbinding kwijt">📡</span>}
          <span className="text-sm font-black tabular-nums text-indigo-700">{p.score}</span>
        </li>
      ))}
    </ul>
  );
}
