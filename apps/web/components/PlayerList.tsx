"use client";

import type { PlayerInfo, RoomState } from "@guessdrawing/shared";
import { useT, type Translate } from "@/lib/i18n";
import { Avatar } from "./Avatar";
import { CheckIcon, CrownIcon, OfflineIcon, PencilIcon } from "./Icons";

function status(p: PlayerInfo, rank: number, t: Translate): { text: string; className: string; icon?: React.ReactNode } {
  if (!p.connected) return { text: t("players.offline"), className: "text-fg/35", icon: <OfflineIcon className="h-3 w-3" /> };
  if (p.isDrawing) return { text: t("players.drawing"), className: "text-accent", icon: <PencilIcon className="h-3 w-3" /> };
  if (p.hasGuessed) return { text: t("players.guessed"), className: "text-mint", icon: <CheckIcon className="h-3 w-3" /> };
  return { text: `#${rank}`, className: "text-fg/35" };
}

export function PlayerList({ room }: { room: RoomState }) {
  const { t } = useT();
  const players = [...room.players].sort((a, b) => b.score - a.score);
  return (
    <div className="panel p-2">
      <div className="flex items-center justify-between px-3 pt-2 pb-2">
        <span className="eyebrow">{t("players.title")}</span>
        <span className="font-mono text-[11px] text-fg/35">
          {players.length}/{room.maxPlayers}
        </span>
      </div>
      <ul className="space-y-1">
        {players.map((p, i) => {
          const s = status(p, i + 1, t);
          const you = p.id === room.you;
          return (
            <li
              key={p.id}
              className={`flex items-center gap-3 rounded-2xl px-2.5 py-2 transition-colors duration-500 ${
                p.hasGuessed ? "bg-mint/10" : you ? "bg-white/[0.05]" : ""
              } ${p.connected ? "" : "opacity-50"}`}
            >
              <Avatar id={p.id} name={p.name} ring={p.isDrawing} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                  <span className="truncate">{p.name}</span>
                  {p.isHost && <CrownIcon className="h-3.5 w-3.5 shrink-0 text-gold" />}
                  {you && <span className="shrink-0 text-fg/35">· {t("players.you")}</span>}
                </p>
                <p className={`flex items-center gap-1 font-mono text-[11px] tracking-wide ${s.className}`}>
                  {s.icon}
                  {s.text}
                </p>
              </div>
              <span className="font-mono text-base tabular-nums">{p.score}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
