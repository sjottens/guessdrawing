import {
  BRUSH_SIZES,
  COLORS,
  MAX_POINTS_PER_MESSAGE,
  MAX_POINTS_PER_STROKE,
  MAX_STROKES,
  MAX_TOTAL_POINTS,
  type PlayerId,
  type Point,
  type Stroke,
} from "@guessdrawing/shared";

const COLOR_SET = new Set<string>(COLORS);
const SIZE_SET = new Set<number>(BRUSH_SIZES);

/** Validates untrusted points; returns null when anything is off. */
export function parsePoints(raw: unknown, max = MAX_POINTS_PER_MESSAGE): Point[] | null {
  if (!Array.isArray(raw) || raw.length > max) return null;
  const out: Point[] = [];
  for (const p of raw) {
    if (!Array.isArray(p) || p.length !== 2) return null;
    const [x, y] = p;
    if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    out.push([clamp01(x), clamp01(y)]);
  }
  return out;
}

export function parseStroke(raw: unknown): Stroke | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.id !== "string" || s.id.length === 0 || s.id.length > 64) return null;
  if (s.tool !== "pen" && s.tool !== "eraser") return null;
  if (typeof s.color !== "string" || !COLOR_SET.has(s.color)) return null;
  if (typeof s.size !== "number" || !SIZE_SET.has(s.size)) return null;
  const points = parsePoints(s.points);
  if (!points) return null;
  return { id: s.id, tool: s.tool, color: s.color, size: s.size, points };
}

function clamp01(n: number): number {
  return Math.round(Math.min(1, Math.max(0, n)) * 10_000) / 10_000;
}

interface OwnedStroke extends Stroke {
  ownerId: PlayerId;
}

/** The server-side copy of the current drawing. */
export class Drawing {
  private strokes: OwnedStroke[] = [];
  private totalPoints = 0;

  begin(ownerId: PlayerId, stroke: Stroke): boolean {
    if (this.strokes.length >= MAX_STROKES) return false;
    if (this.totalPoints + stroke.points.length > MAX_TOTAL_POINTS) return false;
    if (this.strokes.some((s) => s.id === stroke.id)) return false;
    this.strokes.push({ ...stroke, points: [...stroke.points], ownerId });
    this.totalPoints += stroke.points.length;
    return true;
  }

  append(ownerId: PlayerId, id: string, points: Point[]): boolean {
    // Active strokes are almost always at the end, so search backwards.
    let stroke: OwnedStroke | undefined;
    for (let i = this.strokes.length - 1; i >= 0; i--) {
      if (this.strokes[i]!.id === id) {
        stroke = this.strokes[i];
        break;
      }
    }
    if (!stroke || stroke.ownerId !== ownerId) return false;
    if (stroke.points.length + points.length > MAX_POINTS_PER_STROKE) return false;
    if (this.totalPoints + points.length > MAX_TOTAL_POINTS) return false;
    stroke.points.push(...points);
    this.totalPoints += points.length;
    return true;
  }

  /** Removes the owner's latest stroke and returns its id. */
  undo(ownerId: PlayerId): string | null {
    for (let i = this.strokes.length - 1; i >= 0; i--) {
      const s = this.strokes[i]!;
      if (s.ownerId === ownerId) {
        this.strokes.splice(i, 1);
        this.totalPoints -= s.points.length;
        return s.id;
      }
    }
    return null;
  }

  clear(): void {
    this.strokes = [];
    this.totalPoints = 0;
  }

  get isEmpty(): boolean {
    return this.strokes.length === 0;
  }

  snapshot(): Stroke[] {
    return this.strokes.map(({ ownerId: _ownerId, ...s }) => s);
  }
}
