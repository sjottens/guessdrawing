import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_PLAYERS } from "@guessdrawing/shared";
import { makeRoom } from "./helpers.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("rooms", () => {
  it("lets players join and makes the first one host", () => {
    const { join } = makeRoom();
    const a = join("Anna");
    const b = join("Bram");
    expect(a.state.players.map((p) => p.name)).toEqual(["Anna", "Bram"]);
    expect(a.state.hostId).toBe(a.state.you);
    expect(b.state.hostId).not.toBe(b.state.you);
  });

  it("refuses empty names and missing tokens", () => {
    const { join, room } = makeRoom();
    const a = join("   ");
    expect(a.of("error")[0]?.error).toBe("INVALID_NAME");
    expect(a.closed).not.toBeNull();
    const b = join("Bram", "");
    expect(b.of("error")[0]?.error).toBe("NOT_ALLOWED");
    expect(room.isEmpty).toBe(true);
  });

  it("limits rooms to the max number of players", () => {
    const { join } = makeRoom();
    for (let i = 0; i < MAX_PLAYERS; i++) join(`P${i}`);
    const extra = join("Extra");
    expect(extra.of("error")[0]?.error).toBe("ROOM_FULL");
  });

  it("passes host on when the host leaves and reports when empty", () => {
    const onEmpty = vi.fn();
    const { join } = makeRoom({}, onEmpty);
    const a = join("Anna");
    const b = join("Bram");
    a.emit({ type: "leave" });
    expect(b.state.players).toHaveLength(1);
    expect(b.state.hostId).toBe(b.state.you);
    b.emit({ type: "leave" });
    expect(onEmpty).toHaveBeenCalledOnce();
  });

  it("keeps the seat during a short disconnect and restores it on rejoin", () => {
    const { join } = makeRoom({ reconnectGraceMs: 30_000 });
    const a = join("Anna");
    const b = join("Bram");
    const bramId = b.state.you;

    b.drop();
    expect(a.state.players.find((p) => p.id === bramId)?.connected).toBe(false);

    vi.advanceTimersByTime(20_000);
    const b2 = join("Bram"); // same token
    expect(b2.state.you).toBe(bramId);
    expect(a.state.players.find((p) => p.id === bramId)?.connected).toBe(true);

    // Staying away longer than the grace period removes the player.
    b2.drop();
    vi.advanceTimersByTime(30_001);
    expect(a.state.players).toHaveLength(1);
  });

  it("a newer connection with the same token replaces the old one", () => {
    const { join } = makeRoom();
    const a1 = join("Anna");
    const a2 = join("Anna");
    expect(a1.closed?.code).toBe(4000);
    a1.drop(); // late close event of the old socket must not mark Anna away
    expect(a2.me.connected).toBe(true);
  });
});
