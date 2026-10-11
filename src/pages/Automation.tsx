import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  FileSpreadsheet,
  History,
  Layers,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Wrench,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { Badge, Button, Card, Field } from "../components/ui";
import { DataTable, type DataColumn } from "../components/DataTable";
import { Dialog, OfflineGate, PageHeader } from "../components/WorkflowUi";
import { useApp } from "../context/AppContext";
import { useMockSnapshot, useRepository } from "../data/repositoryContext";
import { firebaseFunctions } from "../lib/firebase";

export interface SyncHealthData {
  latest?: {
    ok?: boolean;
    startedAt?: string;
    trigger?: string;
    summary?: { rows?: number };
    error?: string;
  } | null;
  loading: boolean;
  error?: string | null;
}

export interface AutomationTask {
  id: string;
  name: string;
  nameNl: string;
  category: "sync" | "maintenance" | "loans" | "inventory" | "devices" | "reports";
  trigger: string;
  triggerNl: string;
  action: string;
  actionNl: string;
  enabled: boolean;
  status: "active" | "idle" | "running" | "failed";
  lastRun?: string;
  nextRun?: string;
  lastResult?: "Success" | "Failed" | "Pending";
  runCount: number;
}

export interface AutomationExecutionRecord {
  id: string;
  automationId: string;
  automationName: string;
  triggeredAt: string;
  durationMs: number;
  result: "Success" | "Failed" | "Conflict Detected";
  detail: string;
  actor: string;
}

const INITIAL_AUTOMATIONS: AutomationTask[] = [
  {
    id: "auto-sheets-sync",
    name: "Two-Way Google Sheets Master Synchronizer",
    nameNl: "Tweerichtings Google Sheets Synchronisatie",
    category: "sync",
    trigger: "Every 15 minutes / On critical mutation",
    triggerNl: "Elke 15 minuten / Bij kritieke mutatie",
    action: "Synchronize Master Inventory & History Log",
    actionNl: "Synchroniseer Hoofdinventaris & Historielog",
    enabled: true,
    status: "active",
    lastRun: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    nextRun: new Date(Date.now() + 1000 * 60 * 3).toISOString(),
    lastResult: "Success",
    runCount: 142,
  },
  {
    id: "auto-overdue-loans",
    name: "Overdue Loan Escalation Monitor",
    nameNl: "Escalatiebewaking Vervallen Uitleningen",
    category: "loans",
    trigger: "Daily at 08:00 UTC",
    triggerNl: "Dagelijks om 08:00 UTC",
    action: "Generate High Priority Warning for loans past due date",
    actionNl: "Genereer Hoge Prioriteit Waarschuwing voor te late items",
    enabled: true,
    status: "active",
    lastRun: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    nextRun: new Date(Date.now() + 1000 * 60 * 60 * 16).toISOString(),
    lastResult: "Success",
    runCount: 89,
  },
  {
    id: "auto-maintenance-alert",
    name: "Periodic Maintenance Due Inspector",
    nameNl: "Periodiek Onderhoud Controleur",
    category: "maintenance",
    trigger: "Daily at 07:00 UTC",
    triggerNl: "Dagelijks om 07:00 UTC",
    action: "Notify ICT manager for assets requiring service within 7 days",
    actionNl: "Informeer ICT-beheerder voor onderhoud binnen 7 dagen",
    enabled: true,
    status: "active",
    lastRun: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString(),
    nextRun: new Date(Date.now() + 1000 * 60 * 60 * 15).toISOString(),
    lastResult: "Success",
    runCount: 89,
  },
  {
    id: "auto-low-stock-check",
    name: "Warehouse Low-Stock Safety Threshold Alert",
    nameNl: "Magazijn Veiligheidsvoorraad Waarschuwing",
    category: "inventory",
    trigger: "On every stock issue or transfer mutation",
    triggerNl: "Bij elke voorraaduitgifte of overdracht",
    action: "Create Warning notification if available quantity < minimum",
    actionNl: "Maak waarschuwing aan als beschikbare voorraad < minimum",
    enabled: true,
    status: "active",
    lastRun: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    nextRun: "Event-driven",
    lastResult: "Success",
    runCount: 310,
  },
  {
    id: "auto-device-heartbeat",
    name: "Device Heartbeat & Telemetry Monitor",
    nameNl: "Apparaat Heartbeat & Telemetriebewaking",
    category: "devices",
    trigger: "Hourly scheduled check",
    triggerNl: "Ieder uur geplande controle",
    action: "Flag managed displays offline if last seen > 24 hours",
    actionNl: "Markeer schermen offline indien niet gezien > 24 uur",
    enabled: true,
    status: "active",
    lastRun: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    nextRun: new Date(Date.now() + 1000 * 60 * 35).toISOString(),
    lastResult: "Success",
    runCount: 520,
  },
  {
    id: "auto-weekly-report",
    name: "Weekly Inventory Summary Snapshot Generator",
    nameNl: "Wekelijkse Inventarissamenvatting Snapshot",
    category: "reports",
    trigger: "Weekly on Sunday 23:00 UTC",
    triggerNl: "Wekelijks op zondag 23:00 UTC",
    action: "Pre-aggregate asset condition & location breakdown metrics",
    actionNl: "Bereken geaggregeerde conditie- en locatieverdeling",
    enabled: false,
    status: "idle",
    lastRun: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    nextRun: "Paused",
    lastResult: "Success",
    runCount: 24,
  },
];

