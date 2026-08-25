import {
  ArrowRight,
  ClipboardCheck,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ScanLine,
  School,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/ui";
import { IctSupportDialog } from "../components/auth/IctSupportDialog";
import { AimsWordmark } from "../components/branding/AimsWordmark";
import { legalConfig } from "../config/legal";
import { useApp } from "../context/AppContext";
import {
  authErrorMessage,
  forgotPassword,
  googleLogin,
  register,
  validateRegistration,
} from "../auth/firebaseAuth";
import {
  DEMO_AUTH_MODE,
  isVerificationRequired,
} from "../auth/aimsEmailPolicy";

export default function Auth({
  mode = "login",
}: {
  mode?: "login" | "signup" | "forgot";
}) {
  const app = useApp(),
    nl = app.language === "nl",
    navigate = useNavigate(),
    location = useLocation();
  const [done, setDone] = useState(false),
    [showPassword, setShowPassword] = useState(false),
    [error, setError] = useState(""),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "")
      .trim()
      .toLowerCase();
    const password = String(data.get("password") || "");
    setError("");
    setErrors({});
    if (mode === "signup") {
      const input = {
        fullName: String(data.get("fullName") || ""),
        email,
        password,
        department: String(data.get("department") || ""),
        jobTitle: String(data.get("jobTitle") || ""),
      };
      const validation = validateRegistration(
        input,
        String(data.get("confirmPassword") || ""),
      );
      if (Object.keys(validation).length) {
        setErrors(validation);
        return;
      }
      setSubmitting(true);
      try {
        await register(input);
        navigate(isVerificationRequired() ? "/verify-email" : "/dashboard", {
          replace: true,
        });
      } catch (reason) {
        setError(
          authErrorMessage(reason) ===
            "We could not complete that request. Please try again." &&
            reason instanceof Error
            ? reason.message
            : authErrorMessage(reason),
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (
      (mode !== "login" || !DEMO_AUTH_MODE) &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      setErrors({ email: nl ? "Vul een geldig e-mailadres in." : "Enter a valid email address." });
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "forgot") {
        await forgotPassword(email);
        setDone(true);
      } else {
        await app.login(email, data.get("remember") === "on", password);
        const target =
          (location.state as { from?: { pathname?: string } } | null)?.from
            ?.pathname || "/dashboard";
        if (import.meta.env.DEV && DEMO_AUTH_MODE)
          console.info("Redirecting to dashboard");
        navigate(target, { replace: true });
      }
    } catch (reason) {
      setError(authErrorMessage(reason));
    } finally {
      setSubmitting(false);
    }
  }
  async function useGoogle() {
    setSubmitting(true);
    setError("");
    try {
      if (import.meta.env.VITE_APP_MODE === "presentation")
        await app.login("ict-staff", true);
      else await googleLogin(true);
      navigate("/dashboard", { replace: true });
    } catch (reason) {
      setError(authErrorMessage(reason));
    } finally {
      setSubmitting(false);
    }
  }
  const title =
    mode === "login"
      ? nl ? "Welkom terug" : "Welcome back"
      : mode === "signup"
        ? nl ? "Maak uw AIMS-account" : "Create your AIMS account"
        : nl ? "Herstel uw wachtwoord" : "Reset your password";
  return (
    <div className={`auth-page auth-${mode}`} data-auth-theme={app.theme}>
      <section className="auth-brand">
        <div className="auth-brand-content">
          <div className="auth-brand-header">
            <img src="/aims-logo-blue.png" alt="AIMS logo" />
            <div>
              <strong>AIMS</strong>
              <small>{nl ? "Asset- en inventarisbeheersysteem" : "Asset & Inventory Management System"}</small>
            </div>
          </div>
          <div className="auth-brand-copy">
            <h1>
              <span>AIMS Asset &amp; Inventory</span>
              <span>Management System</span>
            </h1>
            <p>
              {nl
                ? "Volledig inzicht, verantwoordelijkheid en levenscyclusbeheer voor schoolmiddelen."
                : "Complete visibility, accountability, and lifecycle control for school assets."}
            </p>
          </div>
          <ul>
            <li>
              <span>
                <ShieldCheck />
              </span>
              <div><strong>{nl ? "Veilige accounttoegang" : "Secure account access"}</strong><small>{nl ? "Meerlaagse beveiliging om uw gegevens en middelen te beschermen." : "Layered security to protect your data and assets."}</small></div>
            </li>
            <li>
              <span>
                <ClipboardCheck />
              </span>
              <div><strong>{nl ? "Traceerbare inventarisprocessen" : "Traceable inventory workflows"}</strong><small>{nl ? "Realtime data en rapporten voor betere beslissingen." : "Real-time data and reporting for better decisions."}</small></div>
            </li>
            <li>
              <span>
                <ScanLine />
              </span>
              <div><strong>{nl ? "Mobiele controles en scans" : "Mobile-ready audits and scanning"}</strong><small>{nl ? "Vereenvoudig verificaties en verminder handmatige taken." : "Simplify verification and reduce manual work."}</small></div>
            </li>
            <li>
              <span>
                <School />
              </span>
              <div><strong>St. Kangoeroe Community School</strong><small>{nl ? "Vertrouwd door scholen en organisaties." : "Trusted by schools and organizations."}</small></div>
            </li>
          </ul>
        </div>
      </section>
      <main className="auth-panel">
        <div className="auth-card login-card">
          {mode !== "login" && (
            <label className="auth-language-select">
              <span>{nl ? "Taal" : "Language"}</span>
              <select
                value={app.language}
                onChange={(event) => app.setLanguage(event.target.value as "en" | "nl")}
                aria-label={nl ? "Taal kiezen" : "Choose language"}
              >
                <option value="en">English</option>
                <option value="nl">Nederlands</option>
              </select>
            </label>
          )}
          {done ? (
            <>
              <span className="auth-success">
                <Mail />
              </span>
              <h2>{nl ? "Controleer uw e-mail" : "Check your email"}</h2>
              <p>
                {nl
                  ? "Als voor dit adres een account bestaat, zijn instructies voor wachtwoordherstel verzonden."
                  : "If an account exists for that address, password reset instructions have been sent."}
              </p>
              <Button onClick={() => navigate("/login")}>
                {nl ? "Terug naar aanmelden" : "Return to sign in"}
              </Button>
            </>
          ) : (
            <>
              <div className="auth-logo-lockup">
                <AimsWordmark variant="auth" />
              </div>
              {mode !== "login" && <h2>{title}</h2>}
              {mode === "signup" && (
                <p>{nl ? "Registreer met uw goedgekeurde school-e-mailadres." : "Register with your approved school email address."}</p>
              )}
              <form onSubmit={submit} noValidate>
                {mode === "signup" && (
                  <label>
                    <span>{nl ? "Volledige naam" : "Full name"}</span>
                    <div className={errors.fullName ? "invalid" : ""}>
                      <UserRound />
                      <input
                        name="fullName"
                        autoComplete="name"
                        maxLength={100}
                        required
                      />
                    </div>
                    {errors.fullName && (
                      <small className="field-error">{errors.fullName}</small>
                    )}
                  </label>
                )}
                <label>
                  <span>{nl ? "E-mailadres" : "Email address"}</span>
                  <div className={errors.email ? "invalid" : ""}>
                    <Mail />
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder={nl ? "voorbeeld@school.nl" : "example@school.org"}
                      required={mode !== "login" || !DEMO_AUTH_MODE}
                      disabled={submitting}
                    />
                  </div>
                  {errors.email && (
                    <small className="field-error">{errors.email}</small>
                  )}
                </label>
                {mode !== "forgot" && (
                  <label>
                    <span>{nl ? "Wachtwoord" : "Password"}</span>
                    <div className={errors.password ? "invalid" : ""}>
                      <LockKeyhole />
                      <input
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={
                          mode === "login" ? "current-password" : "new-password"
                        }
                        placeholder="••••••••••••••"
                        required={mode !== "login" || !DEMO_AUTH_MODE}
                        disabled={submitting}
                      />
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={nl ? "Wachtwoord tonen of verbergen" : "Show or hide password"}
                        disabled={submitting}
                        onClick={() => setShowPassword((value) => !value)}
                      >
                        {showPassword ? <EyeOff /> : <Eye />}
                      </button>
                    </div>
                    {errors.password && (
                      <small className="field-error">{errors.password}</small>
                    )}
                  </label>
                )}
                {mode === "signup" && (
                  <>
                    <label>
                      <span>{nl ? "Wachtwoord bevestigen" : "Confirm password"}</span>
                      <div className={errors.confirmPassword ? "invalid" : ""}>
                        <LockKeyhole />
                        <input
                          name="confirmPassword"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          required
                        />
                      </div>
                      {errors.confirmPassword && (
                        <small className="field-error">
                          {errors.confirmPassword}
                        </small>
                      )}
                    </label>
                    <label>
                      <span>
                        {nl ? "Afdeling" : "Department"} <small>({nl ? "optioneel" : "optional"})</small>
                      </span>
                      <div>
                        <input name="department" maxLength={100} />
                      </div>
                    </label>
                    <label>
                      <span>
                        {nl ? "Functietitel" : "Job title"} <small>({nl ? "optioneel" : "optional"})</small>
                      </span>
                      <div>
                        <input name="jobTitle" maxLength={100} />
                      </div>
                    </label>
                  </>
                )}
                {mode === "login" && (
                  <div className="login-options">
                    <label>
                      <input name="remember" type="checkbox" defaultChecked />
                      <span>{nl ? "Onthoud mij" : "Remember me"}</span>
                    </label>
                    <Link to="/forgot-password">{nl ? "Wachtwoord vergeten?" : "Forgot password?"}</Link>
                  </div>
                )}
                {error && (
                  <p className="field-error" role="alert">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  className="auth-submit"
                  disabled={submitting}
                  aria-busy={submitting}
                >
                  {submitting ? (
                    nl ? "Even geduld…" : "Please wait…"
                  ) : (
                    <>
                      {mode === "login"
                        ? nl ? "Aanmelden" : "Sign in"
                        : mode === "signup"
                          ? nl ? "Account maken" : "Create account"
                          : nl ? "Herstellink verzenden" : "Send reset link"}
                      <ArrowRight />
                    </>
                  )}
                </Button>
              </form>
              {mode === "login" && (
                <>
                  <div className="auth-divider">
                    <span>{nl ? "of" : "or"}</span>
                  </div>
                  <button
                    type="button"
                    className="google-login"
                    onClick={useGoogle}
                    disabled={submitting}
                  >
                    <svg className="google-logo" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z"/>
                      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.37l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"/>
                      <path fill="#FBBC05" d="M6.39 13.92A6.02 6.02 0 0 1 6.08 12c0-.67.11-1.32.31-1.92V7.46H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.54l3.35-2.62Z"/>
                      <path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.46l3.35 2.62C7.18 7.71 9.39 5.95 12 5.95Z"/>
                    </svg>
                    {nl ? "Doorgaan met Google" : "Continue with Google"}
                  </button>
                </>
              )}
              <div className="auth-links">
                {mode === "login" ? (
                  <span>
                    {nl ? "Nog geen account?" : "No account yet?"} <Link to="/signup">{nl ? "Registreren" : "Sign up"}</Link>
                  </span>
                ) : (
                  <Link to="/login">{nl ? "Terug naar aanmelden" : "Back to sign in"}</Link>
                )}
              </div>
              {mode === "login" && <IctSupportDialog language={app.language} />}
              {mode === "login" && (
                <footer className="login-footer">
                  <nav className="login-public-links" aria-label={nl ? "Juridische en ondersteuningslinks" : "Legal and support links"}>
                    <Link to="/terms">{nl ? "Algemene voorwaarden" : "Terms & Conditions"}</Link>
                    <Link to="/privacy">{nl ? "Privacyverklaring" : "Privacy Notice"}</Link>
                    <Link to="/support">{nl ? "ICT-ondersteuning" : "ICT Support"}</Link>
                  </nav>
                  <div className="login-footer__credits">
                    <p className="login-copyright">{legalConfig.copyright}</p>
                    <p className="login-developer-credit">{legalConfig.developerCredit}</p>
                  </div>
                </footer>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
