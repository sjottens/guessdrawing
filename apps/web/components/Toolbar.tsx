"use client";

import { BRUSH_SIZES, COLORS } from "@guessdrawing/shared";
import type { Brush } from "./DrawingCanvas";

export function Toolbar({
  brush,
  onChange,
  onUndo,
  onClear,
  canClear = true,
}: {
  brush: Brush;
  onChange: (b: Brush) => void;
  onUndo: () => void;
  onClear: () => void;
  canClear?: boolean;
}) {
  const isEraser = brush.tool === "eraser";
  return (
    <div className="flex flex-wrap items-center gap-2 p-2">
      <div className="grid grid-cols-8 gap-1">
        {COLORS.map((c) => (
          <button
            key={c}
            aria-label={`Kleur ${c}`}
            onClick={() => onChange({ ...brush, tool: "pen", color: c })}
            className={`h-7 w-7 rounded-md border border-slate-300 transition sm:h-6 sm:w-6 ${
              !isEraser && brush.color === c ? "scale-110 ring-2 ring-indigo-500 ring-offset-1" : ""
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <div className="flex items-center gap-1">
        {BRUSH_SIZES.map((s, i) => (
          <button
            key={s}
            aria-label={`Dikte ${i + 1}`}
            onClick={() => onChange({ ...brush, size: s })}
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${
              brush.size === s ? "bg-indigo-100 ring-2 ring-indigo-400" : "bg-slate-100"
            }`}
          >
            <span
              className="rounded-full bg-slate-800"
              style={{ width: 4 + i * 6, height: 4 + i * 6, backgroundColor: isEraser ? "#94a3b8" : brush.color === "#ffffff" ? "#cbd5e1" : brush.color }}
            />
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <ToolButton label="Gum" active={isEraser} onClick={() => onChange({ ...brush, tool: isEraser ? "pen" : "eraser" })}>
          🧽
        </ToolButton>
        <ToolButton label="Ongedaan maken" onClick={onUndo}>
          ↩️
        </ToolButton>
        {canClear && (
          <ToolButton label="Alles wissen" onClick={onClear}>
            🗑️
          </ToolButton>
        )}
      </div>
    </div>
  );
}

function ToolButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg ${
        active ? "bg-indigo-100 ring-2 ring-indigo-400" : "bg-slate-100 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
