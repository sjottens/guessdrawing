"use client";

import { useState } from "react";
import { MIN_PLAYERS_TO_START, type RoomState } from "@guessdrawing/shared";
import { getGameClient } from "@/lib/game-client";
import { useT } from "@/lib/i18n";
import { CheckIcon, LinkIcon } from "./Icons";

/** Compact bar shown above the canvas while waiting for players. */
export function Lobby({ room }: { room: RoomState }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === room.you;
  const connected = room.players.filter((p) => p.connected).length;
  const canStart = connected >= MIN_PLAYERS_TO_START;

  async function share() {
    const link = `${window.location.origin}/room/${room.code}`;
    try {
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        await navigator.share({ title: t("lobby.shareTitle"), url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* user cancelled */
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5 sm:px-5">
      <div>
        <p className="eyebrow flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          {t("lobby.label")}
        </p>
        <h2 className="mt-1 text-lg font-medium tracking-tight">
          {t("lobby.waiting")}{" "}
          <span className="font-mono text-sm text-fg/40">
            {room.players.length}/{room.maxPlayers}
          </span>
        </h2>
        <p className="text-sm text-fg/50">
          {t("lobby.doodle")}{" "}
          <span className="font-mono text-[11px] tracking-wide text-fg/40 uppercase">
            · {t("lobby.words", { lang: t(`lang.${room.lang ?? "nl"}`) })}
          </span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button className="btn-secondary py-2 text-sm" onClick={share}>
          {copied ? <CheckIcon className="h-4 w-4 text-mint" /> : <LinkIcon className="h-4 w-4" />}
          {copied ? t("lobby.copied") : t("lobby.share")}
        </button>
        {isHost ? (
          <button
            className="btn-accent py-2 text-sm"
            disabled={!canStart}
            title={canStart ? undefined : t("lobby.needPlayers", { n: MIN_PLAYERS_TO_START })}
            onClick={() => getGameClient().send({ type: "start" })}
          >
            {t("lobby.start")}
          </button>
        ) : (
          <span className="font-mono text-[11px] tracking-[0.14em] text-fg/40 uppercase">{t("lobby.hostStarts")}</span>
        )}
      </div>
    </div>
  );
}
