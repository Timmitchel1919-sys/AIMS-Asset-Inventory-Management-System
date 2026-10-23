import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const theme = readFileSync(new URL("./aims-light.css", import.meta.url), "utf8");

describe("AIMS Light sidebar", () => {
  it("uses the Azure royal-blue sidebar palette while retaining light workspaces", () => {
    expect(theme).toContain("--color-sidebar-background: #061d52");
    expect(theme).toContain("--gradient-sidebar: linear-gradient(180deg,#06163e 0%,#08245f 45%,#061d52 72%,#041535 100%)");
    expect(theme).toContain("--color-sidebar-text: #fff");
    expect(theme).toContain("body, html[data-theme=\"aims-light\"] #root");
  });
});
