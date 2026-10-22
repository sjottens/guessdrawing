"use client";

import { useState } from "react";
import type { RoomState } from "@guessdrawing/shared";

/** Compact bar shown above the canvas while waiting for players. */
export function Lobby({ room }: { room: RoomState }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const link = `${window.location.origin}/room/${room.code}`;
    try {
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        await navigator.share({ title: "Doe mee met Krabbel!", url: link });
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
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-3">
      <div>
        <h2 className="font-black text-indigo-900">Wachten op spelers… ({room.players.length}/{room.maxPlayers})</h2>
        <p className="text-sm text-slate-500">
          Code <span className="font-mono font-black tracking-widest text-indigo-700">{room.code}</span> · teken alvast
          wat!
        </p>
      </div>
      <button className="btn-secondary py-2 text-sm" onClick={share}>
        {copied ? "Gekopieerd ✓" : "Link delen"}
      </button>
    </div>
  );
}
