import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import { firestore } from "../lib/firebase";

export type TicketCategory =
  | "login"
  | "asset"
  | "location"
  | "repair"
  | "data"
  | "report"
  | "permission"
  | "system-error"
  | "other";

export type TicketPriority = "low" | "normal" | "high" | "urgent";

export type SupportTicket = {
  id: string;
  requestedBy: string;
  requestedByEmail?: string;
  requestedByName?: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  description: string;
  attachmentUrls?: string[];
  status: "open";
  createdAt: string;
};

export type SubmitSupportTicketInput = {
  uid: string;
  email: string | null;
  name: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  description: string;
  attachmentUrls?: string[];
};

export async function submitSupportTicket(
  input: SubmitSupportTicketInput,
): Promise<string> {
  if (!firestore) throw new Error("Support tickets require Firebase.");
  const ref = await addDoc(collection(firestore, "supportTickets"), {
    requestedBy: input.uid,
    requestedByEmail: input.email ?? null,
    requestedByName: input.name,
    subject: input.subject.trim(),
    category: input.category,
    priority: input.priority,
    description: input.description.trim(),
    attachmentUrls: input.attachmentUrls ?? [],
    status: "open",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listMySupportTickets(
  uid: string,
  max = 20,
): Promise<SupportTicket[]> {
  if (!firestore) return [];
  try {
    const snap = await getDocs(
      query(
        collection(firestore, "supportTickets"),
        where("requestedBy", "==", uid),
        orderBy("createdAt", "desc"),
        limit(max),
      ),
    );
    return snap.docs.map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const raw = data.createdAt;
      let createdAt = "";
      if (raw instanceof Timestamp) createdAt = raw.toDate().toISOString();
      return {
        id: docSnap.id,
        requestedBy: data.requestedBy as string,
        requestedByEmail: data.requestedByEmail as string | undefined,
        requestedByName: data.requestedByName as string | undefined,
        subject: (data.subject as string) ?? "",
        category: (data.category as TicketCategory) ?? "other",
        priority: (data.priority as TicketPriority) ?? "normal",
        description: (data.description as string) ?? "",
        attachmentUrls: data.attachmentUrls as string[] | undefined,
        status: "open" as const,
        createdAt,
      };
    });
  } catch {
    return [];
  }
}
