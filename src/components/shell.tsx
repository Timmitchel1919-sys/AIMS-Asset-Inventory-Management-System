import {
  Activity,
  Archive,
  BarChart3,
  Bell,
  Bot,
  Boxes,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FolderTree,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Mic,
  PackageOpen,
  User,
  PanelLeftClose,
  Recycle,
  RotateCcw,
  Search,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  ToolCase,
  Users,
  Warehouse,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useApp } from "../context/AppContext";
import { can } from "../auth/permissions";
import { matchRoute, navRoutes, type RouteIcon } from "../routes/manifest";
import { useT } from "../i18n";
import { PwaStatus } from "./PwaStatus";
import { useMockSnapshot, useRepository } from "../data/repositoryContext";
import { GlobalSearch } from "./search/GlobalSearch";
import { AimsLogo } from "./branding/AimsLogo";

type VoiceRecognition = {
  lang: string;
  interimResults: boolean;
  start: () => void;
  onresult?: (event: {
    results: { [index: number]: { [index: number]: { transcript: string } } };
  }) => void;
  onend?: () => void;
  onerror?: () => void;
};
type VoiceRecognitionConstructor = new () => VoiceRecognition;

const icons: Record<RouteIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  assets: Boxes,
  inventory: Warehouse,
  categories: FolderTree,
  locations: MapPin,
  departments: Building2,
  assignments: Archive,
  borrow: RotateCcw,
  forms: ClipboardList,
  repairs: Wrench,
  maintenance: ToolCase,
  movements: PackageOpen,
  audits: ClipboardCheck,
  reports: BarChart3,
  notifications: Bell,
  assistant: Bot,
  users: Users,
  admin: Shield,
  roles: ShieldCheck,
  activity: Activity,
  disposals: Recycle,
  settings: Settings,
  install: PackageOpen,
};

const sidebarRouteAliases: Record<string, string[]> = {
  reports: ["/management"],
  admin: ["/users", "/roles", "/permissions", "/activity"],
  "admin-settings": ["/settings"],
};
const sidebarModuleOrder = [
  "dashboard", "assets", "inventory", "categories", "locations",
  "departments", "users", "assignments", "borrows", "service-forms",
  "repairs", "maintenance", "movements", "audits", "reports",
  "disposals", "settings", "assistant",
] as const;
const routeBase = (path: string) =>
  path.replace(/\/\*$/, "").replace(/\/$/, "") || "/";
const pathBelongsTo = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);
export function isSidebarRouteActive(
  pathname: string,
  route: Pick<(typeof navRoutes)[number], "id" | "path">,
  visibleRoutes: ReadonlyArray<Pick<(typeof navRoutes)[number], "id" | "path">>,
): boolean {
  const candidates = visibleRoutes.flatMap((item) => [
    routeBase(item.path),
    ...(sidebarRouteAliases[item.id] ?? []).map(routeBase),
  ]);
  const matches = [
    routeBase(route.path),
    ...(sidebarRouteAliases[route.id] ?? []).map(routeBase),
  ].filter((base) => pathBelongsTo(pathname, base));
  if (!matches.length) return false;
  const best = candidates
    .filter((base) => pathBelongsTo(pathname, base))
    .sort((a, b) => b.length - a.length)[0];
  return matches.includes(best);
}

