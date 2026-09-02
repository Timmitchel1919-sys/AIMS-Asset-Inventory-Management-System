import { useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  FileBarChart,
  History,
  Languages,
  LockKeyhole,
  Menu,
  PackageCheck,
  PackageOpen,
  PlayCircle,
  Repeat2,
  ScanLine,
  ShieldCheck,
  Smartphone,
  TabletSmartphone,
  Users,
  Warehouse,
  Wrench,
  X,
} from "lucide-react";
import { DownloadAppLink } from "../components/download/DownloadAppLink";
import { AimsPublicLockup } from "../components/branding/AimsPublicLockup";
import { AimsDeviceShowcase } from "../components/public/AimsDevicePreviews";
import { OrbitalHeroVisual } from "../components/landing/OrbitalHeroVisual";
import {
  aimsLandingCopy,
  featureContent,
  workflowContent,
} from "../content/aimsLanding";
import { useApp } from "../context/AppContext";
import "../styles/public-landing.css";

type Language = "en" | "nl";
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
  History,
  Repeat2,
  ShieldCheck,
  ClipboardCheck,
];
function Icon({ as: Glyph }: { as: ComponentType<{ className?: string }> }) {
  return (
    <span className="aims-icon">
      <Glyph />
    </span>
  );
}
function Brand({ inverse = false }: { inverse?: boolean }) {
  return <AimsPublicLockup inverse={inverse} />;
}
function SectionHeading({
  title,
  subtitle,
  inverse = false,
}: {
  title: string;
  subtitle: string;
  inverse?: boolean;
}) {
  return (
    <header className={`aims-section-heading${inverse ? " is-inverse" : ""}`}>
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </header>
  );
}
function pageCopy(language: Language) {
  const nl = language === "nl";
  return {
    heroTitle: nl ? "Beheer elk middel" : "Manage every asset",
    heroAccent: nl
      ? "met duidelijkheid en verantwoordelijkheid"
      : "with clarity and accountability",
    heroBody: nl
      ? "AIMS helpt scholen en organisaties om middelen gedurende hun volledige levenscyclus te registreren, beheren en beschermen — van aanschaf tot afvoer."
      : "AIMS helps schools and organizations register, manage, and protect assets across their entire lifecycle — from acquisition to disposal.",
    modulesTitle: nl
      ? "Kernmodules voor de volledige levenscyclus van middelen"
      : "Core modules for the complete asset lifecycle",
    modulesSub: nl
      ? "Gestructureerde hulpmiddelen verbinden het dagelijkse middelenbeheer met betrouwbaar toezicht."
      : "Structured tools connect daily asset work with reliable oversight.",
    worksSub: nl
      ? "Een duidelijk, traceerbaar pad van registratie tot managementrapportage."
      : "A clear, traceable path from registration to management reporting.",
    securityTitle: nl
      ? "Veiligheid en verantwoordelijkheid, standaard ingebouwd"
      : "Security and accountability, built in",
    securitySub: nl
      ? "Bescherm gegevens, bewaak bevoegdheden en houd elke belangrijke handeling aantoonbaar."
      : "Protect records, control permissions, and keep every important action traceable.",
    installTitle: nl
      ? "AIMS werkt waar uw team werkt"
      : "AIMS works wherever your team works",
    installBody: nl
      ? "Gebruik AIMS in een ondersteunde browser of installeer de Progressive Web App voor snellere toegang op compatibele apparaten."
      : "Use AIMS from a supported browser or install the Progressive Web App for faster access on compatible devices.",
    installCard: nl
      ? "Installeer AIMS op dit apparaat"
      : "Install AIMS on this device",
    installCardBody: nl
      ? "Start AIMS vanaf uw beginscherm met dezelfde responsieve browserervaring."
      : "Launch AIMS from your home screen with the same responsive browser experience.",
    finalTitle: nl
      ? "Breng duidelijkheid in elk middel"
      : "Bring clarity to every asset",
    finalBody: nl
      ? "Open de AIMS-presentatiewerkruimte of meld u aan om verder te gaan."
      : "Open the AIMS presentation workspace or sign in to continue.",
  };
}

