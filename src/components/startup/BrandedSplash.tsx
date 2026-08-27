import { motion, useReducedMotion } from "framer-motion";
import { AimsWordmark } from "../branding/AimsWordmark";
import { SplashOrbit } from "./SplashOrbit";
import "./BrandedSplash.css";

type BrandedSplashProps = {
  language: "en" | "nl";
  mode: "checking" | "gateway";
  onEnter?: () => void;
};

export function BrandedSplash({ language, mode, onEnter }: BrandedSplashProps) {
  const reducedMotion = useReducedMotion();
  const gateway = mode === "gateway";
  const enterLabel = language === "nl" ? "AIMS openen" : "Enter AIMS";
  const helper = language === "nl"
    ? "Open de openbare AIMS-werkruimte"
    : "Open the AIMS public workspace";
  const enter = (delay: number) => reducedMotion
    ? { initial: false as const, animate: { opacity: 1 }, transition: { duration: 0 } }
    : { initial: { opacity: 0, scale: 0.97 }, animate: { opacity: 1, scale: 1 }, transition: { delay, duration: 0.48, ease: "easeOut" as const } };

  const brandedContent = <>
    <motion.div className="aims-splash-orbit-entrance" {...enter(0.12)}>
      <SplashOrbit logoSrc="/aims-logo-transparent.png" />
    </motion.div>
    <motion.div className="aims-splash-wordmark" {...enter(0.3)}>
      <AimsWordmark variant="splash" />
    </motion.div>
    {gateway && (
      <motion.span className="aims-splash-enter-copy" {...enter(0.55)}>
        <strong>{enterLabel}</strong>
        <small>{helper}</small>
      </motion.span>
    )}
  </>;

  return <motion.div
    className={`aims-branded-splash aims-branded-splash--${mode}`}
    initial={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: reducedMotion ? 0.12 : 0.4, ease: "easeOut" }}
    role={gateway ? undefined : "status"}
    aria-live={gateway ? undefined : "polite"}
    aria-label={gateway ? undefined : language === "nl" ? "AIMS-sessie wordt gecontroleerd" : "Checking AIMS session"}
  >
    <div className="aims-splash-content">
      {gateway ? (
        <motion.button
          type="button"
          className="aims-splash-entry-control"
          onClick={onEnter}
          aria-label={enterLabel}
          whileTap={reducedMotion ? undefined : { scale: 0.98 }}
        >
          {brandedContent}
        </motion.button>
      ) : (
        <div className="aims-splash-checking-content">
          {brandedContent}
          <motion.div className="aims-splash-loading" {...enter(0.7)}>
            <span className="aims-splash-spinner" aria-hidden="true" />
            <p>Secure workspace loading...</p>
          </motion.div>
        </div>
      )}
    </div>
    <div className="aims-splash-waves" aria-hidden="true"><span /><span /><span /></div>
  </motion.div>;
}
