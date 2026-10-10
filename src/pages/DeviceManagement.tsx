import { Info, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DevicePicker } from "../components/DevicePicker";
import { Badge, Button, Field, Loader, SelectField, State, TextAreaField } from "../components/ui";
import { Dialog, PageHeader } from "../components/WorkflowUi";
import { useApp } from "../context/AppContext";
import {
  assignPolicy,
  cancelCommand,
  deletePolicy,
  enrollDevices,
  queueCommands,
  savePolicy,
  unenrollDevice,
  useDeviceManagementData,
  type DeviceActor,
} from "../data/deviceManagementStore";
import { useMockSnapshot } from "../data/repositoryContext";
import { ASSET_CONDITIONS } from "../domain/assetCondition";
import {
  DEVICE_COMMAND_TYPES,
  MAX_BULK_TARGETS,
  SENSITIVE_COMMANDS,
  defaultPolicyRules,
  deviceHealth,
  evaluateCompliance,
  validateCommandRequest,
  type DeviceCommandType,
  type DevicePolicy,
  type HealthLevel,
  type ViolationCode,
} from "../domain/deviceManagement";
import type { Asset, AssetStatus } from "../domain/types";
import { useT } from "../i18n";

type TabId = "overview" | "health" | "compliance" | "policies" | "commands" | "audit";
const TAB_PATHS: Record<TabId, string> = {
  overview: "/device-management",
  health: "/device-monitoring",
  compliance: "/device-compliance",
  policies: "/device-policies",
  commands: "/device-commands",
  audit: "/device-audit",
};
const PATH_TABS: Record<string, TabId> = {
  ...Object.fromEntries(
    (Object.entries(TAB_PATHS) as [TabId, string][]).map(([tab, path]) => [path, tab]),
  ),
  "/device-bulk-actions": "commands",
};
const TABS: TabId[] = ["overview", "health", "compliance", "policies", "commands", "audit"];
const STATUSES: AssetStatus[] = [
  "Available", "Assigned", "Borrowed", "Under Repair", "Under Maintenance",
  "Reserved", "Lost", "Missing", "Damaged", "Disposed", "Archived",
];

