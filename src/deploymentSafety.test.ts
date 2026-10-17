import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("production deployment safety", () => {
  it("prevents the app shell and service-worker bootstrap from being cached", () => {
    const firebase = JSON.parse(
      readFileSync(resolve(process.cwd(), "firebase.json"), "utf8"),
    ) as {
      hosting: {
        headers: Array<{
          source: string;
          headers: Array<{ key: string; value: string }>;
        }>;
      };
    };
    const noCacheSources = new Set(
      firebase.hosting.headers
        .filter((entry) =>
          entry.headers.some(
            (header) =>
              header.key === "Cache-Control" &&
              header.value === "no-cache, no-store, must-revalidate",
          ),
        )
        .map((entry) => entry.source),
    );

    expect(noCacheSources).toEqual(
      new Set(["/", "/index.html", "/sw.js", "/registerSW.js"]),
    );
  });

  it("blocks production builds that omit Firebase configuration", () => {
    const viteConfig = readFileSync(
      resolve(process.cwd(), "vite.config.ts"),
      "utf8",
    );

    expect(viteConfig).toContain("requiredFirebaseBuildVariables.filter");
    expect(viteConfig).toContain("mode === 'production'");
    expect(viteConfig).toContain("Production build blocked");
  });
});
