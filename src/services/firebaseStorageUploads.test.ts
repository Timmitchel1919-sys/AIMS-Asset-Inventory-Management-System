import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  safeUploadName,
  validateUpload,
} from "./firebaseStorageUploads";

describe("Firebase Storage uploads", () => {
  it("sanitizes file names for object paths", () => {
    expect(safeUploadName(" vóór foto (1).png ")).toBe("voor-foto-1-.png");
    expect(safeUploadName("../../")).toBe("file");
  });

  it("accepts supported files below ten megabytes", () => {
    expect(() =>
      validateUpload({ name: "photo.jpg", type: "image/jpeg", size: 12 }),
    ).not.toThrow();
  });

  it("rejects empty, oversized, and unsupported files", () => {
    expect(() =>
      validateUpload({ name: "empty.pdf", type: "application/pdf", size: 0 }),
    ).toThrow("empty");
    expect(() =>
      validateUpload({
        name: "large.pdf",
        type: "application/pdf",
        size: MAX_UPLOAD_BYTES,
      }),
    ).toThrow("10 MB");
    expect(() =>
      validateUpload({ name: "script.svg", type: "image/svg+xml", size: 12 }),
    ).toThrow("not allowed");
  });
});
