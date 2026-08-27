import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { BrandedSplash } from "./BrandedSplash";

const PUBLIC_ENTRY_SEEN_KEY = "aims_public_entry_seen";

type PublicEntryState = "checking" | "gateway" | "ready";

function hasSeenPublicEntry() {
  try {
    return window.localStorage.getItem(PUBLIC_ENTRY_SEEN_KEY) === "true";
  } catch {
    return false;
  }
}

function rememberPublicEntry() {
  try {
    window.localStorage.setItem(PUBLIC_ENTRY_SEEN_KEY, "true");
  } catch {
    // Storage can be unavailable in restricted/private browser contexts.
  }
}

export function AppStartupGate({ children }: { children: ReactNode }) {
  const { authLoading, language, user } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [entryState, setEntryState] = useState<PublicEntryState>("checking");

  useEffect(() => {
    if (authLoading || entryState !== "checking") return;

    const query = new URLSearchParams(location.search);
    const forcedWelcome = location.pathname === "/welcome" || query.get("welcome") === "1";
    const publicRoot = location.pathname === "/";

    if (forcedWelcome) {
      setEntryState("gateway");
      return;
    }

    if (user) {
      rememberPublicEntry();
      if (publicRoot) navigate("/dashboard", { replace: true });
      setEntryState("ready");
      return;
    }

    if (!publicRoot) {
      setEntryState("ready");
      return;
    }

    if (hasSeenPublicEntry()) {
      navigate("/login", { replace: true });
      setEntryState("ready");
      return;
    }

    setEntryState("gateway");
  }, [authLoading, entryState, location.pathname, location.search, navigate, user]);

  function enterAims() {
    rememberPublicEntry();
    navigate("/", { replace: location.pathname === "/welcome" });
    setEntryState("ready");
  }

  const showOverlay = entryState !== "ready";

  return <>
    <motion.div
      aria-hidden={showOverlay}
      initial={false}
      animate={{ opacity: showOverlay ? 0 : 1, y: showOverlay ? 4 : 0 }}
      transition={{ duration: 0.38, ease: "easeOut" }}
      style={{ visibility: showOverlay ? "hidden" : "visible" }}
    >
      {children}
    </motion.div>
    <AnimatePresence mode="wait">
      {entryState === "checking" && (
        <BrandedSplash key="aims-session-check" language={language} mode="checking" />
      )}
      {entryState === "gateway" && (
        <BrandedSplash key="aims-public-gateway" language={language} mode="gateway" onEnter={enterAims} />
      )}
    </AnimatePresence>
  </>;
}
