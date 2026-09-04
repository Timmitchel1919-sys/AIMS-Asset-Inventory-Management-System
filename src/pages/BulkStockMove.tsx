import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Boxes, PackageCheck } from "lucide-react";
import { Button, Card, SelectField, TextAreaField } from "../components/ui";
import { MutationFeedback, PageHeader } from "../components/WorkflowUi";
import { LocationPathPicker } from "../components/LocationPathPicker";
import { useApp } from "../context/AppContext";
import { useMockSnapshot, useRepository } from "../data/repositoryContext";
import { locationById, locationPath } from "../domain/locationTree";

export default function BulkStockMove() {
  const nl = useApp().language === "nl";
  const app = useApp();
  const repo = useRepository();
  const snapshot = useMockSnapshot();
  const navigate = useNavigate();

  const [sourceId, setSourceId] = useState<string | null>(null);
  const [destId, setDestId] = useState<string | null>(null);
  const [destBin, setDestBin] = useState("");
  const [destDepartment, setDestDepartment] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [review, setReview] = useState(false);
  const [fb, setFb] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });

  const sourceName = sourceId
    ? locationById(snapshot.references, sourceId)?.name || ""
    : "";
  const departments = useMemo(
    () =>
      snapshot.references
        .filter((r) => r.kind === "department" && r.status === "Active")
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [snapshot.references],
  );

  const atSource = useMemo(() => {
    if (!sourceId) return { assets: [], inventory: [] };
    return {
      assets: snapshot.assets.filter(
        (a) =>
          a.status !== "Archived" &&
          (a.currentLocationId === sourceId || a.location === sourceName),
      ),
      inventory: snapshot.inventory.filter(
        (i) => !i.archived && i.location === sourceName,
      ),
    };
  }, [snapshot.assets, snapshot.inventory, sourceId, sourceName]);

  const total = atSource.assets.length + atSource.inventory.length;
  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
    setReview(false);
  };
  const allIds = [
    ...atSource.assets.map((a) => a.id),
    ...atSource.inventory.map((i) => i.id),
  ];
  const pickedAssetIds = atSource.assets
    .filter((a) => picked.has(a.id))
    .map((a) => a.id);
  const pickedInvIds = atSource.inventory
    .filter((i) => picked.has(i.id))
    .map((i) => i.id);

  const ready =
    !!sourceId &&
    !!destId &&
    destId !== sourceId &&
    picked.size > 0 &&
    !!reason.trim();

  const submit = async () => {
    setFb({ status: "loading", message: nl ? "Bezig…" : "Working…" });
    const res = await repo.execute({
      action: "bulk.move",
      actor: app.user?.name,
      values: {
        assetIds: pickedAssetIds,
        inventoryIds: pickedInvIds,
        destinationLocationId: destId,
        destinationBin: destBin || undefined,
        destinationDepartment: destDepartment || undefined,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
        performedByUserId: app.user?.id,
      },
    });
    if (res.ok) {
      setFb({ status: "success", message: res.message });
      setTimeout(() => navigate("/inventory"), 1100);
    } else {
      setFb({ status: "error", message: res.message });
      setReview(false);
    }
  };

  return (
    <div className="page">
      <Link className="back" to="/inventory">
        <ArrowLeft size={16} />
        {nl ? "Terug naar magazijn" : "Back to warehouse"}
      </Link>
      <PageHeader
        title={nl ? "Bulk verplaatsen" : "Bulk move"}
        description={
          nl
            ? "Verplaats meerdere middelen en voorraadregels in één keer tussen locaties. Bestaande voorraad op de bestemming blijft ongewijzigd; elk middel krijgt een eigen onveranderlijk transactierecord."
            : "Move many assets and stock lines between locations in one action. Existing stock at the destination is untouched; every asset gets its own immutable transaction record."
        }
      />

      <Card className="workflow-form">
        <div className="wide">
          <LocationPathPicker
            references={snapshot.references}
            value={sourceId}
            onChange={(id) => {
              setSourceId(id);
              setPicked(new Set());
              setReview(false);
            }}
            showBin={false}
            required
            label={nl ? "Bron" : "Source"}
          />
        </div>

        {sourceId && (
          <div className="wide bulk-move-list">
            <div className="bulk-move-list__head">
              <strong>
                {nl ? "Bij bron" : "At source"}: {total}{" "}
                {nl ? "item(s)" : "item(s)"}
              </strong>
              {total > 0 && (
                <button
                  type="button"
                  className="linklike"
                  onClick={() =>
                    setPicked(
                      picked.size === allIds.length
                        ? new Set()
                        : new Set(allIds),
                    )
                  }
                >
                  {picked.size === allIds.length
                    ? nl
                      ? "Niets selecteren"
                      : "Select none"
                    : nl
                      ? "Alles selecteren"
                      : "Select all"}
                </button>
              )}
            </div>
            {total === 0 ? (
              <p className="muted">
                {nl
                  ? "Geen middelen of voorraad op deze locatie."
                  : "No assets or stock at this location."}
              </p>
            ) : (
              <ul>
                {atSource.assets.map((a) => (
                  <li key={a.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={picked.has(a.id)}
                        onChange={() => toggle(a.id)}
                      />
                      <span>
                        <code>{a.code}</code> {a.name}
                        {a.serialNumber ? ` · SN ${a.serialNumber}` : ""}
                        <em> · {nl ? "middel" : "asset"}</em>
                      </span>
                    </label>
                  </li>
                ))}
                {atSource.inventory.map((i) => (
                  <li key={i.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={picked.has(i.id)}
                        onChange={() => toggle(i.id)}
                      />
                      <span>
                        <code>{i.code}</code> {i.name}
                        <em>
                          {" "}
                          · {nl ? "voorraad" : "stock"} × {i.onHand}
                        </em>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {sourceId && total > 0 && (
          <>
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
                label={nl ? "Bestemming" : "Destination"}
              />
            </div>
            <SelectField
              className="wide"
              label={
                nl
                  ? "Bestemmingsafdeling (optioneel, alleen middelen)"
                  : "Destination department (optional, assets only)"
              }
              value={destDepartment}
              onChange={(e) => setDestDepartment(e.target.value)}
            >
              <option value="">
                {nl ? "Ongewijzigd" : "Unchanged"}
              </option>
              {departments.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </SelectField>
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
              <ArrowRight size={16} />
              {nl ? "Controleren" : "Review"}
            </Button>
          ) : (
            <div className="asset-transfer-confirm">
              <p>
                <Boxes size={14} style={{ verticalAlign: "-2px" }} />{" "}
                <strong>{picked.size}</strong> {nl ? "item(s)" : "item(s)"}{" "}
                {sourceName} <ArrowRight size={14} style={{ verticalAlign: "-2px" }} />{" "}
                {destId ? locationPath(snapshot.references, destId, { bin: destBin }) : ""}
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
                  {nl ? "Bulk verplaatsing bevestigen" : "Confirm bulk move"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
