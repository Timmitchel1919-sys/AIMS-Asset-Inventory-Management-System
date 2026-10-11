import { Link } from "react-router-dom";
import { legalConfig } from "../../config/legal";

interface AuthFooterProps {
  language?: "nl" | "en";
}

export function AuthFooter({ language = "nl" }: AuthFooterProps) {
  const nl = language === "nl";

  return (
    <footer className="auth-footer" aria-label={nl ? "Voettekst en juridische informatie" : "Footer and legal information"}>
      <nav className="auth-footer__nav" aria-label={nl ? "Juridische en ondersteuningslinks" : "Legal and support links"}>
        <Link to="/terms" className="auth-footer__link">
          {nl ? "Algemene voorwaarden" : "Terms & Conditions"}
        </Link>
        <span className="auth-footer__dot" aria-hidden="true">•</span>
        <Link to="/privacy" className="auth-footer__link">
          {nl ? "Privacyverklaring" : "Privacy Notice"}
        </Link>
        <span className="auth-footer__dot" aria-hidden="true">•</span>
        <Link to="/support" className="auth-footer__link">
          {nl ? "ICT-ondersteuning" : "ICT Support"}
        </Link>
      </nav>
      <div className="auth-footer__credits">
        <p className="auth-footer__copyright">{legalConfig.copyright}</p>
        <p className="auth-footer__developer">{legalConfig.developerCredit}</p>
      </div>
    </footer>
  );
}
