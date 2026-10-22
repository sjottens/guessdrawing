import { afterEach, describe, expect, it } from "vitest";
import { MAX_PLAYERS } from "@guessdrawing/shared";
import { join, startServer, waitFor } from "./helpers.js";

let server: Awaited<ReturnType<typeof startServer>>;
afterEach(async () => server?.close());

describe("rooms", () => {
  it("creates a room and lets others join by code", async () => {
    server = await startServer();
    const a = await server.connect();
    const res = await join(a, "Anna", "tok-a");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const code = res.data.code;
    expect(code).toMatch(/^[A-Z0-9]{5}$/);

    const b = await server.connect();
    const resB = await join(b, "Bram", "tok-b", code.toLowerCase());
    expect(resB.ok).toBe(true);

    const state = await waitFor(() => a.states.find((s) => s.players.length === 2));
    expect(state.players.map((p) => p.name)).toEqual(["Anna", "Bram"]);
    expect(state.hostId).toBe(state.you);
  });

  it("rejects unknown rooms and empty names", async () => {
    server = await startServer();
    const a = await server.connect();
    expect(await join(a, "Anna", "t", "ZZZZZ")).toMatchObject({ ok: false, error: "ROOM_NOT_FOUND" });
    expect(await join(a, "   ", "t")).toMatchObject({ ok: false, error: "INVALID_NAME" });
  });

  it("limits rooms to the max number of players", async () => {
    server = await startServer();
    const host = await server.connect();
    const res = await join(host, "Host", "t0");
    if (!res.ok) throw new Error();
    for (let i = 1; i < MAX_PLAYERS; i++) {
      const c = await server.connect();
      expect((await join(c, `P${i}`, `t${i}`, res.data.code)).ok).toBe(true);
    }
    const extra = await server.connect();
    expect(await join(extra, "Extra", "tx", res.data.code)).toMatchObject({ ok: false, error: "ROOM_FULL" });
  });

  it("passes host on when the host leaves and deletes empty rooms", async () => {
    server = await startServer();
    const a = await server.connect();
    const res = await join(a, "Anna", "tok-a");
    if (!res.ok) throw new Error();
    const b = await server.connect();
    await join(b, "Bram", "tok-b", res.data.code);

    a.emit("room:leave");
    const s = await waitFor(() => b.states.find((st) => st.players.length === 1));
    expect(s.hostId).toBe(s.you);

    b.emit("room:leave");
    await waitFor(() => server.rooms.size === 0);
  });

  it("keeps the seat during a short disconnect and restores it on rejoin", async () => {
    server = await startServer({ room: { reconnectGraceMs: 200 } });
    const a = await server.connect();
    const res = await join(a, "Anna", "tok-a");
    if (!res.ok) throw new Error();
    const b = await server.connect();
    await join(b, "Bram", "tok-b", res.data.code);
    const bramId = (await waitFor(() => b.lastState()))!.you;

    b.disconnect();
    await waitFor(() => a.states.find((s) => s.players.some((p) => p.id === bramId && !p.connected)));

    const b2 = await server.connect();
    expect((await join(b2, "Bram", "tok-b", res.data.code)).ok).toBe(true);
    const restored = await waitFor(() => b2.lastState());
    expect(restored.you).toBe(bramId);
    expect(restored.players.find((p) => p.id === bramId)?.connected).toBe(true);

    // A player who stays away longer than the grace period is removed.
    b2.disconnect();
    await waitFor(() => a.states.find((s) => s.players.length === 1), 1000);
  });
});
