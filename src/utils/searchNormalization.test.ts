import { describe, expect, it } from "vitest";
import {
  buildSearchIndex,
  findSearchMatchRange,
  matchesSearch,
  normalizeSearchTokens,
  normalizeSearchValue,
} from "./searchNormalization";

describe("normalizeSearchValue", () => {
  it.each([
    ["KCSMD-0045", "kcsmd0045"],
    ["kcsmd0045", "kcsmd0045"],
    ["KCSMD 0045", "kcsmd0045"],
    ["KCSMD_0045", "kcsmd0045"],
    ["KCSMD/0045", "kcsmd0045"],
    ["KCSMD.0045", "kcsmd0045"],
    ["    KCSMD  0045     ", "kcsmd0045"],
    ["Shaquil A. Smith", "shaquilasmith"],
    ["José Pérez", "joseperez"],
    ["ICT_Kantoor", "ictkantoor"],
    ["AA:BB:CC:11:22:33", "aabbcc112233"],
    ["  Catégorië  ", "categorie"],
  ])("%s normalizes to %s", (input, expected) => {
    expect(normalizeSearchValue(input)).toBe(expected);
  });

  it("handles empty values", () => {
    expect(normalizeSearchValue(null)).toBe("");
    expect(normalizeSearchValue(undefined)).toBe("");
    expect(normalizeSearchTokens(null)).toEqual([]);
  });

  it("splits tokens on punctuation", () => {
    expect(normalizeSearchTokens("Shaquil A. Smith")).toEqual(["shaquil", "a", "smith"]);
  });
});

describe("matchesSearch", () => {
  it.each([
    "KCSMD-0045", "kcsmd-0045", "KCSMD0045", "kcsmd0045", "KCSMD 0045", "kcsmd 0045",
    "KCSMD_0045", "kcsmd_0045", "KCSMD/0045", "KCSMD.0045", "md0045", "MD0045", "0045",
    "KCSMD", "    KCSMD  0045     ",
  ])("inventory code KCSMD-0045 matches %s", (query) => {
    expect(matchesSearch(query, ["KCSMD-0045"])).toBe(true);
  });

  it.each([
    "Shaquil A. Smith", "shaquil a smith", "SHAQUIL A SMITH", "Shaquil-A-Smith", "shaquil-a-smith",
    "shaquilsmith", "Shaquil Smith", "smith", "SHAQUIL", "shaquil",
  ])("name Shaquil A. Smith matches %s", (query) => {
    expect(matchesSearch(query, ["Shaquil A. Smith"])).toBe(true);
  });

  it.each([
    "shaquil.smith@kangoeroeschool.com", "SHAQUIL.SMITH@KANGOEROESCHOOL.COM", "shaquil smith",
    "shaquilsmith", "kangoeroeschool", "shaquil smith kangoeroeschool com",
  ])("e-mail matches %s", (query) => {
    expect(matchesSearch(query, ["shaquil.smith@kangoeroeschool.com"])).toBe(true);
  });

  it.each(["ABC-123-XYZ", "abc-123-xyz", "ABC123XYZ", "abc123xyz", "ABC 123 XYZ", "123XYZ"])(
    "serial ABC-123-XYZ matches %s",
    (query) => expect(matchesSearch(query, ["ABC-123-XYZ"])).toBe(true),
  );

  it.each(["AA:BB:CC:11:22:33", "aa:bb:cc:11:22:33", "AABBCC112233", "aa-bb-cc-11-22-33", "AA BB CC 11 22 33"])(
    "MAC address matches %s",
    (query) => expect(matchesSearch(query, ["AA:BB:CC:11:22:33"])).toBe(true),
  );

  it.each(["kangoeroe", "onderbouw", "school onderbouw", "KANGOEROE"])(
    "location name matches %s",
    (query) => expect(matchesSearch(query, ["Kangoeroe School Onderbouw"])).toBe(true),
  );

  it.each(["José Pérez", "jose perez", "JOSE PEREZ", "joseperez", "jose"])(
    "accented name matches %s",
    (query) => expect(matchesSearch(query, ["José Pérez"])).toBe(true),
  );

  it("matches words spread over several fields", () => {
    expect(matchesSearch("dell 5420", ["KCSMD-147", "Dell Latitude 5420"])).toBe(true);
    expect(matchesSearch("kcsdb0015", ["KCSDB-0015", "Smartboard", "Group 1A"])).toBe(true);
  });

  it("rejects records that do not contain the query", () => {
    expect(matchesSearch("kcsmd0046", ["KCSMD-0045"])).toBe(false);
    expect(matchesSearch("lenovo", ["Dell Latitude 5420"])).toBe(false);
    expect(matchesSearch("shaquil jones", ["Shaquil A. Smith"])).toBe(false);
  });

  it("treats an empty or punctuation-only query as no filter", () => {
    expect(matchesSearch("", ["anything"])).toBe(true);
    expect(matchesSearch("  - / ", ["anything"])).toBe(true);
  });

  it("never mutates the stored values it searches", () => {
    const record = { code: "KCSMD-0045", serial: "ABC-123-XYZ" };
    matchesSearch("kcsmd0045", [record.code, record.serial]);
    buildSearchIndex([record]);
    expect(record).toEqual({ code: "KCSMD-0045", serial: "ABC-123-XYZ" });
  });
});

describe("findSearchMatchRange", () => {
  it("maps a normalized match back onto the original text", () => {
    expect(findSearchMatchRange("KCSMD-0045", "kcsmd0045")).toEqual([0, 10]);
    expect(findSearchMatchRange("KCSMD-0045", "0045")).toEqual([6, 10]);
    expect(findSearchMatchRange("José Pérez", "perez")).toEqual([5, 10]);
    expect(findSearchMatchRange("Dell", "xyz")).toBeNull();
  });
});
