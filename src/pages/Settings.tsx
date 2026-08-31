import {
  Bell,
  CloudOff,
  Database,
  Waypoints,
  Globe2,
  Link2,
  LockKeyhole,
  Palette,
  Save,
  Scale,
  Trash2,
  School,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Field, SelectField } from "../components/ui";
import { MutationFeedback, PageHeader } from "../components/WorkflowUi";
import { LegalPrivacySettings } from "../components/legal/LegalPrivacySettings";
import { AppDeviceSettings } from "../components/settings/AppDeviceSettings";
import { GoogleSheetsExport } from "../components/settings/GoogleSheetsExport";
import { MasterDataSettings } from "../components/settings/MasterDataSettings";
import { RecycleBinSettings } from "../components/settings/RecycleBinSettings";
import { useApp } from "../context/AppContext";
import type { ThemeId } from "../domain/types";
import { useRepository } from "../data/repositoryContext";
import {
  firebaseAuth,
  firebaseConfigured,
  firebaseStorage,
  firestore,
  missingFirebaseEnvironmentVariables,
} from "../lib/firebase";

const themes: [ThemeId, string, string][] = [
  [
    "aimsAzureGlass",
    "AIMS Azure Blue",
    "The official blue enterprise workspace",
  ],
  [
    "aimsEmeraldGloss",
    "AIMS Emerald Green",
    "A premium enterprise theme with a deep emerald sidebar, warm ivory surfaces, and restrained gold accents.",
  ],
];
const tabs = [
  ["general", School],
  ["app", CloudOff],
  ["masterData", Waypoints],
  ["language", Globe2],
  ["appearance", Palette],
  ["inventory", Database],
  ["audits", ShieldCheck],
  ["notifications", Bell],
  ["security", LockKeyhole],
  ["backup", CloudOff],
  ["recycleBin", Trash2],
  ["integrations", Link2],
  ["legal", Scale],
] as const;
type Tab = (typeof tabs)[number][0];
export const settingsPath = (tab: Tab) =>
  `/settings/${tab === "masterData" ? "location-code-groups" : tab}`;
export const tabFromPath = (pathname: string): Tab => {
  const segment = pathname.split("/").filter(Boolean).at(-1);
  if (
    segment === "location-code-groups" ||
    segment === "master-data" ||
    segment === "location-types"
  )
    return "masterData";
  return tabs.some(([id]) => id === segment) ? (segment as Tab) : "general";
};

