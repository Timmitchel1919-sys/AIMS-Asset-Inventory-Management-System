import "./AimsWordmark.css";

type AimsWordmarkVariant = "header" | "auth" | "splash" | "compact";

export function AimsWordmark({
  variant = "header",
  className = "",
}: {
  variant?: AimsWordmarkVariant;
  className?: string;
}) {
  return (
    <span
      className={`brand-wordmark brand-wordmark--${variant} ${className}`.trim()}
      role="img"
      aria-label="AIMS Asset & Inventory Management System"
    >
      <span className="brand-wordmark__letters" aria-hidden="true">
        <svg className="brand-wordmark__a" viewBox="0 0 72 64" focusable="false">
          <path d="M7 58 33 7c1.2-2.4 4.6-2.4 5.8 0L65 58" />
          <circle cx="36" cy="36" r="4" />
        </svg>
        <span>I</span><span>M</span><span>S</span>
      </span>
      <span className="brand-wordmark__subtitle" aria-hidden="true">
        <span className="brand-wordmark__subtitle-line">ASSET &amp; INVENTORY</span>{" "}
        <span className="brand-wordmark__subtitle-line">MANAGEMENT SYSTEM</span>
      </span>
    </span>
  );
}
