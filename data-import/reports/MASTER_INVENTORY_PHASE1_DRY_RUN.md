# AIMS — Master Inventory Migration — Phase 1 Dry Run

Generated: 2026-09-25T16:19:57.662Z · Mode: **ANALYSIS / DRY RUN ONLY** — no Firestore writes, no counters changed, no INV-codes generated, workbook unchanged (SHA-256 identical before/after: `f670607581f2bedccdd96d54b38e0d680e0ee5d26f8ae5b87d8892a67e4d669a`).

> **Source file note:** `MASTER INVENTORY 2026(2).xlsx` was not found on this machine. The analysis used `docs/MASTER INVENTORY 2026.xlsx`, whose sheet list matches the included/excluded sheets in the brief exactly. Confirm this is the intended workbook before Phase 2.

> **Production comparison: DONE** — read-only snapshot of assets, codeGroups, assetCodes, locations, departments, categories, users and userDirectory taken 2026-09-25T16:19:57.915Z with your permission (GET requests only; nothing written).

## 1. Record count per included sheet
| Sheet | Non-empty rows | With INV-code | Without INV-code |
|---|---|---|---|
| LAPTOP | 62 | 62 | 0 |
| DESKTOP | 39 | 39 | 0 |
| MINI DESK | 30 | 30 | 0 |
| TABLET | 2 | 2 | 0 |
| MONITOR | 46 | 46 | 0 |
| DIGIBORD | 53 | 51 | 2 |
| PW MODULE | 13 | 13 | 0 |
| RT MODULE | 7 | 6 | 1 |
| TELEFOON | 12 | 12 | 0 |
| MOBIEL | 8 | 8 | 0 |
| PRINTERSCANNER | 9 | 9 | 0 |
| BEAMER | 4 | 4 | 0 |
| UPS | 41 | 39 | 2 |
| KEYBOARD | 27 | 27 | 0 |

Excluded sheets (ITEMS, PL.KH.OB, PL.BB, PL.OB, OVERZICHT, ANALYSE RAPPORT DIGIBORDEN, INVENTARIS WIFI DIGIBOARD) were not read.

## 2. Totals
- Rows analysed: **353**
- Coded assets: **348** (unique codes: 346)
- Classification: **ALREADY_EXISTS** 64 · **MANUAL_REVIEW** 11 · **READY** 264 · **CONFLICT** 10 · **SOURCE_DUPLICATE** 4

