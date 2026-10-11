// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setDoc = vi.fn(async () => undefined);
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, collection: string, id: string) => ({ collection, id }),
  serverTimestamp: () => "SERVER_TIME",
  setDoc: (...args: unknown[]) => (setDoc as (...a: unknown[]) => unknown)(...args),
}));
vi.mock("./firebase", () => ({ requireFirebase: () => ({ db: {} }) }));

import {
  isEffectivelyOnline,
  markPresenceOffline,
  PRESENCE_STALE_MS,
  startPresenceHeartbeat,
  stopPresenceHeartbeat,
} from "./presence";

beforeEach(() => {
  vi.useFakeTimers();
  setDoc.mockClear();
});
afterEach(() => {
  stopPresenceHeartbeat();
  vi.useRealTimers();
});

const lastWrite = () => setDoc.mock.calls.at(-1) as unknown as [{ collection: string; id: string }, { online: boolean; uid: string; lastSeenAt: string }];

describe("presence heartbeat", () => {
  it("marks the user online immediately and keeps refreshing while the session is open", () => {
    startPresenceHeartbeat("u1");
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(lastWrite()[0]).toEqual({ collection: "presence", id: "u1" });
    expect(lastWrite()[1]).toMatchObject({ uid: "u1", online: true, lastSeenAt: "SERVER_TIME" });
    vi.advanceTimersByTime(45_000);
    expect(setDoc).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(45_000);
    expect(setDoc).toHaveBeenCalledTimes(3);
  });

  it("stops refreshing after cleanup (tab closed / signed out) so the record goes stale", () => {
    const stop = startPresenceHeartbeat("u1");
    stop();
    setDoc.mockClear();
    vi.advanceTimersByTime(10 * 60_000);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("a second start replaces the first timer instead of doubling the writes", () => {
    startPresenceHeartbeat("u1");
    startPresenceHeartbeat("u2");
    setDoc.mockClear();
    vi.advanceTimersByTime(45_000);
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(lastWrite()[1].uid).toBe("u2");
  });

  it("re-asserts presence when the tab becomes visible again or the network returns", () => {
    startPresenceHeartbeat("u1");
    setDoc.mockClear();
    window.dispatchEvent(new Event("online"));
    expect(setDoc).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(setDoc).toHaveBeenCalledTimes(2);
  });

  it("removes its listeners on stop (no writes from a signed-out page)", () => {
    startPresenceHeartbeat("u1");
    stopPresenceHeartbeat();
    setDoc.mockClear();
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("focus"));
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("an explicit logout writes offline and stops the timer", async () => {
    startPresenceHeartbeat("u1");
    await markPresenceOffline("u1");
    expect(lastWrite()[1]).toMatchObject({ online: false });
    setDoc.mockClear();
    vi.advanceTimersByTime(5 * 60_000);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("presence write failures never throw into the sign-in flow", async () => {
    setDoc.mockRejectedValueOnce(new Error("offline"));
    await expect(markPresenceOffline("u1")).resolves.toBeUndefined();
  });
});

describe("isEffectivelyOnline", () => {
  const now = Date.parse("2026-10-11T10:00:00Z");
  it("is online only for a fresh online heartbeat", () => {
    expect(isEffectivelyOnline({ online: true, lastSeenAt: new Date(now - 10_000).toISOString() }, now)).toBe(true);
    expect(isEffectivelyOnline({ online: true, lastSeenAt: new Date(now - PRESENCE_STALE_MS - 1).toISOString() }, now)).toBe(false);
    expect(isEffectivelyOnline({ online: false, lastSeenAt: new Date(now).toISOString() }, now)).toBe(false);
    expect(isEffectivelyOnline(undefined, now)).toBe(false);
    expect(isEffectivelyOnline({ online: true }, now)).toBe(false);
  });
});
