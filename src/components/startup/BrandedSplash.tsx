import { motion, useReducedMotion } from "framer-motion";
import { AimsWordmark } from "../branding/AimsWordmark";
import { SplashOrbit } from "./SplashOrbit";
import "./BrandedSplash.css";

type BrandedSplashProps = {
  language: "en" | "nl";
};

/**
 * The approved AIMS branded splash. Fixed brand palette (independent of the
 * user theme), official logo, wordmark + subtitle, blue/cyan glow, bottom wave
 * pattern, Scannen / Middelen / Veilig orbital animation and a loading
 * indicator. Visible for a fixed 10s window owned by AppStartupGate — this
 * component only renders the branded frame and its entrance/exit.
 */
export function BrandedSplash({ language }: BrandedSplashProps) {
  const reducedMotion = useReducedMotion();
  const nl = language === "nl";
  const loadingLabel = nl
    ? "Beveiligde werkruimte laden..."
    : "Secure workspace loading...";
  const a11yLabel = nl
    ? "AIMS beveiligde werkruimte wordt geladen"
    : "Loading AIMS secure workspace";

  // Visual timeline (motion only — the 10s duration is fixed regardless):
  // 150ms logo, 350ms wordmark + subtitle, 650ms orbit items, 800ms loader.
  const enter = (delay: number) =>
    reducedMotion
      ? {
          initial: false as const,
          animate: { opacity: 1 },
          transition: { duration: 0 },
        }
      : {
          initial: { opacity: 0, scale: 0.97 },
          animate: { opacity: 1, scale: 1 },
          transition: { delay, duration: 0.48, ease: "easeOut" as const },
        };

  return (
    <motion.div
      className="aims-branded-splash"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.12 : 0.4, ease: "easeOut" }}
      role="status"
      aria-live="polite"
      aria-label={a11yLabel}
    >
      <div className="aims-splash-content">
        <div className="aims-splash-checking-content">
          <motion.div className="aims-splash-orbit-entrance" {...enter(0.15)}>
            <SplashOrbit
              logoSrc="/aims-logo-transparent.png"
              itemsDelay={reducedMotion ? 0 : 0.65}
            />
          </motion.div>
          <motion.div className="aims-splash-wordmark" {...enter(0.35)}>
            <AimsWordmark variant="splash" />
          </motion.div>
          <motion.div className="aims-splash-loading" {...enter(0.8)}>
            <span className="aims-splash-spinner" aria-hidden="true" />
            <p>{loadingLabel}</p>
          </motion.div>
        </div>
      </div>
      <div className="aims-splash-waves" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </motion.div>
  );
}
