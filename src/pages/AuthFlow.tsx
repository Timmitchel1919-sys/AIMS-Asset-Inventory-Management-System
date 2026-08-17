import {
  CheckCircle2,
  KeyRound,
  LogOut,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card } from "../components/ui";
import { AccountBackButton, PageHeader } from "../components/WorkflowUi";
import {
  authErrorMessage,
  changePassword,
  currentSignInMethod,
  refreshVerification,
  resendVerification,
} from "../auth/firebaseAuth";
import { useApp } from "../context/AppContext";
import { firebaseConfigured } from "../lib/firebase";
import {
  KCS_ICT_SUPPORT_EMAIL,
  KCS_ICT_SUPPORT_LINE,
} from "../config/ictSupport";
import { legalConfig } from "../config/legal";
import { Link, useLocation } from "react-router-dom";

export function VerifyEmailPage() {
  const app = useApp(),
    navigate = useNavigate(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setInterval(
      () => setRemaining((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [remaining]);
  async function check() {
    setBusy(true);
    setMessage("");
    try {
      if (await refreshVerification()) {
        await app.refreshUser();
        navigate("/dashboard", { replace: true });
      } else
        setMessage(
          "Your email is not verified yet. Open the verification link, then check again.",
        );
    } catch (error) {
      setMessage(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    try {
      await resendVerification();
      setRemaining(60);
      setMessage("Verification email sent. Check your inbox and spam folder.");
    } catch (error) {
      setMessage(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page auth-verify">
      <main className="auth-panel">
        <Card className="auth-card">
          <Mail />
          <h2>Verify your email</h2>
          <p>
            We sent a verification link to <strong>{app.user?.email}</strong>.
            Verify the address before opening AIMS.
          </p>
          {message && <p role="status">{message}</p>}
          <Button onClick={check} disabled={busy}>
            I have verified my email
          </Button>
          <Button
            variant="secondary"
            onClick={resend}
            disabled={busy || remaining > 0}
          >
            {remaining
              ? `Resend in ${remaining}s`
              : "Resend verification email"}
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              await app.logout();
              navigate("/", { replace: true });
            }}
          >
            <LogOut />
            Sign out
          </Button>
        </Card>
      </main>
    </div>
  );
}

export function AccessDeniedPage() {
  const app = useApp();
  const navigate = useNavigate();
  return (
    <div className="auth-page">
      <main className="auth-panel">
        <Card className="auth-card">
          <ShieldCheck />
          <h1>Access Restricted</h1>
          <p>AIMS is available only to authorized Kangoeroe School users.</p>
          <p>Please sign in with your @kangoeroeschool.com account.</p>
          <Button onClick={async () => { await app.logout(); navigate("/login", { replace: true }); }}>
            Return to Sign In
          </Button>
        </Card>
      </main>
    </div>
  );
}

export function SecurityPage() {
  const app = useApp(),
    nl = app.language === "nl",
    method = firebaseConfigured ? currentSignInMethod() : "unknown",
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget),
      current = String(data.get("current") || ""),
      password = String(data.get("password") || ""),
      confirm = String(data.get("confirm") || "");
    setError("");
    setMessage("");
    if (
      password.length < 8 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      setError(nl ? "Gebruik 8+ tekens met hoofdletters, kleine letters en een cijfer." : "Use 8+ characters with uppercase, lowercase, and a number.");
      return;
    }
    if (password !== confirm) {
      setError(nl ? "De wachtwoorden komen niet overeen." : "Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, password);
      event.currentTarget.reset();
      setMessage(nl ? "Wachtwoord succesvol gewijzigd." : "Password changed successfully.");
    } catch (reason) {
      setError(authErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page">
      <AccountBackButton />
      <PageHeader
        title={nl ? "Beveiliging" : "Security"}
        description={nl ? "Persoonlijke aanmeldbeveiliging voor uw account." : "Personal sign-in security for your account."}
      />
      <div className="account-settings-grid">
        <Card>
          <ShieldCheck />
          <h2>{nl ? "Accountstatus" : "Account status"}</h2>
          {method !== "anonymous" && <p>
            {nl ? "E-mailverificatie" : "Email verification"}:{" "}
            <strong>{app.emailVerified ? (nl ? "Geverifieerd" : "Verified") : (nl ? "Niet geverifieerd" : "Not verified")}</strong>
          </p>}
          <p>
            {nl ? "Aanmeldmethode" : "Sign-in method"}:{" "}
            <strong>
              {method === "google"
                ? "Google"
                : method === "anonymous"
                  ? (nl ? "Anoniem" : "Anonymous")
                : method === "password"
                  ? (nl ? "E-mail en wachtwoord" : "Email and password")
                  : (nl ? "Niet beschikbaar in presentatiemodus" : "Unavailable in presentation mode")}
            </strong>
          </p>
        </Card>
        {method === "anonymous" && (
          <Card><ShieldCheck /><h2>{nl ? "Demosessie" : "Demo session"}</h2><p>{nl ? "Dit is een tijdelijke demosessie. Er is geen e-mailadres of wachtwoord om te beheren." : "This is a temporary demo session. It has no email address or password to manage."}</p></Card>
        )}
        {method === "password" && (
          <Card>
            <KeyRound />
            <h2>{nl ? "Wachtwoord wijzigen" : "Change password"}</h2>
            <form className="workflow-form" onSubmit={submit}>
              <label>
                {nl ? "Huidig wachtwoord" : "Current password"}
                <input
                  name="current"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
              <label>
                {nl ? "Nieuw wachtwoord" : "New password"}
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </label>
              <label>
                {nl ? "Nieuw wachtwoord bevestigen" : "Confirm new password"}
                <input
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </label>
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
              {message && (
                <p className="notice success">
                  <CheckCircle2 />
                  {message}
                </p>
              )}
              <Button disabled={busy}>
                <ShieldCheck />
                {busy ? (nl ? "Bijwerken…" : "Updating…") : (nl ? "Wachtwoord bijwerken" : "Update password")}
              </Button>
            </form>
          </Card>
        )}
        {method === "google" && (
          <Card>
            <h2>{nl ? "Wachtwoordbeheer" : "Password management"}</h2>
            <p>
              {nl ? "Dit account meldt zich aan met Google. Beheer het wachtwoord via uw Google-account." : "This account signs in with Google. Manage its password through your Google account."}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

export function HelpPage() {
  const location = useLocation(), { language } = useApp(), nl = language === "nl";
  const diagnostics = encodeURIComponent(
    `AIMS support request\nModule: ${location.pathname}\nTime: ${new Date().toISOString()}\nBrowser: ${navigator.userAgent}`,
  );
  return (
    <div className="page">
      <AccountBackButton />
      <PageHeader
        title={nl ? "Help en ondersteuning" : "Help & Support"}
        description={nl ? "Documentatie, ondersteuning en applicatie-informatie." : "Documentation, support, and application information."}
      />
      <div className="account-settings-grid">
        <Card>
          <h2>{nl ? "Helpcentrum" : "Help Center"}</h2>
          <p>{nl ? "Bekijk hulp per werkproces." : "Browse help by workflow."}</p>
          <nav className="help-links">
            {(nl
              ? ["Aan de slag", "ICT-middelen", "Magazijn", "Locaties", "Toewijzingen", "Uitleenbeheer", "Reparaties", "Onderhoud", "Rapporten", "Account", "PWA-installatie"]
              : ["Getting Started", "ICT Assets", "Warehouse", "Locations", "Assignments", "Borrow Management", "Repairs", "Maintenance", "Reports", "Account", "PWA Installation"]
            ).map((item) => (
              <span key={item}>{item}</span>
            ))}
          </nav>
        </Card>
        <Card>
          <h2>{nl ? "Contact opnemen met ICT-ondersteuning" : "Contact ICT Support"}</h2>
          <p>
            <a
              href={`mailto:${KCS_ICT_SUPPORT_EMAIL}?subject=AIMS%20support&body=${diagnostics}`}
            >
              {KCS_ICT_SUPPORT_EMAIL}
            </a>
            <br />
            {KCS_ICT_SUPPORT_LINE}
          </p>
          <p>
            {nl ? "De e-mail bevat alleen diagnostische gegevens over de applicatie, browser, route en tijdstempel." : "The email includes only application, browser, route, and timestamp diagnostics."}
          </p>
        </Card>
        <Card>
          <h2>{nl ? "Een probleem melden" : "Report a Problem"}</h2>
          <p>
            {nl ? "Meld aanmeldproblemen, problemen met middelen, applicatiefouten, gegevensproblemen of machtigingsproblemen via de ICT-ondersteuningsmail." : "Report login problems, asset issues, application bugs, data issues, or permission issues through the ICT support email."}
          </p>
          <a
            className="btn secondary"
            href={`mailto:${KCS_ICT_SUPPORT_EMAIL}?subject=AIMS%20problem%20report&body=${diagnostics}`}
          >
            {nl ? "Probleemmelding voorbereiden" : "Prepare problem report"}
          </a>
        </Card>
        <Card>
          <h2>{nl ? "Over AIMS" : "About AIMS"}</h2>
          <p>
            <strong>AIMS</strong>
            <br />
            {legalConfig.systemName}
          </p>
          <p>
            {nl ? "Omgeving" : "Environment"}: {import.meta.env.MODE}
            <br />
            {nl ? "Versie" : "Version"}:{" "}
            {import.meta.env.VITE_APP_VERSION || (nl ? "Buildmetadata niet beschikbaar" : "Build metadata unavailable")}
          </p>
          <p>
            <Link to="/privacy">{nl ? "Privacyverklaring" : "Privacy Notice"}</Link> ·{" "}
            <Link to="/terms">{nl ? "Algemene voorwaarden" : "Terms & Conditions"}</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
