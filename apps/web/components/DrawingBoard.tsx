"use client";

import { useEffect, useState } from "react";
import { BRUSH_SIZES, COLORS } from "@guessdrawing/shared";
import { getGameClient } from "@/lib/game-client";
import { DrawingCanvas, type Brush } from "./DrawingCanvas";
import { Toolbar } from "./Toolbar";

export function DrawingBoard({ canDraw, overlay }: { canDraw: boolean; overlay?: React.ReactNode }) {
  const [brush, setBrush] = useState<Brush>({ tool: "pen", color: COLORS[0], size: BRUSH_SIZES[1] });

  const undo = () => getGameClient().send({ type: "draw:undo" });
  const clear = () => getGameClient().send({ type: "draw:clear" });

  // Ctrl/Cmd+Z for undo on desktop.
  useEffect(() => {
    if (!canDraw) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canDraw]);

  return (
    <div className="flex flex-col">
      <div className="relative">
        <DrawingCanvas canDraw={canDraw} brush={brush} />
        {overlay && (
          <div className="absolute inset-0 flex overflow-y-auto rounded-xl bg-indigo-950/70 p-3 backdrop-blur-[2px]">
            <div className="m-auto flex w-full justify-center">{overlay}</div>
          </div>
        )}
      </div>
      {canDraw && <Toolbar brush={brush} onChange={setBrush} onUndo={undo} onClear={clear} />}
    </div>
  );
}
