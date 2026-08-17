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
  School,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Field, SelectField } from "../components/ui";
import { MutationFeedback, PageHeader } from "../components/WorkflowUi";
import { LegalPrivacySettings } from "../components/legal/LegalPrivacySettings";
import { AppDeviceSettings } from "../components/settings/AppDeviceSettings";
import { MasterDataSettings } from "../components/settings/MasterDataSettings";
import { useApp } from "../context/AppContext";
import type { ThemeId } from "../domain/types";
import { useRepository } from "../data/repositoryContext";

const themes: [ThemeId, string, string][] = [
  [
    "aimsAzureGlass",
    "AIMS Azure Glass",
    "The official blue enterprise workspace",
  ],
  [
    "aimsEmeraldGloss",
    "Emerald Gloss",
    "An enterprise-grade emerald theme with a polished, glossy finish for clarity and confident action.",
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
  ["integrations", Link2],
  ["legal", Scale],
] as const;
type Tab = (typeof tabs)[number][0];
export const settingsPath = (tab: Tab) => `/settings/${tab === "masterData" ? "location-code-groups" : tab}`;
export const tabFromPath = (pathname: string): Tab => {
  const segment = pathname.split("/").filter(Boolean).at(-1);
  if (segment === "location-code-groups" || segment === "master-data" || segment === "location-types") return "masterData";
  return tabs.some(([id]) => id === segment) ? segment as Tab : "general";
};

export default function Settings() {
  const app = useApp(),
    nl = app.language === "nl",
    repository = useRepository(),
    location = useLocation(),
    navigate = useNavigate();
  const [tab, setTabState] = useState<Tab>(() => tabFromPath(location.pathname));
  const [feedback, setFeedback] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });
  const labels: Record<Tab, [string, string]> = {
    masterData: [
      nl ? "Locaties & codes" : "Location & Codes",
      nl
        ? "Beheer locaties en codegroepen."
        : "Manage locations and code groups.",
    ],
    app: [
      nl ? "App en apparaat" : "App & Device",
      "Installation, version, and device information.",
    ],
    general: [
      nl ? "Algemeen" : "General",
      "School identity and official contact fields.",
    ],
    language: [nl ? "Taal" : "Language", "Choose the application language."],
    appearance: [nl ? "Thema’s" : "Themes", "Choose the visual theme."],
    inventory: [nl ? "Voorraad" : "Inventory", "Inventory rules and defaults."],
    audits: [
      nl ? "Controles" : "Audits",
      "Selection and verification defaults.",
    ],
    notifications: [
      nl ? "Meldingen" : "Notifications",
      "Channels and operational thresholds.",
    ],
    security: [nl ? "Beveiliging" : "Security", "Session and approval policy."],
    backup: [
      nl ? "Back-upstatus" : "Backup status",
      "Backup connection status.",
    ],
    integrations: [
      nl ? "Integraties" : "Integrations",
      "External service connections.",
    ],
    legal: [
      nl ? "Juridisch en privacy" : "Legal & Privacy",
      "Published policies, privacy contacts, and version information.",
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
    setFeedback({ status: "loading", message: "Saving settings…" });
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
        <nav className="settings-nav" aria-label="Settings sections">
          {tabs.filter(([id])=>!['language','appearance'].includes(id)).map(([id, Icon]) => (
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
                  {app.theme === id && <em>Active</em>}
                </button>
              ))}
            </div>
          ) : (
            <form className="workflow-form" onSubmit={save}>
              {tab === "general" && (
                <>
                  <Field
                    name="schoolName"
                    label="School name"
                    defaultValue="St. Kangoeroe Community School"
                  />
                  <Field name="logo" type="file" label="School logo" />
                  <Field
                    name="address"
                    className="wide"
                    label="Address"
                    defaultValue="Edmundstraat 3–5, Uitvlucht, Paramaribo, Suriname"
                  />
                  <Field
                    name="telephone"
                    label="Telephone"
                    defaultValue="+597 430870"
                  />
                  <Field
                    name="email"
                    type="email"
                    label="Email"
                    defaultValue="administratie@kangoeroeschool.com"
                  />
                </>
              )}
              {tab === "language" && (
                <SelectField
                  name="language"
                  label="Language"
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
                    label="Default minimum stock"
                    defaultValue="5"
                  />
                  <label className="switch-row">
                    <span>Confirm high-risk actions</span>
                    <input name="confirmRisk" type="checkbox" defaultChecked />
                  </label>
                </div>
              )}
              {tab === "audits" && (
                <Field
                  name="defaultCount"
                  type="number"
                  min="1"
                  label="Default sample"
                  defaultValue="25"
                />
              )}
              {tab === "notifications" &&
                ["Overdue returns", "Low stock", "Maintenance", "Audits"].map(
                  (value) => (
                    <label className="switch-row" key={value}>
                      <span>{value}</span>
                      <input name={value} type="checkbox" defaultChecked />
                    </label>
                  ),
                )}
              {tab === "security" && (
                <Field
                  name="sessionMinutes"
                  type="number"
                  min="5"
                  label="Session duration (minutes)"
                  defaultValue="60"
                />
              )}
              {tab === "backup" && (
                <div className="state wide">
                  <CloudOff />
                  <h3>Backups not enabled</h3>
                  <p>No durable backup connection exists.</p>
                </div>
              )}
              {tab === "integrations" &&
                ["Firebase", "Email provider", "Document export service"].map(
                  (value) => (
                    <div className="switch-row wide" key={value}>
                      <span>{value}</span>
                      <b>Not connected</b>
                    </div>
                  ),
                )}
              <div className="wide">
                <MutationFeedback {...feedback} />
                {!["backup", "integrations"].includes(tab) && (
                  <Button type="submit">
                    <Save />
                    Save settings
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
