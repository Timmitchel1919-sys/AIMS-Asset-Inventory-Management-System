/**
 * AIMS branded loading experience.
 *
 * Shown during application bootstrap (initial auth check, refresh, or right
 * after login) in place of the generic skeleton bars. Uses the official AIMS
 * logo, a rotating ring, and a rotating caption that reflects real
 * initialisation activities.
 */
import { useEffect, useMemo, useState } from "react";

export type AIMSBrandedLoaderProps = {
  /** Optional override; most callers let the component cycle its own. */
  statusMessages?: string[];
  /** Short pretty name shown under the logo. Defaults to "AIMS". */
  brand?: string;
  /** Primary heading. Defaults to "Loading AIMS data". */
  title?: string;
  /** Milliseconds between status cycles. Clamped to >=800. */
  interval?: number;
  /** If true, stop the ring/shimmer animations — for e2e snapshots. */
  freeze?: boolean;
};

const DEFAULT_STATUSES_EN = [
  "Verifying session…",
  "Authenticating user…",
  "Loading permissions…",
  "Loading configuration…",
  "Initialising navigation…",
  "Retrieving module data…",
  "Preparing your workspace…",
];
const DEFAULT_STATUSES_NL = [
  "Sessie verifiëren…",
  "Gebruiker authenticeren…",
  "Rechten laden…",
  "Configuratie laden…",
  "Navigatie initialiseren…",
  "Moduledata ophalen…",
  "Werkruimte voorbereiden…",
];

function detectLanguage(): "nl" | "en" {
  try {
    const stored = localStorage.getItem("aims.language");
    if (stored === "nl" || stored === "en") return stored;
  } catch {}
  return (navigator.language || "en").toLowerCase().startsWith("nl") ? "nl" : "en";
}

function detectLogo(): string {
  try {
    const theme = document.documentElement.getAttribute("data-aims-theme") || "";
    if (theme.toLowerCase().includes("emerald")) return "/aims-logo-green.png";
  } catch {}
  return "/aims-logo-blue.png";
}

export function AIMSBrandedLoader({
  statusMessages,
  brand = "AIMS",
  title,
  interval = 2200,
  freeze = false,
}: AIMSBrandedLoaderProps) {
  const lang = useMemo(detectLanguage, []);
  const logo = useMemo(detectLogo, []);
  const messages = useMemo(
    () =>
      statusMessages && statusMessages.length
        ? statusMessages
        : lang === "nl"
          ? DEFAULT_STATUSES_NL
          : DEFAULT_STATUSES_EN,
    [statusMessages, lang],
  );
  const heading = title || (lang === "nl" ? "AIMS-data laden" : "Loading AIMS data");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (freeze) return;
    const delay = Math.max(800, interval);
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, delay);
    return () => window.clearInterval(id);
  }, [messages.length, interval, freeze]);

  return (
    <div
      className={`aims-branded-loader${freeze ? " is-frozen" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={heading}
    >
      <div className="aims-branded-loader__stage">
        <div className="aims-branded-loader__ring" aria-hidden="true">
          <span className="aims-branded-loader__ring-arc" />
        </div>
        <img
          src={logo}
          alt=""
          className="aims-branded-loader__logo"
          aria-hidden="true"
          draggable={false}
        />
      </div>
      <div className="aims-branded-loader__brand">{brand}</div>
      <div className="aims-branded-loader__title">{heading}</div>
      <div className="aims-branded-loader__status" aria-live="polite">
        {messages[index]}
      </div>
    </div>
  );
}

export default AIMSBrandedLoader;
