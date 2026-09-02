import {
  ArrowLeft,
  Bot,
  Bookmark,
  Clock3,
  Send,
  Settings2,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button, Card } from "../components/ui";
import { rolePermissions } from "../auth/permissions";
import { useApp } from "../context/AppContext";
import { useMockSnapshot } from "../data/repositoryContext";
import type { AiAssistantResponse } from "../domain/wave8";
import { createAiAssistantProvider } from "../lib/aiAssistant";

const provider = createAiAssistantProvider();
const prompts = {
  en: [
    "Which assets are currently available?",
    "Which borrowed items are overdue?",
    "Which stock items are below reorder level?",
    "Which repairs are waiting for approval?",
    "Explain why I cannot access this record.",
  ],
  nl: [
    "Welke middelen zijn beschikbaar?",
    "Welke leenitems zijn te laat?",
    "Welke artikelen hebben lage voorraad?",
    "Welke reparaties wachten op goedkeuring?",
    "Leg uit waarom ik geen toegang heb.",
  ],
};

export default function Assistant() {
  const app = useApp(),
    nl = app.language === "nl",
    snapshot = useMockSnapshot(),
    location = useLocation(),
    navigate = useNavigate(),
    params = useParams(),
    [query, setQuery] = useState(""),
    [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<
    { who: "bot" | "you"; text: string; response?: AiAssistantResponse }[]
  >([
    {
      who: "bot",
      text: nl
        ? "Stel een geautoriseerde inventarisvraag. Ik kan geen gegevens wijzigen."
        : "Ask an authorized inventory question. I cannot change data.",
    },
  ]);
  const section = location.pathname.includes("/history")
    ? "history"
    : location.pathname.includes("/saved")
      ? "saved"
      : location.pathname.includes("/settings")
        ? "settings"
        : params.conversationId
          ? "detail"
          : "chat";
  async function send() {
    const value = query.trim();
    if (!value || sending) return;
    setQuery("");
    setSending(true);
    setMessages((current) => [...current, { who: "you", text: value }]);
    const response = await provider.query({
      query: value,
      language: app.language,
      permissions: app.user ? rolePermissions[app.user.role] : [],
      snapshot,
    });
    setMessages((current) => [
      ...current,
      { who: "bot", text: response.answer, response },
    ]);
    setSending(false);
  }
  if (section !== "chat")
    return (
      <div className="page">
        <button
          type="button"
          className="back"
          onClick={() =>
            navigate(section === "detail" ? "/assistant/history" : "/assistant")
          }
        >
          <ArrowLeft />
          {nl ? "Terug" : "Back"}
        </button>
        <header className="page-title">
          <div>
            <h1>
              {section === "history"
                ? nl
                  ? "Gesprekshistorie"
                  : "Conversation history"
                : section === "saved"
                  ? nl
                    ? "Opgeslagen resultaten"
                    : "Saved results"
                  : section === "settings"
                    ? nl
                      ? "Assistentinstellingen"
                      : "Assistant settings"
                    : nl
                      ? "Gespreksdetail"
                      : "Conversation detail"}
            </h1>
            <p>
              {nl
                ? "Veilige, alleen-lezen AI-werkruimte."
                : "Secure, read-only AI workspace."}
            </p>
          </div>
        </header>
        <Card>
          <div className="state">
            <Bot />
            <h2>{nl ? "Anthropic-assistent" : "Anthropic assistant"}</h2>
            <p>
              {section === "detail"
                ? `${nl ? "Gesprek" : "Conversation"} ${params.conversationId}`
                : nl
                  ? "Er zijn nog geen opgeslagen records in deze browsersessie."
                  : "There are no saved records in this browser session yet."}
            </p>
            <Link className="btn primary" to="/assistant">
              {nl ? "Assistent openen" : "Open assistant"}
            </Link>
          </div>
        </Card>
      </div>
    );
  return (
    <div className="page assistant-page">
      <header className="page-title">
        <div>
          <h1>{nl ? "AI-inventarisassistent" : "AI inventory assistant"}</h1>
          <p>
            {nl
              ? "Bevoegdheidsgebonden antwoorden uit de actuele momentopname."
              : "Permission-filtered answers from the current data snapshot."}
          </p>
        </div>
        <div className="actions">
          <Link className="btn secondary" to="/assistant/history">
            <Clock3 />
            {nl ? "Historie" : "History"}
          </Link>
          <Link className="btn secondary" to="/assistant/saved">
            <Bookmark />
            {nl ? "Opgeslagen" : "Saved"}
          </Link>
          <Link className="btn secondary" to="/assistant/settings">
            <Settings2 />
            {nl ? "Instellingen" : "Settings"}
          </Link>
        </div>
      </header>
      {import.meta.env.VITE_SHOW_AI_NOTICE === "true" && (
        <div className="notice warning">
          <strong>
            {nl ? "AI-assistent · alleen lezen" : "AI assistant · read only"}
          </strong>
          <span>
            {" "}
            ·{" "}
            {nl
              ? "Antwoorden zijn gebaseerd op uw bevoegde gegevens en komen van Anthropic of een lokale regelgebaseerde terugval. Er worden nooit automatisch wijzigingen doorgevoerd."
              : "Answers are grounded in your permitted data and come from Anthropic or a local rule-based fallback. No changes are ever made automatically."}
          </span>
        </div>
      )}
      <Card className="assistant-card">
        <div className="chat" aria-live="polite">
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.who}`}>
              <span>
                {message.who === "bot" ? <Bot /> : app.user?.initials}
              </span>
              <p>
                {message.text}
                {message.response?.citations.length ? (
                  <>
                    <br />
                    <small>
                      {nl ? "Bronrecords" : "Source records"}:{" "}
                      {message.response.citations
                        .map((item) => item.reference)
                        .join(", ")}
                    </small>
                  </>
                ) : null}
                {message.response?.workflow && (
                  <>
                    <br />
                    <Link to={message.response.workflow}>
                      {nl ? "Workflow openen" : "Open workflow"} →
                    </Link>
                  </>
                )}
                {message.response && message.response.mock && (
                  <>
                    <br />
                    <small>
                      {nl
                        ? "Terugvalantwoord (regelgebaseerd, geen AI-verbinding)"
                        : "Fallback answer (rule-based, no AI connection)"}
                    </small>
                  </>
                )}
              </p>
            </div>
          ))}
          {sending && (
            <div className="message bot">
              <span>
                <Bot />
              </span>
              <p>{nl ? "Bezig met antwoorden…" : "Thinking…"}</p>
            </div>
          )}
        </div>
        <div className="suggestions">
          {prompts[app.language].slice(0, 3).map((prompt) => (
            <button
              key={prompt}
              onClick={() => setQuery(prompt)}
              disabled={sending}
            >
              <Sparkles />
              {prompt}
            </button>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <label className="sr-only" htmlFor="assistant-query">
            {nl ? "Vraag" : "Question"}
          </label>
          <input
            id="assistant-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={sending}
            placeholder={
              nl
                ? "Vraag naar geautoriseerde gegevens…"
                : "Ask about authorized data…"
            }
          />
          <Button
            aria-label={nl ? "Versturen" : "Send"}
            disabled={sending || !query.trim()}
          >
            <Send />
          </Button>
        </form>
        <small>
          {nl
            ? "Scope: uw effectieve rol · momentopname: huidige repository · mutaties: geblokkeerd"
            : "Scope: your effective role · snapshot: current repository · mutations: blocked"}
        </small>
      </Card>
    </div>
  );
}
