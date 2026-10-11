import { describe, expect, it } from "vitest";
import {
  accountStatusLabel,
  accountStatusTone,
  normalizeAccountStatus,
  resolveAccountStatus,
  resolvePresence,
} from "./accountStatus";
import { PRESENCE_STALE_MS } from "../lib/presence";

describe("account status vs presence", () => {
  it("normalizes unknown or missing status to active only for legacy documents", () => {
    expect(normalizeAccountStatus(undefined)).toBe("active");
    expect(normalizeAccountStatus("pending_verification")).toBe("pending_verification");
    expect(normalizeAccountStatus("disabled")).toBe("disabled");
    expect(normalizeAccountStatus("owner")).toBe("active");
  });

  it("a suspended access assignment always wins over the directory status", () => {
    expect(resolveAccountStatus("active", false)).toBe("disabled");
    expect(resolveAccountStatus("pending_verification", false)).toBe("disabled");
    expect(resolveAccountStatus("active", true)).toBe("active");
    expect(resolveAccountStatus("active", undefined)).toBe("active");
    expect(resolveAccountStatus("disabled", true)).toBe("disabled");
  });

  const fresh = (now: number) => ({ online: true, lastSeenAt: new Date(now - 1000).toISOString() });

  it("Active + Online and Active + Offline are different, independent states", () => {
    const now = Date.now();
    expect(resolvePresence("active", fresh(now), now)).toBe(true);
    expect(resolvePresence("active", undefined, now)).toBe(false);
  });

  it("a disabled or pending account is never shown Online, even with a fresh heartbeat", () => {
    const now = Date.now();
    expect(resolvePresence("disabled", fresh(now), now)).toBe(false);
    expect(resolvePresence("pending_verification", fresh(now), now)).toBe(false);
  });

  it("a heartbeat older than the stale window flips to Offline (closed tab, lost network, expired session)", () => {
    const now = Date.now();
    const stale = { online: true, lastSeenAt: new Date(now - PRESENCE_STALE_MS - 1).toISOString() };
    expect(resolvePresence("active", stale, now)).toBe(false);
  });

  it("an explicit sign-out (online=false) is Offline immediately", () => {
    const now = Date.now();
    expect(resolvePresence("active", { online: false, lastSeenAt: new Date(now).toISOString() }, now)).toBe(false);
  });

  it("labels and tones are localized and never conflate Active with Online", () => {
    expect(accountStatusLabel("active", "nl")).toBe("Actief");
    expect(accountStatusLabel("active", "en")).toBe("Active");
    expect(accountStatusLabel("disabled", "nl")).toBe("Uitgeschakeld");
    expect(accountStatusLabel("pending_verification", "en")).toBe("Pending verification");
    expect(accountStatusTone("disabled")).toBe("danger");
    expect(accountStatusTone("pending_verification")).toBe("warning");
    expect(accountStatusTone("active")).toBe("success");
  });
});
