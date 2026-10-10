// Initial trusted administrator. Remove this bootstrap after a trusted backend
// manages access assignments and last-administrator transactions.
export const AIMS_BOOTSTRAP_ADMIN_UID = "VogTjC6S1aXHO6ySBbdiQ7LNOYG3";

// The single AIMS Owner / super admin. Identified by verified email, never by
// a writable role field. Must match isOwner() in firestore.rules.
export const AIMS_OWNER_EMAIL = "aliendas@kangoeroeschool.com";
export const isAimsOwnerEmail = (email?: string | null) =>
  (email ?? "").trim().toLowerCase() === AIMS_OWNER_EMAIL;
