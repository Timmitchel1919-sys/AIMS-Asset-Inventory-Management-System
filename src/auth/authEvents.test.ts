import { beforeEach, describe, expect, it, vi } from "vitest";

const callable = vi.fn();
const httpsCallable = vi.fn(() => callable);
vi.mock("firebase/functions", () => ({
  httpsCallable: (...args: unknown[]) => (httpsCallable as (...a: unknown[]) => unknown)(...args),
}));
vi.mock("../lib/firebase", () => ({ firebaseFunctions: { name: "functions" } }));

import { reportAuthEvent } from "./authEvents";

beforeEach(() => {
  callable.mockReset();
  httpsCallable.mockClear();
});

describe("reportAuthEvent", () => {
  it("calls the trusted function with only the event name and non-sensitive profile hints", async () => {
    callable.mockResolvedValue({ data: { ok: true, status: "active", emailVerified: true } });
    const result = await reportAuthEvent("login", { department: "ICT", jobTitle: null });
    expect(httpsCallable).toHaveBeenCalledWith({ name: "functions" }, "recordAuthEvent");
    expect(callable).toHaveBeenCalledWith({ event: "login", profile: { department: "ICT" } });
    expect(result).toEqual({ ok: true, status: "active", emailVerified: true });
  });

  it("sends no credentials: the payload is just the event", async () => {
    callable.mockResolvedValue({ data: { ok: true, status: "active", emailVerified: true } });
    await reportAuthEvent("logout");
    expect(callable).toHaveBeenCalledWith({ event: "logout" });
    expect(JSON.stringify(callable.mock.calls)).not.toMatch(/password|token/i);
  });

  it("never throws: a failing function must not break sign-in", async () => {
    callable.mockRejectedValue(new Error("unavailable"));
    await expect(reportAuthEvent("login")).resolves.toBeNull();
  });

  it("gives up after the timeout instead of hanging sign-out", async () => {
    vi.useFakeTimers();
    callable.mockReturnValue(new Promise(() => undefined));
    const pending = reportAuthEvent("logout", undefined, 2000);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(pending).resolves.toBeNull();
    vi.useRealTimers();
  });

  it("surfaces a disabled account so the caller can block the session", async () => {
    callable.mockResolvedValue({ data: { ok: true, status: "disabled", emailVerified: true } });
    expect((await reportAuthEvent("login"))?.status).toBe("disabled");
  });
});
