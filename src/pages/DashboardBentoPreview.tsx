import { useApp } from "../context/AppContext";
import { BentoDashboard } from "../components/dashboard/bento/BentoDashboard";

/**
 * Dev-only preview route for the Dark Bento Dashboard.
 *
 * As of Phase 3A the Bento Dashboard is also integrated into the live
 * `/dashboard` route when the Midnight / Dark Theme is active, but this
 * preview route stays mounted for continued design iteration and remains
 * owner-only + dev-only via the route guard in `routes/manifest.tsx` plus
 * the dev-mode check below.
 *
 * The theme-gate screen is preserved so a reviewer who lands here on a
 * different theme sees a deliberate "Switch to Midnight / Dark" invitation,
 * exactly as before. The Bento content itself is now the same component the
 * live Dashboard mounts, so what you see here is literally what shipped.
 */
export default function DashboardBentoPreview() {
  const { language, effectiveTheme, setTheme } = useApp();
  const nl = language === "nl";
  const isProd = !import.meta.env.DEV;
  const onDark = effectiveTheme === "dark";

  if (isProd) {
    return (
      <div className="page">
        <div className="bento-theme-gate" role="status">
          <h2>{nl ? "Preview niet beschikbaar" : "Preview unavailable"}</h2>
          <p>
            {nl
              ? "Deze Dark Bento preview is alleen beschikbaar in de ontwikkelomgeving."
              : "This Dark Bento preview is only available in the development environment."}
          </p>
        </div>
      </div>
    );
  }

  if (!onDark) {
    return (
      <div className="page">
        <div className="bento-theme-gate" role="status">
          <h2>
            {nl ? "Schakel naar Midnight / Dark" : "Switch to Midnight / Dark"}
          </h2>
          <p>
            {nl
              ? "De Dark Bento preview is gereserveerd voor het Midnight / Dark thema zodat je ontwerp consistent blijft."
              : "The Dark Bento preview is reserved for the Midnight / Dark theme to keep the design consistent."}
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => setTheme("dark")}
          >
            {nl ? "Schakel naar Midnight / Dark" : "Switch to Midnight / Dark"}
          </button>
        </div>
      </div>
    );
  }

  return <BentoDashboard />;
}
