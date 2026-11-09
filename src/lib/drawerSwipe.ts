/**
 * Mobile navigation drawer swipe gestures.
 *
 * Swipe right opens the drawer, swipe left closes it. A swipe only counts
 * when it is clearly horizontal and long enough, and an opening swipe is
 * ignored when it starts inside something that scrolls horizontally itself
 * (dashboard carousel, wide tables) or inside a form control.
 */
export const SWIPE_MIN_DISTANCE = 60;
export const SWIPE_MAX_SLOPE = 0.6;

export type SwipeDirection = "left" | "right" | null;

export function swipeDirection(dx: number, dy: number): SwipeDirection {
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return null;
  if (Math.abs(dy) > Math.abs(dx) * SWIPE_MAX_SLOPE) return null;
  return dx > 0 ? "right" : "left";
}

/** True when the touch started in an element that handles horizontal pans itself. */
export function startsInHorizontalScroller(target: EventTarget | null): boolean {
  let node = target instanceof Element ? target : null;
  while (node && node !== document.body) {
    if (node.matches("input, select, textarea, [contenteditable='true'], [data-swipe-ignore]"))
      return true;
    const style = getComputedStyle(node);
    if (
      /(auto|scroll)/.test(style.overflowX) &&
      node.scrollWidth > node.clientWidth + 1
    )
      return true;
    node = node.parentElement;
  }
  return false;
}

export function bindDrawerSwipe(options: {
  isOpen: () => boolean;
  setOpen: (open: boolean) => void;
  enabled: () => boolean;
}): () => void {
  let startX = 0;
  let startY = 0;
  let tracking = false;
  let blocked = false;
  const start = (event: TouchEvent) => {
    if (!options.enabled() || event.touches.length !== 1) {
      tracking = false;
      return;
    }
    const touch = event.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    tracking = true;
    blocked = !options.isOpen() && startsInHorizontalScroller(event.target);
  };
  const end = (event: TouchEvent) => {
    if (!tracking) return;
    tracking = false;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const direction = swipeDirection(touch.clientX - startX, touch.clientY - startY);
    if (direction === "right" && !options.isOpen() && !blocked) options.setOpen(true);
    else if (direction === "left" && options.isOpen()) options.setOpen(false);
  };
  const cancel = () => {
    tracking = false;
  };
  document.addEventListener("touchstart", start, { passive: true });
  document.addEventListener("touchend", end, { passive: true });
  document.addEventListener("touchcancel", cancel, { passive: true });
  return () => {
    document.removeEventListener("touchstart", start);
    document.removeEventListener("touchend", end);
    document.removeEventListener("touchcancel", cancel);
  };
}
