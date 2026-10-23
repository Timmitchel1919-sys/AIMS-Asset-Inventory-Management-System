import { describe, expect, it, vi } from "vitest";
import { persistThemePreference } from "./themePreference";

describe("theme preference persistence", () => {
  it("keeps the selected theme after persistence succeeds", async () => {
    const apply = vi.fn();
    const persist = vi.fn(async () => undefined);

    await persistThemePreference({
      current: "dark",
      next: "aimsTurquoiseGlass",
      apply,
      persist,
    });

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith("aimsTurquoiseGlass");
    expect(persist).toHaveBeenCalledWith("aimsTurquoiseGlass");
  });

  it("restores the previous theme when persistence fails", async () => {
    const apply = vi.fn();
    const denied = new Error("permission-denied");

    await expect(
      persistThemePreference({
        current: "dark",
        next: "aimsTurquoiseGlass",
        apply,
        persist: vi.fn(async () => {
          throw denied;
        }),
      }),
    ).rejects.toBe(denied);

    expect(apply.mock.calls).toEqual([
      ["aimsTurquoiseGlass"],
      ["dark"],
    ]);
  });

  it("does not write when the selected theme is already active", async () => {
    const apply = vi.fn();
    const persist = vi.fn(async () => undefined);

    await persistThemePreference({
      current: "aimsLight",
      next: "aimsLight",
      apply,
      persist,
    });

    expect(apply).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });
});
