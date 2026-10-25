export type HelpArticle = {
  id: string;
  category: HelpCategoryId;
  title: { en: string; nl: string };
  body: { en: string; nl: string };
  keywords?: string[];
};

export type HelpCategoryId =
  | "getting-started"
  | "ict-assets"
  | "warehouse"
  | "locations"
  | "departments"
  | "assignments"
  | "borrow"
  | "repairs"
  | "maintenance"
  | "movements"
  | "audits"
  | "reports"
  | "qr"
  | "account"
  | "security"
  | "settings";

export const helpCategories: {
  id: HelpCategoryId;
  label: { en: string; nl: string };
}[] = [
  { id: "getting-started", label: { en: "Getting Started", nl: "Aan de slag" } },
  { id: "ict-assets", label: { en: "ICT Assets", nl: "ICT-middelen" } },
  { id: "warehouse", label: { en: "Warehouse", nl: "Magazijn" } },
  { id: "locations", label: { en: "Locations", nl: "Locaties" } },
  { id: "departments", label: { en: "Departments", nl: "Afdelingen" } },
  { id: "assignments", label: { en: "Assignments", nl: "Toewijzingen" } },
  { id: "borrow", label: { en: "Borrow Management", nl: "Uitleenbeheer" } },
  { id: "repairs", label: { en: "Repairs", nl: "Reparaties" } },
  { id: "maintenance", label: { en: "Maintenance", nl: "Onderhoud" } },
  { id: "movements", label: { en: "Inventory Movements", nl: "Voorraadmutaties" } },
  { id: "audits", label: { en: "Inventory Audits", nl: "Voorraadaudits" } },
  { id: "reports", label: { en: "Reports", nl: "Rapporten" } },
  { id: "qr", label: { en: "QR Scanning", nl: "QR-scannen" } },
  { id: "account", label: { en: "Account", nl: "Account" } },
  { id: "security", label: { en: "Security", nl: "Beveiliging" } },
  { id: "settings", label: { en: "Settings", nl: "Instellingen" } },
];

