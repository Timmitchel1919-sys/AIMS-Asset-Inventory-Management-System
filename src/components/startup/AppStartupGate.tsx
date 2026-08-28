import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useApp } from "../../context/AppContext";
import {
  firebaseConfigured,
  missingFirebaseEnvironmentVariables,
} from "../../lib/firebase";
import { BrandedSplash } from "./BrandedSplash";
import "./AppStartupGate.css";

/**
 * Explicit product requirement: the AIMS branded splash stays visible for a
 * FIXED 10 seconds on every fresh app open / relaunch. It is never shortened by
 * a fast startup, and never replayed on internal navigation, login success or
 * logout — only a genuine app (re)load mounts this gate again.
 */
const SPLASH_DURATION = 10000;

type StartupState =
  | "initializing"
  | "authenticated"
  | "unauthenticated"
  | "error";

function StartupServiceWarning({ language }: { language: "en" | "nl" }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  const nl = language === "nl";
  return (
    <div className="aims-startup-warning" role="status" aria-live="polite">
      <p>
        {nl
          ? "Sommige AIMS-diensten konden niet worden geïnitialiseerd. Controleer je verbinding en probeer het opnieuw."
          : "Some AIMS services could not be initialized. Check your connection and try again."}
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={nl ? "Melding sluiten" : "Dismiss message"}
      >
        ×
      </button>
    </div>
  );
}

export function AppStartupGate({ children }: { children: ReactNode }) {
  const { authLoading, language, user } = useApp();
  const reducedMotion = useReducedMotion();
  const [splashComplete, setSplashComplete] = useState(false);

  // One authoritative startup timer, armed once when the app boots. No nested or
  // competing timers anywhere else.
  useEffect(() => {
    const timer = window.setTimeout(
      () => setSplashComplete(true),
      SPLASH_DURATION,
    );
    return () => window.clearTimeout(timer);
  }, []);

  // Firebase init, auth/session restore, and theme/language resolution all run
  // inside AppProvider while the splash is visible. We derive one centralised
  // StartupState continuously so the destination decision is ready before the
  // timer fires — never after. Routing itself is enforced by the router's auth
  // guards (this gate only owns the splash), so the state drives presentation.
  const firebaseUnavailable =
    !firebaseConfigured || missingFirebaseEnvironmentVariables.length > 0;
  const startupState: StartupState = authLoading
    ? "initializing"
    : user
      ? "authenticated"
      : firebaseUnavailable
        ? "error"
        : "unauthenticated";

  // At the 10s mark: if initialization failed, the router still routes to the
  // safe public shell; we add a non-blocking, non-technical warning. Security is
  // never bypassed — route guards remain authoritative.
  const initFailed = splashComplete && startupState === "error";
  const showSplash = !splashComplete;

  return (
    <>
      {/*
        Children mount and initialize during the splash. They are kept visually
        behind the opaque splash on a dark ground, then cross-faded in as the
        splash fades out — so there is never a white flash on reveal, for either
        the Landing or the Dashboard destination.
      */}
      <motion.div
        className="aims-startup-shell"
        aria-hidden={showSplash}
        initial={false}
        animate={{ opacity: showSplash ? 0 : 1 }}
        transition={{
          duration: showSplash ? 0 : reducedMotion ? 0.15 : 0.42,
          ease: "easeOut",
        }}
        style={{ visibility: showSplash ? "hidden" : "visible" }}
      >
        {children}
      </motion.div>

      <AnimatePresence>
        {showSplash && (
          <BrandedSplash key="aims-splash" language={language} />
        )}
      </AnimatePresence>

      {initFailed && <StartupServiceWarning language={language} />}
    </>
  );
}
