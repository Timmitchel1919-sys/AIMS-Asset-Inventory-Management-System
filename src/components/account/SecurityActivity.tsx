import { AlarmClock, Laptop, LogOut, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button, Card } from "../ui";
import { useApp } from "../../context/AppContext";
import {
  computeActiveSessions,
  listAuthEvents,
  type ActiveSession,
  type AuthEvent,
  type AuthEventType,
} from "../../services/authEvents";

function labelForEventType(type: AuthEventType, nl: boolean): string {
  switch (type) {
    case "loggedIn":
      return nl ? "Succesvolle aanmelding" : "Successful sign-in";
    case "loggedOut":
      return nl ? "Afgemeld" : "Signed out";
    case "loginFailed":
      return nl ? "Mislukte aanmelding" : "Failed sign-in";
    case "passwordChanged":
      return nl ? "Wachtwoord gewijzigd" : "Password changed";
    case "mfaEnabled":
      return nl ? "MFA ingeschakeld" : "MFA enabled";
    case "mfaDisabled":
      return nl ? "MFA uitgeschakeld" : "MFA disabled";
    case "newDevice":
      return nl ? "Nieuw apparaat aangemeld" : "New device signed in";
    case "sessionTerminated":
      return nl ? "Sessie beëindigd" : "Session terminated";
    default:
      return type;
  }
}

export function ActiveSessionsCard() {
  const app = useApp();
  const nl = app.language === "nl";
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    const events = await listAuthEvents(app.user?.id ?? null, 100);
    setSessions(computeActiveSessions(events));
    setLoading(false);
  }, [app.user?.id]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  async function signOutCurrent() {
    await app.logout();
  }
  return (
    <Card>
      <Laptop />
      <h2>{nl ? "Actieve sessies" : "Active sessions"}</h2>
      <p>
        {nl
          ? "Apparaten waar uw AIMS-account recent een sessie heeft gestart."
          : "Devices where your AIMS account recently started a session."}
      </p>
      {loading && (
        <p className="field-help">{nl ? "Laden…" : "Loading…"}</p>
      )}
      {!loading && sessions.length === 0 && (
        <p className="field-help">
          {nl
            ? "Geen sessies gevonden."
            : "No sessions on record."}
        </p>
      )}
      {!loading && sessions.length > 0 && (
        <ul className="account-session-list">
          {sessions.map((session) => (
            <li
              key={session.sessionId}
              className={`account-session-item${session.isCurrent ? " current" : ""}`}
            >
              <div className="account-session-item__meta">
                <strong>{session.deviceLabel}</strong>
                <small>
                  {nl ? "Gestart" : "Started"}:{" "}
                  {app.formatDateTime(session.startedAt)}
                </small>
                <small>
                  {nl ? "Laatste activiteit" : "Last activity"}:{" "}
                  {session.isCurrent
                    ? nl
                      ? "Nu"
                      : "Now"
                    : app.formatDateTime(session.lastActivityAt)}
                </small>
              </div>
              {session.isCurrent && (
                <span className="account-session-item__chip">
                  {nl ? "Huidige sessie" : "Current session"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="account-session-actions">
        <Button variant="secondary" onClick={signOutCurrent}>
          <LogOut />
          {nl ? "Afmelden van deze sessie" : "Sign out of this session"}
        </Button>
      </div>
      <p className="field-help account-session-note">
        <ShieldAlert aria-hidden="true" />
        {nl
          ? "Externe sessies van andere apparaten worden pas definitief beëindigd nadat Firebase tokens zijn ingetrokken. Vraag ICT om een token-revoke indien nodig."
          : "Remote sessions on other devices are only fully terminated after Firebase tokens are revoked. Contact ICT to force-revoke tokens if required."}
      </p>
    </Card>
  );
}

export function LoginActivityCard() {
  const app = useApp();
  const nl = app.language === "nl";
  const [events, setEvents] = useState<AuthEvent[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await listAuthEvents(app.user?.id ?? null, 25);
      if (!cancelled) {
        setEvents(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [app.user?.id]);
  return (
    <Card>
      <AlarmClock />
      <h2>{nl ? "Aanmeldactiviteit" : "Login activity"}</h2>
      <p>
        {nl
          ? "Recente beveiligingsgebeurtenissen voor dit account."
          : "Recent security events for this account."}
      </p>
      {loading && (
        <p className="field-help">{nl ? "Laden…" : "Loading…"}</p>
      )}
      {!loading && events.length === 0 && (
        <p className="field-help">
          {nl
            ? "Nog geen gebeurtenissen vastgelegd."
            : "No events recorded yet."}
        </p>
      )}
      {!loading && events.length > 0 && (
        <ul className="account-activity-list">
          {events.map((event) => (
            <li key={event.id} className="account-activity-item">
              <strong>{labelForEventType(event.type, nl)}</strong>
              <small>{app.formatDateTime(event.at)}</small>
              <small>{event.deviceLabel ?? ""}</small>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
