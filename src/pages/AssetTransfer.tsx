import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, PackageCheck, Undo2 } from "lucide-react";
import { Button, Card, Field, SelectField, TextAreaField } from "../components/ui";
import { MutationFeedback, PageHeader } from "../components/WorkflowUi";
import { LocationPathPicker } from "../components/LocationPathPicker";
import { useApp } from "../context/AppContext";
import { useMockSnapshot, useRepository } from "../data/repositoryContext";
import { locationPath } from "../domain/locationTree";
import type { Condition } from "../domain/types";

const CONDITIONS: Condition[] = [
  "New",
  "Excellent",
  "Good",
  "Fair",
  "Poor",
  "Defective",
  "Beyond Repair",
];

type Mode = "transfer" | "return";

function AssetMove({ mode }: { mode: Mode }) {
  const nl = useApp().language === "nl";
  const isReturn = mode === "return";
  const repo = useRepository();
  const snapshot = useMockSnapshot();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const app = useApp();

  const [assetId, setAssetId] = useState(params.get("asset") || "");
  const [destId, setDestId] = useState<string | null>(null);
  const [destBin, setDestBin] = useState("");
  const [destDepartment, setDestDepartment] = useState("");
  const [returnFrom, setReturnFrom] = useState("");
  const [condition, setCondition] = useState<string>("");
  const [accessories, setAccessories] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [review, setReview] = useState(false);
  const [fb, setFb] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });

  const assets = useMemo(
    () =>
      snapshot.assets
        .filter((a) => a.status !== "Archived")
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code)),
    [snapshot.assets],
  );
  const asset = assets.find((a) => a.id === assetId);
  const departments = useMemo(
    () =>
      snapshot.references
        .filter((r) => r.kind === "department" && r.status === "Active")
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [snapshot.references],
  );
  const currentPath = asset
    ? asset.currentLocationPath ||
      locationPath(snapshot.references, asset.currentLocationId, {
        bin: asset.currentBin,
      }) ||
      asset.location
    : "";
  const destPath = destId
    ? locationPath(snapshot.references, destId, { bin: destBin })
    : "";

  const ready =
    !!asset &&
    !!reason.trim() &&
    (isReturn ? !!returnFrom.trim() : true) &&
    (!!destId || (isReturn && !!destId));

  const submit = async () => {
    if (!asset) return;
    setFb({ status: "loading", message: nl ? "Bezig…" : "Working…" });
    const res = await repo.execute({
      action: isReturn ? "asset.return" : "asset.move",
      entityId: asset.id,
      actor: app.user?.name,
      values: {
        transactionType: isReturn ? "RETURN" : "TRANSFER",
        destinationLocationId: destId || undefined,
        destinationBin: destBin || undefined,
        destinationDepartment: destDepartment || undefined,
        conditionAfter: condition || undefined,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
        performedByUserId: app.user?.id,
        ...(isReturn
          ? {
              returnFrom: returnFrom.trim(),
              returnTo: destPath,
              accessories: accessories
                .split(/[,;]/)
                .map((x) => x.trim())
                .filter(Boolean),
            }
          : {}),
      },
    });
    if (res.ok) {
      setFb({ status: "success", message: res.message });
      setTimeout(() => navigate(`/assets/${asset.id}`), 900);
    } else {
      setFb({ status: "error", message: res.message });
      setReview(false);
    }
  };

  return (
    <div className="page">
      <Link className="back" to="/assets">
        <ArrowLeft size={16} />
        {nl ? "Terug naar middelen" : "Back to assets"}
      </Link>
      <PageHeader
        title={
          isReturn
            ? nl
              ? "Middel retourneren"
              : "Return asset"
            : nl
              ? "Middel overplaatsen"
              : "Transfer asset"
        }
        description={
          isReturn
            ? nl
              ? "Retour van een gebruiker, afdeling of operationele locatie naar een opslaglocatie. De identiteit van het middel blijft ongewijzigd."
              : "Return from a user, department or operational location to a storage location. The asset identity is unchanged."
            : nl
              ? "Interne verplaatsing tussen locaties/sublocaties. Alleen bron/bestemming invoeren — de rest wordt automatisch overgenomen."
              : "Internal move between locations/sub-locations. Enter only source/destination — everything else is carried over automatically."
        }
      />

      <Card className="workflow-form">
        <SelectField
          label={nl ? "Middel" : "Asset"}
          value={assetId}
          required
          onChange={(e) => {
            setAssetId(e.target.value);
            setDestDepartment("");
            setReview(false);
          }}
        >
          <option value="">{nl ? "Selecteer middel" : "Select asset"}</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
              {a.serialNumber ? ` — ${a.serialNumber}` : ""}
            </option>
          ))}
        </SelectField>

        {asset && (
          <div className="wide asset-identity-panel">
            <h3>{nl ? "Middelgegevens (automatisch)" : "Asset details (auto-filled)"}</h3>
            <dl>
              <div><dt>INV-CODE</dt><dd>{asset.code}</dd></div>
              <div><dt>{nl ? "Naam" : "Name"}</dt><dd>{asset.name}</dd></div>
              <div><dt>{nl ? "Categorie" : "Category"}</dt><dd>{asset.category}</dd></div>
              <div><dt>{nl ? "Merk / model" : "Brand / model"}</dt><dd>{[asset.brand, asset.model].filter(Boolean).join(" ") || "—"}</dd></div>
              <div><dt>{nl ? "Serienummer" : "Serial number"}</dt><dd>{asset.serialNumber || "—"}</dd></div>
              <div><dt>{nl ? "Huidige conditie" : "Current condition"}</dt><dd>{asset.condition}</dd></div>
              <div className="wide"><dt>{isReturn ? (nl ? "Huidige locatie" : "Current location") : (nl ? "Bron" : "Source")}</dt><dd>{currentPath || "—"}</dd></div>
            </dl>
          </div>
        )}

        {asset && (
          <>
            {isReturn && (
              <Field
                label={nl ? "Retour van (gebruiker / afdeling / locatie)" : "Return from (user / department / location)"}
                value={returnFrom}
                required
                onChange={(e) => setReturnFrom(e.target.value)}
              />
            )}
            <div className="wide">
              <LocationPathPicker
                references={snapshot.references}
                value={destId}
                onChange={(id) => {
                  setDestId(id);
                  setReview(false);
                }}
                bin={destBin}
                onBinChange={setDestBin}
                required
                label={
                  isReturn
                    ? nl
                      ? "Retour naar (opslaglocatie)"
                      : "Return to (storage location)"
                    : nl
                      ? "Bestemming"
                      : "Destination"
                }
              />
            </div>
            <SelectField
              label={
                nl
                  ? "Bestemmingsafdeling (optioneel)"
                  : "Destination department (optional)"
              }
              value={destDepartment}
              onChange={(e) => setDestDepartment(e.target.value)}
            >
              <option value="">
                {nl ? "Ongewijzigd" : "Unchanged"} ({asset.department || "—"})
              </option>
              {departments.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </SelectField>
            <SelectField
              label={
                isReturn
                  ? nl
                    ? "Conditie bij retour"
                    : "Condition at return"
                  : nl
                    ? "Nieuwe conditie (optioneel)"
                    : "New condition (optional)"
              }
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
            >
              <option value="">
                {nl ? "Ongewijzigd" : "Unchanged"} ({asset.condition})
              </option>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectField>
            {isReturn && (
              <Field
                label={nl ? "Accessoires / onderdelen (komma-gescheiden)" : "Accessories / components (comma-separated)"}
                value={accessories}
                onChange={(e) => setAccessories(e.target.value)}
                placeholder={nl ? "bijv. oplader, muis, tas" : "e.g. charger, mouse, bag"}
              />
            )}
            <TextAreaField
              className="wide"
              label={nl ? "Reden" : "Reason"}
              value={reason}
              required
              onChange={(e) => setReason(e.target.value)}
            />
            <TextAreaField
              className="wide"
              label={nl ? "Notities (optioneel)" : "Notes (optional)"}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </>
        )}

        <div className="wide">
          <MutationFeedback {...fb} />
          {!review ? (
            <Button
              type="button"
              disabled={!ready || fb.status === "loading"}
              onClick={() => setReview(true)}
            >
              {isReturn ? <Undo2 size={16} /> : <ArrowRight size={16} />}
              {nl ? "Controleren" : "Review"}
            </Button>
          ) : (
            <div className="asset-transfer-confirm">
              <p>
                <strong>{asset?.code}</strong> — {currentPath || "—"}{" "}
                <ArrowRight size={14} style={{ verticalAlign: "-2px" }} />{" "}
                {isReturn ? returnFrom + " → " : ""}
                {destPath}
                {condition ? ` · ${asset?.condition} → ${condition}` : ""}
                {destDepartment && destDepartment !== asset?.department
                  ? ` · ${asset?.department || "—"} → ${destDepartment}`
                  : ""}
              </p>
              <div className="asset-transfer-confirm__actions">
                <Button type="button" variant="ghost" onClick={() => setReview(false)}>
                  {nl ? "Terug" : "Back"}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={fb.status === "loading"}
                  onClick={submit}
                >
                  <PackageCheck size={16} />
                  {isReturn
                    ? nl
                      ? "Retour bevestigen"
                      : "Confirm return"
                    : nl
                      ? "Overplaatsing bevestigen"
                      : "Confirm transfer"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export const AssetTransfer = () => <AssetMove mode="transfer" />;
export const AssetReturn = () => <AssetMove mode="return" />;
export default AssetTransfer;
