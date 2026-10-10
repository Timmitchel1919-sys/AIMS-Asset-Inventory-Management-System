/**
 * Only these verified school accounts may delete Master Data (Hoofdlocaties and
 * Codegroepen: moving to the recycle bin and permanent deletion). Everyone else
 * may view, create and update. The same list is enforced server-side by
 * canDeleteMasterData() in firestore.rules — keep the two in sync. The UI gate
 * here is only a convenience, never the security boundary.
 */
export const MASTER_DATA_DELETE_EMAILS = [
  "sastropawiroe@kangoeroeschool.com",
  "aliendas@kangoeroeschool.com",
  "manager-ict@kangoeroeschool.com",
] as const;

export const canDeleteMasterData = (email?: string | null) =>
  !!email &&
  (MASTER_DATA_DELETE_EMAILS as readonly string[]).includes(
    email.trim().toLowerCase(),
  );

export const MASTER_DATA_DELETE_DENIED_NL =
  "Alleen geautoriseerde beheerders mogen Master Data verwijderen.";
export const MASTER_DATA_DELETE_DENIED_EN =
  "Only authorized administrators may delete Master Data.";
