import { describe, expect, it } from "vitest";
import { displayInventoryCode } from "../utils/inventoryCode";

describe("displayInventoryCode", () => {
  it("shows the linked ICT asset code without inventory wrappers", () => {
    expect(displayInventoryCode("INV-KCSMD-02-mockstamp0")).toBe("KCSMD-02");
    expect(displayInventoryCode("KCSDB-147")).toBe("KCSDB-147");
  });

  it("removes the legacy inventory prefix for stock-only codes", () => {
    expect(displayInventoryCode("INV-CAB-001")).toBe("CAB-001");
  });
});
