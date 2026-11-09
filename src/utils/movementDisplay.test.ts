import { describe, expect, it } from "vitest";
import { displayMovementPerformer } from "./movementDisplay";

describe("displayMovementPerformer", () => {
  it("uses the requested operator name for historic Naomi Williams rows", () => {
    expect(displayMovementPerformer("Naomi Williams")).toBe("Shaquil Alienda");
    expect(displayMovementPerformer(" naomi williams ")).toBe("Shaquil Alienda");
  });

  it("preserves every other operator", () => {
    expect(displayMovementPerformer("Michael K.")).toBe("Michael K.");
  });
});
