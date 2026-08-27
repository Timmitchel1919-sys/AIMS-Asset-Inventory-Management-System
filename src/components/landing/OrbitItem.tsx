import type { ReactNode } from "react";
import { motion, type MotionValue } from "framer-motion";

export type OrbitItemProps = {
  label: string;
  icon: ReactNode;
  /** Position on the orbit circle, in degrees. 0 = top, clockwise. */
  angle: number;
  /**
   * Live counter-rotation value (degrees) that exactly cancels the shared
   * orbit layer's current rotation, so this item's content always renders
   * upright regardless of where it sits on the circle.
   */
  counterRotate: MotionValue<number>;
  onHoverChange?: (hovered: boolean) => void;
};

/**
 * A single label that rides the shared orbit layer. The anchor is rotated to
 * `angle` and pushed out by `--orbit-radius`; the inner wrapper cancels that
 * static angle so only the live orbit motion remains, which `counterRotate`
 * (derived from the same motion value driving the orbit) then cancels too —
 * the chip itself never visually rotates, only its position on the ring does.
 */
export function OrbitItem({
  label,
  icon,
  angle,
  counterRotate,
  onHoverChange,
}: OrbitItemProps) {
  return (
    <div
      className="aims-orbital-anchor"
      style={{ transform: `rotate(${angle}deg) translateX(var(--orbit-radius))` }}
    >
      <div
        className="aims-orbital-counter-angle"
        style={{ transform: `rotate(${-angle}deg) translate(-50%, -50%)` }}
      >
        <motion.div
          className="aims-orbital-chip"
          style={{ rotate: counterRotate }}
          whileHover={{ scale: 1.04 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          onHoverStart={() => onHoverChange?.(true)}
          onHoverEnd={() => onHoverChange?.(false)}
        >
          <span className="aims-orbital-chip-icon" aria-hidden="true">
            {icon}
          </span>
          <span className="aims-orbital-chip-label">{label}</span>
        </motion.div>
      </div>
    </div>
  );
}
