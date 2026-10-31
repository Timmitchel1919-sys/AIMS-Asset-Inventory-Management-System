import { Copy, Key, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card } from "../ui";
import { useApp } from "../../context/AppContext";
import {
  disableMfaFactor,
  finalizeTotpEnrollment,
  getMfaStatus,
  startTotpEnrollment,
  type MfaStatus,
  type TotpEnrollmentStart,
} from "../../auth/mfa";
import { authErrorMessage } from "../../auth/firebaseAuth";
import { logAuthEvent } from "../../services/authEvents";
import {
  generateBackupCodes,
  readBackupCodesState,
  type BackupCodesState,
} from "../../services/mfaBackupCodes";
import { firebaseConfigured } from "../../lib/firebase";

type Phase =
  | "idle"
  | "enrolling"
  | "disabling"
  | "showingBackupCodes";

export function MfaCard() {
  const app = useApp();
  const nl = app.language === "nl";
  const [status, setStatus] = useState<MfaStatus>({
    enrolled: false,
    factors: [],
  });
  const [backup, setBackup] = useState<BackupCodesState>({
    generated: false,
    remaining: 0,
  });
  const [phase, setPhase] = useState<Phase>("idle");
  const [enrollment, setEnrollment] = useState<TotpEnrollmentStart | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [disableFactorUid, setDisableFactorUid] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [plaintextCodes, setPlaintextCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const uid = app.user?.id ?? null;
  const isDemo = app.user?.isDemoUser === true;

  useEffect(() => {
    if (!firebaseConfigured || isDemo) return;
    let cancelled = false;
    try {
      const next = getMfaStatus();
      if (!cancelled) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing React state with Firebase multiFactor() after enrollment phase changes
        setStatus(next);
      }
    } catch {
      // multiFactor() throws before the user is bound; swallow.
    }
    if (uid) {
      void readBackupCodesState(uid).then((value) => {
        if (!cancelled) setBackup(value);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [uid, isDemo, phase]);

  async function beginEnrollment() {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const start = await startTotpEnrollment(
        "AIMS",
        app.user?.email ?? app.user?.name ?? "user",
      );
      setEnrollment(start);
      setPhase("enrolling");
    } catch (reason) {
      setError(
        nl
          ? `MFA kan niet gestart worden: ${authErrorMessage(reason)}`
          : `Could not start MFA setup: ${authErrorMessage(reason)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnrollment() {
    if (!enrollment) return;
    setError("");
    setBusy(true);
    try {
      await finalizeTotpEnrollment(
        enrollment.secret,
        verificationCode,
        nl ? "Authenticator-app" : "Authenticator app",
      );
      void logAuthEvent(uid, "mfaEnabled");
      setEnrollment(null);
      setVerificationCode("");
      setPhase("idle");
      setStatus(getMfaStatus());
      setNotice(
        nl
          ? "MFA ingeschakeld. Genereer herstelcodes voor noodgevallen."
          : "MFA enabled. Generate backup codes for emergencies.",
      );
    } catch (reason) {
      setError(authErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  function startDisable(factorUid: string) {
    setDisableFactorUid(factorUid);
    setPassword("");
    setError("");
    setPhase("disabling");
  }

  async function confirmDisable() {
    if (!disableFactorUid) return;
    setError("");
    setBusy(true);
    try {
      await disableMfaFactor(disableFactorUid, password);
      void logAuthEvent(uid, "mfaDisabled");
      setDisableFactorUid(null);
      setPassword("");
      setPhase("idle");
      setStatus(getMfaStatus());
      setNotice(nl ? "MFA uitgeschakeld." : "MFA disabled.");
    } catch (reason) {
      setError(authErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function regenerateBackupCodes() {
    if (!uid) return;
    setError("");
    setBusy(true);
    try {
      const codes = await generateBackupCodes(uid);
      setPlaintextCodes(codes);
      setPhase("showingBackupCodes");
      setBackup({
        generated: true,
        remaining: codes.length,
        generatedAt: new Date().toISOString(),
      });
    } catch (reason) {
      setError(authErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  function copyCodes() {
    void navigator.clipboard?.writeText(plaintextCodes.join("\n")).catch(() => {
      /* clipboard not available */
    });
  }

  if (isDemo) {
    return (
      <Card>
        <ShieldCheck />
        <h2>{nl ? "Tweestapsverificatie" : "Multi-factor authentication"}</h2>
        <p>
          {nl
            ? "MFA is niet beschikbaar in de demosessie. Meld u aan met een echt account om een authenticator te koppelen."
            : "MFA is not available in the demo session. Sign in with a real account to pair an authenticator."}
        </p>
      </Card>
    );
  }

  if (!firebaseConfigured) {
    return (
      <Card>
        <ShieldCheck />
        <h2>{nl ? "Tweestapsverificatie" : "Multi-factor authentication"}</h2>
        <p>
          {nl
            ? "MFA vereist een geconfigureerde Firebase-authenticatie."
            : "MFA requires a configured Firebase authentication backend."}
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <ShieldCheck />
      <h2>{nl ? "Tweestapsverificatie" : "Multi-factor authentication"}</h2>
      <p>
        {nl ? "Status" : "Status"}:{" "}
        <strong>
          {status.enrolled
            ? nl
              ? "Ingeschakeld"
              : "Enabled"
            : nl
              ? "Uitgeschakeld"
              : "Disabled"}
        </strong>
      </p>

      {status.enrolled && (
        <ul className="account-mfa-factors">
          {status.factors.map((factor) => (
            <li key={factor.uid}>
              <Smartphone />
              <strong>{factor.displayName}</strong>
              <Button
                variant="secondary"
                onClick={() => startDisable(factor.uid)}
              >
                <ShieldOff />
                {nl ? "Uitschakelen" : "Disable"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {phase === "idle" && !status.enrolled && (
        <Button onClick={beginEnrollment} disabled={busy}>
          <ShieldCheck />
          {nl ? "MFA inschakelen" : "Enable MFA"}
        </Button>
      )}

      {phase === "enrolling" && enrollment && (
        <div className="account-mfa-enroll workflow-form">
          <p>
            {nl
              ? "Scan de QR-code in uw authenticator-app (Google Authenticator, 1Password, Authy, …) en voer de 6-cijferige code in."
              : "Scan the QR code in your authenticator app (Google Authenticator, 1Password, Authy, …) and enter the 6-digit code."}
          </p>
          <p className="account-mfa-qr">
            <img
              alt={nl ? "QR-code voor MFA" : "MFA QR code"}
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(enrollment.qrCodeUrl)}`}
            />
          </p>
          <p className="field-help">
            {nl ? "Of voer de geheime sleutel handmatig in" : "Or enter the secret manually"}:{" "}
            <code>{enrollment.secretKey}</code>
          </p>
          <label>
            {nl ? "Verificatiecode" : "Verification code"}
            <input
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value)}
            />
          </label>
          <div className="account-mfa-actions">
            <Button onClick={confirmEnrollment} disabled={busy || verificationCode.length !== 6}>
              {nl ? "Bevestigen" : "Confirm"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setEnrollment(null);
                setPhase("idle");
                setVerificationCode("");
              }}
            >
              {nl ? "Annuleren" : "Cancel"}
            </Button>
          </div>
        </div>
      )}

      {phase === "disabling" && (
        <div className="workflow-form">
          <p>
            {nl
              ? "Bevestig uw huidige wachtwoord om MFA uit te schakelen."
              : "Confirm your current password to disable MFA."}
          </p>
          <label>
            {nl ? "Huidig wachtwoord" : "Current password"}
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <div className="account-mfa-actions">
            <Button onClick={confirmDisable} disabled={busy || !password}>
              <ShieldOff />
              {nl ? "MFA uitschakelen" : "Disable MFA"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setDisableFactorUid(null);
                setPhase("idle");
              }}
            >
              {nl ? "Annuleren" : "Cancel"}
            </Button>
          </div>
        </div>
      )}

      {/* Backup codes block */}
      <div className="account-mfa-backup">
        <h3>
          <Key />
          {nl ? "Herstelcodes" : "Backup codes"}
        </h3>
        {backup.generated && phase !== "showingBackupCodes" && (
          <p className="field-help">
            {nl
              ? `${backup.remaining} herstelcode(s) nog geldig.`
              : `${backup.remaining} backup code(s) still valid.`}
          </p>
        )}
        {!backup.generated && phase !== "showingBackupCodes" && (
          <p className="field-help">
            {nl
              ? "Geen herstelcodes aanwezig."
              : "No backup codes on file."}
          </p>
        )}
        {phase === "showingBackupCodes" && (
          <>
            <p className="notice warning">
              {nl
                ? "Bewaar deze codes nu. Ze worden eenmalig getoond."
                : "Save these codes now. They are shown only once."}
            </p>
            <ul className="account-mfa-codes">
              {plaintextCodes.map((code) => (
                <li key={code}>
                  <code>{code}</code>
                </li>
              ))}
            </ul>
            <div className="account-mfa-actions">
              <Button variant="secondary" onClick={copyCodes}>
                <Copy />
                {nl ? "Kopiëren" : "Copy"}
              </Button>
              <Button
                onClick={() => {
                  setPhase("idle");
                  setPlaintextCodes([]);
                }}
              >
                {nl ? "Klaar" : "Done"}
              </Button>
            </div>
          </>
        )}
        {phase !== "showingBackupCodes" && (
          <Button variant="secondary" onClick={regenerateBackupCodes} disabled={busy}>
            <Key />
            {backup.generated
              ? nl
                ? "Codes vervangen"
                : "Regenerate codes"
              : nl
                ? "Codes genereren"
                : "Generate codes"}
          </Button>
        )}
        {backup.generated && (
          <p className="field-help">
            {nl
              ? "Nieuwe codes maken alle oude codes ongeldig."
              : "Generating new codes invalidates all previous codes."}
          </p>
        )}
      </div>

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
    </Card>
  );
}
