import { describe, expect, it } from "vitest";
import { deriveConnectivity, isConnectivityError } from "./connectivity";

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

describe("isConnectivityError", () => {
  it("treats an authorization or validation rejection as NOT a connectivity issue", () => {
    expect(isConnectivityError({ code: "permission-denied" })).toBe(false);
    expect(isConnectivityError({ code: "not-found" })).toBe(false);
    expect(isConnectivityError({ code: "already-exists" })).toBe(false);
    expect(isConnectivityError({ code: "failed-precondition" })).toBe(false);
    expect(isConnectivityError(new Error("This code group already exists."))).toBe(
      false,
    );
  });

  it("treats a service-unreachable style error as a connectivity issue", () => {
    expect(isConnectivityError({ code: "unavailable" })).toBe(true);
    expect(isConnectivityError({ code: "deadline-exceeded" })).toBe(true);
    expect(isConnectivityError({ code: "firestore/unavailable" })).toBe(true);
  });
});