export default function PublicLandingPage() {
  const app = useApp(),
    language = app.language,
    c = aimsLandingCopy[language],
    p = pageCopy(language),
    action = app.user ? "/dashboard" : "/login";
  const [menuOpen, setMenuOpen] = useState(false);
  const nav = [
    [c.nav.home, "#home"],
    [c.nav.features, "#features"],
    [c.nav.workflow, "#workflow"],
    [c.nav.security, "#security"],
    ["Help", "/support"],
  ] as const;
  const security =
    language === "nl"
      ? [
          [
            "Rolgebaseerde toegang",
            "Geef iedere gebruiker precies de juiste bevoegdheden.",
          ],
          [
            "Gecontroleerde goedkeuringen",
            "Laat belangrijke acties de juiste controle doorlopen.",
          ],
          ["Activiteitenhistorie", "Bekijk wie wat deed en wanneer."],
          [
            "Traceerbare verplaatsingen",
            "Volg overdrachten en locaties van begin tot eind.",
          ],
          [
            "Beschermde registraties",
            "Houd essentiële gegevens veilig en consistent.",
          ],
          [
            "Auditklare workflows",
            "Werk met aantoonbare processen en betrouwbare rapportages.",
          ],
        ]
      : [
          [
            "Role-based access",
            "Give every user exactly the permissions they need.",
          ],
          [
            "Controlled approvals",
            "Route important actions through the right checks.",
          ],
          ["Activity history", "See who did what and when."],
          [
            "Traceable movements",
            "Follow transfers and locations from end to end.",
          ],
          [
            "Protected records",
            "Keep essential information safe and consistent.",
          ],
          [
            "Audit-ready workflows",
            "Operate with demonstrable processes and reliable reporting.",
          ],
        ];
  return (
    <div className="aims-public-page aims-public-page--premium">
      <a className="aims-skip-link" href="#main-content">
        {c.skip}
      </a>
      <header className="aims-public-header">
        <Link className="aims-brand" to="/" aria-label={`AIMS — ${c.brand}`}>
          <Brand />
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
          <div className="aims-menu-actions">
            <label className="aims-language aims-menu-language">
              <Languages />
              <span className="sr-only">{c.language}</span>
              <select
                aria-label={c.language}
                value={language}
                onChange={(e) => app.setLanguage(e.target.value as Language)}
              >
                <option value="en">EN</option>
                <option value="nl">NL</option>
              </select>
            </label>
            <DownloadAppLink
              className="aims-header-download aims-menu-download"
              onClick={() => setMenuOpen(false)}
            >
              Download App
            </DownloadAppLink>
            <Link
              className="aims-glossy-button aims-signin-button aims-menu-signin"
              to={action}
              onClick={() => setMenuOpen(false)}
            >
              {app.user ? c.open : c.signIn}
              <ArrowRight />
            </Link>
          </div>
        </nav>
        <span className="aims-header-actions">
          <label className="aims-language">
            <Languages />
            <span className="sr-only">{c.language}</span>
            <select
              aria-label={c.language}
              value={language}
              onChange={(e) => app.setLanguage(e.target.value as Language)}
            >
              <option value="en">EN</option>
              <option value="nl">NL</option>
            </select>
          </label>
          <DownloadAppLink className="aims-header-download">
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
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>
      <main id="main-content">
        <section className="aims-hero" id="home">
          <div className="aims-container aims-hero-grid">
            <div className="aims-hero-copy">
              <p className="aims-eyebrow">CLARITY. CONTROL. ACCOUNTABILITY.</p>
              <h1>
                <span>{p.heroTitle}</span>
                <span className="aims-hero-highlight">{p.heroAccent}</span>
              </h1>
              <p className="aims-lead">{p.heroBody}</p>
              <div className="aims-actions">
                <a className="aims-glossy-button" href="#features">
                  <Boxes />
                  {c.explore}
                </a>
                <a className="aims-secondary-button" href="#workflow">
                  <PlayCircle />
                  {c.watchHow}
                </a>
              </div>
            </div>
            <div className="aims-hero-visual">
              <OrbitalHeroVisual language={language} />
            </div>
          </div>
        </section>
        <section
          className="aims-showcase-section"
          aria-label={
            language === "nl"
              ? "Responsieve AIMS-productweergave"
              : "Responsive AIMS product showcase"
          }
        >
          <div className="aims-container">
            <AimsDeviceShowcase language={language} />
            <ul className="aims-device-tags">
              <li>
                <BarChart3 />
                Desktop
              </li>
              <li>
                <TabletSmartphone />
                Tablet
              </li>
              <li>
                <Smartphone />
                Mobile
              </li>
            </ul>
          </div>
        </section>
        <section className="aims-section" id="features">
          <div className="aims-container">
            <SectionHeading title={p.modulesTitle} subtitle={p.modulesSub} />
            <div className="aims-feature-grid">
              {featureContent[language].map(([title, text], i) => (
                <article key={title}>
                  <Icon as={featureIcons[i]} />
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="aims-section aims-section--mist" id="workflow">
          <div className="aims-container">
            <SectionHeading
              title={language === "nl" ? "Hoe AIMS werkt" : "How AIMS works"}
              subtitle={p.worksSub}
            />
            <ol className="aims-workflow">
              {workflowContent[language].map(([title, text], i) => (
                <li key={title}>
                  <span className="aims-step-number">{i + 1}</span>
                  <Icon as={workflowIcons[i]} />
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section className="aims-section aims-security-section" id="security">
          <div className="aims-container">
            <SectionHeading
              title={p.securityTitle}
              subtitle={p.securitySub}
              inverse
            />
            <div className="aims-security-grid">
              {security.map(([title, text], i) => (
                <article key={title}>
                  <Icon as={securityIcons[i]} />
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="aims-section aims-install-section" id="install">
          <div className="aims-container aims-install-grid">
            <div>
              <span className="aims-install-kicker">
                <Smartphone />
                PWA · RESPONSIVE
              </span>
              <h2>{p.installTitle}</h2>
              <p>{p.installBody}</p>
              <ul className="aims-device-tags">
                <li>Browser</li>
                <li>Desktop</li>
                <li>Tablet</li>
                <li>Mobile</li>
              </ul>
            </div>
            <article className="aims-install-card">
              <span className="aims-install-icon">
                <PackageCheck />
              </span>
              <div>
                <h3>{p.installCard}</h3>
                <p>{p.installCardBody}</p>
              </div>
              <DownloadAppLink className="aims-glossy-button">
                {language === "nl" ? "App installeren" : "Install App"}
              </DownloadAppLink>
            </article>
          </div>
        </section>
        <section className="aims-final-cta">
          <div className="aims-container">
            <div>
              <h2>{p.finalTitle}</h2>
              <p>{p.finalBody}</p>
            </div>
            <Link className="aims-cta-white" to={action}>
              {app.user ? c.open : c.signIn}
              <ArrowRight />
            </Link>
          </div>
        </section>
      </main>
      <footer className="aims-footer">
        <div className="aims-container aims-footer-grid">
          <div className="aims-footer-brand">
            <Brand inverse />
            <p>
              {language === "nl"
                ? "Betrouwbaar middelen- en voorraadbeheer voor scholen en organisaties."
                : "Trusted asset and inventory management for schools and organizations."}
            </p>
          </div>
          {(
            [
              [
                "Product",
                [
                  [c.nav.features, "#features"],
                  [c.nav.workflow, "#workflow"],
                  [c.nav.security, "#security"],
                ],
              ],
              [
                language === "nl" ? "Bronnen" : "Resources",
                [
                  [c.documentation, "/support"],
                  [c.support, "/support"],
                ],
              ],
              [
                language === "nl" ? "Bedrijf" : "Company",
                [
                  [language === "nl" ? "Over AIMS" : "About AIMS", "#home"],
                  [c.privacy, "/privacy"],
                ],
              ],
              [
                language === "nl" ? "Ondersteuning" : "Support",
                [
                  [c.support, "/support"],
                  [c.terms, "/terms"],
                ],
              ],
            ] as Array<[string, Array<[string, string]>]>
          ).map(([heading, links]) => (
            <div key={heading}>
              <h2>{heading}</h2>
              {links.map(([label, href]) =>
                href.startsWith("#") ? (
                  <a key={label} href={href}>
                    {label}
                  </a>
                ) : (
                  <Link key={label} to={href}>
                    {label}
                  </Link>
                ),
              )}
            </div>
          ))}
        </div>
        <div className="aims-footer-bottom aims-container">{c.copyright}</div>
      </footer>
    </div>
  );
}
