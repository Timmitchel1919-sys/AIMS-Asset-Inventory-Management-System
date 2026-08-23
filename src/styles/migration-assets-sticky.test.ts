import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

describe("migration assets table",()=>{
  it("freezes only the analyzed Assets table header",()=>{
    const css=readFileSync(new URL("./components.css",import.meta.url),"utf8");
    expect(css).toMatch(/\.migration-assets-table thead th\s*\{[^}]*position:sticky[^}]*top:0[^}]*z-index:3/s);
    expect(css).not.toMatch(/(?:^|})\s*thead th\s*\{[^}]*position:sticky/s);
  });
});
