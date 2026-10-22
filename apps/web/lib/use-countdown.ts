"use client";

import { useEffect, useState } from "react";
import type { RoomState } from "@guessdrawing/shared";

/** Seconds left in the current phase, ticking locally between server updates. */
export function useCountdown(room: RoomState): { secondsLeft: number | null; fraction: number } {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Every new state from the server carries a fresh "time left".
  useEffect(() => {
    setDeadline(room.timeLeftMs === null ? null : Date.now() + room.timeLeftMs);
  }, [room]);

  useEffect(() => {
    if (deadline === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);

  if (deadline === null || !room.phaseDurationMs) return { secondsLeft: null, fraction: 0 };
  const left = Math.max(0, deadline - now);
  return { secondsLeft: Math.ceil(left / 1000), fraction: left / room.phaseDurationMs };
}
