import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { firestore } from "../lib/firebase";

export type AuthEventType =
  | "loggedIn"
  | "loggedOut"
  | "loginFailed"
  | "passwordChanged"
  | "mfaEnabled"
  | "mfaDisabled"
  | "newDevice"
  | "sessionTerminated";

export type AuthEvent = {
  id: string;
  type: AuthEventType;
  at: string;
  sessionId: string;
  userAgent?: string;
  browser?: string;
  os?: string;
  deviceLabel?: string;
  message?: string;
};

const LOCAL_KEY = "aims-auth-events";
const SESSION_KEY = "aims-session-id";
const MAX_LOCAL = 100;

export function currentSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const next =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    sessionStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return `s-${Date.now()}`;
  }
}

export function describeUserAgent(ua = navigator.userAgent): {
  browser: string;
  os: string;
  deviceLabel: string;
} {
  const lower = ua.toLowerCase();
  let browser = "Browser";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) browser = "Chrome";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) browser = "Safari";

  let os = "Device";
  if (lower.includes("windows nt 11")) os = "Windows 11";
  else if (lower.includes("windows nt 10")) os = "Windows 10";
  else if (lower.includes("windows")) os = "Windows";
  else if (lower.includes("android")) os = "Android";
  else if (lower.includes("iphone")) os = "iPhone";
  else if (lower.includes("ipad")) os = "iPad";
  else if (lower.includes("mac os x") || lower.includes("macintosh"))
    os = "macOS";
  else if (lower.includes("linux")) os = "Linux";

  const deviceLabel = `${browser} · ${os}`;
  return { browser, os, deviceLabel };
}

function readLocal(): AuthEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as AuthEvent[];
  } catch {
    return [];
  }
}

function writeLocal(events: AuthEvent[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(events.slice(0, MAX_LOCAL)));
  } catch {
    // ignore quota or private-mode errors
  }
}

export async function logAuthEvent(
  uid: string | null | undefined,
  type: AuthEventType,
  extra: { message?: string } = {},
): Promise<void> {
  const sessionId = currentSessionId();
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const { browser, os, deviceLabel } = describeUserAgent(ua);
  const at = new Date().toISOString();
  const entry: AuthEvent = {
    id: `${sessionId}-${type}-${at}`,
    type,
    at,
    sessionId,
    userAgent: ua,
    browser,
    os,
    deviceLabel,
    ...(extra.message ? { message: extra.message } : {}),
  };

  // Always keep a local tail so the Security page has data in demo mode and
  // offline, and so the current session is immediately visible after login.
  const local = [entry, ...readLocal().filter((e) => e.id !== entry.id)];
  writeLocal(local);

  if (!uid || !firestore) return;
  try {
    const ref = doc(
      collection(firestore, "users", uid, "authEvents"),
      entry.id,
    );
    await setDoc(ref, {
      type,
      sessionId,
      userAgent: ua,
      browser,
      os,
      deviceLabel,
      at: serverTimestamp(),
      ...(extra.message ? { message: extra.message } : {}),
    });
  } catch {
    // Rules may reject before full profile exists; silently fall back to local.
  }
}

export async function listAuthEvents(
  uid: string | null | undefined,
  max = 50,
): Promise<AuthEvent[]> {
  const local = readLocal();
  if (!uid || !firestore) return local.slice(0, max);
  try {
    const ref = collection(firestore, "users", uid, "authEvents");
    const snapshot = await getDocs(
      query(ref, orderBy("at", "desc"), limit(max)),
    );
    const remote: AuthEvent[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const rawAt = data.at;
      let at = "";
      if (rawAt instanceof Timestamp) at = rawAt.toDate().toISOString();
      else if (typeof rawAt === "string") at = rawAt;
      return {
        id: docSnap.id,
        type: (data.type as AuthEventType) ?? "loggedIn",
        at,
        sessionId: (data.sessionId as string) ?? "",
        userAgent: data.userAgent as string | undefined,
        browser: data.browser as string | undefined,
        os: data.os as string | undefined,
        deviceLabel: data.deviceLabel as string | undefined,
        message: data.message as string | undefined,
      };
    });
    // Merge local-only entries (e.g. offline) that aren't in the remote list
    const seen = new Set(remote.map((event) => event.id));
    const merged = [
      ...remote,
      ...local.filter((event) => !seen.has(event.id)),
    ];
    merged.sort((a, b) => (a.at < b.at ? 1 : -1));
    return merged.slice(0, max);
  } catch {
    return local.slice(0, max);
  }
}

export type ActiveSession = {
  sessionId: string;
  startedAt: string;
  lastActivityAt: string;
  deviceLabel: string;
  browser?: string;
  os?: string;
  isCurrent: boolean;
};

export function computeActiveSessions(events: AuthEvent[]): ActiveSession[] {
  const current = currentSessionId();
  const sessions = new Map<string, ActiveSession>();
  // Walk events chronologically (oldest first) to build session state.
  const chrono = [...events].sort((a, b) => (a.at < b.at ? -1 : 1));
  for (const event of chrono) {
    if (!event.sessionId) continue;
    const existing = sessions.get(event.sessionId);
    if (event.type === "loggedIn") {
      sessions.set(event.sessionId, {
        sessionId: event.sessionId,
        startedAt: event.at,
        lastActivityAt: event.at,
        deviceLabel: event.deviceLabel ?? "Unknown device",
        browser: event.browser,
        os: event.os,
        isCurrent: event.sessionId === current,
      });
    } else if (existing) {
      existing.lastActivityAt = event.at;
      if (
        event.type === "loggedOut" ||
        event.type === "sessionTerminated"
      ) {
        sessions.delete(event.sessionId);
      }
    }
  }
  // Ensure the current session shows up even if its loggedIn event hasn't
  // reached the local tail yet (e.g. page reload before write completes).
  if (!sessions.has(current)) {
    const { browser, os, deviceLabel } = describeUserAgent();
    sessions.set(current, {
      sessionId: current,
      startedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      deviceLabel,
      browser,
      os,
      isCurrent: true,
    });
  }
  return Array.from(sessions.values()).sort((a, b) =>
    a.isCurrent ? -1 : b.isCurrent ? 1 : a.lastActivityAt < b.lastActivityAt ? 1 : -1,
  );
}
