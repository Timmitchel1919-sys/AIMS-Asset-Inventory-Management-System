import { useEffect, useState, type FormEvent } from "react";
import { Headset, Send } from "lucide-react";
import { Button, Card } from "../ui";
import { useApp } from "../../context/AppContext";
import {
  listMySupportTickets,
  submitSupportTicket,
  type SupportTicket,
  type TicketCategory,
  type TicketPriority,
} from "../../services/supportTickets";
import { firebaseConfigured } from "../../lib/firebase";

const CATEGORIES: { id: TicketCategory; en: string; nl: string }[] = [
  { id: "login", en: "Login problem", nl: "Aanmeldprobleem" },
  { id: "asset", en: "Asset issue", nl: "Probleem met middel" },
  { id: "location", en: "Location issue", nl: "Locatieprobleem" },
  { id: "repair", en: "Repair / Maintenance issue", nl: "Reparatie / onderhoud" },
  { id: "data", en: "Data problem", nl: "Gegevensprobleem" },
  { id: "report", en: "Report problem", nl: "Rapportageprobleem" },
  { id: "permission", en: "Permission problem", nl: "Machtigingsprobleem" },
  { id: "system-error", en: "System error", nl: "Systeemfout" },
  { id: "other", en: "Other", nl: "Overig" },
];

const PRIORITIES: { id: TicketPriority; en: string; nl: string }[] = [
  { id: "low", en: "Low", nl: "Laag" },
  { id: "normal", en: "Normal", nl: "Normaal" },
  { id: "high", en: "High", nl: "Hoog" },
  { id: "urgent", en: "Urgent", nl: "Urgent" },
];

export function ContactSupportCard() {
  const app = useApp();
  const nl = app.language === "nl";
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<TicketCategory>("other");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);

  useEffect(() => {
    if (!firebaseConfigured || !app.user?.id || app.user?.isDemoUser) return;
    void listMySupportTickets(app.user.id, 10).then(setMyTickets);
  }, [app.user?.id, app.user?.isDemoUser, notice]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!subject.trim() || !description.trim()) {
      setError(
        nl
          ? "Vul een onderwerp en omschrijving in."
          : "Enter a subject and description.",
      );
      return;
    }
    if (!app.user?.id) {
      setError(
        nl
          ? "Meld u aan om een ticket in te dienen."
          : "Sign in to submit a ticket.",
      );
      return;
    }
    if (!firebaseConfigured || app.user.isDemoUser) {
      setError(
        nl
          ? "Tickets zijn uitgeschakeld in de demosessie."
          : "Tickets are disabled in the demo session.",
      );
      return;
    }
    setBusy(true);
    try {
      const id = await submitSupportTicket({
        uid: app.user.id,
        email: app.user.email ?? null,
        name: app.user.name,
        subject,
        category,
        priority,
        description,
      });
      setNotice(
        nl
          ? `Ticket ingediend (#${id.slice(-6).toUpperCase()}). ICT ontvangt een melding.`
          : `Ticket submitted (#${id.slice(-6).toUpperCase()}). ICT has been notified.`,
      );
      setSubject("");
      setDescription("");
      setCategory("other");
      setPriority("normal");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : nl
            ? "Ticket kon niet worden verstuurd."
            : "Ticket could not be submitted.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Headset />
      <h2>{nl ? "Contact met ICT-ondersteuning" : "Contact ICT Support"}</h2>
      <p>
        {nl
          ? "Dien een ticket in bij de ICT-afdeling. Elk ticket wordt gelogd met uw account, categorie en prioriteit."
          : "Open a ticket with the ICT department. Each ticket is logged with your account, category and priority."}
      </p>
      <form className="workflow-form" onSubmit={submit}>
        <label>
          {nl ? "Onderwerp" : "Subject"}
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            required
            maxLength={120}
          />
        </label>
        <label>
          {nl ? "Categorie" : "Category"}
          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as TicketCategory)
            }
          >
            {CATEGORIES.map((item) => (
              <option key={item.id} value={item.id}>
                {nl ? item.nl : item.en}
              </option>
            ))}
          </select>
        </label>
        <label>
          {nl ? "Prioriteit" : "Priority"}
          <select
            value={priority}
            onChange={(event) =>
              setPriority(event.target.value as TicketPriority)
            }
          >
            {PRIORITIES.map((item) => (
              <option key={item.id} value={item.id}>
                {nl ? item.nl : item.en}
              </option>
            ))}
          </select>
        </label>
        <label>
          {nl ? "Omschrijving" : "Description"}
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
            rows={5}
            maxLength={4000}
          />
        </label>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="notice success" role="status">
            {notice}
          </p>
        )}
        <Button disabled={busy}>
          <Send />
          {busy
            ? nl
              ? "Versturen…"
              : "Submitting…"
            : nl
              ? "Ticket indienen"
              : "Submit ticket"}
        </Button>
      </form>
      {myTickets.length > 0 && (
        <>
          <h3 className="support-tickets__title">
            {nl ? "Uw recente tickets" : "Your recent tickets"}
          </h3>
          <ul className="support-tickets">
            {myTickets.map((ticket) => (
              <li key={ticket.id}>
                <strong>
                  #{ticket.id.slice(-6).toUpperCase()} · {ticket.subject}
                </strong>
                <small>
                  {ticket.category} ·{" "}
                  {ticket.createdAt
                    ? app.formatDateTime(ticket.createdAt)
                    : ""}
                </small>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
