"use client";

import { useEffect, useRef } from "react";
import { CANVAS_ASPECT, type DrawTool, type Point, type Stroke } from "@guessdrawing/shared";
import { getGameClient } from "@/lib/game-client";
import { renderAll, renderStroke } from "@/lib/render";

// Bundling points keeps the number of WebSocket messages (and the free-tier usage) low.
const SEND_INTERVAL_MS = 60;
/** Skip points closer than this to the previous one (normalised units). */
const MIN_POINT_DISTANCE = 0.0015;

function newStrokeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export interface Brush {
  tool: DrawTool;
  color: string;
  size: number;
}

export function DrawingCanvas({ canDraw, brush }: { canDraw: boolean; brush: Brush }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const brushRef = useRef(brush);
  brushRef.current = brush;
  const canDrawRef = useRef(canDraw);
  canDrawRef.current = canDraw;

  // Keep the canvas pixel size in sync with its CSS size and redraw on changes.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const client = getGameClient();
    const store = client.drawing;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round((rect.width / CANVAS_ASPECT) * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      renderAll(ctx, store.strokes);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrapperRef.current!);
    resize();

    const unsubscribe = store.subscribe((e) => {
      if (e.type === "reset") renderAll(ctx, store.strokes);
      else if (e.type === "begin") renderStroke(ctx, e.stroke);
      else renderStroke(ctx, e.stroke, e.from);
    });

    return () => {
      ro.disconnect();
      unsubscribe();
    };
  }, []);

  // Pointer input: works for mouse, pen and touch alike.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const client = getGameClient();
    const store = client.drawing;

    let activePointer: number | null = null;
    let current: Stroke | null = null;
    let pending: Point[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const toPoint = (e: PointerEvent): Point => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
      return [Math.round(x * 10_000) / 10_000, Math.round(y * 10_000) / 10_000];
    };

    const flush = () => {
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = null;
      if (!current || pending.length === 0) return;
      client.send({ type: "draw:points", id: current.id, points: pending });
      pending = [];
    };

    const addPoint = (p: Point) => {
      if (!current) return;
      const last = current.points[current.points.length - 1]!;
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < MIN_POINT_DISTANCE) return;
      store.append(current.id, [p]);
      pending.push(p);
      if (pending.length >= 200) flush();
      else flushTimer ??= setTimeout(flush, SEND_INTERVAL_MS);
    };

    const onDown = (e: PointerEvent) => {
      if (!canDrawRef.current || activePointer !== null) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      activePointer = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      const { tool, color, size } = brushRef.current;
      current = { id: newStrokeId(), tool, color, size, points: [toPoint(e)] };
      store.begin(current);
      client.send({ type: "draw:begin", stroke: current });
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== activePointer || !current) return;
      e.preventDefault();
      const events = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
      if (events.length > 0) for (const ce of events) addPoint(toPoint(ce));
      else addPoint(toPoint(e));
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== activePointer) return;
      flush();
      activePointer = null;
      current = null;
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("lostpointercapture", onUp);
    return () => {
      flush();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("lostpointercapture", onUp);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-full" style={{ aspectRatio: CANVAS_ASPECT }}>
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full rounded-[20px] bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_20px_60px_-20px_rgba(109,139,255,0.35)] ${canDraw ? "cursor-crosshair" : ""}`}
        style={{ touchAction: canDraw ? "none" : "auto" }}
      />
    </div>
  );
}
