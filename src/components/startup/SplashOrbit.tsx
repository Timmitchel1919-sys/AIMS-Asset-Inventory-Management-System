import { useEffect, type ReactNode } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { Boxes, ScanLine, ShieldCheck } from "lucide-react";

type Item = { label: string; angle: number; icon: ReactNode };

function SplashOrbitItem({
  item,
  counterRotate,
}: {
  item: Item;
  counterRotate: ReturnType<typeof useTransform<number, number>>;
}) {
  return (
    <div
      className="aims-splash-orbit-anchor"
      style={{
        transform: `rotate(${item.angle}deg) translateX(var(--splash-orbit-radius))`,
      }}
    >
      <div
        className="aims-splash-orbit-angle"
        style={{ transform: `rotate(${-item.angle}deg) translate(-50%,-50%)` }}
      >
        {/* The outer orbit adds +360°/14s; this chip subtracts -360°/14s so the
            pill/text/icon stay upright while travelling the orbital track. */}
        <motion.span
          className="aims-splash-orbit-chip"
          style={{ rotate: counterRotate }}
        >
          <span aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
        </motion.span>
      </div>
    </div>
  );
}

export function SplashOrbit({
  logoSrc,
  itemsDelay = 0,
}: {
  logoSrc: string;
  itemsDelay?: number;
}) {
  const reducedMotion = useReducedMotion();
  const rotate = useMotionValue(0);
  const counterRotate = useTransform(rotate, (value) => -value);
  useEffect(() => {
    if (reducedMotion) {
      rotate.set(0);
      return;
    }
    // One revolution every 14s — constant angular velocity (linear), infinite,
    // clockwise. 0deg and 360deg are identical, so the loop is seamless.
    const controls = animate(rotate, [0, 360], {
      duration: 14,
      ease: "linear",
      repeat: Infinity,
    });
    return () => controls.stop();
  }, [reducedMotion, rotate]);
  // ~120° apart, orbiting the stationary AIMS logo.
  const items: Item[] = [
    { label: "Scannen", angle: 0, icon: <ScanLine /> },
    { label: "Middelen", angle: 120, icon: <Boxes /> },
    { label: "Veilig", angle: 240, icon: <ShieldCheck /> },
  ];
  return (
    <div className="aims-splash-orbit">
      <span
        className="aims-splash-ring aims-splash-ring--outer"
        aria-hidden="true"
      />
      <span
        className="aims-splash-ring aims-splash-ring--middle"
        aria-hidden="true"
      />
      <span
        className="aims-splash-ring aims-splash-ring--inner"
        aria-hidden="true"
      />
      <div className="aims-splash-logo">
        <img src={logoSrc} alt="AIMS Asset & Inventory Management System" />
      </div>
      <motion.div
        className="aims-splash-orbit-layer"
        style={{ rotate }}
        aria-hidden="true"
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: itemsDelay, duration: 0.5, ease: "easeOut" }}
      >
        {items.map((item) => (
          <SplashOrbitItem
            key={item.label}
            item={item}
            counterRotate={counterRotate}
          />
        ))}
      </motion.div>
    </div>
  );
}
