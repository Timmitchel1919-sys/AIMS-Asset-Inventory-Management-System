import { test } from "node:test";
import assert from "node:assert/strict";
import { recordRun, readHealth } from "./syncRuns.js";
import { makeFakeFirestore, FieldValue } from "./testUtils.mjs";

test("recordRun writes a run and overwrites syncHealth/latest", async () => {
  const db = makeFakeFirestore({});
  await recordRun(db, FieldValue, {
    kind: "export", trigger: "schedule", ok: true,
    startedAt: Date.now() - 1200, summary: { rows: { A: 3 } },
  });
  const runs = Object.values(db.__dump("syncRuns"));
  assert.equal(runs.length, 1);
  assert.equal(runs[0].kind, "export");
  assert.equal(runs[0].trigger, "schedule");
  assert.equal(runs[0].ok, true);
  assert.ok(runs[0].durationMs >= 0);

  const latest = db.__dump("syncHealth")["latest"];
  assert.equal(latest.kind, "export");
  assert.equal(latest.ok, true);
});

test("recordRun truncates a long error message", async () => {
  const db = makeFakeFirestore({});
  await recordRun(db, FieldValue, {
    kind: "import", ok: false, startedAt: Date.now(),
    error: "x".repeat(2000),
  });
  const latest = db.__dump("syncHealth")["latest"];
  assert.equal(latest.error.length, 500);
});

test("readHealth returns the latest doc and recent runs newest-first", async () => {
  const db = makeFakeFirestore({});
  for (const iso of ["2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z", "2026-01-03T00:00:00.000Z"]) {
    await db.collection("syncRuns").add({ kind: "export", ok: true, atIso: iso });
  }
  await db.collection("syncHealth").doc("latest").set({ kind: "export", ok: true, atIso: "2026-01-03T00:00:00.000Z" });
  const health = await readHealth(db, 2);
  assert.equal(health.latest.atIso, "2026-01-03T00:00:00.000Z");
  assert.equal(health.recent.length, 2);
  assert.equal(health.recent[0].atIso, "2026-01-03T00:00:00.000Z");
  assert.equal(health.recent[1].atIso, "2026-01-02T00:00:00.000Z");
});