## 3. Excel → AIMS field mapping
AIMS schema source: `src/domain/types.ts` (`Asset`), `firestore.rules` `validAsset` / `validLegacyImportedAsset`. AIMS has **no dedicated fields** for Part number, IMEI, MAC, Purchase year, Extension or Mobile number; technical identifiers go to the existing structured `technicalSpecifications` map (shown in the asset's *Technical details* tab), everything else non-sensitive to `notes`. The full original row (minus sensitive columns) is also kept in `sourceData` for traceability.

| Excel sheet | Excel column | AIMS destination | Direct / Notes / Review | Transformation | Comments |
|---|---|---|---|---|---|
| LAPTOP | INV- CODE | code | Direct | Verbatim — no normalisation. codePrefix = leading letters, codeNumber = integer of trailing digits (leading zeros stay only in `code`). |  |
| LAPTOP | BRAND - MODEL | brand + model + name | Direct | Brand = first word; Model = remainder, ' - ' separators removed. PW/RT MODULE: brand from sheet (Prowise/Riotouch). Name = Brand + Model, fallback '<Type> <code>'. |  |
| LAPTOP | SPECS | technicalSpecifications.rawSpecifications | Direct | Free text kept verbatim (uses the new free-text specifications support). |  |
| LAPTOP | S/N | serialNumber | Direct | Trim. |  |
| LAPTOP | USER | assignedTo (only if matched) else Notes | Notes | Note line 'Legacy gebruiker: <value>' (empty / N/A skipped) |  |
| LAPTOP | LOCATION | location / currentLocationId (review) | Review | Match to AIMS location only if safe; else LOCATION_REVIEW_REQUIRED + 'Legacy locatie:' note. |  |
| LAPTOP | CONDITION | condition | Direct | See §4–7. |  |
| LAPTOP | BRUIKLEEN CONTRACT | Notes | Notes | Note line 'Bruikleen contract: <value>' (empty / N/A skipped) |  |
| LAPTOP | CHARGER | Notes | Notes | Note line 'Charger: <value>' (empty / N/A skipped) |  |
| LAPTOP | LAPTOP BAG | Notes | Notes | Note line 'Laptop bag: <value>' (empty / N/A skipped) |  |
| LAPTOP | MOUSE | Notes | Notes | Note line 'Mouse: <value>' (empty / N/A skipped) |  |
| LAPTOP | PURCHASE (YEAR) | Notes (Aankoopjaar) + sourceData.purchaseYear — no purchaseYear field | Notes + transform | 4-digit year → note 'Aankoopjaar: YYYY'; full dates (9.7.2026, 18 SEPT 2025, Excel serial 46062) → also purchaseDate YYYY-MM-DD. |  |
| DESKTOP | INV- CODE | code | Direct | Verbatim — no normalisation. codePrefix = leading letters, codeNumber = integer of trailing digits (leading zeros stay only in `code`). |  |
| DESKTOP | USER | assignedTo (only if matched) else Notes | Notes | Note line 'Legacy gebruiker: <value>' (empty / N/A skipped) |  |
| DESKTOP | BRAND - MODEL | brand + model + name | Direct | Brand = first word; Model = remainder, ' - ' separators removed. PW/RT MODULE: brand from sheet (Prowise/Riotouch). Name = Brand + Model, fallback '<Type> <code>'. |  |
| DESKTOP | SPECS | technicalSpecifications.rawSpecifications | Direct | Free text kept verbatim (uses the new free-text specifications support). |  |
| DESKTOP | S/N | serialNumber | Direct | Trim. |  |
| DESKTOP | LOCATION | location / currentLocationId (review) | Review | Match to AIMS location only if safe; else LOCATION_REVIEW_REQUIRED + 'Legacy locatie:' note. |  |
| DESKTOP | CONDITION | condition | Direct | See §4–7. |  |
| DESKTOP | / | Notes | Notes | Note line 'Opmerking: <value>' (empty / N/A skipped) |  |
| DESKTOP | PURCHASE (YEAR) | Notes (Aankoopjaar) + sourceData.purchaseYear — no purchaseYear field | Notes + transform | 4-digit year → note 'Aankoopjaar: YYYY'; full dates (9.7.2026, 18 SEPT 2025, Excel serial 46062) → also purchaseDate YYYY-MM-DD. |  |
| DESKTOP | Column 1 | Notes | Notes | Note line 'Opmerking: <value>' (empty / N/A skipped) |  |
| MINI DESK | INV- CODE | code | Direct | Verbatim — no normalisation. codePrefix = leading letters, codeNumber = integer of trailing digits (leading zeros stay only in `code`). |  |
| MINI DESK | DB# | Notes | Notes | Note line 'Gekoppeld digibord: <value>' (empty / N/A skipped) |  |
| MINI DESK | BRAND - MODEL | brand + model + name | Direct | Brand = first word; Model = remainder, ' - ' separators removed. PW/RT MODULE: brand from sheet (Prowise/Riotouch). Name = Brand + Model, fallback '<Type> <code>'. |  |
| MINI DESK | SPECS | technicalSpecifications.rawSpecifications | Direct | Free text kept verbatim (uses the new free-text specifications support). |  |
| MINI DESK | P/N | technicalSpecifications["Part number"] | Direct | technicalSpecifications key 'Part number' |  |
| MINI DESK | S/N | serialNumber | Direct | Trim. |  |
| MINI DESK | LOCATION | location / currentLocationId (review) | Review | Match to AIMS location only if safe; else LOCATION_REVIEW_REQUIRED + 'Legacy locatie:' note. |  |
| MINI DESK | CONDITION | condition | Direct | See §4–7. |  |
| MINI DESK | PURCHASE (YEAR) | Notes (Aankoopjaar) + sourceData.purchaseYear — no purchaseYear field | Notes + transform | 4-digit year → note 'Aankoopjaar: YYYY'; full dates (9.7.2026, 18 SEPT 2025, Excel serial 46062) → also purchaseDate YYYY-MM-DD. |  |
| MINI DESK | OPM | Notes | Notes | Note line 'Opmerking: <value>' (empty / N/A skipped) |  |
| TABLET | INV- CODE | code | Direct | Verbatim — no normalisation. codePrefix = leading letters, codeNumber = integer of trailing digits (leading zeros stay only in `code`). |  |
| TABLET | BRAND - MODEL | brand + model + name | Direct | Brand = first word; Model = remainder, ' - ' separators removed. PW/RT MODULE: brand from sheet (Prowise/Riotouch). Name = Brand + Model, fallback '<Type> <code>'. |  |
| TABLET | SPECS | technicalSpecifications.rawSpecifications | Direct | Free text kept verbatim (uses the new free-text specifications support). |  |
| TABLET | P/N | technicalSpecifications["Part number"] | Direct | technicalSpecifications key 'Part number' |  |
| TABLET | S/N | serialNumber | Direct | Trim. |  |
| TABLET | IMEI | technicalSpecifications.IMEI | Direct | technicalSpecifications key 'IMEI' |  |
| TABLET | CONDITION | condition | Direct | See §4–7. |  |
| TABLET | PURCHASE (YEAR) | Notes (Aankoopjaar) + sourceData.purchaseYear — no purchaseYear field | Notes + transform | 4-digit year → note 'Aankoopjaar: YYYY'; full dates (9.7.2026, 18 SEPT 2025, Excel serial 46062) → also purchaseDate YYYY-MM-DD. |  |
| TABLET | OPMERKING | Notes | Notes | Note line 'Opmerking: <value>' (empty / N/A skipped) |  |
| TABLET | OPM | Notes | Notes | Note line 'Opmerking: <value>' (empty / N/A skipped) |  |
| MONITOR | INV- CODE | code | Direct | Verbatim — no normalisation. codePrefix = leading letters, codeNumber = integer of trailing digits (leading zeros stay only in `code`). |  |
| MONITOR | BRAND - MODEL | brand + model + name | Direct | Brand = first word; Model = remainder, ' - ' separators removed. PW/RT MODULE: brand from sheet (Prowise/Riotouch). Name = Brand + Model, fallback '<Type> <code>'. |  |
| MONITOR | SPECS | technicalSpecifications.rawSpecifications | Direct | Free text kept verbatim (uses the new free-text specifications support). |  |
| MONITOR | S/N | serialNumber | Direct | Trim. |  |
| MONITOR | CONDITION | condition | Direct | See §4–7. |  |
| MONITOR | PURCHASE (YEAR) | Notes (Aankoopjaar) + sourceData.purchaseYear — no purchaseYear field | Notes + transform | 4-digit year → note 'Aankoopjaar: YYYY'; full dates (9.7.2026, 18 SEPT 2025, Excel serial 46062) → also purchaseDate YYYY-MM-DD. |  |
| MONITOR | Location | location / currentLocationId (review) | Review | Match to AIMS location only if safe; else LOCATION_REVIEW_REQUIRED + 'Legacy locatie:' note. |  |
| MONITOR | OPMERKINGEN | Notes | Notes | Note line 'Opmerking: <value>' (empty / N/A skipped) |  |
| DIGIBORD | SCREEN CODE | code | Direct | Verbatim — no normalisation. codePrefix = leading letters, codeNumber = integer of trailing digits (leading zeros stay only in `code`). |  |
| DIGIBORD | LOCATIE GROEP | Notes (Groep) | Notes | Note line 'Groep: <value>' (empty / N/A skipped) |  |
| DIGIBORD | ADMIN INVENTORY LOCATION | location / currentLocationId (review) | Review | Match to AIMS location only if safe; else LOCATION_REVIEW_REQUIRED + 'Legacy locatie:' note. |  |
| DIGIBORD | PASSWORD | EXCLUDED (sensitive) | EXCLUDED | Not imported, not copied to notes or sourceData. |  |
| DIGIBORD | \ | Notes | Notes | Note line 'Opmerking: <value>' (empty / N/A skipped) |  |
| DIGIBORD | BRAND | brand | Direct | Trim. |  |
| DIGIBORD | MODULE | Notes | Notes | Note line 'Module: <value>' (empty / N/A skipped) |  |
| DIGIBORD | MINI DESKTOP | Notes | Notes | Note line 'Mini desktop: <value>' (empty / N/A skipped) |  |
| DIGIBORD | WIFI USER NAME | EXCLUDED (sensitive) | EXCLUDED | Not imported, not copied to notes or sourceData. |  |
| DIGIBORD | WIFI PASSWORD | EXCLUDED (sensitive) | EXCLUDED | Not imported, not copied to notes or sourceData. |  |
| DIGIBORD | Column 11 | Notes | Notes | Note line 'Opmerking: <value>' (empty / N/A skipped) |  |
| DIGIBORD | OPMERKINGEN | Notes | Notes | Note line 'Opmerking: <value>' (empty / N/A skipped) |  |
| DIGIBORD | Column 1 | Notes | Notes | Note line 'Opmerking: <value>' (empty / N/A skipped) |  |
| PW MODULE | INV- CODE | code | Direct | Verbatim — no normalisation. codePrefix = leading letters, codeNumber = integer of trailing digits (leading zeros stay only in `code`). |  |
| PW MODULE | BRAND - MODEL | brand + model + name | Direct | Brand = first word; Model = remainder, ' - ' separators removed. PW/RT MODULE: brand from sheet (Prowise/Riotouch). Name = Brand + Model, fallback '<Type> <code>'. |  |
| PW MODULE | SPECS | technicalSpecifications.rawSpecifications | Direct | Free text kept verbatim (uses the new free-text specifications support). |  |
| PW MODULE | S/N | serialNumber | Direct | Trim. |  |
| PW MODULE | CONDITION | condition | Direct | See §4–7. |  |
| PW MODULE | PURCHASE (YEAR) | Notes (Aankoopjaar) + sourceData.purchaseYear — no purchaseYear field | Notes + transform | 4-digit year → note 'Aankoopjaar: YYYY'; full dates (9.7.2026, 18 SEPT 2025, Excel serial 46062) → also purchaseDate YYYY-MM-DD. |  |
| PW MODULE | HW PROD. NO | technicalSpecifications["HW product no"] | Direct | technicalSpecifications key 'HW product no' |  |
| PW MODULE | SW PROD. NO | technicalSpecifications["SW product no"] | Direct | technicalSpecifications key 'SW product no' |  |
| RT MODULE | INV- CODE | code | Direct | Verbatim — no normalisation. codePrefix = leading letters, codeNumber = integer of trailing digits (leading zeros stay only in `code`). |  |
| RT MODULE | BRAND - MODEL | brand + model + name | Direct | Brand = first word; Model = remainder, ' - ' separators removed. PW/RT MODULE: brand from sheet (Prowise/Riotouch). Name = Brand + Model, fallback '<Type> <code>'. |  |
| RT MODULE | SPECS | technicalSpecifications.rawSpecifications | Direct | Free text kept verbatim (uses the new free-text specifications support). |  |
| RT MODULE | S/N | serialNumber | Direct | Trim. |  |
| RT MODULE | CONDITION | condition | Direct | See §4–7. |  |
| RT MODULE | PURCHASE (YEAR) | Notes (Aankoopjaar) + sourceData.purchaseYear — no purchaseYear field | Notes + transform | 4-digit year → note 'Aankoopjaar: YYYY'; full dates (9.7.2026, 18 SEPT 2025, Excel serial 46062) → also purchaseDate YYYY-MM-DD. |  |
| RT MODULE | Column 1 | Notes | Notes | Note line 'Opmerking: <value>' (empty / N/A skipped) |  |
| TELEFOON | INV- CODE | code | Direct | Verbatim — no normalisation. codePrefix = leading letters, codeNumber = integer of trailing digits (leading zeros stay only in `code`). |  |
| TELEFOON | BRAND - MODEL | brand + model + name | Direct | Brand = first word; Model = remainder, ' - ' separators removed. PW/RT MODULE: brand from sheet (Prowise/Riotouch). Name = Brand + Model, fallback '<Type> <code>'. |  |
| TELEFOON | S/N | serialNumber | Direct | Trim. |  |
| TELEFOON | MAC | technicalSpecifications.MAC | Direct | technicalSpecifications key 'MAC' |  |
| TELEFOON | PASSWORD | EXCLUDED (sensitive) | EXCLUDED | Not imported, not copied to notes or sourceData. |  |
| TELEFOON | EXT# | technicalSpecifications.Extensie | Direct | technicalSpecifications key 'Extensie' |  |
| TELEFOON | AFDELING | department (review) | Review | Match to AIMS department only if safe; else review. |  |
| TELEFOON | CONDITION | condition | Direct | See §4–7. |  |
| MOBIEL | INV- CODE | code | Direct | Verbatim — no normalisation. codePrefix = leading letters, codeNumber = integer of trailing digits (leading zeros stay only in `code`). |  |
| MOBIEL | BRAND - MODEL | brand + model + name | Direct | Brand = first word; Model = remainder, ' - ' separators removed. PW/RT MODULE: brand from sheet (Prowise/Riotouch). Name = Brand + Model, fallback '<Type> <code>'. |  |
| MOBIEL | S/N | serialNumber | Direct | Trim. |  |
| MOBIEL | IMEI | technicalSpecifications.IMEI | Direct | technicalSpecifications key 'IMEI' |  |
| MOBIEL | MAC | technicalSpecifications.MAC | Direct | technicalSpecifications key 'MAC' |  |
| MOBIEL | AFDELING | department (review) | Review | Match to AIMS department only if safe; else review. |  |
| MOBIEL | USER | assignedTo (only if matched) else Notes | Notes | Note line 'Legacy gebruiker: <value>' (empty / N/A skipped) |  |
| MOBIEL | CONDITION | condition | Direct | See §4–7. |  |
| MOBIEL | MOB# | technicalSpecifications.Mobielnummer | Direct | technicalSpecifications key 'Mobielnummer' |  |
| PRINTERSCANNER | INV- CODE | code | Direct | Verbatim — no normalisation. codePrefix = leading letters, codeNumber = integer of trailing digits (leading zeros stay only in `code`). |  |
| PRINTERSCANNER | BRAND - MODEL | brand + model + name | Direct | Brand = first word; Model = remainder, ' - ' separators removed. PW/RT MODULE: brand from sheet (Prowise/Riotouch). Name = Brand + Model, fallback '<Type> <code>'. |  |
| PRINTERSCANNER | S/N | serialNumber | Direct | Trim. |  |
| PRINTERSCANNER | LOCATION | location / currentLocationId (review) | Review | Match to AIMS location only if safe; else LOCATION_REVIEW_REQUIRED + 'Legacy locatie:' note. |  |
| PRINTERSCANNER | CONDITION | condition | Direct | See §4–7. |  |
| PRINTERSCANNER | PURCHASE (YEAR) | Notes (Aankoopjaar) + sourceData.purchaseYear — no purchaseYear field | Notes + transform | 4-digit year → note 'Aankoopjaar: YYYY'; full dates (9.7.2026, 18 SEPT 2025, Excel serial 46062) → also purchaseDate YYYY-MM-DD. |  |
| PRINTERSCANNER | Column 1 | Notes | Notes | Note line 'Opmerking: <value>' (empty / N/A skipped) |  |
| BEAMER | INV- CODE | code | Direct | Verbatim — no normalisation. codePrefix = leading letters, codeNumber = integer of trailing digits (leading zeros stay only in `code`). |  |
| BEAMER | BRAND - MODEL | brand + model + name | Direct | Brand = first word; Model = remainder, ' - ' separators removed. PW/RT MODULE: brand from sheet (Prowise/Riotouch). Name = Brand + Model, fallback '<Type> <code>'. |  |
| BEAMER | S/N | serialNumber | Direct | Trim. |  |
| BEAMER | LOCATION | location / currentLocationId (review) | Review | Match to AIMS location only if safe; else LOCATION_REVIEW_REQUIRED + 'Legacy locatie:' note. |  |
| BEAMER | CONDITION | condition | Direct | See §4–7. |  |
| BEAMER | PURCHASE (YEAR) | Notes (Aankoopjaar) + sourceData.purchaseYear — no purchaseYear field | Notes + transform | 4-digit year → note 'Aankoopjaar: YYYY'; full dates (9.7.2026, 18 SEPT 2025, Excel serial 46062) → also purchaseDate YYYY-MM-DD. |  |
| BEAMER | / | Notes | Notes | Note line 'Opmerking: <value>' (empty / N/A skipped) |  |
| UPS | INV- CODE | code | Direct | Verbatim — no normalisation. codePrefix = leading letters, codeNumber = integer of trailing digits (leading zeros stay only in `code`). |  |
| UPS | BRAND - MODEL | brand + model + name | Direct | Brand = first word; Model = remainder, ' - ' separators removed. PW/RT MODULE: brand from sheet (Prowise/Riotouch). Name = Brand + Model, fallback '<Type> <code>'. |  |
| UPS | SPECS | technicalSpecifications.rawSpecifications | Direct | Free text kept verbatim (uses the new free-text specifications support). |  |
| UPS | S/N | serialNumber | Direct | Trim. |  |
| UPS | GROEP | Notes (Groep) | Notes | Note line 'Groep: <value>' (empty / N/A skipped) |  |
| UPS | INVENTORY LOCATION | location / currentLocationId (review) | Review | Match to AIMS location only if safe; else LOCATION_REVIEW_REQUIRED + 'Legacy locatie:' note. |  |
| UPS | CONDITION | condition | Direct | See §4–7. |  |
| UPS | PURCHASE (YEAR) | Notes (Aankoopjaar) + sourceData.purchaseYear — no purchaseYear field | Notes + transform | 4-digit year → note 'Aankoopjaar: YYYY'; full dates (9.7.2026, 18 SEPT 2025, Excel serial 46062) → also purchaseDate YYYY-MM-DD. |  |
| UPS | OPM | Notes | Notes | Note line 'Opmerking: <value>' (empty / N/A skipped) |  |
| KEYBOARD | INV- CODE | code | Direct | Verbatim — no normalisation. codePrefix = leading letters, codeNumber = integer of trailing digits (leading zeros stay only in `code`). |  |
| KEYBOARD | BRAND - MODEL | brand + model + name | Direct | Brand = first word; Model = remainder, ' - ' separators removed. PW/RT MODULE: brand from sheet (Prowise/Riotouch). Name = Brand + Model, fallback '<Type> <code>'. |  |
| KEYBOARD | SPECS | technicalSpecifications.rawSpecifications | Direct | Free text kept verbatim (uses the new free-text specifications support). |  |
| KEYBOARD | S/N | serialNumber | Direct | Trim. |  |
| KEYBOARD | GROEP | Notes (Groep) | Notes | Note line 'Groep: <value>' (empty / N/A skipped) |  |
| KEYBOARD | INVENTORY LOCATION | location / currentLocationId (review) | Review | Match to AIMS location only if safe; else LOCATION_REVIEW_REQUIRED + 'Legacy locatie:' note. |  |
| KEYBOARD | CONDITION | condition | Direct | See §4–7. |  |
| KEYBOARD | PURCHASE (YEAR) | Notes (Aankoopjaar) + sourceData.purchaseYear — no purchaseYear field | Notes + transform | 4-digit year → note 'Aankoopjaar: YYYY'; full dates (9.7.2026, 18 SEPT 2025, Excel serial 46062) → also purchaseDate YYYY-MM-DD. |  |
| KEYBOARD | OPM | Notes | Notes | Note line 'Opmerking: <value>' (empty / N/A skipped) |  |

Fixed per sheet (no Excel column): `type` / `category` — LAPTOP→Laptop/Laptops, DESKTOP→Desktop/Desktops, MINI DESK→Mini desktop/Mini desktops, TABLET→Tablet/Tablets, MONITOR→Monitor/Monitors, DIGIBORD→Digibord/Digiborden, PW MODULE→Prowise module, RT MODULE→Riotouch module (both Digibord modules), TELEFOON→Vaste telefoon/Telefoons, MOBIEL→Mobiele telefoon/Mobiele telefoons, PRINTERSCANNER→Printer/scanner, BEAMER→Beamer/Beamers, UPS→UPS, KEYBOARD→Keyboard/Keyboards. Live category matches: see §3a.

**Sensitive columns excluded** (values never read into the preview, notes or sourceData):
| Sheet / column | Non-empty cells |
|---|---|
| DIGIBORD / WIFI USER NAME | 34 |
| DIGIBORD / WIFI PASSWORD | 34 |
| DIGIBORD / PASSWORD | 2 |
| TELEFOON / PASSWORD | 3 |

## 4. Unique Condition values in the included sheets
| Value (case/space-insensitive) | Spellings | Rows | Sheets |
|---|---|---|---|
| GOOD | GOOD | 109 | LAPTOP, DESKTOP, MINI DESK, TABLET, PW MODULE, BEAMER, UPS, KEYBOARD |
| USE FOR PARTS | USE FOR PARTS | 10 | LAPTOP, DESKTOP |
| 50% | 50% | 3 | LAPTOP, UPS |
| BAD | BAD | 1 | LAPTOP |
| DEFFECT | DEFFECT | 1 | PRINTERSCANNER |
| OUT OF SERVICE | OUT OF SERVICE | 3 | UPS |

Rows with an **empty** CONDITION: **222** (see decision D3).

## 5. Existing AIMS Condition values
`New`, `Excellent`, `Good`, `Fair`, `Poor`, `Defective`, `Beyond Repair` — a fixed list in code (`src/domain/types.ts`, zod schema in `src/domain/assetManagement.ts`, `AssetForm.tsx`, `Assets.tsx`, `AssetTransfer.tsx`, `mockRepository.tsx`, i18n labels). It is **not** a Firestore master-data list and Firestore Rules do not restrict `condition`, so adding values is a code change (Phase 2), not a data write.

## 6. Condition values to add
| Source value | Rows | Proposed AIMS value | Note |
|---|---|---|---|
| USE FOR PARTS | 10 | Use for parts | Not present in AIMS under any casing |
| BAD | 1 | Bad | Not present in AIMS under any casing |
| OUT OF SERVICE | 3 | Out of service | Not present in AIMS under any casing |

`GOOD` already exists as `Good` → **not** added again.

## 7. Ambiguous Condition values — CONDITION_REVIEW_REQUIRED
| Source value | Rows | Why ambiguous |
|---|---|---|
| 50% (cell value 0.5, formatted as percentage) | 3 | Not a condition label; could mean Fair/partly working. The earlier laptop importer mapped it to Fair — not applied here. |
| DEFFECT | 1 | Misspelling; almost certainly the existing `Defective`. Not added as a new value — needs your confirmation to map. |

## 8. Fields that go to Notes
One labelled line per value, empty / `N/A` / `NOT AVAILABLE` skipped, dedicated fields take priority:
`Legacy locatie`, `Legacy gebruiker`, `Bruikleen contract`, `Charger`, `Laptop bag`, `Mouse`, `Opmerking` (OPM / OPMERKING / OPMERKINGEN / Column 1 / Column 11 / `/` / `\`), `Gekoppeld digibord` (MINI DESK `DB#`), `Groep` (DIGIBORD `LOCATIE GROEP`, UPS/KEYBOARD `GROEP`), `Module`, `Mini desktop`, `Aankoopjaar`.

Accessory values found: Charger `ORIGINAL`×12 · Bruikleen contract `YES`×35 · Laptop bag `NONE`×6, `BAG`×1 · Mouse `NO`×6, `YES`×1 — kept exactly as written in Excel.

## 9. Duplicate INV-codes (within the Excel)
| Sheet!Row | INV-code | Name | Status | Reasons |
|---|---|---|---|---|
| DIGIBORD!13 | KCSDB48 | Prowise | SOURCE_DUPLICATE | DUPLICATE_IN_EXCEL: DIGIBORD!13, DIGIBORD!14 |
| DIGIBORD!14 | KCSDB48 | SHARP | SOURCE_DUPLICATE | DUPLICATE_IN_EXCEL: DIGIBORD!13, DIGIBORD!14 |
| UPS!17 | UPS014 | UPS UPS014 | SOURCE_DUPLICATE | DUPLICATE_IN_EXCEL: UPS!17, UPS!38; DUPLICATE_SERIAL 9B1938A16053: UPS!4 (no code), UPS!17 UPS014 |
| UPS!38 | UPS014 | APC | SOURCE_DUPLICATE | DUPLICATE_IN_EXCEL: UPS!17, UPS!38 |

## 10. INV-codes already existing in AIMS
Live snapshot (2026-09-25T16:19:57.915Z): 70 assets in AIMS, of which **67 came from an earlier legacy import** (19 Sep 2026, `migrationVersion: laptop-inventory-v1`). Matching is on prefix + number (and serial), not the raw string, because the app's generator writes `KCSL-06` where Excel has `KCSL6`.

| Sheet!Row | Excel code | AIMS record | Status | Existing record needs correcting |
|---|---|---|---|---|
| LAPTOP!4 | KHL02 | KHL-02 (ast-0069) | ALREADY_EXISTS |  |
| LAPTOP!6 | KCSL6 | KCSL-06 (ast-0070) | ALREADY_EXISTS |  |
| BEAMER!5 | PRO-01 | PRO-01 (legacy-laptop-7159b6d4-asset) | ALREADY_EXISTS | type 'Laptop'→'Beamer'; category 'IT Equipment'→ proper category |
| BEAMER!6 | PRO-03 | PRO-03 (legacy-laptop-7359b9fa-asset) | ALREADY_EXISTS | type 'Laptop'→'Beamer'; category 'IT Equipment'→ proper category |
| BEAMER!7 | PRO-04 | PRO-04 (legacy-laptop-6e59b21b-asset) | ALREADY_EXISTS | type 'Laptop'→'Beamer'; category 'IT Equipment'→ proper category |
| UPS!5 | UPS012 | UPS012 (legacy-laptop-d228f964-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!6 | UPS011 | UPS011 (legacy-laptop-d528fe1d-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!7 | UPS010 | UPS010 (legacy-laptop-d428fc8a-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!8 | UPS009 | UPS009 (legacy-laptop-412be6b8-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category; serial '1.81223E+11' is Excel scientific notation (precision lost) — Excel raw: '181222503118' |
| UPS!9 | UPS061 | UPS061 (legacy-laptop-45306a32-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category; serial '2.10463E+11' is Excel scientific notation (precision lost) — Excel raw: '210462500180' |
| UPS!10 | UPS006 | UPS006 (legacy-laptop-402be525-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!11 | UPS060 | UPS060 (legacy-laptop-46306bc5-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category; serial '2.11123E+11' is Excel scientific notation (precision lost) — Excel raw: '211122500123' |
| UPS!12 | UPS013 | UPS013 (legacy-laptop-d328faf7-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!13 | UPS004 | UPS004 (legacy-laptop-3e2be1ff-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!14 | UPS003 | UPS003 (legacy-laptop-3b2bdd46-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category; serial '2.20123E+11' is Excel scientific notation (precision lost) — Excel raw: '220122503173' |
| UPS!15 | UPS002 | UPS002 (legacy-laptop-3c2bded9-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!16 | UPS001 | UPS001 (legacy-laptop-392bda20-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!18 | UPS015 | UPS015 (legacy-laptop-d128f7d1-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!19 | UPS016 | UPS016 (legacy-laptop-ce28f318-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!20 | UPS019 | UPS019 (legacy-laptop-cd28f185-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!21 | UPS020.1 | UPS020.1 (legacy-laptop-325934a4-asset) | MANUAL_REVIEW | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!22 | UPS020 | UPS020 (legacy-laptop-ce26b481-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!23 | Fin.Ad02 | Fin.Ad02 (legacy-laptop-5a41097b-asset) | MANUAL_REVIEW | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!24 | Fin.Ad01 | Fin.Ad01 (legacy-laptop-5b410b0e-asset) | MANUAL_REVIEW | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!26 | UPS059 | UPS059 (legacy-laptop-c5337249-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!27 | UPS058 | UPS058 (legacy-laptop-c43370b6-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!28 | UPS062 | UPS062 (legacy-laptop-4430689f-asset) | CONFLICT | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!29 | UPS063 | UPS063 (legacy-laptop-4330670c-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!30 | UPS064 | UPS064 (legacy-laptop-42306579-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!31 | UPS079 | UPS079 (legacy-laptop-492e31e7-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!32 | UPS008 | UPS008 (legacy-laptop-422be84b-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!33 | UPS005 | UPS005 (legacy-laptop-3d2be06c-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!34 | UPS088 | UPS088 (legacy-laptop-c2179713-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!35 | UPS077 | UPS077 (legacy-laptop-3f2e2229-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!36 | UPS085 | UPS085 (legacy-laptop-cd17a864-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!37 | UPS023 | UPS023 (legacy-laptop-cb26afc8-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!39 | UPS037 | UPS037 (legacy-laptop-cf24777d-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!40 | UPS032 | UPS032 (legacy-laptop-ca246f9e-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!41 | UPS067 | UPS067 (legacy-laptop-3f3060c0-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!42 | UPS066 | UPS066 (legacy-laptop-40306253-asset) | CONFLICT | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!43 | UPS021 | UPS021 (legacy-laptop-cd26b2ee-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| UPS!44 | UPS022 | UPS022 (legacy-laptop-cc26b15b-asset) | ALREADY_EXISTS | type 'Laptop'→'UPS'; category 'IT Equipment'→ proper category |
| KEYBOARD!4 | KB19 | KB19 (legacy-laptop-fb1e32f6-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |
| KEYBOARD!5 | KB20 | KB20 (legacy-laptop-0a20892a-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |
| KEYBOARD!6 | KB21 | KB21 (legacy-laptop-0b208abd-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |
| KEYBOARD!7 | KB22 | KB22 (legacy-laptop-08208604-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |
| KEYBOARD!8 | KB23 | KB23 (legacy-laptop-09208797-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |
| KEYBOARD!9 | KB24 | KB24 (legacy-laptop-062082de-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |
| KEYBOARD!10 | KB25 | KB25 (legacy-laptop-07208471-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |
| KEYBOARD!11 | KB26 | KB26 (legacy-laptop-04207fb8-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |
| KEYBOARD!12 | KB27 | KB27 (legacy-laptop-0520814b-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |
| KEYBOARD!13 | KB28 | KB28 (legacy-laptop-02207c92-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |
| KEYBOARD!14 | KB29 | KB29 (legacy-laptop-03207e25-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |
| KEYBOARD!15 | KB30 | KB30 (legacy-laptop-f0229ed3-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |
| KEYBOARD!16 | KB31 | KB31 (legacy-laptop-ef229d40-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |
| KEYBOARD!17 | KB32 | KB32 (legacy-laptop-f222a1f9-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |
| KEYBOARD!18 | KB33 | KB33 (legacy-laptop-f122a066-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |
| KEYBOARD!19 | KB34 | KB34 (legacy-laptop-f422a51f-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |
| KEYBOARD!20 | KB35 | KB35 (legacy-laptop-f322a38c-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |
| KEYBOARD!21 | KB36 | KB36 (legacy-laptop-f622a845-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |
| KEYBOARD!22 | KB37 | KB37 (legacy-laptop-f522a6b2-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |
| KEYBOARD!23 | KB38 | KB38 (legacy-laptop-f822ab6b-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |
| KEYBOARD!24 | KB39 | KB39 (legacy-laptop-f722a9d8-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |
| KEYBOARD!25 | KB40 | KB40 (legacy-laptop-7625b05c-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |
| KEYBOARD!26 | KB41 | KB41 (legacy-laptop-7725b1ef-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |
| KEYBOARD!27 | KB42 | KB42 (legacy-laptop-7825b382-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |
| KEYBOARD!28 | KB43 | KB43 (legacy-laptop-7925b515-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |
| KEYBOARD!29 | KB44 | KB44 (legacy-laptop-7225aa10-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |
| KEYBOARD!30 | KB45 | KB45 (legacy-laptop-7325aba3-asset) | ALREADY_EXISTS | type 'Laptop'→'Keyboard'; category 'IT Equipment'→ proper category |

**Findings on the existing records (not changed in Phase 1):**
- All 67 earlier-imported keyboards/UPS/beamers were written by the *laptop* importer: `type: "Laptop"`, `subcategory: "Computers"`, `category: "IT Equipment"` (a category that does not exist in the category list). Phase 2 should **update** them (type/category/notes), not create duplicates.
- Serial numbers destroyed by Excel scientific notation in the earlier import: `UPS003: 2.20123E+11`, `UPS009: 1.81223E+11`, `UPS061: 2.10463E+11`, `UPS060: 2.11123E+11`. This workbook still has the same numeric cells; the raw values will be recovered where Excel kept full precision.
- Two AIMS assets share prefix+number: `UPS#20: UPS020.1, UPS020` (`UPS020.1` was stored with codeNumber 20).
- Duplicate serial already in AIMS: `0B2401P12878: UPS066, UPS062` — the same Excel conflict was imported as-is.
- In AIMS but not in this Excel: `KHL-01 (ast-0068, Archived)`. `KHL02`/`KHL-02` and `KCSL6`/`KCSL-06` were created manually in the app on 25 Sep.
- Orphan reservation: `assetCodes/KCSL-01` exists but no asset carries that code (a create that reserved the code and then failed). Excel `KCSL01` is therefore MANUAL_REVIEW.

## 11. Conflicting records
| Sheet!Row | INV-code | Name | Status | Reasons |
|---|---|---|---|---|
| LAPTOP!28 | KCSL42 | HP ELITEBOOK 850 G5 | CONFLICT | DUPLICATE_SERIAL 5CG9044D49: LAPTOP!28 KCSL42, LAPTOP!29 KCSL43 |
| LAPTOP!29 | KCSL43 | HP ELITEBOOK 850 G5 | CONFLICT | DUPLICATE_SERIAL 5CG9044D49: LAPTOP!28 KCSL42, LAPTOP!29 KCSL43 |
| DESKTOP!30 | KCSDESK-33 | HP PRODESK 400 G7 | CONFLICT | DUPLICATE_SERIAL CZC122BJPQ: DESKTOP!30 KCSDESK-33, DESKTOP!36 KCSDESK-39 |
| DESKTOP!36 | KCSDESK-39 | HP PRODESK 400 G7 | CONFLICT | DUPLICATE_SERIAL CZC122BJPQ: DESKTOP!30 KCSDESK-33, DESKTOP!36 KCSDESK-39 |
| MINI DESK!9 | KCSMD06 | HP PRODESK 400 G5 Mini | CONFLICT | DUPLICATE_SERIAL 8CC9480166: MINI DESK!9 KCSMD06, MINI DESK!11 KCSMD08 |
| MINI DESK!11 | KCSMD08 | HP PRODESK 400 G5 Mini | CONFLICT | DUPLICATE_SERIAL 8CC9480166: MINI DESK!9 KCSMD06, MINI DESK!11 KCSMD08 |
| BEAMER!4 | PRO-00 | PROJECTOR SCHERM | CONFLICT | CODE_NUMBER_ZERO — Firestore Rules require codeNumber >= 1 |
| UPS!4 | (none) | UPS | CONFLICT | NO_INV_CODE; DUPLICATE_SERIAL 9B1938A16053: UPS!4 (no code), UPS!17 UPS014 |
| UPS!28 | UPS062 | APC | CONFLICT | DUPLICATE_SERIAL 0B2401P12878: UPS!28 UPS062, UPS!42 UPS066; EXISTS_IN_AIMS as UPS062 (legacy-laptop-4430689f-asset, earlier legacy import); SERIAL_ON_OTHER_AIMS_ASSET: UPS066 |
| UPS!42 | UPS066 | APC | CONFLICT | DUPLICATE_SERIAL 0B2401P12878: UPS!28 UPS062, UPS!42 UPS066; EXISTS_IN_AIMS as UPS066 (legacy-laptop-40306253-asset, earlier legacy import); SERIAL_ON_OTHER_AIMS_ASSET: UPS062 |

Duplicate serial numbers across different INV-codes almost always mean a copy/paste error in one of the rows. AIMS' normal create path rejects duplicate serials, so these need a decision per pair.

## 12. Location mapping
AIMS structure (live): **4 main locations** — Kangoeroe High (loc-0002), KCS OnderBouw (loc-0004), KCS BovenBouw (loc-0005), Kangoeroe High Nieuw Bouw (loc-0031) — and **56 departments**, which in practice hold the rooms/groups (`ICT kantoor`, `Conference Room`, `Storage`, `Groep 1A`…`Groep 8C`, `Cabin-1`…). There are no sub-locations.

Excel LOCATION values are rooms/groups, so they map to **`department`**, not to a main location. Matching is exact (case/space-insensitive); class codes like `7B` are matched to `Groep 7B` as *probable*.

| Excel location → AIMS department | Records |
|---|---|
| LOCATION_REVIEW_REQUIRED | 135 |
| ICT kantoor (dep-0018) — exact | 37 |
| Conference Room (dep-0019) — exact | 28 |
| Storage (dep-0009) — exact | 12 |
| ICT (dep-0008) — exact | 8 |
| Finance (dep-0011) — exact | 8 |
| HRM (dep-0012) — exact | 3 |
| Finance Administratie (dep-0015) — exact | 3 |
| KO/NSO (dep-0010) — exact | 2 |
| Secretariaat (dep-0017) — exact | 2 |
| ICT Camera (dep-0027) — exact | 2 |
| Facilitair (dep-0014) — exact | 1 |
| Groep 7B (dep-0056) — probable (class code → Groep) | 1 |
| Groep 7A (dep-0055) — probable (class code → Groep) | 1 |
| Groep 8A (dep-0007) — probable (class code → Groep) | 1 |
| Groep 3C (dep-0042) — probable (class code → Groep) | 1 |
| Groep 3B (dep-0041) — probable (class code → Groep) | 1 |
| Groep 5A (dep-0048) — probable (class code → Groep) | 1 |
| Groep 4D (dep-0047) — probable (class code → Groep) | 1 |
| Groep 1D (dep-0035) — probable (class code → Groep) | 1 |
| Groep 7D (dep-0058) — probable (class code → Groep) | 1 |
| Groep 3A (dep-0040) — probable (class code → Groep) | 1 |
| Groep 4A (dep-0044) — probable (class code → Groep) | 1 |
| Groep 5B (dep-0049) — probable (class code → Groep) | 1 |
| Groep 2A (dep-0036) — probable (class code → Groep) | 1 |
| Groep 4B (dep-0045) — probable (class code → Groep) | 1 |
| KO-Kantoor (dep-0020) — exact | 1 |
| ICT STORAGE (dep-0023) — exact | 1 |

Main location (building): **cannot be derived** from the Excel for 238 records — only values starting with `KH` suggest Kangoeroe High (19 records, still to confirm). Needs a default building per sheet or per value from you.

Unmatched values (LOCATION_REVIEW_REQUIRED, kept as `Legacy locatie:`):

- **Numeric codes (UPS/KEYBOARD 'INVENTORY LOCATION', DIGIBORD 'ADMIN INVENTORY LOCATION')** (80 records): `1`×1, `2`×2, `3`×3, `4`×2, `5`×1, `6`×2, `8`×2, `9`×4, `10`×2, `11`×2, `12`×2, `13`×1, `14`×3, `15`×2, `16`×1, `19`×2, `20`×2, `21`×1, `23`×1, `32`×2, `34`×1, `37`×2, `39`×3, `58`×2, `59`×3, `60`×2, `61`×1, `62`×2, `63`×2, `64`×1, `66`×2, `67`×2, `72`×1, `73`×1, `77`×2, `79`×1, `80`×1, `81`×1, `82`×1, `83`×1, `85`×2, `86`×1, `87`×1, `88`×2, `89`×1, `90`×1, `91`×1, `92`×1
- **Room codes (LOK5, LOK14, LOK15, C1)** (4 records): `LOK15`×1, `LOK14`×1, `LOK5`×1, `C1`×1
- **Location + linked device (MONITOR)** (15 records): `ICT KCSDESK-09`×1, `Secretariaat KCSDESK-07`×2, `Fin Admin KCSL`×1, `Fin Admin KCSDESK-`×2, `KO kantoor KCSDESK-`×1, `Fin Manager KCSL`×1, `Finance KCSL`×1, `Finance KCSDESK-`×1, `BB Kantoor KCSDESK-`×1, `KH Admin KCSL`×1, `KH Admin KCSDESK-`×2, `Directeur KH KCSL`×1
- **Not a location** (2 records): `****`×1, `FREE`×1
- **Named places without an exact department** (34 records): `KCS BASIS`×11, `KH`×12, `ADMIN/SECR`×1, `Dependance Administratie`×1, `Server Room KCS`×1, `KH Administratie`×1, `KO ADMINISTRATIE`×1, `ICT Server KCS`×1, `FIN-Manager`×1, `BB-Admin`×1, `OD-KH`×1, `KH-Admin`×1, `KH DIRECTEUR OFFICE`×1

Near-misses I did **not** auto-match (need your yes/no): `KH`→Kangoeroe High?, `FINANCE`/`Finance Manager`/`FIN-Manager`→`Finance Manager`?, `KH-Admin`/`KH Admin`/`KH Administratie`→`Administratie KH` (exists twice: dep-0024 and dep-0029), `KO ADMINISTRATIE`→`Administratie KO`, `Dependance Administratie`→`Administratie Dependance`, `ADMIN/SECR`→`Administratie/Secr`, `KH DIRECTEUR OFFICE`→`Drecteur Office KH`, `Server Room KCS`/`ICT Server KCS`→?, `KCS BASIS`→?. No departments or locations are created automatically.

## 13. Assignment / user mapping
AIMS has **4 real users**: `Vicel Desperce`, `shaquil alienda`, `Emmy Sastropawiro`, `Julian Maclean` (plus demo accounts, ignored).

| Result | Records |
|---|---|
| ASSIGNMENT_REVIEW_REQUIRED | 62 |
| MATCH: Vicel Desperce (case-insensitive exact) — confirm before assigning | 1 |
| MATCH: Julian Maclean (case-insensitive exact) — confirm before assigning | 1 |

So nearly every Excel USER is a staff member **without an AIMS account** → ASSIGNMENT_REVIEW_REQUIRED, `assignedTo` stays empty, value kept as `Legacy gebruiker: <value>`. No users are created. The two matches (Vicel Desperce, Julian Maclean) are exact name matches but still need your confirmation before `assignedTo` is set.

Not a person (never matched): `DAG LAPTOP`/`DAGLAPTOP`, `FREE`, `TERUG NAAR DE LEVERANCIER`, `FINANCE BACK UP`, `ICT AFDELING | DIV. WERKZH`, `ICT Afdeling`, `Administratie Bovenbouw`, `DONATIE HOKSTAM`, `DONATIE HOKSTAM - BAASARON`. `FREE` / `TERUG NAAR DE LEVERANCIER` hint at a status (D5). Same people appear in different casing across sheets (`REGINA BEVERDIJK` / `Regina Beverdijk`); `CARMEN KARTOTAROENO` vs `Carmen Kartodikromo` — review.

## 14. Code Group / assetCodes implications
Live: 24 code groups (all active, all created in the app with rule-valid prefixes — the hyphenated prefixes in `scripts/seedKcsCodeGroups.mjs` were **not** used), 4 `assetCodes` reservations (KCSL-01, KCSL-06, KHL-01, KHL-02).

| Excel prefix | Rows | Highest no. | Digits | AIMS code group (live) | nextAvailableNumber now | Needed after import |
|---|---|---|---|---|---|---|
| KHL | 1 | 2 | 2 | KHL — Kangoeroe High (cg-0024) | 3 | 3 |
| KCSL | 59 | 79 | 2/1 | KCSL — Laptop (cg-0001) | 7 | 80 |
| KSCL | 2 | 44 | 2 | ✗ (typo of KCSL?) | — | 45 (if a group is created) |
| KCSDESK | 38 | 45 | 2 | KCSDESK — Desktop PC (cg-0005) | 1 | 46 |
| KCSMD | 30 | 30 | 2 | KCSMD — Desktop Mini PC (cg-0006) | 1 | 31 |
| TAB | 2 | 2 | 2 | TAB — Tablet (cg-0012) | 1 | 3 |
| MON | 46 | 46 | 2 | ✗ none — closest `KCSMON` | — | 47 (if a group is created) |
| KCSDB | 51 | 52 | 2 | KCSDB — Digibord (cg-0002) | 1 | 53 |
| KCSPW | 13 | 13 | 2 | KCSPW — PROWISE MODULE (cg-0003) | 1 | 14 |
| KCSRT | 6 | 6 | 2 | KCSRT — RIOTOUCH MODULE (cg-0004) | 1 | 7 |
| TL | 12 | 12 | 2 | ✗ none — closest `KCSLT` | — | 13 (if a group is created) |
| KCSMOB | 8 | 13 | 2 | KCSMOB — Mobiel telefoon (cg-0023) | 1 | 14 |
| PR | 9 | 9 | 2 | ✗ none — closest `KCSPR` | — | 10 (if a group is created) |
| PRO | 4 | 4 | 2 | ✗ none — closest `BR` | — | 5 (if a group is created) |
| UPS | 36 | 88 | 3 | UPS — Battery backup (cg-0009) | 1 | 89 |
| FIN.AD | 2 | 2 | 2 | ✗ not a valid prefix | — | 3 (if a group is created) |
| KB | 27 | 45 | 2 | ✗ none — closest `KBW / KBWS` | — | 46 (if a group is created) |

How code generation works today (verified in code):
- **Normal create** (`AssetForm` → `asset.create` → `FirebaseInventoryRepository.prepareAssetCode` → `allocateAssetCodeNumber`): needs an *active* code group with that exact prefix, requires a serial number, and **formats the code as `PREFIX-NN`** (`KCSL6` would become `KCSL-06`, exactly what happened to ast-0070). It also reserves `assetCodes/{code}`. ⇒ **Phase 2 must not use this path.**
- `normalizeAssetCode` (code-correction path, older import helpers) rewrites codes too ⇒ **must not be called** for these records.
- The allocator's floor is `max(group.nextAvailableNumber, highest codeNumber of any asset with the same codePrefix) + 1`, so generated codes never reuse an imported number as long as imported assets carry the correct `codePrefix` + integer `codeNumber` — even with a stale counter. Today every counter except KCSL (7) and KHL (3) is still 1, while e.g. UPS assets up to 88 exist: harmless thanks to the floor, but should be raised.
- `assetCodes` reservations are keyed by the exact string, so `KCSL-06` does not block `KCSL6` — the numeric floor above is what actually prevents collisions.
- Firestore Rules: `codeNumber` int ≥ 1 (`PRO-00` fails), codeGroup `prefix` must match `^[A-Z0-9]{1,16}$` (`FIN.AD` can never be a group).

**Safe Phase 2 insertion plan (proposal, nothing executed):**
1. Dedicated legacy import writer (the existing `validLegacyImportedAsset` rule path, with `sourceData` + `importMetadata`) writing `code` **verbatim**, `codePrefix` = leading letters, `codeNumber` = integer of the trailing digits; stable document IDs so re-runs are idempotent; **skip create when prefix+number already exists** — those 64 records become *updates* of the existing document instead (type/category/notes/serial repair), never a second asset.
2. Reserve `assetCodes/{code}` with the verbatim code for each new record. `13 T/M 18` (contains `/`) cannot be a document ID and stays out until corrected.
3. Afterwards raise each group's `nextAvailableNumber` to the value in the table above — never lower it. Done by an admin script/Function, not by the import itself.
4. Prefix mismatches (D7): Excel `MON`, `TL`, `PR`, `PRO`, `KB` vs AIMS groups `KCSMON`, `KCSLT`, `KCSPR`, `BR`, `KBW`/`KBWS`. Options: (a) create groups `MON`, `TL`, `PR`, `PRO`, `KB` so these series continue, or (b) import them as legacy-only codes and let new assets start the AIMS series (e.g. `KCSMON-01`). Codes are imported verbatim either way.
5. Format: the generator continues `UPS088` as `UPS-89` and `KCSL79` as `KCSL-80` — no collision, but a different style. Keeping the legacy style requires a per-group format setting (code change).

## 15. Records ready for import
**264** new records are READY (valid unique code, not in AIMS, no duplicate serial). Before writing they still need: department/building mapping (§12), condition decisions (§6–7, D3) and a category for 40 of them (§3a). **64** records already exist and are planned as updates, not creates.

| Sheet | READY (create) | ALREADY_EXISTS (update) | CONFLICT | SOURCE_DUPLICATE | MANUAL_REVIEW |
|---|---|---|---|---|---|
| LAPTOP | 55 | 2 | 2 | 0 | 3 |
| DESKTOP | 36 | 0 | 2 | 0 | 1 |
| MINI DESK | 28 | 0 | 2 | 0 | 0 |
| TABLET | 2 | 0 | 0 | 0 | 0 |
| MONITOR | 46 | 0 | 0 | 0 | 0 |
| DIGIBORD | 49 | 0 | 0 | 2 | 2 |
| PW MODULE | 13 | 0 | 0 | 0 | 0 |
| RT MODULE | 6 | 0 | 0 | 0 | 1 |
| TELEFOON | 12 | 0 | 0 | 0 | 0 |
| MOBIEL | 8 | 0 | 0 | 0 | 0 |
| PRINTERSCANNER | 9 | 0 | 0 | 0 | 0 |
| BEAMER | 0 | 3 | 1 | 0 | 0 |
| UPS | 0 | 32 | 3 | 2 | 4 |
| KEYBOARD | 0 | 27 | 0 | 0 | 0 |

### 3a. Category mapping (live)
| Sheet | AIMS category |
|---|---|
| LAPTOP | Laptops (cat-0032) |
| DESKTOP | Desktop  PC (cat-0066) |
| MINI DESK | Desktop Mini PC (cat-0063) |
| TABLET | Tablets (cat-0081) |
| MONITOR | Monitor (cat-0064) |
| DIGIBORD | Digiborden (cat-0062) |
| PW MODULE | CATEGORY_REVIEW_REQUIRED — no matching AIMS category |
| RT MODULE | CATEGORY_REVIEW_REQUIRED — no matching AIMS category |
| TELEFOON | CATEGORY_REVIEW_REQUIRED — no matching AIMS category |
| MOBIEL | Smartphone (cat-0080) |
| PRINTERSCANNER | CATEGORY_REVIEW_REQUIRED — no matching AIMS category |
| BEAMER | Beamer (cat-0065) |
| UPS | CATEGORY_REVIEW_REQUIRED — no matching AIMS category |
| KEYBOARD | CATEGORY_REVIEW_REQUIRED — no matching AIMS category |

No category exists for PW/RT modules, desk phones (TELEFOON), printers/scanners, UPS, and KEYBOARD only has `Keyboard Wired` / `Keyboard Wireless` (the Excel does not say which). Nothing is created automatically.

## 16. Records requiring manual review
| Sheet!Row | INV-code | Name | Status | Reasons |
|---|---|---|---|---|
| LAPTOP!5 | KCSL01 | DELL INSPIRON 15 | MANUAL_REVIEW | ORPHAN_RESERVATION assetCodes/KCSL-01 exists but no asset has that code |
| LAPTOP!26 | KSCL40 | HP ELITEBOOK 850 G4 | MANUAL_REVIEW | SUSPECTED_PREFIX_TYPO KSCL (sheet otherwise uses KCSL) |
| LAPTOP!30 | KSCL44 | ASUS R301L SONIC MASTER | MANUAL_REVIEW | SUSPECTED_PREFIX_TYPO KSCL (sheet otherwise uses KCSL) |
| DESKTOP!15 | 13 T/M 18 | HP PRODESK 400 G7 | MANUAL_REVIEW | CODE_NOT_PARSEABLE (no PREFIX+NUMBER form); SLASH_IN_CODE (invalid as assetCodes document id) |
| DIGIBORD!21 | (none) | SHARP | MANUAL_REVIEW | NO_INV_CODE |
| DIGIBORD!56 | (none) | SHARP | MANUAL_REVIEW | NO_INV_CODE |
| RT MODULE!10 | (none) | Riotouch ANDROID RIOTOUCH | MANUAL_REVIEW | NO_INV_CODE |
| UPS!21 | UPS020.1 | APC | MANUAL_REVIEW | CODE_NOT_PARSEABLE (no PREFIX+NUMBER form); EXISTS_IN_AIMS as UPS020.1 (legacy-laptop-325934a4-asset, earlier legacy import) |
| UPS!23 | Fin.Ad02 | APC | MANUAL_REVIEW | NON_STANDARD_PREFIX (rules for codeGroups allow only A-Z0-9); EXISTS_IN_AIMS as Fin.Ad02 (legacy-laptop-5a41097b-asset, earlier legacy import) |
| UPS!24 | Fin.Ad01 | APC | MANUAL_REVIEW | NON_STANDARD_PREFIX (rules for codeGroups allow only A-Z0-9); EXISTS_IN_AIMS as Fin.Ad01 (legacy-laptop-5b410b0e-asset, earlier legacy import) |
| UPS!25 | (none) | UPS | MANUAL_REVIEW | NO_INV_CODE |

Data-quality flags on otherwise usable records:

| Sheet!Row | INV-code | Flag |
|---|---|---|
| LAPTOP!11 | KCSL25 | BRAND_SPELLING_REVIEW (DEL — kept as source) |
| LAPTOP!32 | KCSL46 | PURCHASE_YEAR_REVIEW (2O24) |
| MINI DESK!28 | KCSMD25 | PURCHASE_EXCEL_SERIAL 46062 -> 2026-02-09 |
| MINI DESK!29 | KCSMD26 | PURCHASE_EXCEL_SERIAL 46062 -> 2026-02-09 |
| MINI DESK!30 | KCSMD27 | PURCHASE_EXCEL_SERIAL 46062 -> 2026-02-09 |
| MINI DESK!31 | KCSMD28 | PURCHASE_EXCEL_SERIAL 46062 -> 2026-02-09 |
| MINI DESK!32 | KCSMD29 | PURCHASE_EXCEL_SERIAL 46062 -> 2026-02-09 |
| TABLET!4 | TAB-01 | IMEI_REVIEW (14 digits; Excel stored it as a number — precision may be lost) |
| TABLET!5 | TAB-02 | IMEI_REVIEW (14 digits; Excel stored it as a number — precision may be lost) |
| TELEFOON!13 | TL-10 | BRAND_SPELLING_REVIEW (Gransdstream — kept as source) |
| PRINTERSCANNER!8 | PR-05 | BRAND_SPELLING_REVIEW (Keyocera — kept as source) |
| PRINTERSCANNER!9 | PR-06 | BRAND_SPELLING_REVIEW (Keyocera — kept as source) |
| BEAMER!4 | PRO-00 | BRAND_UNKNOWN |

Also: 41 records have a brand but no model (mainly UPS `APC`/`FORZA`, PW MODULE `PROWISE`), and many MONITOR / DIGIBORD / KEYBOARD / UPS rows have no brand, model or serial at all. Brand spellings are **kept as written** (`DEL`, `Keyocera`, `Gransdstream`).

## Decisions needed before Phase 2
- **D1** Confirm the workbook (`docs/MASTER INVENTORY 2026.xlsx`; `…(2).xlsx` was not found).
- **D2** Existing 64 records: update them in place (fix type/category, add notes, repair scientific-notation serials)? Recommended: yes.
- **D3** Empty CONDITION (222 rows): (a) add neutral `Unknown`/`Onbekend`, or (b) default `Good`. Recommended: (a).
- **D4** Add `Bad`, `Use for parts`, `Out of service`; map `DEFFECT`→`Defective`?; `50%`→?
- **D5** Status: default `Available`; should `OUT OF SERVICE`, `FREE`, `TERUG NAAR DE LEVERANCIER` set another status?
- **D6** Each CONFLICT / SOURCE_DUPLICATE / MANUAL_REVIEW row (§9, §11, §16), incl. the orphan `KCSL-01` reservation and `UPS020`/`UPS020.1` sharing number 20.
- **D7** Prefix mismatches `MON`/`TL`/`PR`/`PRO`/`KB` vs `KCSMON`/`KCSLT`/`KCSPR`/`BR`/`KBW` (§14 step 4) and legacy vs `PREFIX-NN` format for new codes.
- **D8** Building (main location) per sheet/value, the near-miss department matches (§12), and categories for modules, phones, printers, UPS, keyboards (§3a).

## 17. Transformed previews (one per asset type)
**SOURCE:** Sheet `LAPTOP` · Row 31 · **READY**
```
Inventory Code: KCSL45
codePrefix / codeNumber: KCSL / 45
Code group: KCSL (cg-0001)
Name: LENOVO THINKPAD ED580
Asset Type: Laptop
Category: Laptops (cat-0032)
Brand: LENOVO
Model: THINKPAD ED580
Serial Number: PF-1KHHWH
Department: Finance (dep-0011) — exact
Location (building): LOCATION_REVIEW_REQUIRED (building not derivable)
Condition: GOOD
Purchase Year: 2024
Assigned to: ASSIGNMENT_REVIEW_REQUIRED
Technical specifications:
  (free text): INTEL CORE i5 - 8250 1.60GHz | 16GB - 128GB SSD | WIN10 PRO | OFFICE 2021

Notes:
Legacy locatie: FINANCE
Legacy gebruiker: REGINA BEVERDIJK
Bruikleen contract: YES
Aankoopjaar: 2024
```

**SOURCE:** Sheet `DESKTOP` · Row 16 · **READY**
```
Inventory Code: KCSDESK-19
codePrefix / codeNumber: KCSDESK / 19
Code group: KCSDESK (cg-0005)
Name: HP PRODESK 400 G7
Asset Type: Desktop
Category: Desktop  PC (cat-0066)
Brand: HP
Model: PRODESK 400 G7
Department: ICT kantoor (dep-0018) — exact
Location (building): LOCATION_REVIEW_REQUIRED (building not derivable)
Condition: GOOD
Purchase Year: 2025
Purchase Date: 2025-09-18
Technical specifications:
  (free text): Intel core i5 -10500 cpu @3.10GHz | 8GB/256SSD | WIN11PRO

Notes:
Legacy locatie: ICT KANTOOR
Aankoopjaar: 2025
```

**SOURCE:** Sheet `MINI DESK` · Row 4 · **READY**
```
Inventory Code: KCSMD01
codePrefix / codeNumber: KCSMD / 1
Code group: KCSMD (cg-0006)
Name: HP PRODESK 600 G5 Mini
Asset Type: Mini desktop
Category: Desktop Mini PC (cat-0063)
Brand: HP
Model: PRODESK 600 G5 Mini
Serial Number: 8CC9451PYC
Department: Groep 7B (dep-0056) — probable (class code → Groep)
Location (building): LOCATION_REVIEW_REQUIRED (building not derivable)
Condition: GOOD
Technical specifications:
  (free text): intel i5-9500T @ 2.20GHZ 8 GB Ram | WIN11 PRO
  Part number: 6FY52AV

Notes:
Legacy locatie: 7B
Gekoppeld digibord: KCSDB42
```

**SOURCE:** Sheet `TABLET` · Row 4 · **READY**
```
Inventory Code: TAB-01
codePrefix / codeNumber: TAB / 1
Code group: TAB (cg-0012)
Name: LENOVO X1 THINKPAD
Asset Type: Tablet
Category: Tablets (cat-0081)
Brand: LENOVO
Model: X1 THINKPAD
Serial Number: R9-0P2QJH 17/09
Condition: GOOD
Technical specifications:
  (free text): INTEL CORE i5 - VPRO 7th Gen
  Part number: SL 10L16630
  IMEI: 14583000385731

Notes:
Opmerking: TOUCH DOET SOMS LASTIG
```

**SOURCE:** Sheet `MONITOR` · Row 12 · **READY**
```
Inventory Code: MON-09
codePrefix / codeNumber: MON / 9
Code group: NO_MATCH — closest: KCSMON
Name: Monitor MON-09
Asset Type: Monitor
Category: Monitor (cat-0064)
Department: LOCATION_REVIEW_REQUIRED
Location (building): LOCATION_REVIEW_REQUIRED (building not derivable)
Condition: (empty — D3)

Notes:
Legacy locatie: Finance KCSL
```

**SOURCE:** Sheet `DIGIBORD` · Row 5 · **READY**
```
Inventory Code: KCSDB45
codePrefix / codeNumber: KCSDB / 45
Code group: KCSDB (cg-0002)
Name: Digibord KCSDB45
Asset Type: Digibord
Category: Digiborden (cat-0062)
Department: LOCATION_REVIEW_REQUIRED
Location (building): LOCATION_REVIEW_REQUIRED (building not derivable)
Condition: (empty — D3)

Notes:
Legacy locatie: 37
Groep: 1D
Mini desktop: KCSMD10
```

**SOURCE:** Sheet `PW MODULE` · Row 4 · **READY**
```
Inventory Code: KCSPW01
codePrefix / codeNumber: KCSPW / 1
Code group: KCSPW (cg-0003)
Name: Prowise PWMOPCi7G5
Asset Type: Prowise module
Category: CATEGORY_REVIEW_REQUIRED — no matching AIMS category
Brand: Prowise
Model: PWMOPCi7G5
Condition: (empty — D3)
Technical specifications:
  HW product no: PW.2.17006.0001
  SW product no: PW.2.17006.0003

Notes:
(none)
```

**SOURCE:** Sheet `RT MODULE` · Row 4 · **READY**
```
Inventory Code: KCSRT01
codePrefix / codeNumber: KCSRT / 1
Code group: KCSRT (cg-0004)
Name: Riotouch TOP H541
Asset Type: Riotouch module
Category: CATEGORY_REVIEW_REQUIRED — no matching AIMS category
Brand: Riotouch
Model: TOP H541
Serial Number: DS20210913003
Condition: (empty — D3)
Technical specifications:
  (free text): i5-4460 | 4GB - 128GB SSD | WIN10 PRO

Notes:
Opmerking: WIFI ISSUIE
```

**SOURCE:** Sheet `TELEFOON` · Row 4 · **READY**
```
Inventory Code: TL-01
codePrefix / codeNumber: TL / 1
Code group: NO_MATCH — closest: KCSLT
Name: Grandstream GXP1620
Asset Type: Vaste telefoon
Category: CATEGORY_REVIEW_REQUIRED — no matching AIMS category
Brand: Grandstream
Model: GXP1620
Serial Number: 271FVFTNB0C2B770
Condition: (empty — D3)
Technical specifications:
  MAC: C074ADC2B770
  Extensie: 200

Notes:
(none)
```

**SOURCE:** Sheet `MOBIEL` · Row 4 · **READY**
```
Inventory Code: KCSMOB05
codePrefix / codeNumber: KCSMOB / 5
Code group: KCSMOB (cg-0023)
Name: SAMSUNG GALAXY A03
Asset Type: Mobiele telefoon
Category: Smartphone (cat-0080)
Brand: SAMSUNG
Model: GALAXY A03
Serial Number: R9YT61BKP0Z
Condition: (empty — D3)
Assigned to: ASSIGNMENT_REVIEW_REQUIRED
Technical specifications:
  IMEI: 351084951384980
  Mobielnummer: 8122399

Notes:
Legacy gebruiker: Giovanni Robinson
```

**SOURCE:** Sheet `PRINTERSCANNER` · Row 4 · **READY**
```
Inventory Code: PR-01
codePrefix / codeNumber: PR / 1
Code group: NO_MATCH — closest: KCSPR
Name: TASKALFA MZ4000i
Asset Type: Printer/scanner
Category: CATEGORY_REVIEW_REQUIRED — no matching AIMS category
Brand: TASKALFA
Model: MZ4000i
Department: Secretariaat (dep-0017) — exact
Location (building): LOCATION_REVIEW_REQUIRED (building not derivable)
Condition: (empty — D3)

Notes:
Legacy locatie: Secretariaat
```

**SOURCE:** Sheet `BEAMER` · Row 5 · **ALREADY_EXISTS** → update legacy-laptop-7159b6d4-asset
```
Inventory Code: PRO-01
codePrefix / codeNumber: PRO / 1
Code group: NO_MATCH — closest: BR
Name: LG PW1000G-GL
Asset Type: Beamer
Category: Beamer (cat-0065)
Brand: LG
Model: PW1000G-GL
Serial Number: 610SRUE7K238
Department: ICT STORAGE (dep-0023) — exact
Location (building): LOCATION_REVIEW_REQUIRED (building not derivable)
Condition: GOOD

Notes:
Legacy locatie: ICT STORAGE
Opmerking: WHITE
```

**SOURCE:** Sheet `UPS` · Row 6 · **ALREADY_EXISTS** → update legacy-laptop-d528fe1d-asset
```
Inventory Code: UPS011
codePrefix / codeNumber: UPS / 11
Code group: UPS (cg-0009)
Name: UPS UPS011
Asset Type: UPS
Category: CATEGORY_REVIEW_REQUIRED — no matching AIMS category
Serial Number: 0B2423P05087
Department: LOCATION_REVIEW_REQUIRED
Location (building): LOCATION_REVIEW_REQUIRED (building not derivable)
Condition: (empty — D3)

Notes:
Legacy locatie: 11
Groep: 3C
```

**SOURCE:** Sheet `KEYBOARD` · Row 4 · **ALREADY_EXISTS** → update legacy-laptop-fb1e32f6-asset
```
Inventory Code: KB19
codePrefix / codeNumber: KB / 19
Code group: NO_MATCH — closest: KBW or KBWS
Name: Keyboard KB19
Asset Type: Keyboard
Category: CATEGORY_REVIEW_REQUIRED — no matching AIMS category
Condition: GOOD

Notes:
(none)
```

Full per-record output: `MASTER_INVENTORY_PHASE1_DRY_RUN.csv` (same folder).