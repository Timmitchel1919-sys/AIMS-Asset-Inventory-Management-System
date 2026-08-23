import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error" | "invalid";

interface StoredDraft<T> {
  value: T;
  savedAt: string;
}

export function readLocalDraft<T>(key: string): StoredDraft<T> | null {
  try {
    const raw = localStorage.getItem(`aims-draft:${key}`);
    return raw ? (JSON.parse(raw) as StoredDraft<T>) : null;
  } catch {
    return null;
  }
}

export function clearLocalDraft(key: string) {
  localStorage.removeItem(`aims-draft:${key}`);
}

export function useAutosaveDraft<T>({
  key,
  value,
  save,
  validate = () => true,
  enabled = true,
  delay = 1000,
}: {
  key: string;
  value: T;
  save: (value: T) => Promise<void>;
  validate?: (value: T) => boolean;
  enabled?: boolean;
  delay?: number;
}) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string>();
  const valueRef = useRef(value);
  const saveRef = useRef(save);
  const validateRef = useRef(validate);
  const revision = useRef(0);
  const lastPersisted = useRef("");

  useEffect(() => {
    valueRef.current = value;
    saveRef.current = save;
    validateRef.current = validate;
  }, [save, validate, value]);

  const flush = useCallback(async () => {
    if (!enabled) return;
    const serialized = JSON.stringify(valueRef.current);
    if (serialized === lastPersisted.current) return;
    if (!validateRef.current(valueRef.current)) {
      setStatus("invalid");
      return;
    }
    const currentRevision = ++revision.current;
    setStatus("saving");
    try {
      await saveRef.current(valueRef.current);
      if (revision.current !== currentRevision) return;
      lastPersisted.current = serialized;
      const timestamp = new Date().toISOString();
      setLastSavedAt(timestamp);
      setStatus("saved");
    } catch {
      if (revision.current === currentRevision) setStatus("error");
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    localStorage.setItem(
      `aims-draft:${key}`,
      JSON.stringify({ value, savedAt: new Date().toISOString() }),
    );
    const timer = window.setTimeout(() => void flush(), delay);
    return () => window.clearTimeout(timer);
  }, [delay, enabled, flush, key, value]);

  useEffect(() => {
    if (!enabled) return;
    const persist = () => void flush();
    const visibility = () => {
      if (document.visibilityState === "hidden") persist();
    };
    window.addEventListener("blur", persist);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", persist);
      document.removeEventListener("visibilitychange", visibility);
      persist();
    };
  }, [enabled, flush]);

  return {
    status,
    lastSavedAt,
    retry: flush,
    clear: () => {
      clearLocalDraft(key);
      lastPersisted.current = JSON.stringify(valueRef.current);
      setStatus("idle");
    },
  };
}