export const helpArticles: HelpArticle[] = [
  {
    id: "intro",
    category: "getting-started",
    title: { en: "What AIMS is", nl: "Wat AIMS is" },
    body: {
      en: "AIMS tracks every ICT asset and warehouse item at Kangoeroe School from acquisition through disposal. Modules live in the sidebar; each module has its own list, detail view and audit history.",
      nl: "AIMS registreert elk ICT-middel en magazijnartikel van Kangoeroe School, van aanschaf tot afvoer. Modules staan in de sidebar; elke module heeft een eigen lijst, detailweergave en audithistorie.",
    },
    keywords: ["aims", "overview", "sidebar", "dashboard"],
  },
  {
    id: "sidebar-navigation",
    category: "getting-started",
    title: { en: "Navigating the sidebar", nl: "Navigeren via de sidebar" },
    body: {
      en: "Modules scroll from Dashboard to Settings. Your profile sits frozen at the bottom. Click any module to open it; click the brand mark to collapse or expand the rail.",
      nl: "Modules scrollen van Dashboard tot Settings. Uw profiel staat vast onderaan. Klik een module om deze te openen; klik op het logo om de balk in of uit te klappen.",
    },
    keywords: ["sidebar", "navigation", "collapse"],
  },
  {
    id: "add-asset",
    category: "ict-assets",
    title: { en: "Add an ICT asset", nl: "Een ICT-middel toevoegen" },
    body: {
      en: "Open the ICT Assets module → New asset. Fill in category, status, location and department; QR codes are generated automatically from the asset code.",
      nl: "Open de ICT-middelen → Nieuw middel. Vul categorie, status, locatie en afdeling in; QR-codes worden automatisch gegenereerd uit de assetcode.",
    },
    keywords: ["add", "create", "asset", "ict"],
  },
  {
    id: "status-explained",
    category: "ict-assets",
    title: { en: "Asset status values explained", nl: "Betekenis van assetstatussen" },
    body: {
      en: "Available = in stock. Assigned/Borrowed = handed out. Under Maintenance/Repair = pulled from circulation. Damaged/Missing = requires action. Disposed = archived with a disposal record.",
      nl: "Beschikbaar = op voorraad. Toegewezen/Uitgeleend = uitgegeven. In onderhoud/reparatie = uit roulatie. Beschadigd/Vermist = actie vereist. Afgevoerd = gearchiveerd met afvoerregistratie.",
    },
    keywords: ["status", "available", "disposed"],
  },
  {
    id: "warehouse-move",
    category: "warehouse",
    title: { en: "Bulk warehouse moves", nl: "Bulkmutaties in het magazijn" },
    body: {
      en: "Use Inventory → Bulk Stock Move to transfer multiple items between locations in one submission. Each row becomes a movement with its own audit entry.",
      nl: "Gebruik Voorraad → Bulkverplaatsing om meerdere artikelen in één keer tussen locaties te verplaatsen. Elke regel wordt een mutatie met eigen auditlog.",
    },
    keywords: ["warehouse", "bulk", "move"],
  },
  {
    id: "location-tree",
    category: "locations",
    title: { en: "Location hierarchy", nl: "Locatiehiërarchie" },
    body: {
      en: "Locations are nested as Building → Floor → Room. Assets inherit their main location from the leaf; move an asset by picking a new leaf location.",
      nl: "Locaties zijn genest als Gebouw → Verdieping → Ruimte. Assets erven hun hoofdlocatie van het laatste knooppunt; wijzig door een nieuw knooppunt te kiezen.",
    },
    keywords: ["locations", "hierarchy", "building"],
  },
  {
    id: "department-cost",
    category: "departments",
    title: { en: "Department cost tracking", nl: "Kostentracking per afdeling" },
    body: {
      en: "Each asset carries a department. Dashboard tiles roll up asset counts and value per department, and reports can filter by department for budgeting.",
      nl: "Elk middel heeft een afdeling. Dashboard-tegels aggregeren aantallen en waarde per afdeling; rapportages kunnen filteren op afdeling voor budgetinzicht.",
    },
    keywords: ["department", "cost", "budget"],
  },
  {
    id: "assign-asset",
    category: "assignments",
    title: { en: "Assign an asset to a user", nl: "Een middel toewijzen aan een gebruiker" },
    body: {
      en: "Open the asset → Assignments → Assign. Pick a user and department. The status flips to Assigned and the assignment appears in the user's directory record.",
      nl: "Open het middel → Toewijzingen → Toewijzen. Kies een gebruiker en afdeling. De status wordt Toegewezen en de toewijzing verschijnt in het gebruikersrecord.",
    },
    keywords: ["assignment", "assign"],
  },
  {
    id: "borrow-flow",
    category: "borrow",
    title: { en: "Borrow + return flow", nl: "Uitleen- en inleverproces" },
    body: {
      en: "Create a borrow record with return date. On return, mark the record returned. Overdue items appear highlighted on the dashboard.",
      nl: "Maak een uitleenregistratie met retourdatum. Markeer bij inlevering als geretourneerd. Verlopen items worden gemarkeerd op het dashboard.",
    },
    keywords: ["borrow", "return", "overdue"],
  },
  {
    id: "repair-ticket",
    category: "repairs",
    title: { en: "Opening a repair ticket", nl: "Een reparatieticket aanmaken" },
    body: {
      en: "Repairs → New repair → attach to an asset, add the fault description and vendor. Status moves to Under Repair until the record is closed.",
      nl: "Reparaties → Nieuwe reparatie → koppel aan een middel, voeg storingsomschrijving en leverancier toe. Status is In reparatie tot het record wordt gesloten.",
    },
    keywords: ["repair", "ticket", "vendor"],
  },
  {
    id: "maintenance-schedule",
    category: "maintenance",
    title: { en: "Scheduling maintenance", nl: "Onderhoud plannen" },
    body: {
      en: "Maintenance → New schedule → pick an asset and interval (weekly/monthly/yearly). The dashboard's maintenance tile warns when work is due within 7 days.",
      nl: "Onderhoud → Nieuw schema → kies een middel en interval (wekelijks/maandelijks/jaarlijks). De onderhoudstegel waarschuwt wanneer werk binnen 7 dagen gepland staat.",
    },
    keywords: ["maintenance", "schedule"],
  },
  {
    id: "movement-reasons",
    category: "movements",
    title: { en: "Movement reason codes", nl: "Reden van voorraadmutatie" },
    body: {
      en: "Reasons include Transfer, Return, Disposal, Loss, Adjustment, Receipt. Reports can group movements by reason.",
      nl: "Redenen zijn onder meer Verplaatsing, Retour, Afvoer, Verlies, Correctie, Ontvangst. Rapportages kunnen mutaties per reden groeperen.",
    },
    keywords: ["movements", "reason"],
  },
  {
    id: "audit-cycle",
    category: "audits",
    title: { en: "Running an inventory audit", nl: "Een voorraadaudit uitvoeren" },
    body: {
      en: "Audits → New audit → scan QR codes room by room. Mismatches surface in the audit summary and generate follow-up movements.",
      nl: "Audits → Nieuwe audit → scan QR-codes kamer voor kamer. Verschillen verschijnen in de auditsamenvatting en genereren vervolgmutaties.",
    },
    keywords: ["audit", "inventory", "scan"],
  },
  {
    id: "reports-overview",
    category: "reports",
    title: { en: "What reports are available", nl: "Welke rapportages er zijn" },
    body: {
      en: "Standard reports cover Asset register, Movements, Repairs, Maintenance due, Borrows outstanding, Depreciation, Disposals. Each can be exported to Excel.",
      nl: "Standaardrapportages: Middelenregister, Mutaties, Reparaties, Onderhoud, Openstaande uitleen, Afschrijving, Afvoer. Elk is te exporteren naar Excel.",
    },
    keywords: ["reports", "excel"],
  },
  {
    id: "qr-scan",
    category: "qr",
    title: { en: "Scanning a QR code", nl: "Een QR-code scannen" },
    body: {
      en: "Click the QR scanner in any module or open the asset's detail URL from a phone camera. The scanner needs camera permission once.",
      nl: "Klik de QR-scanner in elke module of open de detail-URL van een middel vanaf de camera van uw telefoon. De scanner vraagt eenmalig toestemming.",
    },
    keywords: ["qr", "scan", "camera"],
  },
  {
    id: "account-profile",
    category: "account",
    title: { en: "Updating your profile photo", nl: "Profielfoto bijwerken" },
    body: {
      en: "My Profile → Change photo. Supported formats: JPG, PNG, WEBP. Images are resized before upload.",
      nl: "Mijn profiel → Foto wijzigen. Ondersteund: JPG, PNG, WEBP. Afbeeldingen worden geschaald vóór upload.",
    },
    keywords: ["profile", "photo"],
  },
  {
    id: "security-mfa",
    category: "security",
    title: { en: "Enabling multi-factor authentication", nl: "Tweestapsverificatie inschakelen" },
    body: {
      en: "Security → Enable MFA. Scan the QR with Google Authenticator / 1Password / Authy and enter the 6-digit code. Generate backup codes afterwards.",
      nl: "Beveiliging → MFA inschakelen. Scan de QR met Google Authenticator / 1Password / Authy en voer de 6-cijferige code in. Genereer daarna herstelcodes.",
    },
    keywords: ["mfa", "security", "totp"],
  },
  {
    id: "security-sessions",
    category: "security",
    title: { en: "Reviewing active sessions", nl: "Actieve sessies bekijken" },
    body: {
      en: "Security → Active sessions lists devices with recent AIMS activity. The current session is highlighted; sign out of the current session with the dedicated button.",
      nl: "Beveiliging → Actieve sessies toont apparaten met recente activiteit. De huidige sessie is gemarkeerd; meld deze af met de knop onderaan.",
    },
    keywords: ["sessions", "devices", "security"],
  },
  {
    id: "settings-theme",
    category: "settings",
    title: { en: "Changing the theme", nl: "Het thema wijzigen" },
    body: {
      en: "Preferences → Themes → pick one of AIMS Blue Azure, AIMS DarkBento, AIMS Emerald Green or AIMS Light. Choice is saved to your profile.",
      nl: "Voorkeuren → Thema's → kies AIMS Blue Azure, AIMS DarkBento, AIMS Emerald Green of AIMS Light. De keuze wordt op uw profiel opgeslagen.",
    },
    keywords: ["theme", "appearance", "dark"],
  },
  {
    id: "settings-language",
    category: "settings",
    title: { en: "Switching language", nl: "Taal wisselen" },
    body: {
      en: "Preferences → Language → English or Nederlands. The entire interface — including this help center — switches immediately.",
      nl: "Voorkeuren → Taal → Engels of Nederlands. De gehele interface — inclusief dit helpcentrum — wisselt direct.",
    },
    keywords: ["language", "dutch", "english"],
  },
  {
    id: "settings-time",
    category: "settings",
    title: { en: "Time zone and date format", nl: "Tijdzone en datumnotatie" },
    body: {
      en: "Preferences → Date & time → pick time zone (America/Paramaribo default), 12 or 24-hour format, DD-MM-YYYY vs other date formats, and first day of week.",
      nl: "Voorkeuren → Datum en tijd → kies tijdzone (standaard America/Paramaribo), 12- of 24-uursnotatie, DD-MM-YYYY of andere datumnotaties en eerste dag van de week.",
    },
    keywords: ["time", "date", "timezone"],
  },
];

export function searchHelp(query: string, language: "en" | "nl"): HelpArticle[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const tokens = needle.split(/\s+/).filter(Boolean);
  const scored = helpArticles
    .map((article) => {
      const haystack = [
        article.title.en,
        article.title.nl,
        article.body.en,
        article.body.nl,
        ...(article.keywords ?? []),
      ]
        .join(" ")
        .toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (!haystack.includes(token)) return null;
        score += 1;
        if (article.title[language].toLowerCase().includes(token)) score += 2;
      }
      return { article, score };
    })
    .filter((entry): entry is { article: HelpArticle; score: number } =>
      entry !== null,
    )
    .sort((a, b) => b.score - a.score);
  return scored.map(({ article }) => article).slice(0, 20);
}
