import { describe, expect, it } from "vitest";
import { formatIctData } from "./Assets";

describe("formatIctData in ICT Asset Module", () => {
  it("formats brand HP properly instead of Hp", () => {
    expect(formatIctData("Hp", "brand")).toBe("HP");
    expect(formatIctData("hp", "brand")).toBe("HP");
    expect(formatIctData("HP", "brand")).toBe("HP");
    expect(formatIctData("Sharp", "brand")).toBe("Sharp");
    expect(formatIctData("sharp", "brand")).toBe("Sharp");
    expect(formatIctData("APC", "brand")).toBe("APC");
  });

  it("formats model codes HS-P010K and PN-L862B properly", () => {
    expect(formatIctData("hs-p010k", "model")).toBe("HS-P010K");
    expect(formatIctData("Hs-p010k", "model")).toBe("HS-P010K");
    expect(formatIctData("HS-P010K", "model")).toBe("HS-P010K");

    expect(formatIctData("pn-l862b", "model")).toBe("PN-L862B");
    expect(formatIctData("Pn-l862b", "model")).toBe("PN-L862B");
    expect(formatIctData("PN-L862B", "model")).toBe("PN-L862B");

    // Preserves other model names
    expect(formatIctData("Prodesk 400 G7", "model")).toBe("Prodesk 400 G7");
    expect(formatIctData("Elitebook 840 G7", "model")).toBe("Elitebook 840 G7");
  });

  it("formats location KH nieuw bouw and sub location Computer lokaal", () => {
    expect(formatIctData("KH Nieuw bouw", "location")).toBe("KH nieuw bouw");
    expect(formatIctData("kh nieuw bouw", "location")).toBe("KH nieuw bouw");
    expect(formatIctData("Kangoeroe High nieuw bouw", "location")).toBe("KH nieuw bouw");
    expect(formatIctData("KH Nieuw bouw / Computer lokaal", "location")).toBe("KH nieuw bouw / Computer lokaal");
    expect(formatIctData("Computer lokaal", "department")).toBe("Computer lokaal");
    expect(formatIctData("Computer Lokaal", "location")).toBe("Computer lokaal");
  });
});
