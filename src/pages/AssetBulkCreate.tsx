/**
 * Bulk middelen toevoegen — registreer meerdere exemplaren van hetzelfde
 * ICT-middel tegelijk. Gedeelde productinfo wordt één keer ingevuld;
 * inventarisnummers worden automatisch gegenereerd uit codePrefix + reeks;
 * per exemplaar kan de gebruiker serienummer, locatie, afdeling, gebruiker
 * en opmerking apart invullen.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { Button, Field, SelectField } from "../components/ui";
import { MutationFeedback, PageHeader } from "../components/WorkflowUi";
import { useRepository, useRepositorySnapshot } from "../data/repositoryContext";
import { useApp } from "../context/AppContext";
import { useT } from "../i18n";
import { can } from "../auth/permissions";

type RowDraft = {
  serialNumber: string;
  location: string;
  department: string;
  assignedTo: string;
  notes: string;
};

const MAIN_LOCATIONS = [
  "Kangoeroe High",
  "KCS Basis",
  "KCS BovenBouw",
  "KH Nieuwbouw",
];

const DEPARTMENTS = [
  "Administratie Dependance","Administratie KCS Basis","Administratie KH","Administratie KO",
  "Cabin-1","Cabin-2","Cabin-3","Computer Lokaal","Conference Room",
  "Directeur Basisschool","Directeur Office KH","Facilitair","Finance",
  "Finance Administratie","Finance Manager",
  "Groep 1A","Groep 1B","Groep 1C","Groep 1D","Groep 2A","Groep 2B","Groep 2C","Groep 2D",
  "Groep 3A","Groep 3B","Groep 3C","Groep 3D","Groep 4A","Groep 4B","Groep 4C","Groep 4D",
  "Groep 5A","Groep 5B","Groep 5C","Groep 5D","Groep 6A","Groep 6B","Groep 6C","Groep 6D",
  "Groep 7A","Groep 7B","Groep 7C","Groep 7D","Groep 8A","Groep 8B","Groep 8C","Groep 8D",
  "HRM","ICT Camera","ICT Storage 1","ICT Storage 2","ICT-kantoor","KO-Kantoor",
  "Lokaal 1","Lokaal 2","Lokaal 3","Lokaal 4","Lokaal 5","Lokaal 6","Lokaal 7","Lokaal 8",
  "Lokaal 9","Lokaal 10","Lokaal 11","Lokaal 12","Lokaal 13","Lokaal 14","Lokaal 15","Lokaal 16",
  "Lokaal B1","Lokaal B2","Lokaal B3",
  "Lokaal E1","Lokaal E2","Lokaal E3","Lokaal E4","Lokaal E5","Lokaal E6","Lokaal E7",
  "Onder Directeur KH","Practicum lokaal","Secretariaat",
];

const TYPE_OPTIONS = [
  "Access point","Battery backup/UPS","Beamer","Computer","Desktop",
  "Digibord 80/55 inch","Display & Presentation","Keyboard combo","Keyboard wired",
  "Keyboard wireless","Laptop","Mini desktop","Mobiel","Module","Monitor",
  "Muis wired","Muis wireless","Printer","Scanner","Tablet",
];

const MAX_CODE_NUMBER = 5000;
const MAX_BATCH_SIZE = 200; // sanity cap om per ongeluk 500+ requests te voorkomen

export default function AssetBulkCreate() {
  const navigate = useNavigate();
  const t = useT();
  const app = useApp();
  const repository = useRepository();
  const snapshot = useRepositorySnapshot();
  const nl = app.language === "nl";

  const canCreate = can(app.user?.role, "assets.create");

  // --- Gedeelde productinfo ---
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [description, setDescription] = useState("");
  const [specifications, setSpecifications] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [warrantyExpiry, setWarrantyExpiry] = useState("");

  // --- Reeks ---
  const [codePrefix, setCodePrefix] = useState("");
  const [startNumber, setStartNumber] = useState<string>("1");
  const [endNumber, setEndNumber] = useState<string>("1");
  const [reason, setReason] = useState("");

  // --- Per-exemplaar overrides ---
  const [rows, setRows] = useState<Record<number, RowDraft>>({});

  // --- Status ---
  const [feedback, setFeedback] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });

  const codeGroups = useMemo(
    () => (snapshot.codeGroups || []).filter((g: any) => g.isActive),
    [snapshot.codeGroups],
  );

  const categories = useMemo(() => {
    const names = new Set<string>();
    (snapshot.references || [])
      .filter((r) => r.kind === "category" && r.status !== "Archived")
      .forEach((r) => r.name && names.add(r.name.trim()));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [snapshot.references]);

  const start = Number.parseInt(startNumber, 10);
  const end = Number.parseInt(endNumber, 10);
  const rangeValid =
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    start >= 1 &&
    end >= start &&
    end <= MAX_CODE_NUMBER;
  const total = rangeValid ? end - start + 1 : 0;

  const generatedCodes = useMemo<string[]>(() => {
    if (!codePrefix || !rangeValid) return [];
    return Array.from({ length: total }, (_, i) => {
      const n = start + i;
      return `${codePrefix}-${n < 100 ? String(n).padStart(2, "0") : n}`;
    });
  }, [codePrefix, rangeValid, total, start]);

  // Pre-check: welke codes bestaan al?
  const existingCodes = useMemo(() => {
    if (!generatedCodes.length) return new Set<string>();
    const set = new Set<string>();
    const wanted = new Set(generatedCodes);
    for (const asset of snapshot.assets || []) {
      if (asset.code && wanted.has(asset.code)) set.add(asset.code);
    }
    return set;
  }, [generatedCodes, snapshot.assets]);

  const serialsInBatch = useMemo(() => {
    const dupes = new Set<string>();
    const seen = new Set<string>();
    for (const row of Object.values(rows)) {
      const s = row.serialNumber?.trim();
      if (!s) continue;
      if (seen.has(s)) dupes.add(s);
      else seen.add(s);
    }
    return dupes;
  }, [rows]);

  const validationErrors: string[] = [];
  if (!canCreate)
    validationErrors.push(
      nl ? "Geen rechten om middelen aan te maken." : "No permission to create assets.",
    );
  if (!name.trim())
    validationErrors.push(nl ? "Middelnaam is verplicht." : "Asset name is required.");
  if (!category)
    validationErrors.push(nl ? "Categorie is verplicht." : "Category is required.");
  if (!codePrefix)
    validationErrors.push(nl ? "Codegroep is verplicht." : "Code group is required.");
  if (!rangeValid)
    validationErrors.push(
      nl
        ? `Nummerreeks moet 1–${MAX_CODE_NUMBER} zijn, begin ≤ eind.`
        : `Number range must be 1–${MAX_CODE_NUMBER}, start ≤ end.`,
    );
  if (rangeValid && total > MAX_BATCH_SIZE)
    validationErrors.push(
      nl
        ? `Maximaal ${MAX_BATCH_SIZE} middelen per bulkregistratie.`
        : `At most ${MAX_BATCH_SIZE} assets per bulk registration.`,
    );
  if (existingCodes.size > 0)
    validationErrors.push(
      nl
        ? `De volgende inventarisnummers bestaan al: ${[...existingCodes].slice(0, 5).join(", ")}${existingCodes.size > 5 ? "…" : ""}`
        : `These inventory numbers already exist: ${[...existingCodes].slice(0, 5).join(", ")}${existingCodes.size > 5 ? "…" : ""}`,
    );
  if (serialsInBatch.size > 0)
    validationErrors.push(
      nl
        ? `Dubbele serienummers binnen de reeks: ${[...serialsInBatch].join(", ")}`
        : `Duplicate serial numbers within the batch: ${[...serialsInBatch].join(", ")}`,
    );
  if (!reason.trim())
    validationErrors.push(nl ? "Reden is verplicht." : "Reason is required.");

  const blocked = validationErrors.length > 0;

  const updateRow = (idx: number, field: keyof RowDraft, value: string) =>
    setRows((prev) => ({
      ...prev,
      [idx]: { ...(prev[idx] || blankRow()), [field]: value },
    }));

  function blankRow(): RowDraft {
    return {
      serialNumber: "",
      location: "",
      department: "",
      assignedTo: "",
      notes: "",
    };
  }

  const submit = async () => {
    if (blocked) return;
    setFeedback({
      status: "loading",
      message: nl
        ? `Bezig met aanmaken van ${total} middelen…`
        : `Creating ${total} assets…`,
    });

    let created = 0;
    const failures: { code: string; message: string }[] = [];

    for (let i = 0; i < generatedCodes.length; i++) {
      const code = generatedCodes[i];
      const num = start + i;
      const row = rows[i] || blankRow();
      const deptRef = (snapshot.references || []).find(
        (r) => r.kind === "department" && r.name === row.department,
      );
      const result = await repository.execute({
        action: "asset.create",
        actor: app.user?.name,
        values: {
          name: name.trim(),
          category,
          subcategory: "",
          type: type || "",
          brand: brand.trim(),
          model: model.trim(),
          description: description.trim(),
          technicalSpecifications: specifications.trim(),
          codePrefix,
          codeNumber: num,
          barcode: code,
          serialNumber: row.serialNumber.trim(),
          location: row.location || "",
          department: row.department || "",
          departmentId: deptRef?.id || null,
          assignedTo: row.assignedTo.trim(),
          notes: row.notes.trim(),
          status: "Available",
          condition: "Good",
          purchaseDate: purchaseDate || "",
          warrantyExpiry: warrantyExpiry || "",
          reason: `Bulk: ${reason.trim()}`,
          // Een bulk-registratie bevat vaak géén serienummer per rij, dus
          // sta toe dat twee rijen met leeg serienummer naast elkaar bestaan.
          allowDuplicateSerial: !row.serialNumber.trim(),
        } as Record<string, unknown>,
      });
      if (result.ok) created += 1;
      else failures.push({ code, message: result.message });
    }

    if (failures.length === 0) {
      setFeedback({
        status: "success",
        message: nl
          ? `${created} middelen aangemaakt.`
          : `${created} assets created.`,
      });
      setTimeout(() => navigate("/assets"), 900);
    } else {
      setFeedback({
        status: "error",
        message:
          (nl
            ? `${created}/${generatedCodes.length} aangemaakt. Mislukt:`
            : `${created}/${generatedCodes.length} created. Failed:`) +
          " " +
          failures
            .slice(0, 5)
            .map((f) => `${f.code} (${f.message})`)
            .join("; "),
      });
    }
  };

  return (
    <div className="data-page">
      <PageHeader
        title={nl ? "Bulk middelen toevoegen" : "Bulk add assets"}
        description={
          nl
            ? "Registreer meerdere exemplaren van hetzelfde middel met automatisch gegenereerde inventarisnummers."
            : "Register multiple copies of the same asset with auto-generated inventory numbers."
        }
        actions={
          <Button variant="ghost" onClick={() => navigate("/assets")}>
            <ArrowLeft />
            {nl ? "Terug" : "Back"}
          </Button>
        }
      />

      <div className="data-card" style={{ padding: 16, gap: 16, display: "flex", flexDirection: "column" }}>
        <section className="workflow-form" aria-label={nl ? "Gedeelde productinfo" : "Shared product info"}>
          <h3 style={{ margin: 0 }}>{nl ? "1. Productgegevens" : "1. Product info"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <Field label={nl ? "Middelnaam *" : "Asset name *"} value={name} onChange={(e) => setName(e.target.value)} required />
            <SelectField label={nl ? "Categorie *" : "Category *"} value={category} onChange={(e) => setCategory(e.target.value)} required>
              <option value="">{nl ? "Kies categorie…" : "Choose category…"}</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </SelectField>
            <SelectField label={nl ? "Middeltype" : "Type"} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">{nl ? "(Optioneel)" : "(Optional)"}</option>
              {TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </SelectField>
            <Field label={nl ? "Merk" : "Brand"} value={brand} onChange={(e) => setBrand(e.target.value)} />
            <Field label={nl ? "Model" : "Model"} value={model} onChange={(e) => setModel(e.target.value)} />
            <Field label={nl ? "Aankoopdatum" : "Purchase date"} type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            <Field label={nl ? "Garantie vervalt" : "Warranty expires"} type="date" value={warrantyExpiry} onChange={(e) => setWarrantyExpiry(e.target.value)} />
          </div>
          <Field label={nl ? "Omschrijving" : "Description"} value={description} onChange={(e) => setDescription(e.target.value)} />
          <Field label={nl ? "Technische specificaties" : "Specifications"} value={specifications} onChange={(e) => setSpecifications(e.target.value)} />
        </section>

        <section className="workflow-form" aria-label={nl ? "Nummerreeks" : "Number range"}>
          <h3 style={{ margin: 0 }}>{nl ? "2. Nummerreeks" : "2. Number range"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <SelectField label={nl ? "Codegroep *" : "Code group *"} value={codePrefix} onChange={(e) => setCodePrefix(e.target.value)} required>
              <option value="">{nl ? "Kies codegroep…" : "Choose code group…"}</option>
              {codeGroups.map((g: any) => (
                <option key={g.id} value={g.prefix}>{g.name} ({g.prefix})</option>
              ))}
            </SelectField>
            <Field label={nl ? "Beginnummer *" : "Start number *"} type="number" min="1" max={String(MAX_CODE_NUMBER)} value={startNumber} onChange={(e) => setStartNumber(e.target.value)} required />
            <Field label={nl ? "Eindnummer *" : "End number *"} type="number" min="1" max={String(MAX_CODE_NUMBER)} value={endNumber} onChange={(e) => setEndNumber(e.target.value)} required />
            <Field label={nl ? "Totaal aantal" : "Total count"} value={rangeValid ? String(total) : "—"} readOnly />
          </div>
          {generatedCodes.length > 0 && (
            <div style={{ fontSize: "0.85em", color: "var(--color-text-secondary)" }}>
              <strong>{nl ? "Voorbeeld inventarisnummers: " : "Preview inventory numbers: "}</strong>
              {generatedCodes.slice(0, 10).join(", ")}
              {generatedCodes.length > 10 ? ` … (+${generatedCodes.length - 10})` : ""}
            </div>
          )}
          {existingCodes.size > 0 && (
            <div className="field-error" role="alert" style={{ marginTop: 6 }}>
              {nl ? "Bestaande inventarisnummers in deze reeks: " : "Existing inventory numbers in this range: "}
              {[...existingCodes].slice(0, 10).join(", ")}
              {existingCodes.size > 10 ? " …" : ""}
            </div>
          )}
        </section>

        {generatedCodes.length > 0 && generatedCodes.length <= MAX_BATCH_SIZE && (
          <section className="workflow-form" aria-label={nl ? "Per-exemplaar" : "Per-item"}>
            <h3 style={{ margin: 0 }}>{nl ? "3. Individuele gegevens (optioneel per rij)" : "3. Individual data (optional per row)"}</h3>
            <div style={{ maxHeight: 420, overflow: "auto", border: "1px solid var(--color-border)", borderRadius: 6 }}>
              <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ position: "sticky", top: 0, background: "var(--color-surface-elevated)" }}>
                  <tr>
                    <th>#</th>
                    <th>{nl ? "Inv.code" : "Inv.code"}</th>
                    <th>{nl ? "Serienummer" : "Serial"}</th>
                    <th>{nl ? "Hoofd locatie" : "Main location"}</th>
                    <th>{nl ? "Afdeling" : "Department"}</th>
                    <th>{nl ? "Gebruiker" : "User"}</th>
                    <th>{nl ? "Opmerking" : "Notes"}</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedCodes.map((code, i) => {
                    const row = rows[i] || blankRow();
                    return (
                      <tr key={code}>
                        <td style={{ textAlign: "right", color: "var(--color-text-secondary)" }}>{i + 1}</td>
                        <td><strong>{code}</strong></td>
                        <td><input type="text" value={row.serialNumber} onChange={(e) => updateRow(i, "serialNumber", e.target.value)} /></td>
                        <td>
                          <select value={row.location} onChange={(e) => updateRow(i, "location", e.target.value)}>
                            <option value="">—</option>
                            {MAIN_LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </td>
                        <td>
                          <select value={row.department} onChange={(e) => updateRow(i, "department", e.target.value)}>
                            <option value="">—</option>
                            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </td>
                        <td><input type="text" value={row.assignedTo} onChange={(e) => updateRow(i, "assignedTo", e.target.value)} /></td>
                        <td><input type="text" value={row.notes} onChange={(e) => updateRow(i, "notes", e.target.value)} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="workflow-form" aria-label={nl ? "Bevestiging" : "Confirmation"}>
          <h3 style={{ margin: 0 }}>{nl ? "4. Bevestiging" : "4. Confirmation"}</h3>
          <Field label={nl ? "Reden / aankooporder *" : "Reason / purchase order *"} value={reason} onChange={(e) => setReason(e.target.value)} required />
          {validationErrors.length > 0 && (
            <ul className="field-error" role="alert" style={{ margin: 0, paddingLeft: 18 }}>
              {validationErrors.map((err) => <li key={err}>{err}</li>)}
            </ul>
          )}
          <MutationFeedback status={feedback.status} message={feedback.message} />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => navigate("/assets")}>{nl ? "Annuleren" : "Cancel"}</Button>
            <Button onClick={submit} disabled={blocked || feedback.status === "loading"}>
              <Plus />
              {nl
                ? `Aanmaken${total ? ` (${total})` : ""}`
                : `Create${total ? ` (${total})` : ""}`}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
