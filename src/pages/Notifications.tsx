import {
  AlertOctagon,
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Bell,
  BellOff,
  CheckCheck,
  CheckCircle2,
  Clock,
  Filter,
  Info,
  Mail,
  MailOpen,
  RefreshCw,
  Search,
  Settings2,
  Sliders,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Button, Card, Field } from "../components/ui";
import { Dialog, OfflineGate, PageHeader } from "../components/WorkflowUi";
import { useApp } from "../context/AppContext";
import { useMockSnapshot, useRepository } from "../data/repositoryContext";
import type { Notification } from "../domain/types";

type LifecycleTab = "unread" | "read" | "archived" | "preferences";
type PriorityFilter = "all" | "Critical" | "High" | "Medium" | "Low";

interface UserNotificationPreferences {
  maintenanceAlerts: boolean;
  loanReminders: boolean;
  inventoryWarnings: boolean;
  deviceAlerts: boolean;
  securityEvents: boolean;
  emailDigest: boolean;
}

const DEFAULT_PREFERENCES: UserNotificationPreferences = {
  maintenanceAlerts: true,
  loanReminders: true,
  inventoryWarnings: true,
  deviceAlerts: true,
  securityEvents: true,
  emailDigest: false,
};

export default function NotificationsPage() {
  const { language, user, formatDateTime } = useApp();
  const nl = language === "nl";
  const snapshot = useMockSnapshot();
  const repository = useRepository();

  const [activeTab, setActiveTab] = useState<LifecycleTab>("unread");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [isPrefModalOpen, setIsPrefModalOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // User-specific notification preferences stored in localStorage
  const prefStorageKey = `aims_notif_prefs_${user?.id || "guest"}`;
  const [preferences, setPreferences] = useState<UserNotificationPreferences>(() => {
    try {
      const saved = localStorage.getItem(prefStorageKey);
      return saved ? { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) } : DEFAULT_PREFERENCES;
    } catch {
      return DEFAULT_PREFERENCES;
    }
  });

  const savePreferences = (updated: UserNotificationPreferences) => {
    setPreferences(updated);
    try {
      localStorage.setItem(prefStorageKey, JSON.stringify(updated));
    } catch {
      // Storage quota or privacy mode
    }
    setActionNotice(nl ? "Voorkeuren opgeslagen." : "Preferences saved.");
    setTimeout(() => setActionNotice(null), 3000);
  };

  // Canonical notifications filtered by active user and preferences
  const userNotifications = useMemo(() => {
    return (snapshot.notifications || []).filter((notif) => {
      // User-specific visibility check: if notification specifies recipient, must match
      if (notif.recipient && user?.id && notif.recipient !== user.id && notif.recipient !== user.email) {
        // Management/Owner can see global escalations
        if (user.role !== "owner" && user.role !== "administrator") {
          return false;
        }
      }
      return true;
    });
  }, [snapshot.notifications, user]);

  // Counts across lifecycles
  const unreadCount = useMemo(
    () => userNotifications.filter((n) => !n.dismissed && !n.read).length,
    [userNotifications],
  );
  const readCount = useMemo(
    () => userNotifications.filter((n) => !n.dismissed && n.read).length,
    [userNotifications],
  );
  const archivedCount = useMemo(
    () => userNotifications.filter((n) => n.dismissed).length,
    [userNotifications],
  );
  const criticalCount = useMemo(
    () =>
      userNotifications.filter(
        (n) => !n.dismissed && (n.severity === "Critical" || n.category === "danger"),
      ).length,
    [userNotifications],
  );

  // Tab and filter application
  const displayedNotifications = useMemo(() => {
    return userNotifications.filter((n) => {
      // Lifecycle tab
      if (activeTab === "unread" && (n.dismissed || n.read)) return false;
      if (activeTab === "read" && (n.dismissed || !n.read)) return false;
      if (activeTab === "archived" && !n.dismissed) return false;

      // Priority filter
      if (priorityFilter !== "all") {
        if (n.severity !== priorityFilter) return false;
      }

      // Category filter
      if (categoryFilter !== "all") {
        if (n.category !== categoryFilter) return false;
      }

      // Search term
      if (search.trim()) {
        const term = search.toLowerCase();
        const matchTitle = (n.title || "").toLowerCase().includes(term);
        const matchMsg = (n.message || "").toLowerCase().includes(term);
        if (!matchTitle && !matchMsg) return false;
      }

      return true;
    });
  }, [userNotifications, activeTab, priorityFilter, categoryFilter, search]);

  // Operational Actions
  const handleMarkRead = async (id: string) => {
    await repository.execute({ action: "notification.read", entityId: id });
  };

  const handleMarkUnread = async (id: string) => {
    await repository.execute({ action: "notification.unread", entityId: id });
  };

  const handleArchive = async (id: string) => {
    await repository.execute({ action: "notification.dismiss", entityId: id });
    setActionNotice(nl ? "Melding gearchiveerd." : "Notification archived.");
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleRestore = async (id: string) => {
    await repository.execute({ action: "notification.restore", entityId: id });
    setActionNotice(nl ? "Melding hersteld naar actief." : "Notification restored.");
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleMarkAllRead = async () => {
    await repository.execute({ action: "notification.readAll" });
    setActionNotice(nl ? "Alle meldingen gemarkeerd als gelezen." : "All notifications marked as read.");
    setTimeout(() => setActionNotice(null), 3000);
  };

  // Inspect canonical assets and create real notifications if needed
  const handleSyncOperationalEvents = async () => {
    const overdueBorrows = snapshot.borrows.filter((b) => b.status === "Overdue");
    const lowStock = snapshot.inventory.filter((i) => i.onHand - i.reserved < i.minimum);
    const dueMaintenance = snapshot.maintenance.filter((m) => m.status === "Due" || m.status === "Overdue");

    let createdCount = 0;
    const existingTitles = new Set(snapshot.notifications.map((n) => n.title));

    for (const b of overdueBorrows) {
      const title = `Te laat leenitem: ${b.assetCode || b.asset}`;
      if (!existingTitles.has(title)) {
        await repository.execute({
          action: "notification.create",
          values: {
            title,
            message: `Lener ${b.borrower} heeft ${b.asset} niet tijdig ingeleverd (vervaldatum: ${b.dueDate}).`,
            category: "danger",
            severity: "High",
            time: new Date().toISOString(),
            read: false,
            dismissed: false,
          },
        });
        createdCount++;
      }
    }

    for (const i of lowStock) {
      const title = `Lage voorraad: ${i.code} - ${i.name}`;
      if (!existingTitles.has(title)) {
        await repository.execute({
          action: "notification.create",
          values: {
            title,
            message: `Huidige voorraad (${i.onHand - i.reserved} ${i.unit}) is onder het minimum van ${i.minimum}.`,
            category: "warning",
            severity: "Medium",
            time: new Date().toISOString(),
            read: false,
            dismissed: false,
          },
        });
        createdCount++;
      }
    }

    for (const m of dueMaintenance) {
      const title = `Periodiek onderhoud vereist: ${m.assetCode}`;
      if (!existingTitles.has(title)) {
        await repository.execute({
          action: "notification.create",
          values: {
            title,
            message: `Taak "${m.type}" voor middel ${m.assetCode} moet worden uitgevoerd voor ${m.nextDate}.`,
            category: "warning",
            severity: "Medium",
            time: new Date().toISOString(),
            read: false,
            dismissed: false,
          },
        });
        createdCount++;
      }
    }

    setActionNotice(
      nl
        ? `Canonieke controle uitgevoerd: ${createdCount} nieuwe operationele melding(en) aangemaakt.`
        : `Canonical scan completed: ${createdCount} new operational alert(s) generated.`,
    );
    setTimeout(() => setActionNotice(null), 4000);
  };

  const getPriorityTone = (severity?: string, category?: string) => {
    if (severity === "Critical" || category === "danger") return "danger";
    if (severity === "High" || category === "warning") return "warning";
    if (category === "success") return "success";
    return "info";
  };

  return (
    <OfflineGate>
      <div className="page notifications-page">
        <PageHeader
          title={nl ? "Meldingencentrum" : "Notification Center"}
          description={
            nl
              ? "Reële operationele gebeurtenissen, statusupdates en persoonlijke notificatievoorkeuren."
              : "Real operational events, lifecycle updates, and user-specific notification preferences."
          }
          actions={
            <div className="actions">
              <Button variant="secondary" onClick={() => setIsPrefModalOpen(true)}>
                <Sliders className="w-4 h-4 mr-1" />
                {nl ? "Voorkeuren" : "Preferences"}
              </Button>
              <Button variant="secondary" onClick={handleSyncOperationalEvents}>
                <RefreshCw className="w-4 h-4 mr-1" />
                {nl ? "Scan Gebeurtenissen" : "Scan Events"}
              </Button>
              <Button onClick={handleMarkAllRead} disabled={unreadCount === 0}>
                <CheckCheck className="w-4 h-4 mr-1" />
                {nl ? "Alles Gelezen" : "Mark All Read"}
              </Button>
            </div>
          }
        />

        {actionNotice && (
          <div className="alert alert-success mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Operational KPI Metric Strip */}
        <div className="stats-row mb-6">
          <Card className="stat-card">
            <div className="stat-label flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-500" />
              {nl ? "Ongelezen Meldingen" : "Unread Notifications"}
            </div>
            <div className="stat-value text-2xl font-bold">{unreadCount}</div>
          </Card>
          <Card className="stat-card">
            <div className="stat-label flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-rose-500" />
              {nl ? "Kritieke / Hoge Aandacht" : "Critical / High Alerts"}
            </div>
            <div className={`stat-value text-2xl font-bold ${criticalCount > 0 ? "text-rose-500" : ""}`}>
              {criticalCount}
            </div>
          </Card>
          <Card className="stat-card">
            <div className="stat-label flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              {nl ? "Gelezen Meldingen" : "Read Notifications"}
            </div>
            <div className="stat-value text-2xl font-bold">{readCount}</div>
          </Card>
          <Card className="stat-card">
            <div className="stat-label flex items-center gap-2">
              <Archive className="w-4 h-4 text-slate-500" />
              {nl ? "Gearchiveerd" : "Archived"}
            </div>
            <div className="stat-value text-2xl font-bold">{archivedCount}</div>
          </Card>
        </div>

        {/* Tab & Filter Bar */}
        <Card className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b">
            <div className="flex gap-2">
              <Button
                variant={activeTab === "unread" ? "primary" : "secondary"}
                onClick={() => setActiveTab("unread")}
              >
                {nl ? "Ongelezen" : "Unread"} ({unreadCount})
              </Button>
              <Button
                variant={activeTab === "read" ? "primary" : "secondary"}
                onClick={() => setActiveTab("read")}
              >
                {nl ? "Gelezen" : "Read"} ({readCount})
              </Button>
              <Button
                variant={activeTab === "archived" ? "primary" : "secondary"}
                onClick={() => setActiveTab("archived")}
              >
                {nl ? "Gearchiveerd" : "Archived"} ({archivedCount})
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  className="input pl-9 text-sm"
                  placeholder={nl ? "Zoek melding…" : "Filter notifications…"}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select
                className="input text-sm py-1"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
              >
                <option value="all">{nl ? "Alle prioriteiten" : "All Priorities"}</option>
                <option value="Critical">{nl ? "Kritiek (Critical)" : "Critical"}</option>
                <option value="High">{nl ? "Hoog (High)" : "High"}</option>
                <option value="Medium">{nl ? "Normaal (Medium)" : "Medium"}</option>
                <option value="Low">{nl ? "Laag (Low)" : "Low"}</option>
              </select>

              <select
                className="input text-sm py-1"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">{nl ? "Alle categorieën" : "All Types"}</option>
                <option value="danger">{nl ? "Gevaar / Fout" : "Danger / Error"}</option>
                <option value="warning">{nl ? "Waarschuwing" : "Warning"}</option>
                <option value="info">{nl ? "Informatief" : "Informational"}</option>
                <option value="success">{nl ? "Succes" : "Success"}</option>
              </select>
            </div>
          </div>

          {/* Notification Items List */}
          <div className="divide-y">
            {displayedNotifications.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <BellOff className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <div className="font-semibold text-base mb-1">
                  {nl ? "Geen meldingen in deze weergave" : "No notifications in this view"}
                </div>
                <div className="text-sm">
                  {nl
                    ? "Er zijn geen meldingen die voldoen aan de geselecteerde filters."
                    : "There are no notifications matching your current filter criteria."}
                </div>
              </div>
            ) : (
              displayedNotifications.map((notif) => {
                const isCritical = notif.severity === "Critical" || notif.category === "danger";
                return (
                  <div
                    key={notif.id}
                    className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                      isCritical ? "bg-red-500/5 border-l-4 border-l-rose-500" : ""
                    } ${!notif.read ? "font-medium" : "opacity-90"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {isCritical ? (
                          <AlertOctagon className="w-5 h-5 text-rose-500" />
                        ) : notif.category === "warning" ? (
                          <AlertTriangle className="w-5 h-5 text-amber-500" />
                        ) : notif.category === "success" ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <Info className="w-5 h-5 text-blue-500" />
                        )}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-base font-semibold">{notif.title}</span>
                          <Badge tone={getPriorityTone(notif.severity, notif.category)}>
                            {notif.severity || notif.category}
                          </Badge>
                          {notif.read ? (
                            <Badge tone="neutral">{nl ? "Gelezen" : "Read"}</Badge>
                          ) : (
                            <Badge tone="info">{nl ? "Nieuw" : "New"}</Badge>
                          )}
                        </div>

                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                          {notif.message}
                        </p>

                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {notif.time ? formatDateTime(notif.time) : "—"}
                          </span>
                          {notif.type && <span>Type: {notif.type}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      {!notif.dismissed ? (
                        <>
                          <Button
                            variant="secondary"
                            onClick={() => (notif.read ? handleMarkUnread(notif.id) : handleMarkRead(notif.id))}
                            title={notif.read ? (nl ? "Als ongelezen" : "Mark unread") : (nl ? "Als gelezen" : "Mark read")}
                          >
                            {notif.read ? <Mail className="w-4 h-4" /> : <MailOpen className="w-4 h-4" />}
                            {notif.read ? (nl ? "Ongelezen" : "Unread") : (nl ? "Gelezen" : "Read")}
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => handleArchive(notif.id)}
                            title={nl ? "Archiveren" : "Archive"}
                          >
                            <Archive className="w-4 h-4" />
                            {nl ? "Archiveren" : "Archive"}
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="secondary"
                          onClick={() => handleRestore(notif.id)}
                          title={nl ? "Herstellen naar actief" : "Restore to active"}
                        >
                          <ArchiveRestore className="w-4 h-4" />
                          {nl ? "Herstellen" : "Restore"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* User-Specific Notification Preferences Modal */}
        <Dialog
          open={isPrefModalOpen}
          title={nl ? "Persoonlijke Meldingsvoorkeuren" : "Personal Notification Preferences"}
          description={
            nl
              ? "Stel in welke operationele meldingen voor uw account zichtbaar zijn."
              : "Configure which operational alerts are triggered for your account."
          }
          onClose={() => setIsPrefModalOpen(false)}
        >
          <div className="space-y-4 py-2">
            <label className="switch-row flex items-center justify-between p-2 rounded hover:bg-slate-500/10 cursor-pointer">
              <div>
                <div className="font-medium text-sm">
                  {nl ? "Te laat ingeleverde middelen" : "Overdue Loan Alerts"}
                </div>
                <div className="text-xs text-slate-500">
                  {nl ? "Meldingen wanneer uitgeleende apparatuur over de vervaldatum is." : "Alerts when borrowed items pass due date."}
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.loanReminders}
                onChange={(e) =>
                  savePreferences({ ...preferences, loanReminders: e.target.checked })
                }
              />
            </label>

            <label className="switch-row flex items-center justify-between p-2 rounded hover:bg-slate-500/10 cursor-pointer">
              <div>
                <div className="font-medium text-sm">
                  {nl ? "Periodiek onderhoud herinneringen" : "Periodic Maintenance Due"}
                </div>
                <div className="text-xs text-slate-500">
                  {nl ? "Waarschuwingen voor geplande inspecties en onderhoudsbeurten." : "Notices for inspection and service schedules."}
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.maintenanceAlerts}
                onChange={(e) =>
                  savePreferences({ ...preferences, maintenanceAlerts: e.target.checked })
                }
              />
            </label>

            <label className="switch-row flex items-center justify-between p-2 rounded hover:bg-slate-500/10 cursor-pointer">
              <div>
                <div className="font-medium text-sm">
                  {nl ? "Lage voorraad waarschuwingen" : "Low Stock Warnings"}
                </div>
                <div className="text-xs text-slate-500">
                  {nl ? "Melding zodra magazijnvoorraad onder de herbestelgrens valt." : "Trigger when inventory drops below safety threshold."}
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.inventoryWarnings}
                onChange={(e) =>
                  savePreferences({ ...preferences, inventoryWarnings: e.target.checked })
                }
              />
            </label>

            <label className="switch-row flex items-center justify-between p-2 rounded hover:bg-slate-500/10 cursor-pointer">
              <div>
                <div className="font-medium text-sm">
                  {nl ? "Apparaat & Netwerk Incidenten" : "Device & Telemetry Incidents"}
                </div>
                <div className="text-xs text-slate-500">
                  {nl ? "Meldingen over offline apparaten en afwijkende hardwaretelemetrie." : "Alerts for offline devices and compliance issues."}
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.deviceAlerts}
                onChange={(e) =>
                  savePreferences({ ...preferences, deviceAlerts: e.target.checked })
                }
              />
            </label>

            <label className="switch-row flex items-center justify-between p-2 rounded hover:bg-slate-500/10 cursor-pointer">
              <div>
                <div className="font-medium text-sm">
                  {nl ? "Beveiligings- & Auditgebeurtenissen" : "Security & Audit Events"}
                </div>
                <div className="text-xs text-slate-500">
                  {nl ? "Meldingen over ongeautoriseerde toegangspogingen en datamigraties." : "Audit trail alerts and sensitive access notifications."}
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.securityEvents}
                onChange={(e) =>
                  savePreferences({ ...preferences, securityEvents: e.target.checked })
                }
              />
            </label>

            <label className="switch-row flex items-center justify-between p-2 rounded hover:bg-slate-500/10 cursor-pointer">
              <div>
                <div className="font-medium text-sm">
                  {nl ? "E-mail samenvatting (Digest)" : "Email Notification Digest"}
                </div>
                <div className="text-xs text-slate-500">
                  {nl ? "Ontvang periodiek geconsolideerde meldingen per e-mail." : "Receive periodic email digest for critical events."}
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.emailDigest}
                onChange={(e) =>
                  savePreferences({ ...preferences, emailDigest: e.target.checked })
                }
              />
            </label>

            <div className="pt-4 flex justify-end">
              <Button onClick={() => setIsPrefModalOpen(false)}>
                {nl ? "Sluiten" : "Close"}
              </Button>
            </div>
          </div>
        </Dialog>
      </div>
    </OfflineGate>
  );
}
