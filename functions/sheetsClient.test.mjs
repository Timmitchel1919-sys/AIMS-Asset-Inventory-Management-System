import { test } from "node:test";
import assert from "node:assert/strict";
import { withRetry } from "./sheetsClient.js";

const opts = { baseMs: 1, retries: 3 };

test("withRetry returns on the first success", async () => {
  let calls = 0;
  const out = await withRetry(async () => {
    calls += 1;
    return "ok";
  }, opts);
  assert.equal(out, "ok");
  assert.equal(calls, 1);
});

test("withRetry retries transient failures then succeeds", async () => {
  let calls = 0;
  const out = await withRetry(
    async () => {
      calls += 1;
      if (calls < 3) {
        const e = new Error("429");
        e.status = 429;
        throw e;
      }
      return "recovered";
    },
    { ...opts, isRetryable: (e) => e.status === 429 },
  );
  assert.equal(out, "recovered");
  assert.equal(calls, 3);
});

test("withRetry gives up after retries are exhausted", async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(
      async () => {
        calls += 1;
        const e = new Error("503");
        e.status = 503;
        throw e;
      },
      { ...opts, isRetryable: () => true },
    ),
    /503/,
  );
  assert.equal(calls, 4); // 1 + 3 retries
});

test("withRetry does not retry a non-retryable error", async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(
      async () => {
        calls += 1;
        const e = new Error("400");
        e.status = 400;
        throw e;
      },
      { ...opts, isRetryable: (e) => e.status >= 500 },
    ),
    /400/,
  );
  assert.equal(calls, 1);
});
