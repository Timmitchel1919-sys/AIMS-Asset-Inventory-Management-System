export type ReleaseNote = {
  version: string;
  date: string; // ISO yyyy-mm-dd
  highlights: { en: string; nl: string };
  features?: { en: string; nl: string }[];
  improvements?: { en: string; nl: string }[];
  fixes?: { en: string; nl: string }[];
};

/**
 * Single source of truth for AIMS release notes. Newest first. The About
 * section + any future in-app changelog read from this file; no component
 * may hard-code release copy.
 */
export const releaseNotes: ReleaseNote[] = [
  {
    version: "2026.10.25-profile",
    date: "2026-10-25",
    highlights: {
      en: "Personal account panel is complete: active sessions, MFA, backup codes, searchable help, in-app support tickets and problem reports.",
      nl: "Persoonlijk accountpaneel is compleet: actieve sessies, MFA, herstelcodes, doorzoekbare help en interne supporttickets/probleemrapporten.",
    },
    features: [
      {
        en: "Active sessions and login activity on Security.",
        nl: "Actieve sessies en aanmeldactiviteit op Beveiliging.",
      },
      {
        en: "TOTP multi-factor authentication with hashed backup codes.",
        nl: "TOTP tweestapsverificatie met gehashte herstelcodes.",
      },
      {
        en: "Password strength meter on the change-password form.",
        nl: "Wachtwoord-sterkte-indicator op het wijzigen-wachtwoord-formulier.",
      },
      {
        en: "Searchable Help Center with 16 categories and bilingual articles.",
        nl: "Doorzoekbaar helpcentrum met 16 categorieën en tweetalige artikelen.",
      },
      {
        en: "Contact ICT Support and Report-a-Problem forms backed by Firestore.",
        nl: "Formulieren voor ICT-ondersteuning en probleemmeldingen die opslaan in Firestore.",
      },
    ],
    improvements: [
      {
        en: "Profile dropdown header shows role chip and verified badge.",
        nl: "De profiel-dropdown toont nu de rol-chip en een verificatie-badge.",
      },
      {
        en: "Preferences gained Time zone and First day of week.",
        nl: "Voorkeuren met Tijdzone en Eerste dag van de week.",
      },
    ],
  },
  {
    version: "2026.10.25-shell",
    date: "2026-10-25",
    highlights: {
      en: "Shell restructure: profile icon moved to a frozen sidebar footer, Notifications joined the sidebar, the topbar is gone.",
      nl: "Shell-herstructurering: profielicoon staat vast onderaan de sidebar, Notificaties zijn in de sidebar opgenomen, de topbar is verwijderd.",
    },
    features: [
      {
        en: "Modules scroll from Dashboard to Settings while the profile button stays pinned.",
        nl: "Modules scrollen van Dashboard tot Settings terwijl de profielknop vastgezet blijft.",
      },
      {
        en: "Notifications module in the sidebar beneath Device Management & Monitoring, with unread badge.",
        nl: "Notificatiesmodule in de sidebar onder Device Management, inclusief badge voor ongelezen items.",
      },
    ],
    improvements: [
      {
        en: "Global search bar and the entire topbar were removed; main content shifts up.",
        nl: "Globale zoekbalk en de hele topbar zijn verwijderd; de inhoud schuift op.",
      },
    ],
  },
  {
    version: "2026.10.25-theme",
    date: "2026-10-25",
    highlights: {
      en: "Professional restyle of the Midnight Dark Bento theme: unified cyan + amber accent family, numeric type scale, elevation + radius tokens, polished interaction states.",
      nl: "Professionele restyle van het Midnight Dark Bento-thema: één cyan + amber accentfamilie, numerieke typografieschaal, elevatie- en radius-tokens, verfijnde interactiestates.",
    },
    improvements: [
      {
        en: "Peak bar in movement stream is warm (amber) instead of pure white.",
        nl: "Piekbalk in de movement stream is warm (amber) in plaats van puur wit.",
      },
      {
        en: "Age bars use an explicit diverging ramp cyan → teal → amber → coral.",
        nl: "Age-bars gebruiken een expliciete diverging-ramp cyan → teal → amber → coral.",
      },
      {
        en: "QR tile wrapped in a dark mat; dashed borders replaced with solid-plus-stripe.",
        nl: "QR-tegel in donkere mat; dashed borders vervangen door solid + stripe-pattern.",
      },
      {
        en: "Firefox scrollbar fallback and backdrop-filter @supports fallback.",
        nl: "Firefox scrollbar-fallback en @supports fallback voor backdrop-filter.",
      },
    ],
    fixes: [
      {
        en: "Defined `--bento-muted` — fixes invisible stock range track in dark theme.",
        nl: "`--bento-muted` gedefinieerd — lost onzichtbare stock-range-track op in donker thema.",
      },
    ],
  },
];

export function latestVersion(): string {
  return releaseNotes[0]?.version ?? "unknown";
}
