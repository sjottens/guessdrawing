/** A point in normalised canvas coordinates: both axes run from 0 to 1. */
export type Point = [x: number, y: number];

export type DrawTool = "pen" | "eraser";

export interface Stroke {
  id: string;
  tool: DrawTool;
  color: string;
  /** Line width as a fraction of the canvas width. */
  size: number;
  points: Point[];
}

/** Width / height of the drawing surface. Same everywhere so drawings line up. */
export const CANVAS_ASPECT = 4 / 3;
export const CANVAS_BACKGROUND = "#ffffff";

export const BRUSH_SIZES = [0.006, 0.014, 0.035] as const;

export const COLORS = [
  "#000000",
  "#ffffff",
  "#9ca3af",
  "#4b5563",
  "#ef4444",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#15803d",
  "#38bdf8",
  "#2563eb",
  "#7c3aed",
  "#ec4899",
  "#fda4af",
  "#92400e",
  "#fcd9b6",
] as const;

export const MAX_STROKES = 2_000;
export const MAX_POINTS_PER_STROKE = 4_000;
export const MAX_POINTS_PER_MESSAGE = 400;
export const MAX_TOTAL_POINTS = 120_000;
