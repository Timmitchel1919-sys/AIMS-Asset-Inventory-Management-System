import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const gate = readFileSync("src/components/startup/AppStartupGate.tsx", "utf8");
const splash = readFileSync("src/components/startup/BrandedSplash.tsx", "utf8");
const splashCss = readFileSync("src/components/startup/BrandedSplash.css", "utf8");
const orbit = readFileSync("src/components/startup/SplashOrbit.tsx", "utf8");
const shell = readFileSync("src/components/shell.tsx", "utf8");
const authFlow = readFileSync("src/pages/AuthFlow.tsx", "utf8");
const indexHtml = readFileSync("index.html", "utf8");

describe("AIMS fixed 10-second startup splash", () => {
  it("pins the splash to exactly 10000ms with one authoritative timer", () => {
    expect(gate).toMatch(/const SPLASH_DURATION = 10000;/);
    expect(gate).toMatch(/setTimeout\(\s*\(\) => setSplashComplete\(true\),\s*SPLASH_DURATION,?\s*\)/);
    expect(gate.match(/setTimeout\(/g) ?? []).toHaveLength(1);
  });

  it("does not use any adaptive / skip shortcut for the normal flow", () => {
    for (const banned of [
      "minimumDuration",
      "adaptiveDuration",
      "startupReadyEarly",
      "skipSplash",
    ]) {
      expect(gate).not.toContain(banned);
    }
  });

  it("keeps children mounted behind the splash on a dark ground (no white flash)", () => {
    expect(gate).toMatch(/visibility: showSplash \? "hidden" : "visible"/);
    expect(gate).toMatch(/aims-startup-shell/);
    expect(indexHtml).toMatch(/html,body,#root\{[^}]*background:#00071c/);
  });

  it("resolves a centralised StartupState before the splash exits", () => {
    expect(gate).toMatch(/type StartupState =\s*\|\s*"initializing"/);
    expect(gate).toContain('"authenticated"');
    expect(gate).toContain('"unauthenticated"');
    expect(gate).toContain('"error"');
  });

  it("routes a failed initialization to a non-technical warning, not a raw error", () => {
    expect(gate).toMatch(/startupState === "error"/);
    expect(gate).toMatch(/could not be initialized/);
    expect(gate).not.toContain("FirebaseError");
    expect(gate).not.toMatch(/error\.(message|code)/);
  });

  it("no longer ships the forbidden permanent click-to-enter gateway", () => {
    expect(gate).not.toMatch(/gateway/i);
    expect(gate).not.toContain("aims_public_entry_seen");
    expect(splash).not.toMatch(/onEnter|Enter AIMS/);
  });
});

describe("AIMS branded splash visuals are preserved", () => {
  it("keeps the fixed brand palette regardless of user theme", () => {
    for (const hex of [
      "#00071c",
      "#021d58",
      "#005dec",
      "#049cfa",
      "#02cefd",
      "#70defb",
      "#f4f8fc",
      "#8c9aac",
    ]) {
      expect(splashCss.toLowerCase()).toContain(hex);
    }
  });

  it("keeps the bottom wave pattern and the loading indicator", () => {
    expect(splash).toMatch(/aims-splash-waves/);
    expect(splash).toMatch(/aims-splash-spinner/);
    expect(splash).toMatch(/role="status"/);
    expect(splash).toMatch(/aria-live="polite"/);
  });

  it("orbits Scannen / Middelen / Veilig ~120deg apart, 20s linear infinite clockwise", () => {
    expect(orbit).toMatch(/label: "Scannen", angle: 0/);
    expect(orbit).toMatch(/label: "Middelen", angle: 120/);
    expect(orbit).toMatch(/label: "Veilig", angle: 240/);
    expect(orbit).toMatch(/duration: 20,\s*ease: "linear",\s*repeat: Infinity/);
  });

  it("counter-rotates the chips so labels never turn upside down", () => {
    expect(orbit).toMatch(/useTransform\(rotate, \(value\) => -value\)/);
    expect(orbit).toMatch(/style=\{\{ rotate: counterRotate \}\}/);
  });

  it("keeps the AIMS logo stationary at the orbit centre with an accessible alt", () => {
    expect(orbit).toMatch(/aims-splash-logo/);
    expect(orbit).toMatch(/alt="AIMS Asset & Inventory Management System"/);
    expect(orbit).not.toMatch(/aims-splash-logo[^]*?animate=\{\{ rotate/);
  });

  it("places the labels exactly on the largest ring and scales the whole composition from one variable", () => {
    // Chip orbit distance == largest ring radius (ring diameter = 2 x radius).
    expect(orbit).toMatch(/translateX\(var\(--splash-orbit-radius\)\)/);
    expect(splashCss).toMatch(
      /\.aims-splash-ring--outer\s*\{[^}]*width:\s*calc\(var\(--splash-orbit-radius\)\s*\*\s*2\)/,
    );
    // Logo size is a locked fraction of the same radius (constant relative to
    // the rings; only the shared variable changes per device).
    expect(splashCss).toMatch(
      /\.aims-splash-logo\s*\{[^}]*width:\s*calc\(var\(--splash-orbit-radius\)\s*\*\s*0?\.\d+\)/,
    );
    expect(splashCss).not.toMatch(/\.aims-splash-logo\s*\{[^}]*width:\s*clamp\(/);
    // Media queries adapt by retuning only the single scale variable.
    const mediaBlocks = splashCss.match(/@media[^{]+\{[^@]*?--splash-orbit-radius[^@]*?\}/g) ?? [];
    expect(mediaBlocks.length).toBeGreaterThanOrEqual(3);
  });
});

describe("logout returns to the public Landing page, never the splash or login", () => {
  it("signs out from the shell straight to '/'", () => {
    expect(shell).toContain('navigate("/", { replace: true });');
    expect(shell).not.toContain('reason: "signed-out"');
    expect(shell).not.toMatch(/navigate\("\/login"/);
  });

  it("signs out from the auth-flow screens straight to '/'", () => {
    expect(authFlow).not.toContain('reason: "signed-out"');
    expect(authFlow).not.toMatch(/logout\(\);\s*navigate\("\/login"/);
    expect(authFlow).toMatch(/logout\(\);\s*navigate\("\/", \{ replace: true \}\)/);
  });
});
