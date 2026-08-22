import {
  Bell,
  Camera,
  Languages,
  MonitorCog,
  Palette,
  Save,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Button, Card, SelectField } from "../components/ui";
import { AccountBackButton, PageHeader } from "../components/WorkflowUi";
import { authErrorMessage, updateSelfProfile } from "../auth/firebaseAuth";
import { useApp } from "../context/AppContext";
import type { ThemeId } from "../domain/types";

const themes: [ThemeId, string][] = [
  ["aimsAzureGlass", "AIMS Azure Glass"],
  ["aimsEmeraldGloss", "Emerald Gloss"],
];
export function ProfilePage() {
  const app = useApp(),
    nl = app.language === "nl",
    user = app.user,
    isDemo = user?.isDemoUser === true,
    fileRef = useRef<HTMLInputElement>(null),
    [editing, setEditing] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(timer);
  }, [message]);
  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/") || file.size > 2_000_000) {
      setError(nl ? "Kies een JPG-, PNG- of WebP-afbeelding kleiner dan 2 MB." : "Choose a JPG, PNG, or WebP image smaller than 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string")
        app.updateProfilePhoto(reader.result);
    };
    reader.readAsDataURL(file);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget),
      values = {
        fullName: String(data.get("fullName") || "").trim(),
        department: String(data.get("department") || ""),
        jobTitle: String(data.get("jobTitle") || ""),
      };
    if (!values.fullName) {
      setError(nl ? "Volledige naam is verplicht." : "Full name is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await updateSelfProfile(values);
      await app.refreshUser();
      setMessage(nl ? "Profiel bijgewerkt." : "Profile updated.");
    } catch (reason) {
      setError(authErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page profile-page">
      <AccountBackButton />
      <PageHeader
        title={nl ? "Mijn profiel" : "My Profile"}
        description={nl ? "Uw persoonlijke AIMS-accountgegevens." : "Your personal AIMS account information."}
      />
      <Card className="profile-card">
        <div className="profile-photo-area">
          {user?.profilePhoto ? (
            <img src={user.profilePhoto} alt={nl ? `Profiel van ${user.name}` : `${user.name} profile`} />
          ) : (
            <span>{user?.initials}</span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={selectPhoto}
          />
          <div className="profile-photo-buttons">
            <button
              className="btn secondary"
              type="button"
              onClick={() => fileRef.current?.click()}
            >
              <Camera />
              {nl ? "Foto kiezen" : "Choose photo"}
            </button>
            {user?.profilePhoto && (
              <button
                className="btn secondary"
                type="button"
                onClick={() => app.removeProfilePhoto()}
              >
                <Trash2 />
                {nl ? "Foto verwijderen" : "Remove photo"}
              </button>
            )}
          </div>
          <small>{nl ? "Op dit apparaat opgeslagen." : "Stored on this device."}</small>
        </div>
        <form className="profile-details" onSubmit={save} aria-busy={busy}>
          {editing && !isDemo ? (
            <>
              <label>
                <small>{nl ? "Volledige naam" : "Full name"}</small>
                <input
                  name="fullName"
                  defaultValue={user?.name}
                  maxLength={100}
                  required
                />
              </label>
              <label>
                <small>{nl ? "Afdeling" : "Department"}</small>
                <input name="department" defaultValue={user?.department} />
              </label>
              <label>
                <small>{nl ? "Functietitel" : "Job title"}</small>
                <input name="jobTitle" defaultValue={user?.jobTitle} />
              </label>
            </>
          ) : isDemo ? (
            <>
              <div><small>{nl ? "Naam" : "Name"}</small><strong>{nl ? "Demogebruiker" : "Demo User"}</strong></div>
              <div><small>{nl ? "Accounttype" : "Account type"}</small><strong>{nl ? "Demogebruiker" : "Demo User"}</strong></div>
              <div><small>{nl ? "Authenticatie" : "Authentication"}</small><strong>{nl ? "Anoniem" : "Anonymous"}</strong></div>
              <p className="notice">{nl ? "Dit is een tijdelijke demosessie." : "This is a temporary demo session."}</p>
            </>
          ) : (
            <>
              <div>
                <small>{nl ? "Volledige naam" : "Full name"}</small>
                <strong>{user?.name}</strong>
              </div>
              <div>
                <small>{nl ? "E-mailadres" : "Email address"}</small>
                <strong>{user?.email}</strong>
              </div>
              <div>
                <small>{nl ? "Afdeling" : "Department"}</small>
                <strong>{user?.department || (nl ? "Niet opgegeven" : "Not provided")}</strong>
              </div>
              <div>
                <small>{nl ? "Functietitel" : "Job title"}</small>
                <strong>{user?.jobTitle || (nl ? "Niet opgegeven" : "Not provided")}</strong>
              </div>
              <div>
                <small>{nl ? "Account aangemaakt" : "Account created"}</small>
                <strong>
                  {user?.accountCreatedAt
                  ? new Date(user.accountCreatedAt).toLocaleDateString(nl ? "nl-NL" : "en-US")
                    : nl ? "Niet beschikbaar" : "Not available"}
                </strong>
              </div>
              <div>
                <small>{nl ? "E-mailverificatie" : "Email verification"}</small>
                <strong className="profile-active">
                  {app.emailVerified ? (nl ? "Geverifieerd" : "Verified") : (nl ? "Niet geverifieerd" : "Not verified")}
                </strong>
              </div>
            </>
          )}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          {message && <p className="notice success">{message}</p>}
          {!isDemo && <div className="actions">
            {editing ? (
              <>
                <Button disabled={busy}>
                  <Save />
                  {nl ? "Profiel opslaan" : "Save profile"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setEditing(false)}
                >
                  {nl ? "Annuleren" : "Cancel"}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                onClick={() => {
                  setError("");
                  setMessage("");
                  setEditing(true);
                }}
              >
                <UserRound />
                {nl ? "Profiel bewerken" : "Edit profile"}
              </Button>
            )}
          </div>}
        </form>
      </Card>
    </div>
  );
}

export function PreferencesPage() {
  const app = useApp(),
    nl = app.language === "nl",
    [message, setMessage] = useState("");
  async function save(next: Parameters<typeof app.updatePreferences>[0]) {
    await app.updatePreferences(next);
    setMessage((next.language ?? app.language) === "nl" ? "Voorkeuren opgeslagen." : "Preferences saved.");
  }
  return (
    <div className="page">
      <AccountBackButton />
      <PageHeader
        title={nl ? "Voorkeuren" : "Preferences"}
        description={nl ? "Keuzes die alleen voor uw AIMS-account gelden." : "Choices that apply only to your AIMS account."}
      />
      {message && (
        <p className="notice success" role="status">
          {message}
        </p>
      )}
      <div className="account-settings-grid">
        <Card>
          <Palette />
          <h2>{nl ? "Thema's" : "Themes"}</h2>
          <div className="theme-grid">
            {themes.map(([id, name]) => (
              <button
                key={id}
                className={`theme-choice theme-${id} ${app.theme === id ? "selected" : ""}`}
                onClick={async () => {
                  app.setTheme(id);
                  await save({ theme: id });
                }}
              >
                <i>
                  <span />
                  <span />
                  <span />
                </i>
                <b>{name}</b>
                {app.theme === id && <em>{nl ? "Actief" : "Active"}</em>}
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <Languages />
          <h2>{nl ? "Taal" : "Language"}</h2>
          <SelectField
            label={nl ? "Taal" : "Language"}
            value={app.language}
            onChange={async (event) => {
              const language = event.target.value as "en" | "nl";
              app.setLanguage(language);
              await save({ language });
            }}
          >
            <option value="en">{nl ? "Engels" : "English"}</option>
            <option value="nl">Nederlands</option>
          </SelectField>
        </Card>
        <Card>
          <MonitorCog />
          <h2>{nl ? "Datum en tijd" : "Date & time"}</h2>
          <SelectField
            label={nl ? "Datumnotatie" : "Date format"}
            value={app.preferences.dateFormat}
            onChange={(event) =>
              save({
                dateFormat: event.target.value as
                  "DD-MM-YYYY" | "MM-DD-YYYY" | "YYYY-MM-DD",
              })
            }
          >
            <option>DD-MM-YYYY</option>
            <option>MM-DD-YYYY</option>
            <option>YYYY-MM-DD</option>
          </SelectField>
          <SelectField
            label={nl ? "Tijdnotatie" : "Time format"}
            value={app.preferences.timeFormat}
            onChange={(event) =>
              save({ timeFormat: event.target.value as "24-hour" | "12-hour" })
            }
          >
            <option>24-hour</option>
            <option>12-hour</option>
          </SelectField>
        </Card>
        <Card>
          <Bell />
          <h2>{nl ? "Persoonlijke meldingen" : "Personal notifications"}</h2>
          {[
            ["maintenance", nl ? "Onderhoudsherinneringen" : "Maintenance reminders"],
            ["borrowing", nl ? "Uitleenherinneringen" : "Borrowing reminders"],
            ["assignments", nl ? "Toewijzingsmeldingen" : "Assignment notifications"],
            ["system", nl ? "Systeemmeldingen" : "System notifications"],
            ["email", nl ? "E-mailmeldingen" : "Email notifications"],
          ].map(([id, label]) => (
            <label className="switch-row" key={id}>
              <span>{label}</span>
              <input
                type="checkbox"
                checked={app.preferences.notifications?.[id] ?? false}
                onChange={(event) =>
                  save({ notifications: { [id]: event.target.checked } })
                }
              />
            </label>
          ))}
        </Card>
      </div>
    </div>
  );
}
