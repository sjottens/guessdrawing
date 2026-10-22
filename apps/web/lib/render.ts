import { CANVAS_BACKGROUND, type Stroke } from "@guessdrawing/shared";

export function strokeColor(stroke: Stroke): string {
  return stroke.tool === "eraser" ? CANVAS_BACKGROUND : stroke.color;
}

/**
 * Draws a stroke onto the canvas. With `from` > 0 only the new part is
 * drawn, which keeps live drawing cheap.
 */
export function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, from = 0): void {
  const { width: w, height: h } = ctx.canvas;
  const pts = stroke.points;
  if (pts.length === 0) return;
  const lineWidth = Math.max(1, stroke.size * w);
  ctx.strokeStyle = ctx.fillStyle = strokeColor(stroke);
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (pts.length === 1) {
    const [x, y] = pts[0]!;
    ctx.beginPath();
    ctx.arc(x * w, y * h, lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const start = Math.max(0, from - 1);
  ctx.beginPath();
  ctx.moveTo(pts[start]![0] * w, pts[start]![1] * h);
  for (let i = start + 1; i < pts.length; i++) ctx.lineTo(pts[i]![0] * w, pts[i]![1] * h);
  ctx.stroke();
}

export function renderAll(ctx: CanvasRenderingContext2D, strokes: Stroke[]): void {
  ctx.fillStyle = CANVAS_BACKGROUND;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const s of strokes) renderStroke(ctx, s);
}
