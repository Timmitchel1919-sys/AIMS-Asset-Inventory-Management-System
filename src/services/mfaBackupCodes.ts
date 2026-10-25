import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { firestore } from "../lib/firebase";

const CODE_COUNT = 8;
const CODE_LENGTH = 10; // characters per plaintext code
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // omit ambiguous chars

function randomCode(): string {
  const buffer = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(buffer);
  let output = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    output += ALPHABET[buffer[i] % ALPHABET.length];
  }
  // Format as XXXXX-XXXXX for readability.
  return `${output.slice(0, 5)}-${output.slice(5)}`;
}

export async function hashCode(code: string): Promise<string> {
  const normalized = code.replace(/[\s-]/g, "").toUpperCase();
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export type BackupCodesState = {
  generated: boolean;
  remaining: number;
  generatedAt?: string;
};

export async function readBackupCodesState(
  uid: string,
): Promise<BackupCodesState> {
  if (!firestore) return { generated: false, remaining: 0 };
  try {
    const snapshot = await getDoc(
      doc(firestore, "users", uid, "mfaBackup", "codes"),
    );
    if (!snapshot.exists()) return { generated: false, remaining: 0 };
    const data = snapshot.data() as {
      hashes?: string[];
      generatedAt?: { toDate?: () => Date } | string;
    };
    const hashes = data.hashes ?? [];
    const generatedAtRaw = data.generatedAt;
    const generatedAt =
      typeof generatedAtRaw === "string"
        ? generatedAtRaw
        : generatedAtRaw && typeof generatedAtRaw.toDate === "function"
          ? generatedAtRaw.toDate().toISOString()
          : undefined;
    return {
      generated: hashes.length > 0,
      remaining: hashes.length,
      generatedAt,
    };
  } catch {
    return { generated: false, remaining: 0 };
  }
}

/**
 * Generate a new set of plaintext backup codes, store their SHA-256 hashes in
 * Firestore (replacing any previous set), and return the plaintext codes to
 * display to the user ONCE. Plaintext is never persisted.
 */
export async function generateBackupCodes(uid: string): Promise<string[]> {
  if (!firestore) throw new Error("Backup codes require Firebase.");
  const codes: string[] = [];
  for (let i = 0; i < CODE_COUNT; i += 1) codes.push(randomCode());
  const hashes = await Promise.all(codes.map((code) => hashCode(code)));
  await setDoc(
    doc(firestore, "users", uid, "mfaBackup", "codes"),
    {
      hashes,
      generatedAt: serverTimestamp(),
    },
    { merge: false },
  );
  return codes;
}

/**
 * Consume a backup code: remove its hash from storage. Returns true if the
 * code matched and was consumed, false otherwise.
 */
export async function consumeBackupCode(
  uid: string,
  code: string,
): Promise<boolean> {
  if (!firestore) return false;
  const ref = doc(firestore, "users", uid, "mfaBackup", "codes");
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return false;
  const data = snapshot.data() as { hashes?: string[] };
  const hashes = data.hashes ?? [];
  const candidate = await hashCode(code);
  const index = hashes.indexOf(candidate);
  if (index === -1) return false;
  const next = hashes.filter((_, i) => i !== index);
  await updateDoc(ref, { hashes: next });
  return true;
}