const COPY = {
  en: {
    title: "Device Management & Monitoring",
    description:
      "Owner-only console for the managed device register, health, compliance policies and the command log.",
    tabs: { overview: "Overview", health: "Health", compliance: "Compliance", policies: "Policies", commands: "Commands", audit: "Audit" } as Record<TabId, string>,
    ownerOnly: "OWNER ONLY",
    noAgent:
      "No device agent is connected. Health and compliance are calculated from the asset register, and commands are recorded as queued for the audit trail — they are not executed on any device.",
    offlineTitle: "Firebase is not connected",
    offlineText: "Device management stores its data in Firebase and is unavailable in this mode.",
    errorTitle: "Device data could not be loaded",
    managed: "Managed devices", healthy: "Healthy", nonCompliant: "Non-compliant", queued: "Queued commands",
    addDevices: "Add devices", search: "Search managed devices…", selected: "selected",
    assignPolicy: "Assign policy", noPolicy: "No policy", queueCommand: "Queue command", apply: "Apply",
    device: "Device", assignee: "Assigned to", status: "Status", health: "Health", policy: "Policy",
    compliance: "Compliance", actions: "Actions", remove: "Remove",
    compliant: "Compliant", violations: "Violations", assetMissing: "Asset no longer exists",
    emptyTitle: "No managed devices yet", emptyText: "Add assets from the register to start managing them.",
    enrollTitle: "Add devices to the managed register", enrollHint: "Only assets that are not managed yet are listed.",
    cancel: "Cancel", save: "Save", delete: "Delete", edit: "Edit", add: "Add",
    healthLevels: { healthy: "Healthy", attention: "Needs attention", critical: "Critical" } as Record<HealthLevel, string>,
    reasons: {
      "warranty-expired": "Warranty expired", "warranty-expiring": "Warranty expires soon", "poor-condition": "Poor condition",
      "fair-condition": "Fair condition", "maintenance-due": "Maintenance required", "end-of-life": "Past useful life",
      "in-service": "In repair/maintenance", "critical-status": "Lost, missing or damaged",
    } as Record<string, string>,
    violationLabels: {
      "warranty-expired": "Warranty missing or expired", "no-assignee": "No assignee", "too-old": "Older than policy limit",
      "condition-not-allowed": "Condition not allowed", "status-blocked": "Status not allowed",
    } as Record<ViolationCode, string>,
    onlyNonCompliant: "Only non-compliant", onlyAttention: "Only needs attention/critical",
    policyNew: "New policy", policyName: "Policy name", policyDescription: "Description", policyActive: "Policy is active",
    ruleWarranty: "Require a valid warranty", ruleAssignee: "Require an assignee", ruleAge: "Maximum age in years (empty = no limit)",
    ruleConditions: "Allowed conditions (none ticked = any)", ruleStatuses: "Blocked statuses",
    policiesEmpty: "No policies yet", policiesEmptyText: "Create a policy to evaluate compliance of managed devices.",
    devicesUsing: "devices", inactive: "Inactive", confirmDeletePolicy: "Delete this policy? Devices using it will become unassigned.",
    newCommand: "New command", commandType: "Command", reason: "Reason", reasonHint: "Required for lock and wipe (min. 5 characters).",
    commandTypes: { lock: "Lock", restart: "Restart", locate: "Locate", "collect-info": "Collect info", wipe: "Wipe" } as Record<DeviceCommandType, string>,
    commandErrors: { "no-targets": "Select at least one device.", "too-many": `At most ${MAX_BULK_TARGETS} devices per command.`, "reason-required": "A reason of at least 5 characters is required.", "bad-type": "Unknown command." } as Record<string, string>,
    ack: "I understand this only records a request and is not executed on the device.",
    queuedStatus: "Queued", cancelled: "Cancelled", requestedBy: "Requested by", when: "When", cancelCommand: "Cancel",
    commandsEmpty: "No commands recorded", commandsEmptyText: "Queued commands will appear here.",
    auditEmpty: "No audit entries", auditEmptyText: "Every change in this console is recorded here.",
    action: "Action", detail: "Detail", by: "By",
    done: { enrolled: "Devices added.", removed: "Device removed.", policy: "Policy applied.", queuedCmd: "Command(s) queued.", saved: "Policy saved.", deleted: "Policy deleted.", cancelled: "Command cancelled." },
  },
  nl: {
    title: "Apparaatbeheer & Monitoring",
    description:
      "Alleen voor de eigenaar: beheerconsole voor het apparatenregister, gezondheid, compliancebeleid en het opdrachtenlogboek.",
    tabs: { overview: "Overzicht", health: "Gezondheid", compliance: "Compliance", policies: "Beleid", commands: "Opdrachten", audit: "Audit" } as Record<TabId, string>,
    ownerOnly: "ALLEEN EIGENAAR",
    noAgent:
      "Er is geen apparaatagent gekoppeld. Gezondheid en compliance worden berekend uit het assetregister en opdrachten worden als 'in wachtrij' vastgelegd voor de audittrail — ze worden niet op een apparaat uitgevoerd.",
    offlineTitle: "Firebase is niet verbonden",
    offlineText: "Apparaatbeheer bewaart zijn gegevens in Firebase en is in deze modus niet beschikbaar.",
    errorTitle: "Apparaatgegevens konden niet worden geladen",
    managed: "Beheerde apparaten", healthy: "Gezond", nonCompliant: "Niet compliant", queued: "Opdrachten in wachtrij",
    addDevices: "Apparaten toevoegen", search: "Beheerde apparaten zoeken…", selected: "geselecteerd",
    assignPolicy: "Beleid toewijzen", noPolicy: "Geen beleid", queueCommand: "Opdracht in wachtrij", apply: "Toepassen",
    device: "Apparaat", assignee: "Toegewezen aan", status: "Status", health: "Gezondheid", policy: "Beleid",
    compliance: "Compliance", actions: "Acties", remove: "Verwijderen",
    compliant: "Compliant", violations: "Overtredingen", assetMissing: "Asset bestaat niet meer",
    emptyTitle: "Nog geen beheerde apparaten", emptyText: "Voeg assets uit het register toe om ze te beheren.",
    enrollTitle: "Apparaten toevoegen aan het beheerregister", enrollHint: "Alleen assets die nog niet worden beheerd staan in de lijst.",
    cancel: "Annuleren", save: "Opslaan", delete: "Verwijderen", edit: "Bewerken", add: "Toevoegen",
    healthLevels: { healthy: "Gezond", attention: "Aandacht nodig", critical: "Kritiek" } as Record<HealthLevel, string>,
    reasons: {
      "warranty-expired": "Garantie verlopen", "warranty-expiring": "Garantie verloopt binnenkort", "poor-condition": "Slechte staat",
      "fair-condition": "Matige staat", "maintenance-due": "Onderhoud vereist", "end-of-life": "Levensduur verstreken",
      "in-service": "In reparatie/onderhoud", "critical-status": "Verloren, vermist of beschadigd",
    } as Record<string, string>,
    violationLabels: {
      "warranty-expired": "Garantie ontbreekt of verlopen", "no-assignee": "Geen gebruiker toegewezen", "too-old": "Ouder dan beleidslimiet",
      "condition-not-allowed": "Staat niet toegestaan", "status-blocked": "Status niet toegestaan",
    } as Record<ViolationCode, string>,
    onlyNonCompliant: "Alleen niet-compliant", onlyAttention: "Alleen aandacht/kritiek",
    policyNew: "Nieuw beleid", policyName: "Naam beleid", policyDescription: "Omschrijving", policyActive: "Beleid is actief",
    ruleWarranty: "Geldige garantie vereist", ruleAssignee: "Toegewezen gebruiker vereist", ruleAge: "Maximale leeftijd in jaren (leeg = geen limiet)",
    ruleConditions: "Toegestane staten (niets aangevinkt = alle)", ruleStatuses: "Geblokkeerde statussen",
    policiesEmpty: "Nog geen beleid", policiesEmptyText: "Maak beleid aan om de compliance van beheerde apparaten te beoordelen.",
    devicesUsing: "apparaten", inactive: "Inactief", confirmDeletePolicy: "Dit beleid verwijderen? Apparaten die het gebruiken worden losgekoppeld.",
    newCommand: "Nieuwe opdracht", commandType: "Opdracht", reason: "Reden", reasonHint: "Verplicht voor vergrendelen en wissen (min. 5 tekens).",
    commandTypes: { lock: "Vergrendelen", restart: "Herstarten", locate: "Lokaliseren", "collect-info": "Info verzamelen", wipe: "Wissen" } as Record<DeviceCommandType, string>,
    commandErrors: { "no-targets": "Selecteer minstens één apparaat.", "too-many": `Maximaal ${MAX_BULK_TARGETS} apparaten per opdracht.`, "reason-required": "Een reden van minstens 5 tekens is verplicht.", "bad-type": "Onbekende opdracht." } as Record<string, string>,
    ack: "Ik begrijp dat dit alleen een verzoek vastlegt en niet op het apparaat wordt uitgevoerd.",
    queuedStatus: "In wachtrij", cancelled: "Geannuleerd", requestedBy: "Aangevraagd door", when: "Wanneer", cancelCommand: "Annuleren",
    commandsEmpty: "Geen opdrachten vastgelegd", commandsEmptyText: "Opdrachten in de wachtrij verschijnen hier.",
    auditEmpty: "Geen auditregels", auditEmptyText: "Elke wijziging in deze console wordt hier vastgelegd.",
    action: "Actie", detail: "Detail", by: "Door",
    done: { enrolled: "Apparaten toegevoegd.", removed: "Apparaat verwijderd.", policy: "Beleid toegepast.", queuedCmd: "Opdracht(en) in wachtrij gezet.", saved: "Beleid opgeslagen.", deleted: "Beleid verwijderd.", cancelled: "Opdracht geannuleerd." },
  },
} as const;

