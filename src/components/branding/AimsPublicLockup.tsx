import "./AimsPublicLockup.css";

export function AimsPublicLockup({ inverse = false }: { inverse?: boolean }) {
  return (
    <span
      className={`aims-public-lockup${inverse ? " aims-public-lockup--inverse" : ""}`}
      role="img"
      aria-label="AIMS Asset & Inventory Management System"
    >
      <img src="/aims-logo-transparent.png" alt="" />
      <span className="aims-public-lockup__copy" aria-hidden="true">
        <strong>AIMS</strong>
          <small>Asset &amp; Inventory Management System</small>
      </span>
    </span>
  );
}
