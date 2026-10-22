import { afterEach, describe, expect, it } from "vitest";
import { BRUSH_SIZES, COLORS, type Stroke } from "@guessdrawing/shared";
import { join, startServer, waitFor } from "./helpers.js";

let server: Awaited<ReturnType<typeof startServer>>;
afterEach(async () => server?.close());

const stroke = (id: string, points: Stroke["points"] = [[0.1, 0.1]]): Stroke => ({
  id,
  tool: "pen",
  color: COLORS[0],
  size: BRUSH_SIZES[0],
  points,
});

async function twoPlayers() {
  server = await startServer();
  const a = await server.connect();
  const res = await join(a, "Anna", "tok-a");
  if (!res.ok) throw new Error();
  const b = await server.connect();
  await join(b, "Bram", "tok-b", res.data.code);
  return { a, b, code: res.data.code };
}

describe("drawing", () => {
  it("relays strokes to the other players and syncs late joiners", async () => {
    const { a, b, code } = await twoPlayers();
    const got: unknown[] = [];
    b.on("draw:begin", (s) => got.push(["begin", s.id]));
    b.on("draw:points", (p) => got.push(["points", p.points.length]));

    a.emit("draw:begin", stroke("s1"));
    a.emit("draw:points", { id: "s1", points: [[0.2, 0.2], [0.3, 0.3]] });
    await waitFor(() => got.length === 2);
    expect(got).toEqual([["begin", "s1"], ["points", 2]]);

    const c = await server.connect();
    const synced = new Promise<Stroke[]>((r) => c.on("draw:sync", r));
    await join(c, "Cas", "tok-c", code);
    const strokes = await synced;
    expect(strokes).toHaveLength(1);
    expect(strokes[0]!.points).toEqual([[0.1, 0.1], [0.2, 0.2], [0.3, 0.3]]);
  });

  it("ignores invalid strokes and clamps coordinates", async () => {
    const { a, b } = await twoPlayers();
    const got: Stroke[] = [];
    b.on("draw:begin", (s) => got.push(s));
    a.emit("draw:begin", { ...stroke("bad"), color: "url(evil)" });
    a.emit("draw:begin", { ...stroke("bad2"), size: 5 });
    a.emit("draw:begin", stroke("ok", [[-1, 2]]));
    await waitFor(() => got.length === 1);
    expect(got[0]!.id).toBe("ok");
    expect(got[0]!.points).toEqual([[0, 1]]);
  });

  it("undo removes only your own last stroke; clear wipes everything", async () => {
    const { a, b } = await twoPlayers();
    const removed: string[] = [];
    let cleared = 0;
    a.on("draw:remove", (id) => removed.push(id));
    a.on("draw:clear", () => cleared++);

    a.emit("draw:begin", stroke("a1"));
    b.emit("draw:begin", stroke("b1"));
    await new Promise((r) => setTimeout(r, 30));
    a.emit("draw:undo");
    await waitFor(() => removed.length === 1);
    expect(removed).toEqual(["a1"]);

    b.emit("draw:clear");
    await waitFor(() => cleared === 1);
  });
});
