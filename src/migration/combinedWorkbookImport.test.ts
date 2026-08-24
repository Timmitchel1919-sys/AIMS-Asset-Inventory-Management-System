import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  parseCombinedWorkbooks,
  parseSelectedWorkbooks,
  shouldExcludeMasterSheet,
} from "./combinedWorkbookImport";

function workbookFile(name: string, sheets: Record<string, unknown[][]>) {
  const workbook = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([sheetName, rows]) =>
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(rows),
      sheetName,
    ),
  );
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new File([bytes], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("combined workbook parsing", () => {
  it("reads master tables and per-device history without exposing passwords", async () => {
    const master = workbookFile("MASTER INVENTORY 2026.xlsx", {
      Overzicht: [["Summary"]],
      Laptops: [
        [
          "Asset Code",
          "Device Name",
          "Serial Number",
          "MAC Address",
          "Admin Password",
        ],
        ["KCSL-200", "Laptop", "SER-200", "AA:BB", "secret"],
      ],
    });
    const history = workbookFile("History Log .xlsx", {
      "KCSL-200": [
        ["Device Name", "KCSL-200"],
        ["Serial Number", "SER-200"],
        [],
        ["DATE", "STATUS", "ISSUE", "SOLUTION", "NOTES"],
        [new Date("2024-03-04"), "Repair", "RAM", "Replaced", "Ready"],
      ],
    });
    const parsed = await parseCombinedWorkbooks(master, history);
    expect(parsed.master.sheets).toEqual(["Laptops"]);
    expect(parsed.master.rows).toHaveLength(1);
    expect(parsed.history.rows).toHaveLength(1);
    expect(parsed.master.excludedSensitiveFields).toBe(1);
    expect(parsed.master.sensitiveFields[0]).toMatchObject({
      sourceSheet: "Laptops",
      label: "Admin Password",
      nonEmpty: true,
    });
    expect(JSON.stringify(parsed)).not.toContain("secret");
    expect(parsed.history.rows[0].__sourceSheet).toBe("KCSL-200");
  });

  it("counts sensitive labels and non-empty values separately without retaining secrets", async () => {
    const master = workbookFile("Master.xlsx", {
      LAPTOP: [
        ["Asset Code", "Admin Password"],
        ["KCSL01", "secret"],
        ["KCSL02", ""],
      ],
    });
    const history = workbookFile("History.xlsx", {
      KCSL01: [
        ["Device Name", "KCSL01"],
        ["Admin Passw", "history-secret"],
        ["DATE", "STATUS"],
        ["01-01-2025", "Done"],
      ],
    });
    const parsed = await parseCombinedWorkbooks(master, history);
    expect(parsed.master.sensitiveFields).toHaveLength(2);
    expect(parsed.master.excludedSensitiveFields).toBe(1);
    expect(parsed.history.excludedSensitiveFields).toBe(1);
    expect(JSON.stringify(parsed)).not.toContain("history-secret");
  });

  it("rejects unsupported file extensions", async () => {
    const invalid = new File(["x"], "inventory.csv");
    await expect(parseCombinedWorkbooks(invalid, invalid)).rejects.toThrow(
      "alleen .xlsx",
    );
  });

  it("analyzes one or more generically named selected files", async () => {
    const assets = workbookFile("Bestand 1.xlsx", {
      Assets: [
        ["Asset Code", "Serial Number"],
        ["KCSL01", "SER-01"],
      ],
    });
    const history = workbookFile("Bestand 2.xlsx", {
      KCSL01: [
        ["DATE", "STATUS"],
        ["01-01-2025", "Service"],
      ],
    });
    const one = await parseSelectedWorkbooks([assets]);
    expect(one.master.rows).toHaveLength(1);
    expect(one.history.rows).toHaveLength(0);
    const two = await parseSelectedWorkbooks([assets, history]);
    expect(two.master.rows).toHaveLength(1);
    expect(two.history.rows).toHaveLength(1);
  });

  it("detects a row-three header with a leading empty column and canonicalizes real master labels", async () => {
    const master = workbookFile("MASTER INVENTORY 2026.xlsx", {
      Laptops: [
        ["INVENTORY LAPTOP"],
        [],
        [
          "",
          "INV-\nCODE",
          "S/N",
          "BRAND - MODEL",
          "SPECS",
          "USER",
          "LOCATION",
          "CONDITION",
          "BRUIKLEEN CONTRACT",
          "PURCHASE (YEAR)",
          "Admin Password",
        ],
        [
          "",
          "KCSL01",
          "",
          "Dell - Latitude",
          "16GB RAM",
          "ICT User",
          "ICT kantoor",
          "Good",
          "Contract-1",
          2024,
          "never-export",
        ],
      ],
    });
    const history = workbookFile("History Log .xlsx", {
      KCSL01: [
        ["DATE", "STATUS", "ISSUE", "SOLUTION", "NOTES"],
        ["23 -01- 2024", "Service", "Check", "Ready", ""],
      ],
    });
    const parsed = await parseCombinedWorkbooks(master, history);
    expect(parsed.master.rows[0]).toMatchObject({
      __sourceRow: 4,
      "Asset Code": "KCSL01",
      "Brand - Model": "Dell - Latitude",
      Specs: "16GB RAM",
      Location: "ICT kantoor",
      "Purchase Year": 2024,
    });
    expect(parsed.master.excludedSensitiveFields).toBe(1);
    expect(JSON.stringify(parsed)).not.toContain("never-export");
  });

  it("imports SCREEN CODE from DIGIBORD and keeps all 14 inventory categories", async () => {
    const categories = [
      "LAPTOP",
      "DESKTOP",
      "MINI DESK",
      "TABLET",
      "MONITOR",
      "DIGIBORD",
      "PW MODULE",
      "RT MODULE",
      "TELEFOON",
      "MOBIEL",
      "PRINTERSCANNER",
      "BEAMER",
      "UPS",
      "KEYBOARD",
    ];
    const sheets = Object.fromEntries(
      categories.map((name, index) => [
        name,
        [
          [name === "DIGIBORD" ? "SCREEN CODE" : "Asset Code", "Serial Number"],
          [
            name === "DIGIBORD"
              ? "KCSDB01"
              : `${name.replace(/\s/g, "").slice(0, 4)}${index + 1}`,
            `SER-${index}`,
          ],
        ],
      ]),
    );
    const parsed = await parseSelectedWorkbooks([
      workbookFile("Master.xlsx", {
        OVERZICHT: [["ignore"]],
        PLATTEGROND: [["ignore"]],
        ...sheets,
      }),
    ]);
    expect(parsed.master.sheets).toHaveLength(14);
    expect(
      parsed.master.rows.find((row) => row.__sourceSheet === "DIGIBORD")?.[
        "Asset Code"
      ],
    ).toBe("KCSDB01");
  });

  it("always excludes planning and Wi-Fi overview worksheets from Master Data", () => {
    [
      "PL.KH.OB",
      "PL.BB",
      "PL.OB",
      "Investaris Wifilijsten",
      "Inventaris Wifilijsten",
    ].forEach((name) => expect(shouldExcludeMasterSheet(name)).toBe(true));
    expect(shouldExcludeMasterSheet("LAPTOP")).toBe(false);
  });
});
