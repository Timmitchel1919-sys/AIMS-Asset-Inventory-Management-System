import { describe, expect, it } from "vitest";
import { isSafeInternalPath, safeTargetFromState } from "./navigation";

describe("safe return-path validation", () => {
  it("accepts internal single-slash paths", () => {
    expect(isSafeInternalPath("/assets/ast-1")).toBe(true);
    expect(isSafeInternalPath("/q/abc")).toBe(true);
    expect(safeTargetFromState({ pathname: "/assets/ast-1" })).toBe(
      "/assets/ast-1",
    );
    expect(
      safeTargetFromState({
        pathname: "/assets",
        search: "?q=1",
        hash: "#top",
      }),
    ).toBe("/assets?q=1#top");
  });

  it("rejects open-redirect vectors", () => {
    expect(isSafeInternalPath("https://evil.example")).toBe(false);
    expect(isSafeInternalPath("//evil.example")).toBe(false);
    expect(isSafeInternalPath("javascript:alert(1)")).toBe(false);
    expect(isSafeInternalPath("")).toBe(false);
    expect(safeTargetFromState({ pathname: "https://evil.example" })).toBeNull();
    expect(safeTargetFromState(null)).toBeNull();
    expect(safeTargetFromState({})).toBeNull();
  });
});