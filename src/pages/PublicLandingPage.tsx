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
  Monitor,
  PackageOpen,
  Repeat2,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Tablet,
  Users,
  Warehouse,
  Wrench,
  X,
} from "lucide-react";
import { PwaInstallButton } from "../components/PwaStatus";
import { DownloadAppLink } from "../components/download/DownloadAppLink";
import { AimsDeviceShowcase } from "../components/public/AimsDevicePreviews";
import {
  aimsLandingCopy,
  featureContent,
  securityContent,
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
const deviceIcons = [Monitor, BarChart3, Tablet, Smartphone, ScanLine];
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
  ] as const;
  return (
    <div className="aims-public-page" data-theme="aimsAzureGlass">
      <a className="aims-skip-link" href="#main-content">
        {c.skip}
      </a>
      <header className="aims-public-header">
        <Link className="aims-brand" to="/" aria-label={`AIMS — ${c.brand}`}>
          <img className="aims-mark" src="/aims-logo-blue.png" alt="" />
          <span>
            <b>AIMS</b>
            <small>{c.brand}</small>
          </span>
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
          <DownloadAppLink className="aims-glossy-button">
            {language === "nl" ? "App downloaden" : "Download App"}
          </DownloadAppLink>
          <Link className="aims-glossy-button" to={action}>
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
              <h1>{c.heroTitle}</h1>
              <p className="aims-lead">{c.heroText}</p>
              <div className="aims-actions">
                <a className="aims-secondary-button" href="#features">
                  {c.explore}
                </a>
              </div>
            </div>
            <div className="aims-hero-visual" aria-hidden="true">
              <div className="aims-hero-orbit">
                <ShieldCheck />
                <img src="/aims-logo-blue.png" alt="" />
              </div>
            </div>
          </div>
        </section>
        <section
          className="aims-showcase-section"
          aria-labelledby="showcase-title"
        >
          <div className="aims-container">
            <header className="aims-section-heading">
              <h2 id="showcase-title">{c.showcaseTitle}</h2>
              <p>{c.showcaseText}</p>
            </header>
            <AimsDeviceShowcase language={language} />
          </div>
        </section>
        <section className="aims-section" id="features">
          <div className="aims-container">
            <header className="aims-section-heading">
              <h2>{c.featuresTitle}</h2>
              <p>{c.featuresText}</p>
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
              <h2>{c.workflowTitle}</h2>
              <p>{c.workflowText}</p>
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
              <h2>{c.securityTitle}</h2>
              <p>{c.securityText}</p>
            </header>
            <div className="aims-security-grid">
              {securityContent[language].map((title, index) => (
                <article key={title}>
                  <Icon as={securityIcons[index]} />
                  <h3>{title}</h3>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="aims-section aims-device-compatibility">
          <div className="aims-container aims-split">
            <div>
              <h2>{c.devicesTitle}</h2>
              <p>{c.devicesText}</p>
              <ul>
                {[
                  c.preview.desktop,
                  c.preview.laptop,
                  c.preview.tablet,
                  c.preview.mobile,
                  c.install,
                ].map((label, index) => (
                  <li key={label}>
                    <Icon as={deviceIcons[index]} />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="aims-pwa-card">
              <DownloadArtwork />
              <h3>{c.pwaTitle}</h3>
              <p>{c.pwaText}</p>
              <PwaInstallButton>{c.install}</PwaInstallButton>
            </div>
          </div>
        </section>
        <section className="aims-final-cta">
          <div className="aims-container">
            <div>
              <h2>{c.ctaTitle}</h2>
              <p>{c.ctaText}</p>
            </div>
          </div>
        </section>
      </main>
      <footer className="aims-footer">
        <div className="aims-container aims-footer-grid">
          <div className="aims-footer-brand">
            <div>
              <b>AIMS</b>
              <p>{c.brand}</p>
              <small>{c.tagline}</small>
            </div>
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
          </div>
          <div>
            <h2>{c.footerResources}</h2>
            <Link to="/support">{c.support}</Link>
            <span>{c.documentation}</span>
            <Link to="/privacy">{c.privacy}</Link>
            <Link to="/terms">{c.terms}</Link>
          </div>
          <div className="aims-footer-meta">
            <p>{c.authorized}</p>
            <p>{c.version}</p>
            <p>{c.presentation}</p>
          </div>
        </div>
        <div className="aims-footer-bottom aims-container">{c.copyright}</div>
      </footer>
    </div>
  );
}

function DownloadArtwork() {
  return (
    <div className="aims-pwa-art" aria-hidden="true">
      <Smartphone />
      <span>
        <ArrowRight />
      </span>
    </div>
  );
}
