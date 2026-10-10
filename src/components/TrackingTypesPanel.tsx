import { useState, type FormEvent } from "react";
import { Badge, Button, Field, Loader, SelectField, TextAreaField } from "./ui";
import { useApp } from "../context/AppContext";
import {
  createAssetTypes,
  createMissingDefaults,
  setAssetTypeStatus,
  useAssetTypes,
} from "../data/assetTypesStore";
import {
  ASSET_TYPE_BEHAVIORS,
  ASSET_TYPE_ERRORS,
  DEFAULT_ASSET_TYPES,
  assetTypeId,
  type AssetTypeBehavior,
} from "../domain/assetTypes";

const COPY = {
  nl: {
    title: "Beheertypen (asset type)",
    intro:
      "Een beheertype bepaalt hoe een middel wordt bijgehouden. Dit is iets anders dan de categorie of het type-niveau hierboven.",
    behaviors: { SERIALIZED: "Serialized (per stuk)", BULK: "Bulk (gezamenlijk)", CONSUMABLE: "Verbruiksmateriaal" } as Record<AssetTypeBehavior, string>,
    name: "Naam",
    description: "Beschrijving",
    behavior: "Beheergedrag",
    add: "Beheertype toevoegen",
    defaults: "Standaardtypen aanmaken",
    empty: "Nog geen beheertypen. Maak de standaardtypen aan of voeg er zelf een toe.",
    archive: "Archiveren",
    restore: "Herstellen",
    saved: "Beheertype opgeslagen.",
    updated: "Beheertype bijgewerkt.",
    failed: "Opslaan mislukt",
    offline: "Beheertypen vereisen een Firebase-verbinding.",
    status: { Active: "Actief", Inactive: "Inactief", Archived: "Gearchiveerd" } as Record<string, string>,
  },
  en: {
    title: "Tracking types (asset type)",
    intro:
      "A tracking type decides how an asset is tracked. It is different from the category or type level above.",
    behaviors: { SERIALIZED: "Serialized (per item)", BULK: "Bulk (collective)", CONSUMABLE: "Consumable" } as Record<AssetTypeBehavior, string>,
    name: "Name",
    description: "Description",
    behavior: "Behavior",
    add: "Add tracking type",
    defaults: "Create default types",
    empty: "No tracking types yet. Create the defaults or add your own.",
    archive: "Archive",
    restore: "Restore",
    saved: "Tracking type saved.",
    updated: "Tracking type updated.",
    failed: "Save failed",
    offline: "Tracking types require a Firebase connection.",
    status: { Active: "Active", Inactive: "Inactive", Archived: "Archived" } as Record<string, string>,
  },
} as const;

export function TrackingTypesPanel() {
  const { user, language } = useApp();
  const nl = language === "nl";
  const c = nl ? COPY.nl : COPY.en;
  const { items, loading, error, connected } = useAssetTypes();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [behavior, setBehavior] = useState<AssetTypeBehavior>("SERIALIZED");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const actor = { uid: user?.id, name: user?.name };

  const run = async (work: () => Promise<string | null>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const problem = await work();
      setMessage(
        problem
          ? { ok: false, text: ASSET_TYPE_ERRORS[language === "nl" ? "nl" : "en"][problem as keyof typeof ASSET_TYPE_ERRORS.nl] ?? problem }
          : { ok: true, text: success },
      );
      return !problem;
    } catch (err) {
      setMessage({ ok: false, text: `${c.failed}: ${err instanceof Error ? err.message : String(err)}` });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await run(() => createAssetTypes([{ name, description, behavior }], items, actor), c.saved);
    if (ok) {
      setName("");
      setDescription("");
    }
  };

  if (!connected) return <section className="card tracking-types"><p>{c.offline}</p></section>;

  const missingDefaults = DEFAULT_ASSET_TYPES.some(
    (item) => !items.some((existing) => existing.id === assetTypeId(item.name)),
  );

  return (
    <section className="card tracking-types" aria-labelledby="tracking-types-title">
      <header className="card-head">
        <h2 id="tracking-types-title">{c.title}</h2>
        {missingDefaults && user && (
          <Button type="button" variant="secondary" disabled={busy} onClick={() => run(() => createMissingDefaults(items, actor), c.saved)}>
            {c.defaults}
          </Button>
        )}
      </header>
      <p className="field-hint">{c.intro}</p>
      {message && (
        <p className={`dm-message dm-message--${message.ok ? "ok" : "error"}`} role={message.ok ? "status" : "alert"}>
          {message.text}
        </p>
      )}
      {loading ? (
        <Loader />
      ) : error ? (
        <p className="dm-message dm-message--error" role="alert">{error}</p>
      ) : !items.length ? (
        <p>{c.empty}</p>
      ) : (
        <ul className="tracking-types__list">
          {items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.name}</strong>{" "}
                <Badge tone={item.status === "Active" ? "success" : "neutral"}>{c.status[item.status] ?? item.status}</Badge>{" "}
                <Badge tone="info">{c.behaviors[item.behavior] ?? item.behavior}</Badge>
                {item.description && <small className="tracking-types__desc">{item.description}</small>}
              </div>
              {user && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => run(async () => { await setAssetTypeStatus(item, item.status === "Archived" ? "Active" : "Archived", actor); return null; }, c.updated)}
                >
                  {item.status === "Archived" ? c.restore : c.archive}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {user && (
        <form onSubmit={submit} className="tracking-types__form" noValidate>
          <Field label={c.name} required value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          <SelectField label={c.behavior} value={behavior} onChange={(e) => setBehavior(e.target.value as AssetTypeBehavior)}>
            {ASSET_TYPE_BEHAVIORS.map((value) => (
              <option key={value} value={value}>{c.behaviors[value]}</option>
            ))}
          </SelectField>
          <TextAreaField label={c.description} value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
          <Button type="submit" disabled={busy || !name.trim()}>{c.add}</Button>
        </form>
      )}
    </section>
  );
}
