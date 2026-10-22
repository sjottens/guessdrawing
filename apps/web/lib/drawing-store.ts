import type { Point, Stroke } from "@guessdrawing/shared";

export type DrawingEvent =
  | { type: "reset" }
  | { type: "begin"; stroke: Stroke }
  | { type: "points"; stroke: Stroke; from: number };

/**
 * Client-side copy of the drawing. Lives outside React so that
 * hundreds of point updates per second don't trigger re-renders.
 */
export class DrawingStore {
  strokes: Stroke[] = [];
  private readonly listeners = new Set<(e: DrawingEvent) => void>();

  subscribe(listener: (e: DrawingEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(e: DrawingEvent): void {
    for (const l of this.listeners) l(e);
  }

  reset(strokes: Stroke[]): void {
    this.strokes = strokes.map((s) => ({ ...s, points: [...s.points] }));
    this.emit({ type: "reset" });
  }

  begin(stroke: Stroke): void {
    const copy = { ...stroke, points: [...stroke.points] };
    this.strokes.push(copy);
    this.emit({ type: "begin", stroke: copy });
  }

  append(id: string, points: Point[]): void {
    const stroke = this.find(id);
    if (!stroke) return;
    const from = stroke.points.length;
    stroke.points.push(...points);
    this.emit({ type: "points", stroke, from });
  }

  remove(id: string): void {
    const before = this.strokes.length;
    this.strokes = this.strokes.filter((s) => s.id !== id);
    if (this.strokes.length !== before) this.emit({ type: "reset" });
  }

  clear(): void {
    this.strokes = [];
    this.emit({ type: "reset" });
  }

  private find(id: string): Stroke | undefined {
    for (let i = this.strokes.length - 1; i >= 0; i--) if (this.strokes[i]!.id === id) return this.strokes[i];
    return undefined;
  }
}
