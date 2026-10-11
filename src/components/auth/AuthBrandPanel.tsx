import {
  ClipboardCheck,
  ScanLine,
  School,
  ShieldCheck,
} from "lucide-react";
import { AimsPublicLockup } from "../branding/AimsPublicLockup";

interface AuthBrandPanelProps {
  language?: "nl" | "en";
}

export function AuthBrandPanel({ language = "nl" }: AuthBrandPanelProps) {
  const nl = language === "nl";

  return (
    <aside className="auth-brand" aria-label={nl ? "AIMS Identiteit en overzicht" : "AIMS Brand and overview"}>
      {/* Concentric curved radial arcs matching the reference image */}
      <div className="auth-brand-arcs" aria-hidden="true">
        <div className="auth-brand-arc auth-brand-arc--1" />
        <div className="auth-brand-arc auth-brand-arc--2" />
        <div className="auth-brand-arc auth-brand-arc--3" />
      </div>

      <div className="auth-brand-inner">
        {/* Brand Lockup at top */}
        <div className="auth-brand-top">
          <AimsPublicLockup />
        </div>

        {/* Supporting description */}
        <p className="auth-brand-lead">
          {nl
            ? "Volledig inzicht, verantwoordelijkheid en levenscyclusbeheer voor schoolmiddelen."
            : "Complete visibility, accountability, and lifecycle control for school assets."}
        </p>

        {/* 4 Feature items matching the reference image */}
        <ul className="auth-brand-features">
          <li className="auth-brand-feature">
            <span className="auth-brand-feature__icon-box">
              <ShieldCheck className="auth-brand-feature__icon" />
            </span>
            <div className="auth-brand-feature__text">
              <strong>{nl ? "Veilige accounttoegang" : "Secure account access"}</strong>
              <small>
                {nl
                  ? "Meerlaagse beveiliging om uw gegevens en middelen te beschermen."
                  : "Layered security to protect your data and assets."}
              </small>
            </div>
          </li>

          <li className="auth-brand-feature">
            <span className="auth-brand-feature__icon-box">
              <ClipboardCheck className="auth-brand-feature__icon" />
            </span>
            <div className="auth-brand-feature__text">
              <strong>{nl ? "Traceerbare inventarisprocessen" : "Traceable inventory workflows"}</strong>
              <small>
                {nl
                  ? "Realtime data en rapporten voor betere beslissingen."
                  : "Real-time data and reporting for better decisions."}
              </small>
            </div>
          </li>

          <li className="auth-brand-feature">
            <span className="auth-brand-feature__icon-box">
              <ScanLine className="auth-brand-feature__icon" />
            </span>
            <div className="auth-brand-feature__text">
              <strong>{nl ? "Mobiele controles en scans" : "Mobile audits and scanning"}</strong>
              <small>
                {nl
                  ? "Vereenvoudig verificaties en verminder handmatige taken."
                  : "Simplify verification and reduce manual work."}
              </small>
            </div>
          </li>

          <li className="auth-brand-feature">
            <span className="auth-brand-feature__icon-box">
              <School className="auth-brand-feature__icon" />
            </span>
            <div className="auth-brand-feature__text">
              <strong>St. Kangoeroe Community School</strong>
              <small>
                {nl
                  ? "Vertrouwd door scholen en organisaties."
                  : "Trusted by schools and organizations."}
              </small>
            </div>
          </li>
        </ul>
      </div>
    </aside>
  );
}
