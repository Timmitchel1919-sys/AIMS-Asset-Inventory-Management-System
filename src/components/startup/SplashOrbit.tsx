import { useEffect, type ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { Boxes, ScanLine, ShieldCheck } from "lucide-react";

type Item = { label: string; angle: number; icon: ReactNode };

function SplashOrbitItem({ item, counterRotate }: { item: Item; counterRotate: ReturnType<typeof useTransform<number, number>> }) {
  return <div className="aims-splash-orbit-anchor" style={{ transform: `rotate(${item.angle}deg) translateX(var(--splash-orbit-radius))` }}><div className="aims-splash-orbit-angle" style={{ transform: `rotate(${-item.angle}deg) translate(-50%,-50%)` }}><motion.span className="aims-splash-orbit-chip" style={{ rotate: counterRotate }}><span aria-hidden="true">{item.icon}</span><span>{item.label}</span></motion.span></div></div>;
}

export function SplashOrbit({ logoSrc }: { logoSrc: string }) {
  const reducedMotion = useReducedMotion();
  const rotate = useMotionValue(0);
  const counterRotate = useTransform(rotate, value => -value);
  useEffect(() => {
    if (reducedMotion) { rotate.set(0); return; }
    const controls = animate(rotate, [0, 360], { duration: 20, ease: "linear", repeat: Infinity });
    return () => controls.stop();
  }, [reducedMotion, rotate]);
  const items: Item[] = [
    { label: "Scannen", angle: 0, icon: <ScanLine /> },
    { label: "Middelen", angle: 120, icon: <Boxes /> },
    { label: "Veilig", angle: 240, icon: <ShieldCheck /> },
  ];
  return <div className="aims-splash-orbit">
    <span className="aims-splash-ring aims-splash-ring--outer" aria-hidden="true" /><span className="aims-splash-ring aims-splash-ring--middle" aria-hidden="true" /><span className="aims-splash-ring aims-splash-ring--inner" aria-hidden="true" />
    <div className="aims-splash-logo"><img src={logoSrc} alt="AIMS Asset & Inventory Management System" /></div>
    <motion.div className="aims-splash-orbit-layer" style={{ rotate }} aria-hidden="true">{items.map(item => <SplashOrbitItem key={item.label} item={item} counterRotate={counterRotate} />)}</motion.div>
  </div>;
}
