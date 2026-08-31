import { describe, expect, it } from "vitest";
import { deriveConnectivity } from "./connectivity";

const base = {
  navOnline: true,
  hasPendingWrites: false,
  serverUnreachable: false,
  writeError: false,
};

describe("deriveConnectivity", () => {
  it("offline beats everything", () => {
    expect(
      deriveConnectivity({ ...base, navOnline: false, hasPendingWrites: true }),
    ).toBe("offline");
  });

  it("pending writes while online means syncing", () => {
    expect(deriveConnectivity({ ...base, hasPendingWrites: true })).toBe("syncing");
  });

  it("server unreachable or a write error means degraded", () => {
    expect(deriveConnectivity({ ...base, serverUnreachable: true })).toBe("degraded");
    expect(deriveConnectivity({ ...base, writeError: true })).toBe("degraded");
  });

  it("syncing takes priority over degraded", () => {
    expect(
      deriveConnectivity({ ...base, hasPendingWrites: true, serverUnreachable: true }),
    ).toBe("syncing");
  });

  it("all clear means online", () => {
    expect(deriveConnectivity(base)).toBe("online");
  });
});
