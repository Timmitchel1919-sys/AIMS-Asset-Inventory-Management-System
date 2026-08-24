import * as XLSX from "xlsx";

const key = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const cell = (
  row: unknown[],
  indexes: Map<string, number>,
  names: string[],
) => {
  const found = [...indexes.entries()].find(([name]) =>
    names.map(key).includes(name),
  );
  return found ? (row[found[1]] ?? "") : "";
};

export async function excelAssetImportToCsv(file: File) {
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: true,
  });
  const records: unknown[][] = [
    [
      "code",
      "name",
      "serialnumber",
      "category",
      "location",
      "department",
      "brand",
      "model",
    ],
  ];
  for (const sheetName of workbook.SheetNames) {
    if (/^(overzicht|pl\.|inventory|inventaris wifi)/i.test(sheetName))
      continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(
      workbook.Sheets[sheetName],
      { header: 1, defval: "", raw: false },
    );
    const headerIndex = rows.findIndex((row) =>
      row.some((value) =>
        ["invcode", "assetcode", "deviceid", "code"].includes(key(value)),
      ),
    );
    if (headerIndex < 0) continue;
    const indexes = new Map(
      rows[headerIndex].map((value, index) => [key(value), index]),
    );
    for (const row of rows.slice(headerIndex + 1)) {
      const code = cell(row, indexes, [
        "inv code",
        "asset code",
        "device id",
        "code",
      ]);
      if (!String(code).trim()) continue;
      const brandModel = String(
        cell(row, indexes, ["brand model", "brand - model"]),
      );
      const [brand = "", ...modelParts] = brandModel.split(/\s+-\s+/);
      records.push([
        code,
        cell(row, indexes, ["item name", "device name", "name"]) ||
          brandModel ||
          sheetName,
        cell(row, indexes, ["s/n", "serial number", "serial", "service tag"]),
        sheetName,
        cell(row, indexes, ["location", "locatie", "stock location"]),
        cell(row, indexes, ["department", "departement", "afdeling"]),
        cell(row, indexes, ["brand", "merk"]) || brand,
        cell(row, indexes, ["model"]) || modelParts.join(" - "),
      ]);
    }
  }
  if (records.length === 1)
    throw new Error(
      "Geen ondersteunde inventaristabel met een codekolom gevonden.",
    );
  return XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(records));
}
