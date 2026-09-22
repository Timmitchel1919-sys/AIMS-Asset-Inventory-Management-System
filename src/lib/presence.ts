/**
 * Lightweight, Firestore-only session presence for the Users module's
 * Online/Offline indicator.
 *
 * Firestore has no server-side disconnect hook (unlike the Realtime
 * Database's onDisconnect), so presence here is a heartbeat: while an
 * authenticated tab is open it periodically refreshes its own
 * `presence/{uid}` document. Other users read that collection in real time
 * (a single onSnapshot listener, no polling) and treat a heartbeat as stale
 * — and therefore Offline — once it's older than PRESENCE_STALE_MS. That
 * staleness check is what turns "browser closed / crashed / lost network"
 * into Offline without needing a disconnect callback that Firestore can't
 * offer.
 *
 * An explicit sign-out calls markPresenceOffline() first (while still
 * authenticated, since the security rule is owner-write-only), so a
 * deliberate logout reflects immediately instead of waiting out the
 * staleness window. A second open tab for the same user keeps heartbeating
 * independently, so closing one tab never marks the user offline while
 * another authenticated tab is still active.
 */
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { requireFirebase } from "./firebase";

const HEARTBEAT_INTERVAL_MS = 45_000;
/** Generous relative to the heartbeat interval to absorb network/tab-timer
 * jitter without flapping a genuinely-active session to Offline. */
export const PRESENCE_STALE_MS = 130_000;

let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

async function writePresence(uid: string, online: boolean) {
  try {
    const { db } = requireFirebase();
    await setDoc(doc(db, "presence", uid), {
      uid,
      online,
      lastSeenAt: serverTimestamp(),
    });
  } catch {
    // Presence is best-effort UI metadata; it must never block sign-in/out.
  }
}

/** Starts the heartbeat for `uid`. Returns a cleanup function that only
 * stops this tab's timer — it does not mark the user offline, so it is
 * safe to call on unmount/tab-close as well as on sign-out. */
export function startPresenceHeartbeat(uid: string): () => void {
  stopPresenceHeartbeat();
  void writePresence(uid, true);
  heartbeatTimer = setInterval(() => void writePresence(uid, true), HEARTBEAT_INTERVAL_MS);
  return stopPresenceHeartbeat;
}

export function stopPresenceHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = undefined;
}

/** Call before firebaseLogout() while the user is still authenticated —
 * afterwards the security rule (owner-only) would reject the write. */
export async function markPresenceOffline(uid: string) {
  stopPresenceHeartbeat();
  await writePresence(uid, false);
}

export interface PresenceRecord {
  online?: boolean;
  lastSeenAt?: string;
}

/** Combines the explicit flag with the staleness check described above. */
export function isEffectivelyOnline(
  record: PresenceRecord | undefined,
  now: number,
): boolean {
  if (!record?.online || !record.lastSeenAt) return false;
  return now - new Date(record.lastSeenAt).getTime() < PRESENCE_STALE_MS;
}
