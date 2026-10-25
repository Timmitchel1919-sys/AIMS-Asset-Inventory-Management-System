import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { firestore } from "../lib/firebase";

export type ProblemModule =
  | "dashboard"
  | "assets"
  | "inventory"
  | "locations"
  | "departments"
  | "assignments"
  | "borrow"
  | "repairs"
  | "maintenance"
  | "movements"
  | "audits"
  | "reports"
  | "notifications"
  | "settings"
  | "account"
  | "security"
  | "other";

export type ProblemType =
  | "crash"
  | "unexpected-behavior"
  | "missing-data"
  | "permission"
  | "performance"
  | "visual"
  | "other";

export type ProblemDiagnostics = {
  version: string;
  route: string;
  userAgent: string;
  os: string;
  deviceType: "desktop" | "tablet" | "mobile" | "unknown";
  theme: string;
  language: string;
  timestamp: string;
};

export function captureDiagnostics(theme: string, language: string): ProblemDiagnostics {
  const ua = navigator.userAgent;
  const lower = ua.toLowerCase();
  let os = "Unknown";
  if (lower.includes("windows")) os = "Windows";
  else if (lower.includes("android")) os = "Android";
  else if (lower.includes("iphone")) os = "iPhone";
  else if (lower.includes("ipad")) os = "iPad";
  else if (lower.includes("mac os x") || lower.includes("macintosh")) os = "macOS";
  else if (lower.includes("linux")) os = "Linux";
  let deviceType: ProblemDiagnostics["deviceType"] = "desktop";
  if (/mobi|iphone|android.*mobile/i.test(ua)) deviceType = "mobile";
  else if (/ipad|tablet|android(?!.*mobile)/i.test(ua)) deviceType = "tablet";
  return {
    version: import.meta.env.VITE_APP_VERSION || "dev",
    route: typeof location !== "undefined" ? location.pathname : "/",
    userAgent: ua,
    os,
    deviceType,
    theme,
    language,
    timestamp: new Date().toISOString(),
  };
}

export type SubmitProblemReportInput = {
  uid: string;
  email: string | null;
  name: string;
  module: ProblemModule;
  problemType: ProblemType;
  description: string;
  stepsToReproduce: string;
  diagnostics: ProblemDiagnostics;
};

export async function submitProblemReport(
  input: SubmitProblemReportInput,
): Promise<string> {
  if (!firestore) throw new Error("Problem reports require Firebase.");
  const ref = await addDoc(collection(firestore, "problemReports"), {
    reportedBy: input.uid,
    reportedByEmail: input.email ?? null,
    reportedByName: input.name,
    module: input.module,
    problemType: input.problemType,
    description: input.description.trim(),
    stepsToReproduce: input.stepsToReproduce.trim(),
    diagnostics: input.diagnostics,
    status: "open",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}
