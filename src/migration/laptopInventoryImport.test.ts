import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { WorkflowRepositoryEngine } from "../data/mockRepository";
import {
  analyzeLaptopInventory,
  parseTechnicalSpecifications,
  rowsForImport,
} from "./laptopInventoryImport";

function workbookFile(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(rows),
    "LAPTOP",
  );
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new File([bytes], "Laptop Inventory.xlsx");
}

const headers = [
  "INV-\nCODE",
  "BRAND - MODEL",
  "SPECS",
  "S/N",
  "USER",
  "LOCATION",
  "CONDITION",
  "BRUIKLEEN\nCONTRACT",
  "CHARGER",
  "LAPTOP\nBAG",
  "MOUSE",
  "PURCHASE\n(YEAR)",
];

describe("laptop inventory migration", () => {
  it("preserves legacy codes and raw source values", async () => {
    const preview = await analyzeLaptopInventory(
      workbookFile([
        ["INVENTORY LAPTOP"],
        headers,
        [
          "KCSL6",
          "HP - ELITEBOOK",
          "8GB - 256GB SSD",
          "SN-1",
          "FREE",
          "ICT",
          "GOOD",
          "",
          "ORIGINAL",
          "",
          "",
          "2O24",
        ],
        [
          "KSCL40",
          "ASUS R301L",
          "",
          "",
          "",
          "",
          "USE FOR PARTS",
          "",
          "",
          "",
          "",
          "",
        ],
      ]),
      [],
      [],
    );

    expect(preview.rows.map((row) => row.code)).toEqual(["KCSL6", "KSCL40"]);
    expect(preview.rows[0].sourceData.purchase).toBe("2O24");
    expect(preview.rows[0].purchaseYear).toBe("");
    expect(preview.rows[0].warnings).toContain("PURCHASE_DATE_PARSE_WARNING");
    expect(preview.rows[0].warnings).toContain("LEGACY_CODE_PATTERN_WARNING");
    expect(preview.rows[1].warnings).toContain("LEGACY_CODE_PATTERN_WARNING");
    expect(preview.rows[1].model).toBe("ASUS R301L");
  });

  it("flags duplicate serial numbers without changing either record", async () => {
    const preview = await analyzeLaptopInventory(
      workbookFile([
        headers,
        [
          "KCSL90",
          "HP - ELITEBOOK 850 G5",
          "",
          "DUPLICATE-SERIAL-TEST",
          "A",
          "KH",
          "GOOD",
          "",
          "",
          "",
          "",
          "2024",
        ],
        [
          "KCSL91",
          "HP - ELITEBOOK 850 G5",
          "",
          "DUPLICATE-SERIAL-TEST",
          "B",
          "KH",
          "GOOD",
          "",
          "",
          "",
          "",
          "2024",
        ],
      ]),
      [],
      [],
    );

    expect(preview.summary.duplicateSerials).toBe(2);
    expect(
      preview.rows.every(
        (row) => row.sourceData.serialNumber === "DUPLICATE-SERIAL-TEST",
      ),
    ).toBe(true);
    expect(preview.rows.every((row) => row.disposition === "new")).toBe(true);
  });

  it("detects existing codes and partial integration conflicts", async () => {
    const repo = new WorkflowRepositoryEngine();
    const preview = await analyzeLaptopInventory(
      workbookFile([
        headers,
        [
          repo.snapshot().inventory[0].code,
          "HP - A",
          "",
          "A",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ],
        [
          repo.snapshot().assets[0].code,
          "HP - B",
          "",
          "B",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ],
      ]),
      repo.snapshot().inventory,
      repo.snapshot().assets,
    );

    expect(preview.rows.map((row) => row.disposition)).toEqual([
      "conflict",
      "conflict",
    ]);
    expect(rowsForImport(preview)).toHaveLength(0);
  });

  it("parses safe dates and structured specifications without inventing values", async () => {
    const preview = await analyzeLaptopInventory(
      workbookFile([
        headers,
        [
          "KCSL99",
          "HP - PROBOOK 650 G8",
          "INTEL CORE i5-1145G7 @2.60GHz | RAM 8GB - 256GB SSD | WIN11 PRO | OFFICE 2024",
          "SN79",
          "",
          "ICT",
          "50%",
          "",
          "",
          "",
          "",
          "20.8.2026",
        ],
      ]),
      [],
      [],
    );
    const row = preview.rows[0];

    expect(row.purchaseDate).toBe("2026-08-20");
    expect(row.sourceData.purchase).toBe("20.8.2026");
    expect(row.technicalSpecifications.storageType).toBe("SSD");
    expect(row.technicalSpecifications.operatingSystem).toBe("Windows 11 Pro");
    expect(parseTechnicalSpecifications("")).toEqual({ rawSpecifications: "" });
  });

  it("imports into inventory and assets idempotently with audit metadata", async () => {
    const repo = new WorkflowRepositoryEngine();
    const preview = await analyzeLaptopInventory(
      workbookFile([
        headers,
        [
          "KHL02",
          "LENOVO - THINKPAD",
          "",
          "",
          "DAGLAPTOP",
          "ICT",
          "GOOD",
          "",
          "ORIGINAL",
          "",
          "",
          "",
        ],
      ]),
      repo.snapshot().inventory,
      repo.snapshot().assets,
    );
    const rows = rowsForImport(preview);
    const beforeInventory = repo.snapshot().inventory.length;
    const beforeAssets = repo.snapshot().assets.length;

    const first = await repo.execute({
      action: "inventory.legacy.importBatch",
      values: { rows, batchId: "test-batch" },
      actor: "tester",
    });
    const second = await repo.execute({
      action: "inventory.legacy.importBatch",
      values: { rows, batchId: "test-batch-repeat" },
      actor: "tester",
    });

    expect(first.ok).toBe(true);
    expect(second.message).toContain("0 created, 1 skipped");
    expect(repo.snapshot().inventory).toHaveLength(beforeInventory + 1);
    expect(repo.snapshot().assets).toHaveLength(beforeAssets + 1);
    expect(
      repo.snapshot().assets.find((asset) => asset.code === "KHL02")?.code,
    ).toBe("KHL02");
    expect(
      repo.snapshot().inventory.find((item) => item.code === "KHL02")
        ?.importMetadata?.migrationVersion,
    ).toBe("laptop-inventory-v1");
    expect(
      repo
        .snapshot()
        .activity.some((entry) =>
          entry.detail.includes("INVENTORY_IMPORT_CREATED: KHL02"),
        ),
    ).toBe(true);
  });
});
