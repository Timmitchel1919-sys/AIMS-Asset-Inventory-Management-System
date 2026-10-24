import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

describe("migration assets table",()=>{
  it("keeps the analyzed Assets table header in natural document flow",()=>{
    const css=readFileSync(new URL("./components.css",import.meta.url),"utf8");
    expect(css).toMatch(/\.migration-assets-table thead th\s*\{[^}]*position:\s*static/s);
    expect(css).not.toMatch(/(?:^|})\s*thead th\s*\{[^}]*position:\s*sticky/s);
  });
});
