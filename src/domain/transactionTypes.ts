/**
 * Phase B — canonical stock-movement transaction vocabulary.
 *
 * The `Movement` record already carried a free-text `type`. This adds a small
 * closed set plus a per-type transaction id (`TRF-2026-000184`) so every
 * movement is classifiable and uniquely referenceable, while keeping the old
 * `type` string for backward compatibility.
 */

export const TRANSACTION_TYPES = [
  "RECEIVE",
  "TRANSFER",
  "RETURN",
  "ASSIGN",
  "UNASSIGN",
  "ADJUST",
  "DISPOSE",
  "REPAIR",
  "MAINTENANCE",
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

const PREFIX: Record<TransactionType, string> = {
  RECEIVE: "RCV",
  TRANSFER: "TRF",
  RETURN: "RET",
  ASSIGN: "ASG",
  UNASSIGN: "UNA",
  ADJUST: "ADJ",
  DISPOSE: "DSP",
  REPAIR: "RPR",
  MAINTENANCE: "MNT",
};

export const transactionPrefix = (t: TransactionType): string => PREFIX[t];

export const isTransactionType = (v: unknown): v is TransactionType =>
  typeof v === "string" && (TRANSACTION_TYPES as readonly string[]).includes(v);

/** e.g. transactionRef("TRANSFER", 184) -> "TRF-2026-000184" */
export function transactionRef(
  type: TransactionType,
  seq: number,
  year: number = new Date().getFullYear(),
): string {
  const n = Number.isFinite(seq) && seq > 0 ? Math.floor(seq) : 1;
  return `${PREFIX[type]}-${year}-${String(n).padStart(6, "0")}`;
}

// Order matters: "assignment return" must hit RETURN before ASSIGN.
const RULES: Array<[RegExp, TransactionType]> = [
  [/receiv|incoming|inkoop|ontvang/i, "RECEIVE"],
  [/return|retour/i, "RETURN"],
  [/transfer|movement|overbo|verplaats|relocat|storage transfer/i, "TRANSFER"],
  [/assign|toewijz|uitgifte|issue|outgoing/i, "ASSIGN"],
  [/unassign|ontkoppel|release/i, "UNASSIGN"],
  [/dispos|afvoer|scrap|write.?off/i, "DISPOSE"],
  [/repair|reparat/i, "REPAIR"],
  [/mainten|onderhoud/i, "MAINTENANCE"],
  [/correct|adjust|reversal|count|audit/i, "ADJUST"],
];

/** Best-effort map of an existing free-text movement `type` to the closed set. */
export function normalizeTransactionType(
  raw: string | null | undefined,
): TransactionType {
  const s = String(raw ?? "").trim();
  for (const [re, t] of RULES) if (re.test(s)) return t;
  return "ADJUST";
}
