import { describe, expect, it } from "vitest";
import { swipeDirection } from "./drawerSwipe";

describe("drawer swipe gestures", () => {
  it("recognises clear horizontal swipes", () => {
    expect(swipeDirection(120, 10)).toBe("right");
    expect(swipeDirection(-120, -15)).toBe("left");
  });
  it("ignores short taps and vertical scrolling", () => {
    expect(swipeDirection(30, 0)).toBeNull();
    expect(swipeDirection(90, 80)).toBeNull();
    expect(swipeDirection(5, 300)).toBeNull();
  });
});
