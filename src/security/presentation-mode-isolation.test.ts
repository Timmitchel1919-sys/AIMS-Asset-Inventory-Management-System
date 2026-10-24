import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * Phase 3A.7A — Presentation-mode isolation regression tests.
 *
 * These assertions pin the architectural invariants that make a
 * `build:presentation` artifact safe to publish to a Firebase Hosting PR
 * preview channel: the bundle must have no path through which it initializes
 * production Firebase or reaches production data.
 *
 * The tests inspect SOURCE CODE (not runtime), so they stay deterministic in
 * CI and don't require a live build artifact. A separate deploy-time safety
 * check lives in the PR workflow itself.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(repoRoot, rel), "utf8");
}

describe("Presentation-mode isolation — source invariants", () => {
  it("main.tsx mounts MockRepositoryProvider when VITE_APP_MODE === 'presentation'", () => {
    const src = read("src/main.tsx");
    // Must evaluate the presentation flag against the build-time env var.
    expect(src).toMatch(/import\.meta\.env\.VITE_APP_MODE\s*===\s*["']presentation["']/);
    // Must mount the mock provider in that branch, never the firebase provider.
    expect(src).toMatch(/<MockRepositoryProvider>/);
    expect(src).toMatch(/\bFirebaseRepositoryProvider\b/);
    // The firebase provider mount must sit AFTER the presentation guard.
    const firebaseIndex = src.indexOf("<FirebaseRepositoryProvider>");
    const presentationGuardIndex = src.indexOf('"presentation"');
    expect(firebaseIndex).toBeGreaterThan(presentationGuardIndex);
  });

  it("src/lib/firebase.ts never initializes Firebase when any VITE_FIREBASE_* env is missing", () => {
    const src = read("src/lib/firebase.ts");
    // The gating constant must be derived from the missing-env list.
    expect(src).toMatch(
      /firebaseConfigured\s*=\s*missingFirebaseEnvironmentVariables\.length\s*===\s*0/,
    );
    // Every service accessor must be gated on `app` existing.
    expect(src).toMatch(/firebaseAuth\s*=\s*app\s*\?\s*getAuth\(app\)\s*:\s*null/);
    expect(src).toMatch(/firebaseStorage\s*=\s*app\s*\?\s*getStorage\(app\)\s*:\s*null/);
    expect(src).toMatch(/firebaseFunctions\s*=\s*app\s*\?\s*getFunctions\(/);
    expect(src).toMatch(/firebaseAi\s*=\s*app/);
  });

  it("AppContext short-circuits Firebase paths when presentationMode is true", () => {
    const src = read("src/context/AppContext.tsx");
    expect(src).toMatch(/presentationMode\s*=\s*import\.meta\.env\.VITE_APP_MODE\s*===\s*["']presentation["']/);
    // Several guard clauses must exist that early-return / skip Firebase work.
    expect(src).toMatch(/if\s*\(\s*presentationMode[^)]*\)\s*return/);
    expect(src).toMatch(/!presentationMode\s*&&\s*Boolean\(firebaseAuth\)/);
  });

  it("vite.config.ts blocks a production build that is missing Firebase env", () => {
    const src = read("vite.config.ts");
    expect(src).toMatch(/mode\s*===\s*['"]production['"]/);
    expect(src).toMatch(/Production build blocked: missing Firebase/);
  });
});

describe("Presentation-mode isolation — PR deploy workflow guards", () => {
  const WORKFLOW = ".github/workflows/firebase-hosting-pull-request.yml";

  // Skip gracefully if the workflow is missing in the local checkout.
  const workflowExists = existsSync(resolve(repoRoot, WORKFLOW));
  const describeOrSkip = workflowExists ? describe : describe.skip;

  describeOrSkip("firebase-hosting-pull-request.yml", () => {
    const raw = workflowExists ? read(WORKFLOW) : "";

    it("runs the presentation build, not the production build", () => {
      expect(raw).toMatch(/run:\s*[^\n]*build:presentation/);
      // Must not run the plain production build which requires Firebase env.
      // A line that invokes `npm run build` or `pnpm run build` without the
      // `:presentation` suffix is forbidden here.
      expect(raw).not.toMatch(/run:[^\n]*\b(npm|pnpm)\s+run\s+build\b(?!:presentation)/);
      // Legacy pattern `npm install --no-package-lock && npm run build` is
      // explicitly forbidden; it is the production build path.
      expect(raw).not.toMatch(/npm install --no-package-lock && npm run build(?!:presentation)/);
    });

    it("does NOT inject any VITE_FIREBASE_* env into the build step", () => {
      expect(raw).not.toMatch(/VITE_FIREBASE_[A-Z_]+/);
    });

    it("deploys to a preview channel, never to the live channel", () => {
      // The Hosting-deploy action replaces LIVE Hosting when `channelId: live`.
      // That flag must never appear in the PR workflow.
      expect(raw).not.toMatch(/channelId:\s*live\b/);
      expect(raw).not.toMatch(/"channelId"\s*:\s*"live"/);
    });

    it("still uses the same-repo PR guard that blocks fork-run secrets exposure", () => {
      // Prevents an attacker's fork PR from triggering a secret-wielding build.
      expect(raw).toMatch(/github\.event\.pull_request\.head\.repo\.full_name\s*==\s*github\.repository/);
    });
  });
});
