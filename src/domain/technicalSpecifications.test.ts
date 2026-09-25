import { describe, expect, it } from "vitest";
import {
  formatTechnicalSpecifications,
  parseTechnicalSpecifications,
} from "./technicalSpecifications";

describe("technical specifications", () => {
  it("keeps free text verbatim and still parses Key: value lines", () => {
    const text = [
      '"INTELCORE i5 - 4200M 2.5GHz:',
      "RAM 4GB - 128GB SSD | WIN10 PRO | OFFICE 2019\"",
      "CPU: Intel Core i5",
      "https://example.com/manual",
    ].join("\n");
    expect(parseTechnicalSpecifications(text)).toEqual({
      CPU: "Intel Core i5",
      rawSpecifications: [
        '"INTELCORE i5 - 4200M 2.5GHz:',
        "RAM 4GB - 128GB SSD | WIN10 PRO | OFFICE 2019\"",
        "https://example.com/manual",
      ].join("\n"),
    });
  });

  it("round-trips through the form text", () => {
    const text = "Laptop for exams\nRAM: 16 GB\nCPU: i7";
    const parsed = parseTechnicalSpecifications(text);
    expect(parseTechnicalSpecifications(formatTechnicalSpecifications(parsed))).toEqual(parsed);
  });

  it("shows older empty-value entries as plain lines", () => {
    expect(
      formatTechnicalSpecifications({ "RAM 4GB | WIN10": "", CPU: "i5" }),
    ).toBe("RAM 4GB | WIN10\nCPU: i5");
  });

  it("stores nothing for empty input", () => {
    expect(parseTechnicalSpecifications("  \n\n")).toEqual({});
  });
});
