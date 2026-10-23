"use client";

import { useEffect, useRef } from "react";
import type { Focus, ShapeEvent } from "./nebula-three";

/**
 * Full-screen particle nebula behind the page. three.js is loaded on demand,
 * so it never delays the first paint, and without WebGL the page stays flat.
 */
export function NebulaScene({ focus = "right", onShape }: { focus?: Focus; onShape?: (e: ShapeEvent) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onShapeRef = useRef(onShape);
  onShapeRef.current = onShape;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    void import("./nebula-three").then(({ mountNebula }) => {
      if (cancelled) return;
      try {
        cleanup = mountNebula(host, { focus, onShape: (e) => onShapeRef.current?.(e) });
      } catch {
        /* No WebGL: the page simply stays flat. */
      }
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [focus]);

  return <div ref={hostRef} aria-hidden className="pointer-events-none fixed inset-0 z-0 animate-fade" />;
}