const fmt = (iso?: string) => (iso ? iso.replace("T", " ").slice(0, 16) : "—");
const healthTone = (level: HealthLevel) =>
  level === "healthy" ? "success" : level === "attention" ? "warning" : "danger";

interface Row {
  assetId: string;
  assetCode: string;
  asset?: Asset;
  policy?: DevicePolicy;
  policyId?: string;
  health?: ReturnType<typeof deviceHealth>;
  compliance?: ReturnType<typeof evaluateCompliance>;
}

export default function DeviceManagement() {
  const app = useApp();
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const snapshot = useMockSnapshot();
  const data = useDeviceManagementData();
  const nl = app.language === "nl";
  const c = nl ? COPY.nl : COPY.en;
  const tab: TabId = PATH_TABS[location.pathname.replace(/\/$/, "")] ?? "overview";
  const actor: DeviceActor = { uid: app.user?.id, name: app.user?.name };

  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [onlyNonCompliant, setOnlyNonCompliant] = useState(false);
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollSelection, setEnrollSelection] = useState<Set<string>>(new Set());
  const [bulkPolicy, setBulkPolicy] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandSelection, setCommandSelection] = useState<Set<string>>(new Set());
  const [commandType, setCommandType] = useState<DeviceCommandType>("locate");
  const [commandReason, setCommandReason] = useState("");
  const [commandAck, setCommandAck] = useState(false);
  const [policyDraft, setPolicyDraft] = useState<(Partial<DevicePolicy> & { ageText: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  // Mobile: tables collapse into cards, so every cell needs its column label.
  useLayoutEffect(() => {
    panelRef.current?.querySelectorAll("table").forEach((table) => {
      const labels = [...table.querySelectorAll("thead th")].map((th) => th.textContent ?? "");
      table.querySelectorAll("tbody tr").forEach((row) =>
        [...row.children].forEach((cell, index) => {
          if (labels[index]) cell.setAttribute("data-label", labels[index]);
        }),
      );
    });
  });

  const run = async (work: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await work();
      setMessage({ kind: "ok", text: success });
      return true;
    } catch (err) {
      const key = err instanceof Error ? err.message : String(err);
      setMessage({ kind: "error", text: c.commandErrors[key] ?? key });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const now = Date.now();
  const assetsById = useMemo(
    () => new Map(snapshot.assets.map((asset) => [asset.id, asset])),
    [snapshot.assets],
  );
  const policiesById = useMemo(
    () => new Map(data.policies.map((policy) => [policy.id, policy])),
    [data.policies],
  );
  const rows: Row[] = useMemo(
    () =>
      data.devices
        .map((device) => {
          const asset = assetsById.get(device.assetId);
          const policy = device.policyId ? policiesById.get(device.policyId) : undefined;
          return {
            assetId: device.assetId,
            assetCode: asset?.code || device.assetCode,
            asset,
            policy,
            policyId: device.policyId,
            health: asset ? deviceHealth(asset, now) : undefined,
            compliance: asset ? evaluateCompliance(asset, policy, now) : undefined,
          };
        })
        .sort((a, b) => a.assetCode.localeCompare(b.assetCode)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.devices, assetsById, policiesById],
  );

  const needle = search.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (onlyNonCompliant && row.compliance?.compliant !== false) return false;
    if (onlyAttention && (!row.health || row.health.level === "healthy")) return false;
    if (!needle) return true;
    return `${row.assetCode} ${row.asset?.name ?? ""} ${row.asset?.assignedTo ?? ""} ${row.asset?.serialNumber ?? ""}`
      .toLowerCase()
      .includes(needle);
  });
  const healthyCount = rows.filter((r) => r.health?.level === "healthy").length;
  const nonCompliantCount = rows.filter((r) => r.compliance?.compliant === false).length;
  const queuedCount = data.commands.filter((cmd) => cmd.status === "queued").length;

  const targetsOf = (ids: Iterable<string>) =>
    [...ids].map((assetId) => ({
      assetId,
      assetCode: rows.find((r) => r.assetId === assetId)?.assetCode ?? assetsById.get(assetId)?.code ?? assetId,
    }));
  const enrolledIds = new Set(data.devices.map((d) => d.assetId));
  const enrollItems = snapshot.assets
    .filter((asset) => !enrolledIds.has(asset.id))
    .map((asset) => ({
      id: asset.id,
      label: `${asset.code} — ${asset.name}`,
      sublabel: [asset.brand, asset.model, asset.serialNumber].filter(Boolean).join(" · "),
    }));
  const commandItems = rows.map((row) => ({
    id: row.assetId,
    label: `${row.assetCode} — ${row.asset?.name ?? c.assetMissing}`,
    sublabel: row.asset?.assignedTo,
  }));

  const toggleRow = (id: string) =>
    setSelection((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_BULK_TARGETS) next.add(id);
      return next;
    });
  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selection.has(r.assetId));
  const toggleAll = () =>
    setSelection(allFilteredSelected ? new Set() : new Set(filtered.slice(0, MAX_BULK_TARGETS).map((r) => r.assetId)));

  const openCommand = () => {
    setCommandSelection(new Set(selection));
    setCommandReason("");
    setCommandAck(false);
    setCommandOpen(true);
  };
  const commandProblem = validateCommandRequest({
    type: commandType,
    reason: commandReason,
    targets: targetsOf(commandSelection),
  });
  const submitCommand = async () => {
    if (commandProblem || !commandAck) return;
    const ok = await run(
      () => queueCommands({ type: commandType, reason: commandReason, targets: targetsOf(commandSelection) }, actor),
      c.done.queuedCmd,
    );
    if (ok) setCommandOpen(false);
  };

  const openPolicy = (policy?: DevicePolicy) =>
    setPolicyDraft(
      policy
        ? { ...policy, ageText: policy.rules.maxAgeYears === null ? "" : String(policy.rules.maxAgeYears) }
        : { name: "", description: "", active: true, rules: { ...defaultPolicyRules }, ageText: "" },
    );
  const submitPolicy = async () => {
    if (!policyDraft?.rules) return;
    const age = policyDraft.ageText.trim() === "" ? null : Number(policyDraft.ageText);
    const ok = await run(
      () =>
        savePolicy(
          {
            id: policyDraft.id,
            name: policyDraft.name ?? "",
            description: policyDraft.description ?? "",
            active: policyDraft.active !== false,
            rules: { ...policyDraft.rules!, maxAgeYears: age !== null && Number.isFinite(age) ? age : null },
          },
          actor,
        ),
      c.done.saved,
    );
    if (ok) setPolicyDraft(null);
  };
  const toggleIn = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  if (!data.connected)
    return (
      <div className="page device-management-page">
        <State type="offline" title={c.offlineTitle} description={c.offlineText} />
      </div>
    );

  const policyUsage = (policyId: string) => rows.filter((r) => r.policyId === policyId).length;

  return (
    <div className="page device-management-page">
      <PageHeader
        title={c.title}
        description={c.description}
        actions={
          <span className="badge badge-danger dm-owner-badge">
            <ShieldAlert size={14} aria-hidden="true" /> {c.ownerOnly}
          </span>
        }
      />
      <p className="dm-notice" role="note">
        <Info size={16} aria-hidden="true" /> {c.noAgent}
      </p>
      {message && (
        <p className={`dm-message dm-message--${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}
      <div className="asset-tabs" role="tablist" aria-label={c.title}>
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "active" : ""}
            onClick={() => navigate(TAB_PATHS[key])}
          >
            {c.tabs[key]}
          </button>
        ))}
      </div>

      {data.error ? (
        <State type="error" title={c.errorTitle} description={data.error} />
      ) : data.loading ? (
        <Loader />
      ) : (
        <section className="card dm-panel" role="tabpanel" ref={panelRef}>
          {tab === "overview" && (
            <>
              <div className="dm-kpis">
                <div className="dm-kpi"><span>{c.managed}</span><strong>{rows.length}</strong></div>
                <div className="dm-kpi"><span>{c.healthy}</span><strong>{rows.length ? Math.round((healthyCount / rows.length) * 100) : 0}%</strong></div>
                <div className="dm-kpi"><span>{c.nonCompliant}</span><strong>{nonCompliantCount}</strong></div>
                <div className="dm-kpi"><span>{c.queued}</span><strong>{queuedCount}</strong></div>
              </div>
              <div className="dm-toolbar">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={c.search}
                  aria-label={c.search}
                />
                <Button type="button" onClick={() => { setEnrollSelection(new Set()); setEnrollOpen(true); }}>
                  <Plus size={16} /> {c.addDevices}
                </Button>
              </div>
              {selection.size > 0 && (
                <div className="dm-bulkbar" role="region" aria-label={c.actions}>
                  <strong>{selection.size} {c.selected}</strong>
                  <select value={bulkPolicy} onChange={(e) => setBulkPolicy(e.target.value)} aria-label={c.assignPolicy}>
                    <option value="">{c.noPolicy}</option>
                    {data.policies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => assignPolicy(targetsOf(selection), bulkPolicy ? { id: bulkPolicy, name: policiesById.get(bulkPolicy)?.name ?? "" } : null, actor),
                        c.done.policy,
                      )
                    }
                  >
                    {c.assignPolicy}
                  </Button>
                  <Button type="button" variant="secondary" onClick={openCommand}>{c.queueCommand}</Button>
                  <Button type="button" variant="ghost" onClick={() => setSelection(new Set())}>{c.cancel}</Button>
                </div>
              )}
              {!rows.length ? (
                <State type="empty" title={c.emptyTitle} description={c.emptyText} />
              ) : (
                <div className="dm-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th><input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} aria-label="Select all" /></th>
                        <th>{c.device}</th><th>{c.assignee}</th><th>{c.status}</th><th>{c.health}</th><th>{c.policy}</th><th>{c.compliance}</th><th>{c.actions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((row) => (
                        <tr key={row.assetId}>
                          <td><input type="checkbox" checked={selection.has(row.assetId)} onChange={() => toggleRow(row.assetId)} aria-label={row.assetCode} /></td>
                          <td><strong>{row.assetCode}</strong><br /><small>{row.asset?.name ?? c.assetMissing}</small></td>
                          <td>{row.asset?.assignedTo || "—"}</td>
                          <td>{row.asset ? t(`status.${row.asset.status}`) : "—"}</td>
                          <td>{row.health ? <Badge tone={healthTone(row.health.level)}>{row.health.score} · {c.healthLevels[row.health.level]}</Badge> : "—"}</td>
                          <td>{row.policy?.name ?? "—"}</td>
                          <td>{row.compliance ? (row.compliance.compliant ? <Badge tone="success">{c.compliant}</Badge> : <Badge tone="danger">{row.compliance.violations.length} {c.violations.toLowerCase()}</Badge>) : "—"}</td>
                          <td>
                            <Button type="button" variant="ghost" aria-label={`${c.remove} ${row.assetCode}`} disabled={busy}
                              onClick={() => run(() => unenrollDevice({ assetId: row.assetId, assetCode: row.assetCode }, actor).then(() => setSelection((s) => { const n = new Set(s); n.delete(row.assetId); return n; })), c.done.removed)}>
                              <Trash2 size={16} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tab === "health" && (
            <>
              <div className="dm-toolbar">
                <label className="dm-check"><input type="checkbox" checked={onlyAttention} onChange={(e) => setOnlyAttention(e.target.checked)} /> {c.onlyAttention}</label>
              </div>
              {!rows.length ? <State type="empty" title={c.emptyTitle} description={c.emptyText} /> : (
                <div className="dm-table-wrap">
                  <table>
                    <thead><tr><th>{c.device}</th><th>{c.health}</th><th>{c.detail}</th></tr></thead>
                    <tbody>
                      {[...rows]
                        .filter((r) => !onlyAttention || (r.health && r.health.level !== "healthy"))
                        .sort((a, b) => (a.health?.score ?? 101) - (b.health?.score ?? 101))
                        .map((row) => (
                          <tr key={row.assetId}>
                            <td><strong>{row.assetCode}</strong><br /><small>{row.asset?.name ?? c.assetMissing}</small></td>
                            <td>{row.health ? <Badge tone={healthTone(row.health.level)}>{row.health.score} · {c.healthLevels[row.health.level]}</Badge> : "—"}</td>
                            <td>{row.health?.reasons.length ? row.health.reasons.map((r) => c.reasons[r] ?? r).join(", ") : "—"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tab === "compliance" && (
            <>
              <div className="dm-toolbar">
                <label className="dm-check"><input type="checkbox" checked={onlyNonCompliant} onChange={(e) => setOnlyNonCompliant(e.target.checked)} /> {c.onlyNonCompliant}</label>
              </div>
              {!rows.length ? <State type="empty" title={c.emptyTitle} description={c.emptyText} /> : (
                <div className="dm-table-wrap">
                  <table>
                    <thead><tr><th>{c.device}</th><th>{c.policy}</th><th>{c.compliance}</th><th>{c.violations}</th></tr></thead>
                    <tbody>
                      {rows.filter((r) => !onlyNonCompliant || r.compliance?.compliant === false).map((row) => (
                        <tr key={row.assetId}>
                          <td><strong>{row.assetCode}</strong><br /><small>{row.asset?.name ?? c.assetMissing}</small></td>
                          <td>{row.policy ? `${row.policy.name}${row.policy.active ? "" : ` (${c.inactive})`}` : "—"}</td>
                          <td>{row.compliance ? (row.compliance.compliant ? <Badge tone="success">{c.compliant}</Badge> : <Badge tone="danger">{c.nonCompliant}</Badge>) : "—"}</td>
                          <td>{row.compliance?.violations.length ? row.compliance.violations.map((v) => c.violationLabels[v]).join(", ") : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tab === "policies" && (
            <>
              <div className="dm-toolbar"><Button type="button" onClick={() => openPolicy()}><Plus size={16} /> {c.policyNew}</Button></div>
              {!data.policies.length ? <State type="empty" title={c.policiesEmpty} description={c.policiesEmptyText} /> : (
                <div className="dm-policy-grid">
                  {data.policies.map((policy) => (
                    <article key={policy.id} className="dm-policy">
                      <header>
                        <h3>{policy.name}</h3>
                        {!policy.active && <Badge tone="neutral">{c.inactive}</Badge>}
                      </header>
                      {policy.description && <p>{policy.description}</p>}
                      <ul>
                        {policy.rules.requireValidWarranty && <li>{c.ruleWarranty}</li>}
                        {policy.rules.requireAssignee && <li>{c.ruleAssignee}</li>}
                        {policy.rules.maxAgeYears !== null && <li>≤ {policy.rules.maxAgeYears} {nl ? "jaar" : "years"}</li>}
                        {policy.rules.allowedConditions.length > 0 && <li>{policy.rules.allowedConditions.map((x) => t(`condition.${x}`)).join(", ")}</li>}
                      </ul>
                      <footer>
                        <small>{policyUsage(policy.id)} {c.devicesUsing}</small>
                        <span>
                          <Button type="button" variant="secondary" onClick={() => openPolicy(policy)}>{c.edit}</Button>
                          <Button type="button" variant="ghost" disabled={busy}
                            onClick={() => { if (window.confirm(c.confirmDeletePolicy)) run(() => deletePolicy(policy, rows.filter((r) => r.policyId === policy.id).map((r) => r.assetId), actor), c.done.deleted); }}>
                            {c.delete}
                          </Button>
                        </span>
                      </footer>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "commands" && (
            <>
              <div className="dm-toolbar"><Button type="button" onClick={openCommand}><Plus size={16} /> {c.newCommand}</Button></div>
              {!data.commands.length ? <State type="empty" title={c.commandsEmpty} description={c.commandsEmptyText} /> : (
                <div className="dm-table-wrap">
                  <table>
                    <thead><tr><th>{c.device}</th><th>{c.commandType}</th><th>{c.status}</th><th>{c.reason}</th><th>{c.requestedBy}</th><th>{c.when}</th><th>{c.actions}</th></tr></thead>
                    <tbody>
                      {data.commands.map((cmd) => (
                        <tr key={cmd.id}>
                          <td>{cmd.assetCode}</td>
                          <td>{c.commandTypes[cmd.type] ?? cmd.type}</td>
                          <td><Badge tone={cmd.status === "queued" ? "info" : "neutral"}>{cmd.status === "queued" ? c.queuedStatus : c.cancelled}</Badge></td>
                          <td>{cmd.reason || "—"}</td>
                          <td>{cmd.createdBy ?? "—"}</td>
                          <td>{fmt(cmd.createdAt)}</td>
                          <td>{cmd.status === "queued" && <Button type="button" variant="ghost" disabled={busy} onClick={() => run(() => cancelCommand(cmd, actor), c.done.cancelled)}>{c.cancelCommand}</Button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tab === "audit" && (
            !data.audit.length ? <State type="empty" title={c.auditEmpty} description={c.auditEmptyText} /> : (
              <div className="dm-table-wrap">
                <table>
                  <thead><tr><th>{c.when}</th><th>{c.action}</th><th>{c.device}</th><th>{c.detail}</th><th>{c.by}</th></tr></thead>
                  <tbody>
                    {data.audit.map((entry) => (
                      <tr key={entry.id}>
                        <td>{fmt(entry.createdAt)}</td><td>{entry.action}</td><td>{entry.assetCode ?? "—"}</td><td>{entry.detail}</td><td>{entry.actor ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </section>
      )}

      <Dialog
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        title={c.enrollTitle}
        description={c.enrollHint}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setEnrollOpen(false)}>{c.cancel}</Button>
            <Button type="button" disabled={busy || !enrollSelection.size}
              onClick={async () => { if (await run(() => enrollDevices(targetsOf(enrollSelection), actor), c.done.enrolled)) setEnrollOpen(false); }}>
              {c.add} ({enrollSelection.size})
            </Button>
          </>
        }
      >
        <DevicePicker items={enrollItems} selected={enrollSelection} onChange={setEnrollSelection} nl={nl} max={MAX_BULK_TARGETS} />
      </Dialog>

      <Dialog
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        title={c.newCommand}
        description={c.noAgent}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setCommandOpen(false)}>{c.cancel}</Button>
            <Button type="button" variant={SENSITIVE_COMMANDS.includes(commandType) ? "danger" : "primary"} disabled={busy || !!commandProblem || !commandAck} onClick={submitCommand}>
              {c.queueCommand}
            </Button>
          </>
        }
      >
        <SelectField label={c.commandType} value={commandType} onChange={(e) => setCommandType(e.target.value as DeviceCommandType)}>
          {DEVICE_COMMAND_TYPES.map((type) => <option key={type} value={type}>{c.commandTypes[type]}</option>)}
        </SelectField>
        <TextAreaField label={c.reason} value={commandReason} maxLength={500} onChange={(e) => setCommandReason(e.target.value)} />
        <p className="field-hint">{c.reasonHint}</p>
        <DevicePicker items={commandItems} selected={commandSelection} onChange={setCommandSelection} nl={nl} max={MAX_BULK_TARGETS} />
        {commandProblem && commandSelection.size + commandReason.length > 0 && (
          <p className="dm-message dm-message--error" role="alert">{c.commandErrors[commandProblem]}</p>
        )}
        <label className="dm-check"><input type="checkbox" checked={commandAck} onChange={(e) => setCommandAck(e.target.checked)} /> {c.ack}</label>
      </Dialog>

      <Dialog
        open={!!policyDraft}
        onClose={() => setPolicyDraft(null)}
        title={policyDraft?.id ? c.edit : c.policyNew}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setPolicyDraft(null)}>{c.cancel}</Button>
            <Button type="button" disabled={busy} onClick={submitPolicy}>{c.save}</Button>
          </>
        }
      >
        {policyDraft?.rules && (
          <div className="dm-policy-form">
            <Field label={c.policyName} required value={policyDraft.name ?? ""} maxLength={80} onChange={(e) => setPolicyDraft({ ...policyDraft, name: e.target.value })} />
            <TextAreaField label={c.policyDescription} value={policyDraft.description ?? ""} maxLength={500} onChange={(e) => setPolicyDraft({ ...policyDraft, description: e.target.value })} />
            <label className="dm-check"><input type="checkbox" checked={policyDraft.active !== false} onChange={(e) => setPolicyDraft({ ...policyDraft, active: e.target.checked })} /> {c.policyActive}</label>
            <label className="dm-check"><input type="checkbox" checked={policyDraft.rules.requireValidWarranty} onChange={(e) => setPolicyDraft({ ...policyDraft, rules: { ...policyDraft.rules!, requireValidWarranty: e.target.checked } })} /> {c.ruleWarranty}</label>
            <label className="dm-check"><input type="checkbox" checked={policyDraft.rules.requireAssignee} onChange={(e) => setPolicyDraft({ ...policyDraft, rules: { ...policyDraft.rules!, requireAssignee: e.target.checked } })} /> {c.ruleAssignee}</label>
            <Field label={c.ruleAge} type="number" min="1" max="50" value={policyDraft.ageText} onChange={(e) => setPolicyDraft({ ...policyDraft, ageText: e.target.value })} />
            <fieldset className="dm-checks">
              <legend>{c.ruleConditions}</legend>
              {ASSET_CONDITIONS.map((cond) => (
                <label key={cond} className="dm-check"><input type="checkbox" checked={policyDraft.rules!.allowedConditions.includes(cond)} onChange={() => setPolicyDraft({ ...policyDraft, rules: { ...policyDraft.rules!, allowedConditions: toggleIn(policyDraft.rules!.allowedConditions, cond) } })} /> {t(`condition.${cond}`)}</label>
              ))}
            </fieldset>
            <fieldset className="dm-checks">
              <legend>{c.ruleStatuses}</legend>
              {STATUSES.map((status) => (
                <label key={status} className="dm-check"><input type="checkbox" checked={policyDraft.rules!.blockedStatuses.includes(status)} onChange={() => setPolicyDraft({ ...policyDraft, rules: { ...policyDraft.rules!, blockedStatuses: toggleIn(policyDraft.rules!.blockedStatuses, status) } })} /> {t(`status.${status}`)}</label>
              ))}
            </fieldset>
          </div>
        )}
      </Dialog>
    </div>
  );
}
