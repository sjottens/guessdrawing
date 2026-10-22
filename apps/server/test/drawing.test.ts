import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeRoom, stroke } from "./helpers.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("drawing", () => {
  it("relays strokes to others and syncs late joiners", () => {
    const { join } = makeRoom();
    const a = join("Anna");
    const b = join("Bram");
    a.emit({ type: "draw:begin", stroke: stroke("s1") });
    a.emit({ type: "draw:points", id: "s1", points: [[0.2, 0.2], [0.3, 0.3]] });
    expect(b.of("draw:begin").map((m) => m.stroke.id)).toEqual(["s1"]);
    expect(b.of("draw:points")[0]?.points).toHaveLength(2);
    expect(a.of("draw:begin")).toHaveLength(0); // not echoed to the drawer

    const c = join("Cas");
    const sync = c.of("draw:sync")[0]!;
    expect(sync.strokes[0]!.points).toEqual([[0.1, 0.1], [0.2, 0.2], [0.3, 0.3]]);
  });

  it("ignores invalid strokes and clamps coordinates", () => {
    const { join } = makeRoom();
    const a = join("Anna");
    const b = join("Bram");
    a.emit({ type: "draw:begin", stroke: { ...stroke("bad"), color: "url(evil)" } });
    a.emit({ type: "draw:begin", stroke: { ...stroke("bad2"), size: 5 } });
    a.emit({ type: "draw:begin", stroke: stroke("ok", [[-1, 2]]) });
    const got = b.of("draw:begin").map((m) => m.stroke);
    expect(got.map((s) => s.id)).toEqual(["ok"]);
    expect(got[0]!.points).toEqual([[0, 1]]);
  });

  it("undo removes only your own last stroke; clear wipes everything", () => {
    const { join } = makeRoom();
    const a = join("Anna");
    const b = join("Bram");
    a.emit({ type: "draw:begin", stroke: stroke("a1") });
    b.emit({ type: "draw:begin", stroke: stroke("b1") });
    a.emit({ type: "draw:undo" });
    expect(a.of("draw:remove").map((m) => m.id)).toEqual(["a1"]);
    b.emit({ type: "draw:clear" });
    expect(a.of("draw:clear")).toHaveLength(1);
  });
});
