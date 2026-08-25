import { useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  FileBarChart,
  Languages,
  LockKeyhole,
  Menu,
  PackageOpen,
  PlayCircle,
  Repeat2,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Users,
  Warehouse,
  Wrench,
  X,
} from "lucide-react";
import { DownloadAppLink } from "../components/download/DownloadAppLink";
import { AimsWordmark } from "../components/branding/AimsWordmark";
import { AimsDeviceShowcase } from "../components/public/AimsDevicePreviews";
import {
  aimsLandingCopy,
  featureContent,
  workflowContent,
} from "../content/aimsLanding";
import { useApp } from "../context/AppContext";
import "../styles/public-landing.css";

const featureIcons = [
  Boxes,
  Warehouse,
  Users,
  Repeat2,
  Wrench,
  ScanLine,
  ClipboardCheck,
  FileBarChart,
];
const workflowIcons = [
  PackageOpen,
  Users,
  Repeat2,
  Wrench,
  ClipboardCheck,
  BarChart3,
];
const securityIcons = [
  LockKeyhole,
  CheckCircle2,
  FileBarChart,
  Repeat2,
  ShieldCheck,
  ClipboardCheck,
];
function Icon({
  as: IconComponent,
}: {
  as: ComponentType<{ className?: string }>;
}) {
  return (
    <span className="aims-icon">
      <IconComponent />
    </span>
  );
}
export default function PublicLandingPage() {
  const app = useApp(),
    language = app.language,
    c = aimsLandingCopy[language],
    action = app.user ? "/dashboard" : "/login";
  const [menuOpen, setMenuOpen] = useState(false);
  const nav = [
    [c.nav.home, "#home"],
    [c.nav.features, "#features"],
    [c.nav.workflow, "#workflow"],
    [c.nav.security, "#security"],
    [c.nav.support, "/support"],
    [language === "nl" ? "Over ons" : "About us", "#about"],
  ] as const;
  return (
    <div className="aims-public-page">
      <a className="aims-skip-link" href="#main-content">
        {c.skip}
      </a>
      <header className="aims-public-header">
        <Link className="aims-brand" to="/" aria-label={`AIMS — ${c.brand}`}>
          <img className="aims-mark" src="/aims-logo-blue.png" alt="" />
          <AimsWordmark variant="header" />
        </Link>
        <nav
          id="public-navigation"
          className={menuOpen ? "is-open" : ""}
          aria-label="Public navigation"
        >
          <span className="aims-primary-navigation">
            {nav.map(([label, target]) =>
              target.startsWith("#") ? (
                <a key={label} href={target} onClick={() => setMenuOpen(false)}>
                  {label}
                </a>
              ) : (
                <Link
                  key={label}
                  to={target}
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </Link>
              ),
            )}
          </span>
        </nav>
        <span className="aims-header-actions">
          <label className="aims-language">
            <Languages />
            <span className="sr-only">{c.language}</span>
            <select
              aria-label={c.language}
              value={language}
              onChange={(event) =>
                app.setLanguage(event.target.value as "en" | "nl")
              }
            >
              <option value="en">EN</option>
              <option value="nl">NL</option>
            </select>
          </label>
          <DownloadAppLink className="aims-glossy-button aims-install-button">
            Download App
          </DownloadAppLink>
          <Link className="aims-glossy-button aims-signin-button" to={action}>
            {app.user ? c.open : c.signIn}
            <ArrowRight />
          </Link>
        </span>
        <button
          type="button"
          className="aims-menu-button"
          aria-label={menuOpen ? "Menu sluiten" : "Menu openen"}
          aria-expanded={menuOpen}
          aria-controls="public-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>
      <main id="main-content">
        <section className="aims-hero" id="home">
          <div className="aims-container aims-hero-grid">
            <div className="aims-hero-copy">
              <p className="aims-eyebrow">{c.heroEyebrow}</p>
              <h1>
                <span>{language === "nl" ? "Beheer elk middel." : "Manage every asset."}</span>
                <span className="aims-hero-highlight">{language === "nl" ? "Met duidelijkheid en verantwoordelijkheid." : "With clarity and accountability."}</span>
              </h1>
              <p className="aims-lead">{language === "nl" ? "AIMS helpt scholen en organisaties middelen gedurende hun volledige levenscyclus te volgen, beheren en beschermen — van aanschaf tot afvoer." : "AIMS helps schools and organizations track, manage, and protect assets across their entire lifecycle — from acquisition to disposal."}</p>
              <div className="aims-actions">
                <a className="aims-glossy-button" href="#features"><Boxes />{c.explore}</a>
                <a className="aims-secondary-button" href="#workflow"><PlayCircle />{c.watchHow}</a>
              </div>
              <ul className="aims-hero-trust" aria-label={language === "nl" ? "Belangrijkste voordelen" : "Key benefits"}>
                <li><CheckCircle2 />{language === "nl" ? "Centraal en nauwkeurig" : "Centralized & Accurate"}</li>
                <li><ShieldCheck />{language === "nl" ? "Veilig en conform" : "Secure & Compliant"}</li>
                <li><Smartphone />{language === "nl" ? "Overal toegang" : "Anywhere Access"}</li>
              </ul>
            </div>
            <div className="aims-hero-visual" aria-label={language === "nl" ? "AIMS-dashboard op laptop, tablet en mobiele telefoon" : "AIMS dashboard shown across laptop, tablet, and mobile devices"}>
              <div className="aims-hero-device-showcase">
                <AimsDeviceShowcase language={language} />
              </div>
            </div>
          </div>
        </section>
        <section className="aims-section" id="features">
          <div className="aims-container">
            <header className="aims-section-heading">
              <h2>{language === "nl" ? "Alles wat u nodig hebt, in één systeem" : "Everything you need, in one system"}</h2>
              <p>{language === "nl" ? "Acht verbonden modules voor controle over de volledige levenscyclus." : "Eight connected capabilities for complete lifecycle control."}</p>
            </header>
            <div className="aims-feature-grid">
              {featureContent[language].map(([title, text], index) => (
                <article key={title}>
                  <Icon as={featureIcons[index]} />
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="aims-section aims-section--mist" id="workflow">
          <div className="aims-container">
            <header className="aims-section-heading">
              <h2>{language === "nl" ? "Hoe AIMS werkt" : "How AIMS Works"}</h2>
              <p>{language === "nl" ? "Een eenvoudige workflow voor volledig beheer van de levenscyclus van middelen." : "A simple workflow for complete asset lifecycle management."}</p>
            </header>
            <ol className="aims-workflow">
              {workflowContent[language].map(([title, text], index) => (
                <li key={title}>
                  <span className="aims-step-number">{index + 1}</span>
                  <Icon as={workflowIcons[index]} />
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section className="aims-section aims-security-section" id="security">
          <div className="aims-container">
            <header className="aims-section-heading">
              <h2>{language === "nl" ? "Gebouwd voor moderne organisaties" : "Built for Modern Organizations"}</h2>
              <p>{language === "nl" ? "Krachtige functies die controle en vertrouwen versterken." : "Powerful features that drive control and confidence."}</p>
            </header>
            <div className="aims-security-grid">
              {[
                [language === "nl" ? "Rolgebaseerde toegang" : "Role-Based Access", language === "nl" ? "Geef iedere gebruiker precies de juiste bevoegdheden." : "Give every user exactly the permissions they need."],
                ["QR / Barcode Tracking", language === "nl" ? "Identificeer en controleer middelen direct." : "Identify and verify assets instantly."],
                [language === "nl" ? "Onderhoudshistorie" : "Maintenance History", language === "nl" ? "Bewaar service, reparaties en onderhoud op één plek." : "Keep service, repair and maintenance records together."],
                [language === "nl" ? "Slimme rapportage" : "Smart Reporting", language === "nl" ? "Zet actuele gegevens om in betrouwbare inzichten." : "Turn current records into reliable insight."],
                [language === "nl" ? "Mobiel gereed" : "Mobile Ready", language === "nl" ? "Werk veilig op desktop, tablet en telefoon." : "Work securely across desktop, tablet and phone."],
                ["PWA Installable", language === "nl" ? "Installeer AIMS rechtstreeks op ondersteunde apparaten." : "Install AIMS directly on supported devices."],
              ].map(([title, text], index) => (
                <article key={title}>
                  <Icon as={securityIcons[index]} />
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="aims-final-cta" id="about">
          <div className="aims-container">
            <div>
              <h2>{language === "nl" ? "Klaar om duidelijkheid en controle in uw middelen te brengen?" : "Ready to bring clarity and control to your assets?"}</h2>
              <p>{language === "nl" ? "Sluit u aan bij scholen en organisaties die AIMS vertrouwen voor verantwoordelijk middelenbeheer." : "Join schools and organizations that trust AIMS for accountable asset management."}</p>
            </div>
            <div className="aims-actions">
              <Link className="aims-glossy-button" to={action}>{language === "nl" ? "Vandaag beginnen" : "Get Started Today"}<ArrowRight /></Link>
              <DownloadAppLink className="aims-secondary-button">{language === "nl" ? "App installeren" : "Install App"}</DownloadAppLink>
            </div>
          </div>
        </section>
      </main>
      <footer className="aims-footer">
        <div className="aims-container aims-footer-grid">
          <div className="aims-footer-brand">
            <img className="aims-mark" src="/aims-logo-blue.png" alt="" />
            <div><b>AIMS</b><p>{c.brand}</p><small>{language === "nl" ? "Een modern middelen- en voorraadbeheersysteem voor scholen en organisaties die waarde hechten aan duidelijkheid, controle en verantwoordelijkheid." : "A modern asset and inventory management system built for schools and organizations that value clarity, control and accountability."}</small></div>
          </div>
          <div>
            <h2>{c.footerProduct}</h2>
            <DownloadAppLink
              className="aims-footer-download-link"
              showIcon={false}
            >
              {language === "nl" ? "App downloaden" : "Download App"}
            </DownloadAppLink>
            <a href="#features">{c.nav.features}</a>
            <a href="#workflow">{c.nav.workflow}</a>
            <a href="#security">{c.nav.security}</a>
            <span>{language === "nl" ? "Prijzen" : "Pricing"}</span>
          </div>
          <div>
            <h2>{c.footerResources}</h2>
            <Link to="/support">{c.support}</Link>
            <span>{c.documentation}</span>
            <Link to="/privacy">{c.privacy}</Link>
            <Link to="/terms">{c.terms}</Link>
            <span>{language === "nl" ? "Handleidingen" : "Guides"}</span>
            <span>{language === "nl" ? "Release-opmerkingen" : "Release Notes"}</span>
          </div>
          <div>
            <h2>{language === "nl" ? "Bedrijf" : "Company"}</h2>
            <a href="#about">{language === "nl" ? "Over ons" : "About Us"}</a>
            <Link to="/privacy">{c.privacy}</Link>
            <Link to="/terms">{c.terms}</Link>
          </div>
          <div>
            <h2>{language === "nl" ? "Blijf verbonden" : "Stay Connected"}</h2>
            <Link to="/support">{language === "nl" ? "Helpcentrum" : "Help Center"}</Link>
            <Link to="/support">{language === "nl" ? "Contact opnemen" : "Contact Support"}</Link>
            <form className="aims-footer-subscribe" onSubmit={(event) => event.preventDefault()}>
              <label className="sr-only" htmlFor="aims-footer-email">Email</label>
              <input id="aims-footer-email" type="email" placeholder={language === "nl" ? "Uw e-mailadres" : "Your email address"} />
              <button type="submit" aria-label={language === "nl" ? "Aanmelden voor updates" : "Subscribe for updates"}><ArrowRight /></button>
            </form>
          </div>
        </div>
        <div className="aims-footer-bottom aims-container">{c.copyright}</div>
      </footer>
    </div>
  );
}

