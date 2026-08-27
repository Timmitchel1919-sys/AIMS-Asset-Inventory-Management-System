import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
} from "framer-motion";
import { ScanLine, ShieldCheck, Boxes } from "lucide-react";
import { aimsLandingCopy } from "../../content/aimsLanding";
import { OrbitItem } from "./OrbitItem";
import "./OrbitalHeroVisual.css";

type Language = "en" | "nl";

const ORBIT_DURATION_SECONDS = 20;

/**
 * Drives one continuous, linear 0→360deg loop as a single Framer Motion
 * value. Every orbiting item derives its counter-rotation from this same
 * value (see OrbitItem), so the orbit and every label's upright correction
 * are always perfectly in sync — pausing/resuming this one value pauses the
 * whole system without any drift between parts.
 */
function useOrbitRotation(paused: boolean) {
  const reduceMotion = useReducedMotion();
  const rotate = useMotionValue(0);
  const playbackRef = useRef<AnimationPlaybackControls | null>(null);

  useEffect(() => {
    if (reduceMotion) {
      rotate.set(0);
      return;
    }
    const controls = animate(rotate, [0, 360], {
      duration: ORBIT_DURATION_SECONDS,
      ease: "linear",
      repeat: Infinity,
    });
    playbackRef.current = controls;
    return () => controls.stop();
  }, [reduceMotion, rotate]);

  useEffect(() => {
    if (reduceMotion || !playbackRef.current) return;
    if (paused) playbackRef.current.pause();
    else playbackRef.current.play();
  }, [paused, reduceMotion]);

  return rotate;
}

type OrbitDefinition = { key: string; label: string; angle: number; icon: ReactNode };

export function OrbitalHeroVisual({ language }: { language: Language }) {
  const copy = aimsLandingCopy[language];
  const [hoverCount, setHoverCount] = useState(0);
  const isPaused = hoverCount > 0;
  const rotate = useOrbitRotation(isPaused);
  const counterRotate = useTransform(rotate, (v) => -v);
  const handleHoverChange = (hovered: boolean) =>
    setHoverCount((count) => Math.max(0, count + (hovered ? 1 : -1)));

  const items: OrbitDefinition[] = [
    { key: "scan", label: copy.orbitScan, angle: 0, icon: <ScanLine /> },
    { key: "assets", label: copy.orbitAssets, angle: 120, icon: <Boxes /> },
    { key: "secure", label: copy.orbitSecure, angle: 240, icon: <ShieldCheck /> },
  ];

  return (
    <div className="aims-orbital-hero" aria-label={copy.orbitVisualLabel}>
      <div className="aims-orbital-arcs" aria-hidden="true" />
      <div className="aims-orbital-ring aims-orbital-ring--inner" aria-hidden="true" />
      <div className="aims-orbital-ring aims-orbital-ring--middle" aria-hidden="true" />
      <div className="aims-orbital-ring aims-orbital-ring--outer" aria-hidden="true" />
      <div className="aims-orbital-logo">
        <img
          src="/aims-logo-transparent.png"
          alt="AIMS Asset & Inventory Management System"
        />
      </div>
      <motion.div className="aims-orbital-layer" style={{ rotate }}>
        {items.map((item) => (
          <OrbitItem
            key={item.key}
            label={item.label}
            icon={item.icon}
            angle={item.angle}
            counterRotate={counterRotate}
            onHoverChange={handleHoverChange}
          />
        ))}
      </motion.div>
    </div>
  );
}
