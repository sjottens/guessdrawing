"use client";

import { BRUSH_SIZES, COLORS } from "@guessdrawing/shared";
import { useT } from "@/lib/i18n";
import type { Brush } from "./DrawingCanvas";
import { EraserIcon, TrashIcon, UndoIcon } from "./Icons";

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
  const { t } = useT();
  const isEraser = brush.tool === "eraser";
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-3 px-1 py-2">
      <div className="grid grid-cols-8 gap-1.5">
        {COLORS.map((c) => {
          const active = !isEraser && brush.color === c;
          return (
            <button
              key={c}
              aria-label={t("tool.color", { color: c })}
              aria-pressed={active}
              onClick={() => onChange({ ...brush, tool: "pen", color: c })}
              className={`h-7 w-7 cursor-pointer rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)] transition duration-200 hover:scale-110 sm:h-6 sm:w-6 ${
                active ? "scale-110 ring-2 ring-fg ring-offset-2 ring-offset-bg" : ""
              }`}
              style={{ backgroundColor: c }}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
        {BRUSH_SIZES.map((s, i) => (
          <button
            key={s}
            aria-label={t("tool.size", { n: i + 1 })}
            aria-pressed={brush.size === s}
            onClick={() => onChange({ ...brush, size: s })}
            className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition ${
              brush.size === s ? "bg-white/15" : "hover:bg-white/[0.07]"
            }`}
          >
            <span
              className="rounded-full"
              style={{
                width: 4 + i * 5,
                height: 4 + i * 5,
                backgroundColor: isEraser ? "#8a90a2" : brush.color === "#000000" ? "#eef0f6" : brush.color,
              }}
            />
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
        <ToolButton label={t("tool.eraser")} active={isEraser} onClick={() => onChange({ ...brush, tool: isEraser ? "pen" : "eraser" })}>
          <EraserIcon className="h-4 w-4" />
        </ToolButton>
        <ToolButton label={t("tool.undo")} onClick={onUndo}>
          <UndoIcon className="h-4 w-4" />
        </ToolButton>
        {canClear && (
          <ToolButton label={t("tool.clear")} danger onClick={onClear}>
            <TrashIcon className="h-4 w-4" />
          </ToolButton>
        )}
      </div>
    </div>
  );
}

function ToolButton({
  label,
  active = false,
  danger = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition ${
        active ? "bg-accent text-white shadow-[0_0_16px_-2px_var(--color-accent)]" : "text-fg/70 hover:bg-white/[0.08] hover:text-fg"
      } ${danger ? "hover:text-hot" : ""}`}
    >
      {children}
    </button>
  );
}
