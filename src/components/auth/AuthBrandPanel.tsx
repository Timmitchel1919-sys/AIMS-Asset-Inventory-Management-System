import {
  Boxes,
  CheckCircle2,
  Laptop,
  QrCode,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { AimsPublicLockup } from "../branding/AimsPublicLockup";

interface AuthBrandPanelProps {
  language?: "nl" | "en";
}

export function AuthBrandPanel({ language = "nl" }: AuthBrandPanelProps) {
  const nl = language === "nl";

  return (
    <aside className="auth-brand" aria-label={nl ? "AIMS Identiteit en overzicht" : "AIMS Brand and overview"}>
      <div className="auth-brand-inner">
        {/* Top brand header */}
        <div className="auth-brand-top">
          <AimsPublicLockup inverse />
        </div>

        {/* Visual showcase with preview UI cards inspired by reference */}
        <div className="auth-showcase-visual" aria-hidden="true">
          {/* Background ambient glow circles */}
          <div className="auth-showcase-glow" />

          {/* Card 1: Asset & Inventory Overview (Top card) */}
          <div className="auth-preview-card auth-preview-card--metrics">
            <div className="auth-preview-card__header">
              <div className="auth-preview-card__title-group">
                <Boxes className="auth-preview-card__icon" />
                <span className="auth-preview-card__title">
                  {nl ? "Middelenoverzicht" : "Asset Overview"}
                </span>
              </div>
              <span className="auth-preview-badge auth-preview-badge--live">
                <span className="auth-preview-badge__dot" />
                {nl ? "Realtime" : "Live"}
              </span>
            </div>
            <div className="auth-preview-metrics">
              <div className="auth-preview-metric">
                <strong className="auth-preview-metric__value">1.482</strong>
                <span className="auth-preview-metric__label">{nl ? "Totaal geregistreerd" : "Total registered"}</span>
              </div>
              <div className="auth-preview-pills">
                <span className="auth-metric-pill auth-metric-pill--success">
                  <span className="auth-metric-pill__dot" />
                  {nl ? "94% Inzetbaar" : "94% Available"}
                </span>
                <span className="auth-metric-pill auth-metric-pill--primary">
                  <span className="auth-metric-pill__dot" />
                  {nl ? "128 In bruikleen" : "128 On loan"}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Recent Device Assignment (Middle floating card) */}
          <div className="auth-preview-card auth-preview-card--item">
            <div className="auth-preview-card__header">
              <div className="auth-preview-card__title-group">
                <Laptop className="auth-preview-card__icon" />
                <div>
                  <span className="auth-preview-card__title">Lenovo ThinkPad L14 Gen 4</span>
                  <span className="auth-preview-card__subtitle">AST-2026-084</span>
                </div>
              </div>
              <span className="auth-preview-badge auth-preview-badge--verified">
                <CheckCircle2 className="auth-preview-badge__icon" />
                {nl ? "Gekoppeld" : "Assigned"}
              </span>
            </div>
            <div className="auth-preview-item-footer">
              <span className="auth-preview-item-loc">{nl ? "IT-Beheerder • Lokaal 2.04" : "IT Staff • Room 2.04"}</span>
              <span className="auth-preview-item-status">{nl ? "Geverifieerd" : "Verified"}</span>
            </div>
          </div>

          {/* Card 3: Quick Audit & Traceability (Lower card) */}
          <div className="auth-preview-card auth-preview-card--audit">
            <div className="auth-preview-card__header">
              <div className="auth-preview-card__title-group">
                <QrCode className="auth-preview-card__icon" />
                <div>
                  <span className="auth-preview-card__title">
                    {nl ? "Snelle QR-Verificatie" : "Fast QR Verification"}
                  </span>
                  <span className="auth-preview-card__subtitle">
                    {nl ? "100% Traceerbaar" : "100% Traceable"}
                  </span>
                </div>
              </div>
              <span className="auth-preview-badge auth-preview-badge--audit">
                <ShieldCheck className="auth-preview-badge__icon" />
                {nl ? "Beveiligd" : "Secure"}
              </span>
            </div>
          </div>
        </div>

        {/* Hero headline and supporting copy */}
        <div className="auth-brand-bottom">
          <div className="auth-brand-emblem" aria-hidden="true">
            <TrendingUp />
          </div>
          <h2 className="auth-brand-headline">
            {nl
              ? "Eén centrale hub voor slim inventaris- en middelenbeheer"
              : "A Unified Hub for Smarter Asset & Inventory Management"}
          </h2>
          <p className="auth-brand-description">
            {nl
              ? "AIMS biedt St. Kangoeroe Community School realtime inzicht, betrouwbare verantwoording en volledige levenscycluscontrole."
              : "AIMS provides St. Kangoeroe Community School with real-time insight, reliable accountability, and complete lifecycle control."}
          </p>

          {/* Pagination indicator dots like in reference image */}
          <div className="auth-showcase-pagination" aria-hidden="true">
            <span className="auth-pagination-bar auth-pagination-bar--active" />
            <span className="auth-pagination-bar" />
            <span className="auth-pagination-bar" />
            <span className="auth-pagination-bar" />
          </div>
        </div>
      </div>
    </aside>
  );
}
