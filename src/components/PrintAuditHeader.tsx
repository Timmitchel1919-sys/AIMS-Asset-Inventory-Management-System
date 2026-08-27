import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";

/** Shared audit header for every browser print and Save as PDF operation. */
export function PrintAuditHeader() {
  const { language, user, formatDateTime } = useApp();
  const [printedAt, setPrintedAt] = useState(() => new Date());

  useEffect(() => {
    const updatePrintMoment = () => setPrintedAt(new Date());
    window.addEventListener("beforeprint", updatePrintMoment);
    return () => window.removeEventListener("beforeprint", updatePrintMoment);
  }, []);

  const printedBy = user?.name || user?.email || (language === "nl" ? "Onbekende gebruiker" : "Unknown user");
  return (
    <header className="print-audit-header" aria-hidden="true">
      <div className="print-audit-brand print-audit-brand--aims">
        <img src="/aims-logo-blue.png" alt="" />
        <span><strong>AIMS</strong><small>Asset &amp; Inventory System</small></span>
      </div>
      <div className="print-audit-brand print-audit-brand--school">
        <span><strong>St. Kangoeroe Community School</strong><small>KCS</small></span>
        <img src="/kcs-school-logo.jpg" alt="" />
      </div>
      <p className="print-audit-meta">
        <strong>{language === "nl" ? "Afgedrukt door" : "Printed by"}:</strong> {printedBy}
        <span aria-hidden="true"> · </span>
        <strong>{language === "nl" ? "Datum en tijd" : "Date and time"}:</strong> {formatDateTime(printedAt)}
      </p>
    </header>
  );
}
