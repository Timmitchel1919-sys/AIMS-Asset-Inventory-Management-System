import { useApp } from "../../context/AppContext";
import {
  AIMS_LOGO_ALT,
  resolveAimsLogoSrc,
  type AimsLogoPlacement,
} from "../../branding/aimsLogo";

type Props = {
  /**
   * Where the logo lives. `sidebar` is the only placement that turns green
   * under the Green theme; every other placement stays blue. Defaults to
   * `primary`.
   */
  placement?: AimsLogoPlacement;
  className?: string;
  /**
   * Pass `decorative` when the same branding is already announced by an
   * adjacent element (e.g. a wordmark), so screen readers don't repeat it.
   * Meaningful instances get the full AIMS alt text.
   */
  decorative?: boolean;
  width?: number | string;
  height?: number | string;
};

/**
 * The centralised AIMS logo. Renders the official artwork straight from
 * `src/branding/aimsLogo.ts` — no recolouring, cropping or CSS-drawn marks.
 */
export function AimsLogo({
  placement = "primary",
  className,
  decorative = false,
  width,
  height,
}: Props) {
  const { effectiveTheme } = useApp();
  return (
    <img
      className={className}
      src={resolveAimsLogoSrc(placement, effectiveTheme)}
      alt={decorative ? "" : AIMS_LOGO_ALT}
      width={width}
      height={height}
      decoding="async"
      draggable={false}
      data-aims-logo={placement}
    />
  );
}
