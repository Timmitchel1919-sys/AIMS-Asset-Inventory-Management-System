import { useApp } from "../../context/AppContext";

/**
 * Shown on the public sign-in / sign-up pages when a sign-in succeeded at
 * Firebase but AIMS could not finish setting the session up. The user has been
 * signed out; this tells them why they are back at the form instead of
 * silently bouncing them. Overlaid (fixed), so the approved layout is unchanged.
 */
export function AuthErrorBanner() {
  const { authError, language } = useApp();
  if (!authError) return null;
  const nl = language === "nl";
  return (
    <div
      role="alert"
      className="notice error"
      style={{
        position: "fixed",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        maxWidth: "min(92vw, 520px)",
        textAlign: "center",
      }}
    >
      {nl
        ? "We konden uw sessie niet afronden. U bent uitgelogd. Probeer het opnieuw of neem contact op met ICT-support."
        : "We could not finish setting up your session. You have been signed out. Try again or contact ICT support."}
    </div>
  );
}
