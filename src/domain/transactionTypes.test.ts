import { describe, expect, it } from "vitest";
import {
  TRANSACTION_TYPES,
  isTransactionType,
  normalizeTransactionType,
  transactionRef,
} from "./transactionTypes";

describe("transactionTypes", () => {
  it("formats a zero-padded per-type reference", () => {
    expect(transactionRef("TRANSFER", 184, 2026)).toBe("TRF-2026-000184");
    expect(transactionRef("RETURN", 1, 2026)).toBe("RET-2026-000001");
    expect(transactionRef("RECEIVE", 0, 2026)).toBe("RCV-2026-000001");
  });

  it("maps existing free-text movement types to the closed set", () => {
    expect(normalizeTransactionType("Asset movement")).toBe("TRANSFER");
    expect(normalizeTransactionType("Transfer")).toBe("TRANSFER");
    expect(normalizeTransactionType("Storage transfer")).toBe("TRANSFER");
    expect(normalizeTransactionType("Assignment")).toBe("ASSIGN");
    expect(normalizeTransactionType("Assignment return")).toBe("RETURN");
    expect(normalizeTransactionType("Disposal")).toBe("DISPOSE");
    expect(normalizeTransactionType("repair.complete")).toBe("REPAIR");
    expect(normalizeTransactionType("maintenance.start")).toBe("MAINTENANCE");
    expect(normalizeTransactionType("Correction: Reversal")).toBe("ADJUST");
    expect(normalizeTransactionType("Voorraad ontvangen")).toBe("RECEIVE");
    expect(normalizeTransactionType("something odd")).toBe("ADJUST");
    expect(normalizeTransactionType(undefined)).toBe("ADJUST");
  });

  it("guards the union at runtime", () => {
    expect(isTransactionType("TRANSFER")).toBe(true);
    expect(isTransactionType("MOVE")).toBe(false);
    expect(isTransactionType(7)).toBe(false);
    for (const t of TRANSACTION_TYPES) expect(isTransactionType(t)).toBe(true);
  });
});