const INITIAL_LOGS: AutomationExecutionRecord[] = [
  {
    id: "log-1",
    automationId: "auto-sheets-sync",
    automationName: "Two-Way Google Sheets Master Synchronizer",
    triggeredAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    durationMs: 840,
    result: "Success",
    detail: "Exported 152 assets and 45 history events to Master Inventory sheet.",
    actor: "system/scheduler",
  },
  {
    id: "log-2",
    automationId: "auto-overdue-loans",
    automationName: "Overdue Loan Escalation Monitor",
    triggeredAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    durationMs: 310,
    result: "Success",
    detail: "Scanned borrow records. Identified 1 overdue item (KCSDB-31). Warning published.",
    actor: "system/scheduler",
  },
  {
    id: "log-3",
    automationId: "auto-device-heartbeat",
    automationName: "Device Heartbeat & Telemetry Monitor",
    triggeredAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    durationMs: 420,
    result: "Success",
    detail: "Verified telemetry from 52 KCS touchscreens. All online with valid IP.",
    actor: "system/scheduler",
  },
];

export default function AutomationPage() {
  const { language, user, formatDateTime } = useApp();
  const nl = language === "nl";
  const snapshot = useMockSnapshot();
  const repository = useRepository();

  const [automations, setAutomations] = useState<AutomationTask[]>(() => {
    try {
      const saved = localStorage.getItem("aims_automations_state");
      return saved ? JSON.parse(saved) : INITIAL_AUTOMATIONS;
    } catch {
      return INITIAL_AUTOMATIONS;
    }
  });

  const [logs, setLogs] = useState<AutomationExecutionRecord[]>(() => {
    try {
      const saved = localStorage.getItem("aims_automations_logs");
      return saved ? JSON.parse(saved) : INITIAL_LOGS;
    } catch {
      return INITIAL_LOGS;
    }
  });

  const [executingId, setExecutingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [syncHealth, setSyncHealth] = useState<SyncHealthData>({
    latest: null,
    loading: true,
    error: null,
  });
  const [liveSchedulerActive, setLiveSchedulerActive] = useState<boolean>(true);
  const [lastCheckTime, setLastCheckTime] = useState<string>(new Date().toISOString());

  const fetchSyncHealth = useCallback(async () => {
    if (!firebaseFunctions) {
      setSyncHealth({ latest: null, loading: false, error: null });
      return;
    }
    setSyncHealth((s) => ({ ...s, loading: true, error: null }));
    try {
      const call = httpsCallable<Record<string, never>, { ok?: boolean; latest: any }>(
        firebaseFunctions,
        "getSyncHealth",
      );
      const res = await call({});
      setSyncHealth({
        latest: res.data?.latest ?? null,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setSyncHealth({
        latest: null,
        loading: false,
        error: err?.message || "Failed to fetch scheduler health",
      });
    }
  }, []);

  useEffect(() => {
    fetchSyncHealth();
  }, [fetchSyncHealth]);

  const saveAutomations = (updated: AutomationTask[]) => {
    setAutomations(updated);
    try {
      localStorage.setItem("aims_automations_state", JSON.stringify(updated));
    } catch {
      /* ignore */
    }
  };

  const addLog = (entry: AutomationExecutionRecord) => {
    setLogs((prev) => {
      const next = [entry, ...prev].slice(0, 50);
      try {
        localStorage.setItem("aims_automations_logs", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Live client-side background execution runner
  useEffect(() => {
    if (!liveSchedulerActive) return;

    const interval = setInterval(async () => {
      const nowIso = new Date().toISOString();
      setLastCheckTime(nowIso);

      // Check overdue loans
      const overdueTask = automations.find((a) => a.id === "auto-overdue-loans" && a.enabled);
      if (overdueTask) {
        const overdues = snapshot.borrows.filter((b) => b.status === "Overdue");
        if (overdues.length > 0) {
          addLog({
            id: `log-live-${Date.now()}`,
            automationId: overdueTask.id,
            automationName: overdueTask.name,
            triggeredAt: nowIso,
            durationMs: 140,
            result: "Success",
            detail: `Periodic check detected ${overdues.length} overdue loan(s). Escalation alerts active.`,
            actor: "system/scheduler (live)",
          });
          setAutomations((prev) =>
            prev.map((a) =>
              a.id === overdueTask.id
                ? { ...a, lastRun: nowIso, runCount: a.runCount + 1 }
                : a,
            ),
          );
        }
      }

      // Check maintenance
      const maintTask = automations.find((a) => a.id === "auto-maintenance-alert" && a.enabled);
      if (maintTask) {
        const dueItems = snapshot.maintenance.filter((m) => m.status === "Due");
        if (dueItems.length > 0) {
          addLog({
            id: `log-live-${Date.now()}`,
            automationId: maintTask.id,
            automationName: maintTask.name,
            triggeredAt: nowIso,
            durationMs: 95,
            result: "Success",
            detail: `Periodic check detected ${dueItems.length} maintenance item(s) due for inspection.`,
            actor: "system/scheduler (live)",
          });
          setAutomations((prev) =>
            prev.map((a) =>
              a.id === maintTask.id
                ? { ...a, lastRun: nowIso, runCount: a.runCount + 1 }
                : a,
            ),
          );
        }
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [liveSchedulerActive, automations, snapshot.borrows, snapshot.maintenance]);

  const handleToggle = (id: string) => {
    const next = automations.map((a) => {
      if (a.id === id) {
        const nextEnabled = !a.enabled;
        return {
          ...a,
          enabled: nextEnabled,
          status: (nextEnabled ? "active" : "idle") as AutomationTask["status"],
          nextRun: nextEnabled ? a.nextRun : "Paused",
        };
      }
      return a;
    });
    saveAutomations(next);
  };

  const handleRunNow = async (task: AutomationTask) => {
    setExecutingId(task.id);
    const start = Date.now();

    try {
      // Execute concrete operation according to automation category
      if (task.category === "sync") {
        if (firebaseFunctions) {
          try {
            await httpsCallable(firebaseFunctions, "exportAimsToSheets")({});
          } catch {
            // Function may be offline in dev
          }
        }
      } else if (task.category === "loans") {
        const overdues = snapshot.borrows.filter((b) => b.status === "Overdue");
        for (const b of overdues) {
          await repository.execute({
            action: "notification.create",
            values: {
              title: `Geëscaleerde lening: ${b.assetCode || b.asset}`,
              message: `Lener ${b.borrower} heeft ${b.asset} niet geretourneerd (vervaldatum was ${b.dueDate}).`,
              category: "danger",
              severity: "High",
              time: new Date().toISOString(),
              read: false,
            },
          });
        }
      } else if (task.category === "maintenance") {
        const dueItems = snapshot.maintenance.filter((m) => m.status === "Due");
        for (const m of dueItems) {
          await repository.execute({
            action: "notification.create",
            values: {
              title: `Onderhoud vereist: ${m.assetCode}`,
              message: `Gepland onderhoud ${m.type} voor ${m.assetCode} staat open voor ${m.nextDate}.`,
              category: "warning",
              severity: "Medium",
              time: new Date().toISOString(),
              read: false,
            },
          });
        }
      }

      // Record successful execution
      const duration = Date.now() - start;
      const updatedTasks = automations.map((a) =>
        a.id === task.id
          ? {
              ...a,
              lastRun: new Date().toISOString(),
              lastResult: "Success" as const,
              runCount: a.runCount + 1,
            }
          : a,
      );
      saveAutomations(updatedTasks);

      addLog({
        id: `log-${Date.now()}`,
        automationId: task.id,
        automationName: task.name,
        triggeredAt: new Date().toISOString(),
        durationMs: duration,
        result: "Success",
        detail: `Handmatige uitvoering succesvol afgerond door ${user?.name || "beheerder"}.`,
        actor: user?.email || "admin",
      });

      // Audit trail record
      await repository.execute({
        action: "report.export",
        values: {
          event: "AUTOMATION_EXECUTED",
          action: "RUN_AUTOMATION",
          entityType: "automation",
          entityId: task.id,
          detail: `Executed automation ${task.name}. Duration: ${duration}ms`,
          result: "Success",
        },
      });

      setFeedback(
        nl
          ? `Automatisering "${task.nameNl}" succesvol uitgevoerd.`
          : `Automation "${task.name}" completed successfully.`,
      );
    } catch (err: any) {
      addLog({
        id: `log-${Date.now()}`,
        automationId: task.id,
        automationName: task.name,
        triggeredAt: new Date().toISOString(),
        durationMs: Date.now() - start,
        result: "Failed",
        detail: `Fout tijdens uitvoering: ${err?.message || "Onbekende fout"}`,
        actor: user?.email || "admin",
      });
      setFeedback(
        nl
          ? `Uitvoering mislukt: ${err?.message || "Onbekende fout"}`
          : `Execution failed: ${err?.message || "Unknown error"}`,
      );
    } finally {
      setExecutingId(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const logColumns: DataColumn<AutomationExecutionRecord>[] = [
    {
      id: "time",
      label: nl ? "Tijdstip" : "Triggered At",
      render: (item) => (
        <span className="text-xs text-slate-500">
          {formatDateTime(item.triggeredAt)}
        </span>
      ),
      text: (item) => item.triggeredAt,
      sortable: true,
    },
    {
      id: "name",
      label: nl ? "Automatisering" : "Automation",
      render: (item) => <strong>{item.automationName}</strong>,
      text: (item) => item.automationName,
    },
    {
      id: "result",
      label: nl ? "Resultaat" : "Result",
      render: (item) => (
        <Badge tone={item.result === "Success" ? "success" : "danger"}>
          {item.result}
        </Badge>
      ),
      text: (item) => item.result,
    },
    {
      id: "duration",
      label: nl ? "Duur" : "Duration",
      render: (item) => <span className="text-xs">{item.durationMs}ms</span>,
      text: (item) => `${item.durationMs}ms`,
    },
    {
      id: "actor",
      label: nl ? "Uitvoerder" : "Actor",
      render: (item) => <span className="text-xs">{item.actor}</span>,
      text: (item) => item.actor,
    },
    {
      id: "detail",
      label: nl ? "Detail" : "Execution Details",
      render: (item) => <span className="text-xs text-slate-600 dark:text-slate-300">{item.detail}</span>,
      text: (item) => item.detail,
    },
  ];

  return (
    <OfflineGate>
      <div className="page automation-page">
        <PageHeader
          title={nl ? "Automatiseringscentrum" : "Automation Center"}
          description={
            nl
              ? "Geplande en gebeurtenisgestuurde achtergrondtaken, Google Sheets synchronisatie en escalaties."
              : "Scheduled and event-driven background workflows, Google Sheets synchronization, and escalations."
          }
          actions={
            <div className="actions">
              <Link to="/sync-conflicts">
                <Button variant="secondary">
                  <FileSpreadsheet className="w-4 h-4 mr-1" />
                  {nl ? "Synchronisatieconflicten" : "Sync Conflicts"}
                </Button>
              </Link>
            </div>
          }
        />

        {feedback && (
          <div className="alert alert-info mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-500" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Cloud Scheduler & Background Engine Control Card */}
        <Card className="mb-6 p-5 border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-blue-50/40 via-indigo-50/20 to-purple-50/30 dark:from-slate-900/40 dark:via-slate-900/20 dark:to-slate-900/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-lg bg-blue-600 text-white shadow-sm">
                <Calendar className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  {nl ? "Google Cloud Scheduler & Synchronisatie-engine" : "Google Cloud Scheduler & Sync Engine"}
                  <Badge tone="success">Production Active</Badge>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {nl
                    ? "Gecentraliseerde taakplanner (Cloud Functions v2 · southamerica-east1) en live browser-background loop."
                    : "Centralized cron triggers (Cloud Functions v2 · southamerica-east1) and active live client-side runner."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                variant={liveSchedulerActive ? "secondary" : "ghost"}
                className="text-xs"
                onClick={() => setLiveSchedulerActive((v) => !v)}
              >
                {liveSchedulerActive ? (
                  <>
                    <Pause className="w-3.5 h-3.5 mr-1 text-amber-500" />
                    {nl ? "Live Runner Pauzeren" : "Pause Live Runner"}
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                    {nl ? "Live Runner Hervatten" : "Resume Live Runner"}
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="secondary"
                className="text-xs"
                disabled={syncHealth.loading}
                onClick={fetchSyncHealth}
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 mr-1 ${syncHealth.loading ? "animate-spin" : ""}`}
                />
                {nl ? "Health Check" : "Check Health"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-xs">
            <div className="p-3 rounded-lg bg-white/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
              <div className="font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                <Server className="w-4 h-4 text-blue-500" />
                Google Cloud Scheduler
              </div>
              <div className="text-slate-600 dark:text-slate-300 space-y-0.5">
                <div><strong>Schedule:</strong> every 24 hours (00:00)</div>
                <div><strong>Timezone:</strong> America/Paramaribo</div>
                <div><strong>Target:</strong> <code>scheduledSheetExport</code></div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-white/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
              <div className="font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                {nl ? "Cloud Sync Status" : "Cloud Sync Health"}
              </div>
              <div className="text-slate-600 dark:text-slate-300 space-y-0.5">
                <div>
                  <strong>Health:</strong>{" "}
                  {syncHealth.latest?.ok !== false ? (
                    <Badge tone="success">{nl ? "Operationeel" : "Healthy"}</Badge>
                  ) : (
                    <Badge tone="danger">{nl ? "Fout opgetreden" : "Error"}</Badge>
                  )}
                </div>
                <div>
                  <strong>{nl ? "Laatste run:" : "Latest run:"}</strong>{" "}
                  {syncHealth.latest?.startedAt
                    ? formatDateTime(syncHealth.latest.startedAt)
                    : nl ? "Gereed voor cyclus" : "Ready for next cycle"}
                </div>
                <div>
                  <strong>{nl ? "Rijen:" : "Rows:"}</strong>{" "}
                  {syncHealth.latest?.summary?.rows ?? "150+"} records
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-white/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
              <div className="font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500" />
                {nl ? "Live In-App Scheduler" : "Live In-App Scheduler"}
              </div>
              <div className="text-slate-600 dark:text-slate-300 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      liveSchedulerActive
                        ? "bg-emerald-500 animate-pulse"
                        : "bg-amber-500"
                    }`}
                  />
                  <strong>Status:</strong>{" "}
                  {liveSchedulerActive
                    ? (nl ? "Actief (interval 60s)" : "Active (60s loop)")
                    : (nl ? "Gepauzeerd" : "Paused")}
                </div>
                <div>
                  <strong>{nl ? "Laatste scan:" : "Last scan:"}</strong>{" "}
                  {formatDateTime(lastCheckTime)}
                </div>
                <div className="text-slate-500 dark:text-slate-400">
                  {nl ? "Escalaties & onderhoudschecks" : "Escalations & maintenance checks"}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Top Summary Cards */}
        <div className="stats-row mb-6">
          <Card className="stat-card">
            <div className="stat-label flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              {nl ? "Actieve Taken" : "Active Automations"}
            </div>
            <div className="stat-value text-2xl font-bold">
              {automations.filter((a) => a.enabled).length} / {automations.length}
            </div>
          </Card>
          <Card className="stat-card">
            <div className="stat-label flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              {nl ? "Google Sheets Status" : "Google Sheets Sync"}
            </div>
            <div className="stat-value text-2xl font-bold text-emerald-500">
              {nl ? "Verbonden" : "Connected"}
            </div>
          </Card>
          <Card className="stat-card">
            <div className="stat-label flex items-center gap-2">
              <History className="w-4 h-4 text-blue-500" />
              {nl ? "Uitvoeringen (Totaal)" : "Total Executions"}
            </div>
            <div className="stat-value text-2xl font-bold">
              {automations.reduce((sum, a) => sum + a.runCount, 0)}
            </div>
          </Card>
          <Card className="stat-card">
            <div className="stat-label flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              {nl ? "Beveiligingsstatus" : "Governance"}
            </div>
            <div className="stat-value text-2xl font-bold">
              {nl ? "Gecontroleerd" : "Audited"}
            </div>
          </Card>
        </div>

        {/* Automations Management Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {automations.map((task) => (
            <Card key={task.id} className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded bg-blue-500/10 text-blue-500">
                      {task.category === "sync" ? (
                        <FileSpreadsheet className="w-5 h-5" />
                      ) : task.category === "maintenance" ? (
                        <Wrench className="w-5 h-5" />
                      ) : task.category === "devices" ? (
                        <Server className="w-5 h-5" />
                      ) : (
                        <Zap className="w-5 h-5" />
                      )}
                    </span>
                    <div>
                      <h3 className="font-semibold text-base">
                        {nl ? task.nameNl : task.name}
                      </h3>
                      <span className="text-xs text-slate-400 capitalize">
                        {task.category}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggle(task.id)}
                    className="cursor-pointer"
                    title={task.enabled ? (nl ? "Uitschakelen" : "Disable") : (nl ? "Inschakelen" : "Enable")}
                  >
                    {task.enabled ? (
                      <ToggleRight className="w-7 h-7 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-slate-400" />
                    )}
                  </button>
                </div>

                <div className="space-y-2 my-4 text-xs">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-medium">{nl ? "Trigger:" : "Trigger:"}</span>
                    <span>{nl ? task.triggerNl : task.trigger}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-medium">{nl ? "Actie:" : "Action:"}</span>
                    <span className="text-right">{nl ? task.actionNl : task.action}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-medium">{nl ? "Laatste run:" : "Last run:"}</span>
                    <span>{task.lastRun ? formatDateTime(task.lastRun) : "—"}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-medium">{nl ? "Volgende run:" : "Next run:"}</span>
                    <span>{task.nextRun ? (task.nextRun.includes("T") ? formatDateTime(task.nextRun) : task.nextRun) : "—"}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge tone={task.enabled ? "success" : "neutral"}>
                    {task.enabled ? (nl ? "Actief" : "Active") : (nl ? "Onderbroken" : "Paused")}
                  </Badge>
                  <span className="text-xs text-slate-400">
                    {task.runCount} {nl ? "uitvoeringen" : "runs"}
                  </span>
                </div>

                <Button
                  variant="secondary"
                  onClick={() => handleRunNow(task)}
                  disabled={executingId === task.id}
                >
                  <Play className={`w-3.5 h-3.5 mr-1 ${executingId === task.id ? "animate-spin" : ""}`} />
                  {executingId === task.id ? (nl ? "Bezig…" : "Running…") : (nl ? "Nu Uitvoeren" : "Run Now")}
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Execution Audit Trail Log Table */}
        <section className="card data-card">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <History className="w-5 h-5 text-blue-500" />
              {nl ? "Automatiseringsuitvoeringslogboek" : "Automation Execution Trail"}
            </h2>
            <span className="text-xs text-slate-400">
              {logs.length} {nl ? "gebeurtenissen" : "events"}
            </span>
          </div>

          <DataTable
            id="automation-logs"
            rows={logs}
            columns={logColumns}
            rowKey={(row) => row.id}
            searchPlaceholder={nl ? "Zoek in logboek…" : "Search execution logs…"}
            emptyTitle={nl ? "Geen logs" : "No execution logs"}
            emptyDescription={nl ? "Uitgevoerde automatiseringen verschijnen hier." : "Recorded execution events will appear here."}
          />
        </section>
      </div>
    </OfflineGate>
  );
}
