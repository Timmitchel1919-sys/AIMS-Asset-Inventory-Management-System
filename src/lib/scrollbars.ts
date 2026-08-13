const SCROLLING_CLASS = "is-scrolling";
const HIDE_DELAY_MS = 650;

export function initializeAutoHidingScrollbars() {
  const hideTimers = new WeakMap<Element, ReturnType<typeof setTimeout>>();

  document.addEventListener(
    "scroll",
    (event) => {
      const target =
        event.target instanceof Element ? event.target : document.documentElement;
      const previousTimer = hideTimers.get(target);

      if (previousTimer) clearTimeout(previousTimer);
      target.classList.add(SCROLLING_CLASS);

      const timer = setTimeout(() => {
        target.classList.remove(SCROLLING_CLASS);
        hideTimers.delete(target);
      }, HIDE_DELAY_MS);

      hideTimers.set(target, timer);
    },
    true,
  );
}
