// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readLocalDraft, useAutosaveDraft } from "./useAutosaveDraft";

describe("useAutosaveDraft", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("debounces rapid typing and persists the newest draft", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ value }) => useAutosaveDraft({ key: "note", value, save, delay: 1000 }),
      { initialProps: { value: { title: "A" } } },
    );
    rerender({ value: { title: "AB" } });
    rerender({ value: { title: "ABC" } });
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ title: "ABC" });
    expect(readLocalDraft<{ title: string }>("note")?.value.title).toBe("ABC");
  });

  it("shows an error and retries without applying a stale save result", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useAutosaveDraft({ key: "retry", value: { title: "Note" }, save, delay: 1000 }),
    );
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(result.current.status).toBe("error");
    await act(async () => result.current.retry());
    expect(result.current.status).toBe("saved");
  });

  it("does not save invalid drafts", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useAutosaveDraft({ key: "invalid", value: { title: "" }, save, validate: value => Boolean(value.title), delay: 800 }),
    );
    await act(async () => vi.advanceTimersByTimeAsync(800));
    expect(save).not.toHaveBeenCalled();
    expect(result.current.status).toBe("invalid");
  });
});
