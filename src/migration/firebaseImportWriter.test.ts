import { describe, expect, it } from "vitest";
import type { ImportWrite } from "./finalImportPlan";
import { prepareImportWriteData } from "./firebaseImportWriter";

const write: ImportWrite = {
  phase: "assets",
  collection: "assets",
  documentId: "asset-1",
  mode: "upsert",
  fingerprint: "fingerprint",
  data: {
    name: "Laptop",
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "Admin name",
    updatedAt: "2026-01-01T00:00:00.000Z",
    updatedBy: "Admin name",
  },
};

describe("Firestore import writes", () => {
  it("preserves existing immutable creation metadata by omitting it", () => {
    const timestamp = { server: true };

    expect(prepareImportWriteData(write, true, "uid-1", timestamp)).toEqual({
      name: "Laptop",
      updatedAt: timestamp,
      updatedBy: "uid-1",
    });
  });

  it("uses trusted server audit metadata for a new document", () => {
    const timestamp = { server: true };

    expect(prepareImportWriteData(write, false, "uid-1", timestamp)).toEqual({
      name: "Laptop",
      createdAt: timestamp,
      createdBy: "uid-1",
      updatedAt: timestamp,
      updatedBy: "uid-1",
    });
  });
});
