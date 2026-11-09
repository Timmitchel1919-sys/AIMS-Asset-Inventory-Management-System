import { useCallback, useRef, useSyncExternalStore } from "react";

/**
 * Page actions dock.
 *
 * A page's primary/secondary header actions (PageHeader `actions`) are
 * rendered — via a React portal — at the far right of the page's main white
 * toolbar bar when one exists. Toolbars opt in by rendering
 * <PageActionsSlot/>. When several toolbars are mounted the first one in
 * document order wins; without any slot the actions stay in the header.
 */
const slots = new Set<HTMLElement>();
const listeners = new Set<() => void>();
let current: HTMLElement | null = null;

function pickFirst(): HTMLElement | null {
  let first: HTMLElement | null = null;
  slots.forEach((slot) => {
    if (!slot.isConnected) return;
    if (
      !first ||
      first.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_PRECEDING
    )
      first = slot;
  });
  return first;
}

function publish() {
  const next = pickFirst();
  if (next === current) return;
  current = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePageActionsSlot(enabled = true): HTMLElement | null {
  const slot = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
  return enabled ? slot : null;
}

export function PageActionsSlot() {
  const mounted = useRef<HTMLDivElement | null>(null);
  const ref = useCallback((element: HTMLDivElement | null) => {
    if (mounted.current) slots.delete(mounted.current);
    mounted.current = element;
    if (element) slots.add(element);
    // Publish after the commit so document-order comparison sees the
    // final tree (several toolbars may mount in the same commit).
    queueMicrotask(publish);
  }, []);
  return <div ref={ref} className="toolbar-page-actions" data-page-actions-slot="" />;
}