export default function Settings() {
  const app = useApp(),
    nl = app.language === "nl",
    repository = useRepository(),
    location = useLocation(),
    navigate = useNavigate();
  const [tab, setTabState] = useState<Tab>(() =>
    tabFromPath(location.pathname),
  );
  const [feedback, setFeedback] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });
  const firebaseConnected = Boolean(
    firebaseConfigured && firebaseAuth && firestore && firebaseStorage,
  );
  const integrations = [
    {
      name: "Firebase",
      connected: firebaseConnected,
      status: firebaseConnected
        ? nl
          ? "Verbonden"
          : "Connected"
        : nl
          ? "Configuratie ontbreekt"
          : "Configuration missing",
      detail: firebaseConnected
        ? `${import.meta.env.VITE_FIREBASE_PROJECT_ID}${import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true" ? " (emulator)" : ""}`
        : missingFirebaseEnvironmentVariables.join(", "),
    },
    {
      name: nl ? "E-mailprovider" : "Email provider",
      connected: Boolean(firebaseAuth),
      status: firebaseAuth
        ? nl
          ? "Via Firebase Authentication"
          : "Via Firebase Authentication"
        : nl
          ? "Niet beschikbaar"
          : "Unavailable",
      detail: nl
        ? "Voor aanmelden, verificatie en wachtwoordherstel."
        : "Used for sign-in, verification and password recovery.",
    },
    {
      name: nl ? "Documentexport" : "Document export",
      connected: true,
      status: nl ? "Ingebouwd in AIMS" : "Built into AIMS",
      detail: nl
        ? "Excel-, CSV-, JSON- en rapportdownloads vereisen geen externe verbinding."
        : "Excel, CSV, JSON and report downloads require no external connection.",
    },
  ];
  const labels: Record<Tab, [string, string]> = {
    masterData: [
      nl ? "Locaties & codes" : "Location & Codes",
      nl
        ? "Beheer locaties en codegroepen."
        : "Manage locations and code groups.",
    ],
    app: [
      nl ? "App en apparaat" : "App & Device",
      nl
        ? "Installatie-, versie- en apparaatinformatie."
        : "Installation, version, and device information.",
    ],
    general: [
      nl ? "Algemeen" : "General",
      nl
        ? "Schoolidentiteit en officiële contactgegevens."
        : "School identity and official contact fields.",
    ],
    language: [
      nl ? "Taal" : "Language",
      nl ? "Kies de taal van de applicatie." : "Choose the application language.",
    ],
    appearance: [
      nl ? "Thema’s" : "Themes",
      nl ? "Kies het visuele thema." : "Choose the visual theme.",
    ],
    inventory: [
      nl ? "Voorraad" : "Inventory",
      nl ? "Voorraadregels en standaardwaarden." : "Inventory rules and defaults.",
    ],
    audits: [
      nl ? "Controles" : "Audits",
      nl
        ? "Standaardwaarden voor selectie en verificatie."
        : "Selection and verification defaults.",
    ],
    notifications: [
      nl ? "Meldingen" : "Notifications",
      nl
        ? "Kanalen en operationele drempelwaarden."
        : "Channels and operational thresholds.",
    ],
    security: [
      nl ? "Beveiliging" : "Security",
      nl ? "Sessie- en goedkeuringsbeleid." : "Session and approval policy.",
    ],
    backup: [
      nl ? "Back-upstatus" : "Backup status",
      nl ? "Status van de back-upverbinding." : "Backup connection status.",
    ],
    recycleBin: [
      nl ? "Prullenbak" : "Recycle bin",
      nl
        ? "Herstel of verwijder veilig gearchiveerde gegevens."
        : "Restore or safely purge archived records.",
    ],
    integrations: [
      nl ? "Integraties" : "Integrations",
      nl ? "Verbindingen met externe diensten." : "External service connections.",
    ],
    legal: [
      nl ? "Juridisch en privacy" : "Legal & Privacy",
      nl
        ? "Gepubliceerd beleid, privacycontacten en versie-informatie."
        : "Published policies, privacy contacts, and version information.",
    ],
  };
  useEffect(() => {
    const task = window.setTimeout(
      () => setTabState(tabFromPath(location.pathname)),
      0,
    );
    return () => window.clearTimeout(task);
  }, [location.pathname]);
  const setTab = (value: Tab) => {
    setTabState(value);
    setFeedback({ status: "idle", message: "" });
    navigate(settingsPath(value), { replace: true });
  };
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback({
      status: "loading",
      message: nl ? "Instellingen opslaan…" : "Saving settings…",
    });
    localStorage.setItem(
      `kcs-settings-${tab}`,
      JSON.stringify(
        Object.fromEntries(new FormData(event.currentTarget).entries()),
      ),
    );
    const result = await repository.execute({
      action: "settings.appearance",
      values: { tab },
    });
    setFeedback({
      status: result.ok ? "success" : "error",
      message: result.message,
    });
  }
  return (
    <div className="page">
      <PageHeader
        title={nl ? "Instellingen" : "Settings"}
        description={
          nl
            ? "Beheer identiteit, beleid, taal en voorkeuren."
            : "Manage AIMS operational and system configuration."
        }
      />
      <div className="settings-layout">
        <nav
          className="settings-nav"
          aria-label={nl ? "Instellingensecties" : "Settings sections"}
        >
          {tabs
            .filter(([id]) => !["language", "appearance"].includes(id))
            .map(([id, Icon]) => (
              <button
                type="button"
                key={id}
                className={tab === id ? "active" : ""}
                onClick={() => setTab(id)}
              >
                <Icon />
                {labels[id][0]}
              </button>
            ))}
        </nav>
        <section className="card">
          <h2>{labels[tab][0]}</h2>
          <p className="section-copy">{labels[tab][1]}</p>
          {tab === "masterData" ? (
            <MasterDataSettings />
          ) : tab === "app" ? (
            <AppDeviceSettings />
          ) : tab === "legal" ? (
            <LegalPrivacySettings />
          ) : tab === "recycleBin" ? (
            <RecycleBinSettings />
          ) : tab === "appearance" ? (
            <div className="theme-grid">
              {themes.map(([id, name, description]) => (
                <button
                  key={id}
                  onClick={async () => {
                    app.setTheme(id);
                    await app.updatePreferences({ theme: id });
                  }}
                  className={`theme-choice theme-${id} ${app.theme === id ? "selected" : ""}`}
                >
                  <i>
                    <span />
                    <span />
                    <span />
                  </i>
                  <b>{name}</b>
                  <small>{description}</small>
                  {app.theme === id && <em>{nl ? "Actief" : "Active"}</em>}
                </button>
              ))}
            </div>
          ) : (
            <form className="workflow-form" onSubmit={save}>
              {tab === "general" && (
                <>
                  <Field
                    name="schoolName"
                    label={nl ? "Schoolnaam" : "School name"}
                    defaultValue="St. Kangoeroe Community School"
                  />
                  <Field
                    name="logo"
                    type="file"
                    label={nl ? "Schoollogo" : "School logo"}
                  />
                  <Field
                    name="address"
                    className="wide"
                    label={nl ? "Adres" : "Address"}
                    defaultValue="Edmundstraat 3–5, Uitvlucht, Paramaribo, Suriname"
                  />
                  <Field
                    name="telephone"
                    label={nl ? "Telefoon" : "Telephone"}
                    defaultValue="+597 430870"
                  />
                  <Field
                    name="email"
                    type="email"
                    label={nl ? "E-mail" : "Email"}
                    defaultValue="administratie@kangoeroeschool.com"
                  />
                </>
              )}
              {tab === "language" && (
                <SelectField
                  name="language"
                  label={nl ? "Taal" : "Language"}
                  value={app.language}
                  onChange={async (event) => {
                    const next = event.target.value as "en" | "nl";
                    app.setLanguage(next);
                    await app.updatePreferences({ language: next });
                  }}
                >
                  <option value="en">English</option>
                  <option value="nl">Nederlands</option>
                </SelectField>
              )}
              {tab === "inventory" && (
                <div className="inventory-settings-row wide">
                  <Field
                    name="defaultMinimum"
                    type="number"
                    min="0"
                    label={
                      nl ? "Standaard minimumvoorraad" : "Default minimum stock"
                    }
                    defaultValue="5"
                  />
                  <label className="switch-row">
                    <span>
                      {nl
                        ? "Bevestig acties met hoog risico"
                        : "Confirm high-risk actions"}
                    </span>
                    <input name="confirmRisk" type="checkbox" defaultChecked />
                  </label>
                </div>
              )}
              {tab === "audits" && (
                <Field
                  name="defaultCount"
                  type="number"
                  min="1"
                  label={nl ? "Standaardsteekproef" : "Default sample"}
                  defaultValue="25"
                />
              )}
              {tab === "notifications" &&
                (
                  [
                    ["Overdue returns", nl ? "Achterstallige retouren" : "Overdue returns"],
                    ["Low stock", nl ? "Lage voorraad" : "Low stock"],
                    ["Maintenance", nl ? "Onderhoud" : "Maintenance"],
                    ["Audits", nl ? "Controles" : "Audits"],
                  ] as const
                ).map(([value, label]) => (
                  <label className="switch-row" key={value}>
                    <span>{label}</span>
                    <input name={value} type="checkbox" defaultChecked />
                  </label>
                ))}
              {tab === "security" && (
                <Field
                  name="sessionMinutes"
                  type="number"
                  min="5"
                  label={
                    nl ? "Sessieduur (minuten)" : "Session duration (minutes)"
                  }
                  defaultValue="60"
                />
              )}
              {tab === "backup" && (
                <div className="state wide">
                  <CloudOff />
                  <h3>
                    {nl
                      ? "Automatische back-up niet ingeschakeld"
                      : "Automatic backup not enabled"}
                  </h3>
                  <p>
                    {nl
                      ? "Deze status gaat over een geplande, externe back-up van alle Firebase-data. De verplichte JSON-backup vóór een Excel-import is een afzonderlijke lokale herstelkopie en blijft beschikbaar op het importscherm."
                      : "This status concerns a scheduled external backup of all Firebase data. The mandatory JSON backup before an Excel import is a separate local recovery copy available on the import screen."}
                  </p>
                </div>
              )}
              {tab === "integrations" && (
                <>
                  {integrations.map((integration) => (
                    <div
                      className="switch-row wide integration-status-row"
                      key={integration.name}
                    >
                      <span>
                        <strong>{integration.name}</strong>
                        <small>{integration.detail}</small>
                      </span>
                      <b
                        className={
                          integration.connected
                            ? "integration-connected"
                            : "integration-disconnected"
                        }
                      >
                        {integration.status}
                      </b>
                    </div>
                  ))}
                  <GoogleSheetsExport />
                </>
              )}
              <div className="wide">
                <MutationFeedback {...feedback} />
                {!["backup", "integrations"].includes(tab) && (
                  <Button type="submit">
                    <Save />
                    {nl ? "Instellingen opslaan" : "Save settings"}
                  </Button>
                )}
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
