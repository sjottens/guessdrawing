"use client";

import { useState } from "react";
import type { RoomState } from "@guessdrawing/shared";

export function Lobby({ room }: { room: RoomState }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/room/${room.code}` : "";

  async function copy() {
    try {
      if (navigator.share && /Mobi/i.test(navigator.userAgent)) {
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
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-2xl font-black text-indigo-900">Wachten op spelers…</h2>
      <p className="text-slate-500">
        Deel de code <span className="font-mono text-xl font-black tracking-widest text-indigo-700">{room.code}</span> of
        de link met je vrienden.
      </p>
      <button className="btn-secondary" onClick={copy}>
        {copied ? "Gekopieerd ✓" : "Uitnodigingslink delen"}
      </button>
      <p className="text-sm text-slate-400">
        {room.players.length}/{room.maxPlayers} spelers
      </p>
    </div>
  );
}