export function AppShell({ children }: { children: ReactNode }) {
  const app = useApp(),
    t = useT(),
    location = useLocation(),
    navigate = useNavigate(),
    snapshot = useMockSnapshot(),
    repository = useRepository();
  const sidebarRef = useRef<HTMLElement>(null),
    accountMenuRef = useRef<HTMLDivElement>(null),
    accountButtonRef = useRef<HTMLButtonElement>(null),
    mobileSearchRef = useRef<HTMLDivElement>(null),
    [activeNotchTop, setActiveNotchTop] = useState<number | null>(null);
  const presentationMode = import.meta.env.VITE_APP_MODE === "presentation";
  const [assistantOpen, setAssistantOpen] = useState(false),
    [assistantQuery, setAssistantQuery] = useState(""),
    [listening, setListening] = useState(false),
    [voiceStatus, setVoiceStatus] = useState(""),
    [profileOpen, setProfileOpen] = useState(false),
    [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  useEffect(() => {
    if (!profileOpen) return;
    const close = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node))
        setProfileOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
        accountButtonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [profileOpen]);
  useEffect(() => {
    if (!mobileSearchOpen) return;
    const close = (event: MouseEvent) => {
      if (!mobileSearchRef.current?.contains(event.target as Node))
        setMobileSearchOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileSearchOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [mobileSearchOpen]);
  useEffect(() => {
    const task = window.setTimeout(() => setMobileSearchOpen(false), 0);
    return () => window.clearTimeout(task);
  }, [location.pathname]);
  const [assistantMessages, setAssistantMessages] = useState<
    { who: "bot" | "you"; text: string }[]
  >([
    {
      who: "bot",
      text:
        app.language === "nl"
          ? "Waarmee kan ik helpen?"
          : "How can I help with your inventory?",
    },
  ]);
  const current = matchRoute(location.pathname);
  useLayoutEffect(() => {
    const sidebar = sidebarRef.current,
      nav = sidebar?.querySelector("nav");
    if (!sidebar || !nav) return;
    const update = () => {
      const active = nav.querySelector<HTMLElement>(
        '.navigation-item[aria-current="page"]',
      );
      if (!active) {
        setActiveNotchTop(null);
        return;
      }
      const sidebarBox = sidebar.getBoundingClientRect(),
        activeBox = active.getBoundingClientRect();
      setActiveNotchTop(activeBox.top - sidebarBox.top + activeBox.height / 2);
    };
    update();
    nav.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      nav.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [location.pathname, app.sidebarCollapsed, app.mobileOpen]);
  if (!app.user) return null;
  // Keep the complete module catalog visible in the sidebar. Route guards still
  // enforce role permissions after a module is selected.
  const routes = navRoutes;
  const primaryRoutes = sidebarModuleOrder.flatMap((id) => {
    const route = routes.find((candidate) => candidate.id === id);
    return route ? [route] : [];
  });
  const assistantEnabled = routes.some((route) => route.id === "assistant");
  const bottomNavLabelKeys: Record<string, string> = {
    dashboard: "nav.dashboard",
    assets: "nav.assetsShort",
    inventory: "nav.inventory",
    audits: "nav.auditsShort",
    notifications: "nav.notificationsShort",
  };
  const unreadNotificationCount = snapshot.notifications.filter(
    (notification) => !notification.read && !notification.dismissed,
  ).length;
  function askAssistant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = assistantQuery.trim();
    if (!value) return;
    const lower = value.toLowerCase();
    let response: string;
    if (
      (lower.includes("repair") || lower.includes("repar")) &&
      can(app.user?.role, "repairs.manage")
    )
      response =
        app.language === "nl"
          ? `${snapshot.repairs.length} reparatierecords zijn beschikbaar.`
          : `${snapshot.repairs.length} repair records are available.`;
    else if (
      (lower.includes("stock") || lower.includes("voorraad")) &&
      can(app.user?.role, "inventory.view")
    )
      response =
        app.language === "nl"
          ? `${snapshot.inventory.filter((item) => item.onHand - item.reserved < item.minimum).length} artikelen hebben lage voorraad.`
          : `${snapshot.inventory.filter((item) => item.onHand - item.reserved < item.minimum).length} items have low stock.`;
    else
      response =
        app.language === "nl"
          ? "De gevraagde gegevens zijn niet beschikbaar voor uw rol of in de huidige mockdataset."
          : "The requested data is unavailable for your role or in the current mock dataset.";
    setAssistantMessages((messages) => [
      ...messages,
      { who: "you", text: value },
      { who: "bot", text: response },
    ]);
    setAssistantQuery("");
  }
  function startVoiceInput() {
    const voiceWindow = window as typeof window & {
      SpeechRecognition?: VoiceRecognitionConstructor;
      webkitSpeechRecognition?: VoiceRecognitionConstructor;
    };
    const Recognition =
      voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceStatus(
        app.language === "nl"
          ? "Spraakinvoer wordt niet ondersteund in deze browser."
          : "Voice input is not supported in this browser.",
      );
      return;
    }
    const recognition = new Recognition();
    recognition.lang = app.language === "nl" ? "nl-NL" : "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      setAssistantQuery(event.results[0][0].transcript);
      setVoiceStatus(
        app.language === "nl" ? "Spraak vastgelegd." : "Voice captured.",
      );
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setVoiceStatus(
        app.language === "nl"
          ? "Spraak kon niet worden herkend."
          : "Voice could not be recognized.",
      );
    };
    setVoiceStatus(app.language === "nl" ? "Luisteren…" : "Listening…");
    setListening(true);
    recognition.start();
  }
  return (
    <div className={`app ${app.sidebarCollapsed ? "collapsed" : ""}`}>
      <a className="skip-link" href="#main-content">
        {app.language === "nl" ? "Naar hoofdinhoud" : "Skip to main content"}
      </a>
      {app.mobileOpen && (
        <button
          className="scrim"
          aria-label={t("common.closeNavigation")}
          onClick={() => app.setMobileOpen(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        id="app-primary-navigation"
        className={`sidebar app-sidebar ${app.sidebarCollapsed ? "app-sidebar--collapsed" : ""} ${app.mobileOpen ? "open" : ""}`}
        aria-label={t("common.primaryNavigation")}
      >
        <header className="brand app-sidebar__header">
          <button
            type="button"
            className={`brand-mark app-sidebar__logo-button ${app.sidebarCollapsed ? "brand-expand" : ""}`}
            aria-label={
              app.mobileOpen
                ? t("common.closeNavigation")
                : app.sidebarCollapsed
                  ? "Expand sidebar"
                  : "AIMS Asset & Inventory Management System"
            }
            title={
              app.mobileOpen
                ? t("common.closeNavigation")
                : app.sidebarCollapsed
                  ? "Expand sidebar"
                  : "AIMS Asset & Inventory Management System"
            }
            aria-expanded={app.mobileOpen ? true : !app.sidebarCollapsed}
            aria-controls="app-primary-navigation"
            onClick={() => {
              if (app.mobileOpen) {
                app.setMobileOpen(false);
                return;
              }
              if (app.sidebarCollapsed) app.setSidebarCollapsed(false);
            }}
          >
            <AimsLogo context="authenticated" surface="dark" alt="" />
          </button>
          <div className="brand-copy app-sidebar__brand-text">
            <strong>AIMS</strong>
            <span>Asset &amp; Inventory System</span>
          </div>
          {!app.sidebarCollapsed && (
            <button
              type="button"
              className="sidebar-collapse-button app-sidebar__collapse-button"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              aria-expanded="true"
              onClick={() => app.setSidebarCollapsed(true)}
            >
              <PanelLeftClose aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className="mobile-close"
            aria-label={t("common.closeNavigation")}
            onClick={() => app.setMobileOpen(false)}
          >
            <X />
          </button>
        </header>
        <nav>
          {primaryRoutes.map((route) => {
            const Icon = icons[route.icon!],
              label = t(route.navKey!),
              active = isSidebarRouteActive(
                location.pathname,
                route,
                primaryRoutes,
              );
            return (
              <span className="sidebar-route" key={route.id}>
                <Link
                  className={`navigation-item${active ? " active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  data-module-id={route.id}
                  to={routeBase(route.path)}
                  title={app.sidebarCollapsed ? label : undefined}
                  aria-label={app.sidebarCollapsed ? label : undefined}
                  onClick={() => app.setMobileOpen(false)}
                >
                  <span className="navigation-item__icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="navigation-item__label">{label}</span>
                  {route.id === "notifications" &&
                    unreadNotificationCount > 0 && (
                      <b className="nav-count">{unreadNotificationCount}</b>
                    )}
                </Link>
              </span>
            );
          })}
        </nav>
        {activeNotchTop !== null && (
          <span
            className="app-sidebar__active-notch"
            style={{ top: activeNotchTop }}
            aria-hidden="true"
          />
        )}
      </aside>
      <header className="topbar">
        <button
          type="button"
          className="topbar-logo-trigger"
          aria-label={
            app.mobileOpen
              ? t("common.closeNavigation")
              : t("common.openNavigation")
          }
          aria-expanded={app.mobileOpen}
          aria-controls="app-primary-navigation"
          onClick={() => {
            setMobileSearchOpen(false);
            app.setMobileOpen(!app.mobileOpen);
          }}
        >
          <Menu className="topbar-menu-trigger__icon" aria-hidden="true" />
        </button>
        <div
          className="topbar-search"
          data-expanded={mobileSearchOpen}
          ref={mobileSearchRef}
        >
          <GlobalSearch autoFocus={mobileSearchOpen} />
          {mobileSearchOpen && (
            <button
              type="button"
              className="topbar-search-close"
              aria-label={t("common.closeSearch")}
              onClick={() => setMobileSearchOpen(false)}
            >
              <X aria-hidden="true" />
            </button>
          )}
        </div>
        {!mobileSearchOpen && (
          <button
            type="button"
            className="topbar-search-trigger"
            aria-label={t("common.openSearch")}
            onClick={() => {
              app.setMobileOpen(false);
              setMobileSearchOpen(true);
            }}
          >
            <Search aria-hidden="true" />
          </button>
        )}
        <div className="top-actions">
          <button
            className="top-notifications"
            aria-label={`${t("nav.notifications")}: ${unreadNotificationCount}`}
            onClick={() => navigate("/notifications")}
          >
            <Bell />
            {unreadNotificationCount > 0 && (
              <span>{unreadNotificationCount}</span>
            )}
          </button>
          <div className="profile-menu-wrap" ref={accountMenuRef}>
            <button
              ref={accountButtonRef}
              className="top-user"
              aria-label={
                app.language === "nl"
                  ? "Accountmenu openen"
                  : "Open account menu"
              }
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              aria-controls="account-menu"
              onClick={() => setProfileOpen((value) => !value)}
            >
              {app.user.profilePhoto ? (
                <img
                  className="avatar avatar-photo"
                  src={app.user.profilePhoto}
                  alt=""
                />
              ) : (
                <span className="avatar">{app.user.initials}</span>
              )}
              <ChevronDown aria-hidden="true" />
            </button>
            {profileOpen && (
              <>
                <button
                  className="account-sheet-scrim"
                  aria-label={app.language === "nl" ? "Accountmenu sluiten" : "Close account menu"}
                  onClick={() => setProfileOpen(false)}
                />
                <div id="account-menu" className="profile-menu" role="menu">
                  <span className="account-sheet-handle" aria-hidden="true" />
                  <header>
                    <span className="account-menu-avatar">
                      {app.user.profilePhoto ? (
                        <img src={app.user.profilePhoto} alt="" />
                      ) : (
                        app.user.initials
                      )}
                    </span>
                    <div>
                      <strong>{app.user.name}</strong>
                      <small>{app.user.isDemoUser ? (app.language === "nl" ? "Demosessie" : "Demo session") : app.user.email}</small>
                      {(app.user.jobTitle || app.user.department) && (
                        <small>
                          {[app.user.jobTitle, app.user.department]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      )}
                    </div>
                  </header>
                  <div className="account-menu-links">
                    <button
                      role="menuitem"
                      onClick={() => {
                        navigate("/profile");
                        setProfileOpen(false);
                      }}
                    >
                      <User />
                      {app.language === "nl" ? "Mijn profiel" : "My Profile"}
                      <ChevronRight />
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => {
                        navigate("/preferences");
                        setProfileOpen(false);
                      }}
                    >
                      <Settings />
                      {app.language === "nl" ? "Voorkeuren" : "Preferences"}
                      <ChevronRight />
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => {
                        navigate("/security");
                        setProfileOpen(false);
                      }}
                    >
                      <Shield />
                      {app.language === "nl" ? "Beveiliging" : "Security"}
                      <ChevronRight />
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => {
                        navigate("/help");
                        setProfileOpen(false);
                      }}
                    >
                      <ShieldCheck />
                      {app.language === "nl" ? "Help en ondersteuning" : "Help & Support"}
                      <ChevronRight />
                    </button>
                  </div>
                  <button
                    className="account-signout"
                    role="menuitem"
                    onClick={async () => {
                      setProfileOpen(false);
                      await app.logout();
                      navigate("/", { replace: true });
                    }}
                  >
                    <LogOut />
                    {app.language === "nl" ? "Afmelden" : "Sign out"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="main" id="main-content" tabIndex={-1}>
        {presentationMode && (
          <section
            className="presentation-strip"
            aria-label={
              app.language === "nl"
                ? "Presentatieomgeving"
                : "Presentation environment"
            }
          >
            <div>
              <strong>
                {app.language === "nl"
                  ? "Presentatieomgeving"
                  : "Presentation environment"}
              </strong>
              <span>
                {app.language === "nl"
                  ? "Fictieve demonstratiegegevens · gesimuleerde authenticatie · geen permanente database"
                  : "Fictional demonstration data · simulated authentication · no permanent database"}
              </span>
            </div>
            <div className="presentation-account">
              <span>
                {app.language === "nl" ? "Demo-account" : "Demo account"}
              </span>
              <select
                aria-label={
                  app.language === "nl" ? "Demo-account" : "Demo account"
                }
                value={app.user.role}
                onChange={(event) =>
                  app.login(event.target.value as typeof app.user.role, false)
                }
              >
                <option value="administrator">Administrator</option>
                <option value="warehouse-manager">Inventory Manager</option>
                <option value="ict-staff">Technician</option>
                <option value="auditor">Auditor</option>
                <option value="management">Department Manager</option>
                <option value="warehouse-staff">Read-only demonstration</option>
              </select>
            </div>
            <button
              className="btn secondary"
              onClick={() => {
                if (
                  confirm(
                    app.language === "nl"
                      ? "Herstel de exacte demonstratiegegevens?"
                      : "Restore the exact demonstration dataset?",
                  )
                )
                  repository.reset();
              }}
            >
              <RotateCcw />
              {app.language === "nl" ? "Demo resetten" : "Reset demo data"}
            </button>
          </section>
        )}
        <div className="breadcrumb">
          <ChevronLeft size={14} />
          <span>
            {current
              ? t(current.titleKey)
              : "AIMS Asset & Inventory Management System"}
          </span>
        </div>
        <PwaStatus />
        {children}
        {location.pathname.startsWith("/assistant") && (
          <p className="assistant-privacy-notice">
            {app.language === "nl"
              ? "Voer geen wachtwoorden, authenticatiecodes of zeer gevoelige persoonsgegevens in."
              : "Do not enter passwords, authentication codes, or highly sensitive personal information."}{" "}
            <a href="/privacy">
              {app.language === "nl" ? "Privacyverklaring" : "Privacy Notice"}
            </a>
          </p>
        )}
      </main>
      <nav className="bottom-nav" aria-label={t("common.mobileNavigation")}>
        {routes
          .filter((route) => route.id in bottomNavLabelKeys)
          .map((route) => {
            const Icon = icons[route.icon!],
              isNotifications = route.id === "notifications",
              label = t(bottomNavLabelKeys[route.id]);
            return (
              <NavLink
                key={route.id}
                to={routeBase(route.path)}
                aria-label={
                  isNotifications && unreadNotificationCount > 0
                    ? `${label}, ${unreadNotificationCount} ${t("common.unread")}`
                    : undefined
                }
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
                {isNotifications && unreadNotificationCount > 0 && (
                  <b className="nav-count" aria-hidden="true">
                    {unreadNotificationCount}
                  </b>
                )}
              </NavLink>
            );
          })}
      </nav>
      {assistantEnabled && assistantOpen && (
        <div className="floating-assistant open">
          {assistantOpen && (
            <section
              className="assistant-panel"
              aria-label={t("nav.assistant")}
            >
              <header>
                <span>
                  <Bot />
                  {t("nav.assistant")}
                </span>
                <button
                  aria-label={
                    app.language === "nl"
                      ? "Assistent sluiten"
                      : "Close assistant"
                  }
                  onClick={() => setAssistantOpen(false)}
                >
                  <X />
                </button>
              </header>
              <div className="assistant-panel-chat" aria-live="polite">
                {assistantMessages.map((message, index) => (
                  <div
                    key={index}
                    className={`assistant-panel-message ${message.who}`}
                  >
                    {message.text}
                  </div>
                ))}
              </div>
              {voiceStatus && (
                <small className="voice-status">{voiceStatus}</small>
              )}
              <form onSubmit={askAssistant}>
                <input
                  value={assistantQuery}
                  onChange={(event) => setAssistantQuery(event.target.value)}
                  placeholder={
                    app.language === "nl"
                      ? "Stel een vraag…"
                      : "Ask a question…"
                  }
                />
                <button
                  type="button"
                  className={listening ? "listening" : ""}
                  aria-label={
                    app.language === "nl" ? "Spraakinvoer" : "Voice input"
                  }
                  title={app.language === "nl" ? "Spraakinvoer" : "Voice input"}
                  onClick={startVoiceInput}
                >
                  <Mic />
                </button>
                <button
                  type="submit"
                  aria-label={app.language === "nl" ? "Versturen" : "Send"}
                >
                  <Send />
                </button>
              </form>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
