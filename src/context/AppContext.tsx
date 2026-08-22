import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { Role, ThemeId, User } from "../domain/types";
import { normalizeTheme } from "../domain/rules";
import {
  applyKcsTheme,
  getStoredKcsTheme,
  persistAuthenticatedTheme,
  PUBLIC_AIMS_THEME,
} from "../lib/kcs-theme";
import { firebaseAuth } from "../lib/firebase";
import {
  demoLogin as firebaseDemoLogin,
  ensureAimsUserProfile,
  ensureDemoUserProfile,
  loadProfile,
  login as firebaseLogin,
  logout as firebaseLogout,
  savePreferences,
  type UserPreferences,
} from "../auth/firebaseAuth";
import {
  DEMO_AUTH_MODE,
  canFirebaseUserAccess,
  isVerificationRequired,
} from "../auth/aimsEmailPolicy";
import { AIMS_BOOTSTRAP_ADMIN_UID } from "../auth/accessBootstrap";

const demoUsers: Record<Role, User> = {
  administrator: {
    id: "u1",
    name: "Naomi Williams",
    email: "admin@kcs.example",
    role: "administrator",
    department: "ICT",
    initials: "NW",
  },
  "ict-manager": {
    id: "u2",
    name: "Michael King",
    email: "ict-manager@kcs.example",
    role: "ict-manager",
    department: "ICT",
    initials: "MK",
  },
  "warehouse-manager": {
    id: "u3",
    name: "Rita James",
    email: "inventory@kcs.example",
    role: "warehouse-manager",
    department: "Warehouse",
    initials: "RJ",
  },
  "ict-staff": {
    id: "u4",
    name: "Joseph Lewis",
    email: "joseph.lewis@kangoeroeschool.com",
    role: "ict-staff",
    department: "ICT",
    initials: "JL",
    status: "Active",
  },
  "warehouse-staff": {
    id: "u5",
    name: "Claire Wilson",
    email: "readonly@kcs.example",
    role: "warehouse-staff",
    department: "Warehouse",
    initials: "CW",
  },
  management: {
    id: "u6",
    name: "Daniel Moore",
    email: "manager@kcs.example",
    role: "management",
    department: "Management",
    initials: "DM",
  },
  auditor: {
    id: "u7",
    name: "Alex Auditor",
    email: "auditor@kcs.example",
    role: "auditor",
    department: "Audit",
    initials: "AA",
  },
};
const validRoles = new Set<Role>(Object.keys(demoUsers) as Role[]);
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "AU";
type Ctx = {
  user: User | null;
  authLoading: boolean;
  emailVerified: boolean;
  accessDenied: boolean;
  preferences: UserPreferences;
  updatePreferences: (value: UserPreferences) => Promise<void>;
  login: (
    identity?: Role | string,
    remember?: boolean,
    password?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfilePhoto: (photo: string) => void;
  removeProfilePhoto: () => void;
  theme: ThemeId;
  effectiveTheme: ThemeId;
  setTheme: (t: ThemeId) => void;
  setThemeRoute: (pathname: string) => void;
  language: "en" | "nl";
  setLanguage: (l: "en" | "nl") => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
};
const AppContext = createContext<Ctx | null>(null);
const isPublicThemePath = (pathname: string) =>
  /^\/(?:$|login\/?$|signup\/?$|register\/?$|verify-email\/?$|forgot-password\/?$|reset-password\/?$|terms\/?$|privacy\/?$|support\/?$|download\/?$)/.test(
    pathname,
  );
export function AppProvider({ children }: { children: ReactNode }) {
  const presentationMode = import.meta.env.VITE_APP_MODE === "presentation";
  const [user, setUser] = useState<User | null>(() => {
    if (!presentationMode) return null;
    if (localStorage.getItem("kcs-auth") === "out") return null;
    const storedRole = localStorage.getItem("kcs-role") as Role | null;
    return (storedRole && demoUsers[storedRole]) || demoUsers["ict-staff"];
  });
  const [emailVerified, setEmailVerified] = useState(presentationMode);
  const [accessDenied, setAccessDenied] = useState(false);
  const [authLoading, setAuthLoading] = useState(
    !presentationMode && Boolean(firebaseAuth),
  );
  const [theme, setThemeState] = useState<ThemeId>(() => getStoredKcsTheme());
  const [publicPath, setPublicPath] = useState(() =>
    isPublicThemePath(
      typeof window === "undefined" ? "/" : window.location.pathname,
    ),
  );
  const [language, setLanguageState] = useState<"en" | "nl">(
    () => (localStorage.getItem("kcs-language") as "en" | "nl") || "en",
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("kcs-sidebar-collapsed") === "true",
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>(() => ({
    dateFormat:
      (localStorage.getItem(
        "aims-date-format",
      ) as UserPreferences["dateFormat"]) || "DD-MM-YYYY",
    timeFormat:
      (localStorage.getItem(
        "aims-time-format",
      ) as UserPreferences["timeFormat"]) || "24-hour",
    notifications: {
      maintenance: true,
      borrowing: true,
      assignments: true,
      system: true,
      email: false,
    },
  }));
  const mapFirebaseUser = useCallback(
    async (firebaseUser: NonNullable<typeof firebaseAuth>["currentUser"]) => {
      if (!firebaseUser) {
        setUser(null);
        setEmailVerified(false);
        return;
      }
      const demoUser = DEMO_AUTH_MODE && firebaseUser.isAnonymous;
      if (!canFirebaseUserAccess(firebaseUser)) {
        setAccessDenied(true);
        await firebaseLogout();
        setUser(null);
        setEmailVerified(false);
        return;
      }
      setAccessDenied(false);
      const canProvision =
        demoUser || !isVerificationRequired() || firebaseUser.emailVerified;
      const profile = demoUser
        ? await ensureDemoUserProfile(firebaseUser)
        : canProvision
          ? await ensureAimsUserProfile(firebaseUser)
          : await loadProfile(firebaseUser);
      const tokenRole = demoUser
        ? undefined
        : (await firebaseUser.getIdTokenResult(true)).claims.role;
       const role = firebaseUser.uid === AIMS_BOOTSTRAP_ADMIN_UID
         ? "administrator"
         : DEMO_AUTH_MODE
        ? "ict-staff"
        : validRoles.has(tokenRole as Role)
          ? (tokenRole as Role)
          : validRoles.has(profile.role as Role)
          ? (profile.role as Role)
          : "warehouse-staff";
      const created =
        profile.createdAt &&
        typeof profile.createdAt === "object" &&
        "toDate" in profile.createdAt
          ? String(
              (profile.createdAt as { toDate: () => Date })
                .toDate()
                .toISOString(),
            )
          : undefined;
      setUser({
        id: profile.uid,
        name: profile.fullName,
        email: profile.email || "",
        role,
        department: profile.department || "",
        jobTitle: profile.jobTitle,
        accountType: profile.accountType,
        authProvider: profile.authProvider,
        isDemoUser: profile.isDemoUser,
        accountCreatedAt: created,
        initials: initials(profile.fullName),
        status: "Active",
        profilePhoto:
          localStorage.getItem(`aims-profile-photo:${profile.uid}`) ||
          undefined,
      });
      setEmailVerified(canProvision);
      if (profile.preferences) {
        setPreferences((current) => ({ ...current, ...profile.preferences }));
        if (profile.preferences.theme) {
          const next = normalizeTheme(profile.preferences.theme as ThemeId);
          setThemeState(next);
          persistAuthenticatedTheme(next);
        }
        if (profile.preferences.language) {
          setLanguageState(profile.preferences.language);
          localStorage.setItem("kcs-language", profile.preferences.language);
        }
      }
    },
    [],
  );
  useEffect(() => {
    if (presentationMode || !firebaseAuth) return;
    return onAuthStateChanged(firebaseAuth, async (current) => {
      try {
        await mapFirebaseUser(current);
      } catch (error) {
        if (import.meta.env.DEV)
          console.error("AIMS auth-state provisioning failed:", error);
      } finally {
        setAuthLoading(false);
      }
    });
  }, [presentationMode, mapFirebaseUser]);
  const effectiveTheme = publicPath && !user ? PUBLIC_AIMS_THEME : theme;
  useEffect(() => applyKcsTheme(effectiveTheme, false), [effectiveTheme]);
  useEffect(() => {
    localStorage.setItem("kcs-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);
  const value = useMemo<Ctx>(
    () => ({
      user,
      authLoading,
      emailVerified,
      accessDenied,
      preferences,
      updatePreferences: async (next) => {
        const merged = {
          ...preferences,
          ...next,
          notifications: {
            ...preferences.notifications,
            ...next.notifications,
          },
        };
        setPreferences(merged);
        if (merged.dateFormat)
          localStorage.setItem("aims-date-format", merged.dateFormat);
        if (merged.timeFormat)
          localStorage.setItem("aims-time-format", merged.timeFormat);
        if (!presentationMode) await savePreferences(merged);
      },
      login: async (
        identity: Role | string = "ict-staff",
        remember = true,
        password = "",
      ) => {
        setAccessDenied(false);
        if (presentationMode) {
          const role = (
            identity.includes("@") ? "ict-staff" : identity
          ) as Role;
          setUser(demoUsers[role] || demoUsers["ict-staff"]);
          localStorage.setItem("kcs-auth", "in");
          localStorage.setItem("kcs-role", role);
          setEmailVerified(true);
          return;
        }
        if (DEMO_AUTH_MODE) {
          const credential = await firebaseDemoLogin();
          await mapFirebaseUser(credential.user);
          return;
        }
        await firebaseLogin(identity, password, remember);
      },
      logout: async () => {
        setAccessDenied(false);
        if (presentationMode) {
          setUser(null);
          localStorage.setItem("kcs-auth", "out");
          return;
        }
        await firebaseLogout();
      },
      refreshUser: async () => {
        if (firebaseAuth?.currentUser)
          await mapFirebaseUser(firebaseAuth.currentUser);
      },
      updateProfilePhoto: (photo: string) =>
        setUser((current) => {
          if (!current) return current;
          localStorage.setItem(`aims-profile-photo:${current.id}`, photo);
          return { ...current, profilePhoto: photo };
        }),
      removeProfilePhoto: () =>
        setUser((current) => {
          if (!current) return current;
          localStorage.removeItem(`aims-profile-photo:${current.id}`);
          return { ...current, profilePhoto: undefined };
        }),
      theme,
      effectiveTheme,
      setTheme: (next: ThemeId) => {
        const normalized = normalizeTheme(next);
        setThemeState(normalized);
        persistAuthenticatedTheme(normalized);
      },
      setThemeRoute: (pathname: string) =>
        setPublicPath(isPublicThemePath(pathname)),
      language,
      setLanguage: (l: "en" | "nl") => {
        setLanguageState(l);
        localStorage.setItem("kcs-language", l);
      },
      sidebarCollapsed,
      setSidebarCollapsed,
      mobileOpen,
      setMobileOpen,
    }),
    [
      user,
      authLoading,
      emailVerified,
      accessDenied,
      preferences,
      presentationMode,
      mapFirebaseUser,
      theme,
      effectiveTheme,
      language,
      sidebarCollapsed,
      mobileOpen,
    ],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export const useApp = () => {
  const c = useContext(AppContext);
  if (!c) throw new Error("AppProvider missing");
  return c;
};
