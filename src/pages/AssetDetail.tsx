import {
  Archive,
  ArrowLeft,
  Check,
  Edit3,
  History,
  MapPin,
  MoveRight,
  Printer,
  Recycle,
  RotateCcw,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { can } from "../auth/permissions";
import { useAssetT, type AssetCopyKey } from "../assetCopy";
import { Button, Card, Loader, State } from "../components/ui";
import {
  ConfirmDialog,
  MutationFeedback,
  OfflineGate,
} from "../components/WorkflowUi";
import { AssetStatusBadge } from "../components/AssetStatusBadge";
import { ConditionBadge } from "../components/ConditionBadge";
import { useApp } from "../context/AppContext";
import { useMockSnapshot, useRepository } from "../data/repositoryContext";
import { labelPayload } from "../domain/assetManagement";
import { useT } from "../i18n";

const tabs: AssetCopyKey[] = [
  "overview",
  "technicalDetails",
  "assignmentHistory",
  "locationHistory",
  "borrowHistory",
  "repairHistory",
  "maintenanceHistory",
  "movementHistory",
  "auditHistory",
  "statusHistory",
  "documents",
  "accessories",
  "lifecycle",
];
const tabHelp: Record<"nl" | "en", Partial<Record<AssetCopyKey, string>>> = {
  nl: {
    overview:
      "Basisgegevens zoals code, serienummer, status, locatie, eigenaar en aankoopinformatie.",
    technicalDetails:
      "Technische specificaties, zoals processor, geheugen, opslag, besturingssysteem, netwerk en scherm.",
    assignmentHistory:
      "Wie het middel toegewezen kreeg, vanaf welke datum en wanneer het werd teruggegeven of overgedragen.",
    locationHistory:
      "Op welke hoofd- of sublocaties het middel heeft gestaan en wanneer het werd verplaatst.",
    borrowHistory:
      "Uitleen- en retourregistraties, inclusief lener, periode, conditie en status.",
    repairHistory:
      "Gemelde defecten, diagnose, reparatie, onderdelen, technicus en reparatiestatus.",
    maintenanceHistory:
      "Onderhoud, schoonmaak, updates, controles en afgeronde onderhoudstaken.",
    movementHistory:
      "Verplaatsingen tussen locaties en afdelingen, inclusief reden en uitvoerder.",
    auditHistory:
      "Inventariscontroles waarin dit middel is opgenomen en de resultaten daarvan.",
    statusHistory:
      "Statuswijzigingen en andere vastgelegde systeemacties voor dit middel.",
    documents:
      "Facturen, garantiebewijzen, handleidingen, foto’s en andere gekoppelde bestanden.",
    accessories:
      "Bijbehorende accessoires, zoals lader, tas, kabels, toetsenbord of muis.",
    lifecycle:
      "Levensduurnotities, archivering en aanvragen voor afvoer of buitengebruikstelling.",
  },
  en: {
    overview:
      "Core data such as code, serial number, status, location, owner and purchase information.",
    technicalDetails:
      "Technical specifications such as processor, memory, storage, operating system, network and display.",
    assignmentHistory:
      "Who received the asset, the assignment date and when it was returned or transferred.",
    locationHistory:
      "The main and sub-locations where the asset was held and when it moved.",
    borrowHistory:
      "Borrowing and return records, including borrower, period, condition and status.",
    repairHistory:
      "Reported faults, diagnosis, repairs, parts, technician and repair status.",
    maintenanceHistory:
      "Maintenance, cleaning, updates, checks and completed maintenance work.",
    movementHistory:
      "Movements between locations and departments, including reason and performer.",
    auditHistory:
      "Inventory audits that included this asset and their results.",
    statusHistory:
      "Status changes and other recorded system actions for this asset.",
    documents: "Invoices, warranties, manuals, photos and other linked files.",
    accessories:
      "Accessories such as a charger, bag, cables, keyboard or mouse.",
    lifecycle:
      "Lifecycle notes, archiving and disposal or decommissioning requests.",
  },
};
export default function AssetDetail() {
  const params = useParams(),
    id = params.assetId || params.id,
    navigate = useNavigate(),
    routeState = useLocation().state as {
      assetMutation?: string;
      message?: string;
    } | null,
    [searchParams] = useSearchParams(),
    repository = useRepository(),
    app = useApp(),
    a = useAssetT(),
    t = useT(),
    snapshot = useMockSnapshot(),
    asset = snapshot.assets.find((value) => value.id === id);
  const [tab, setTab] = useState<AssetCopyKey>("overview"),
    [message, setMessage] = useState(""),
    [confirmArchive, setConfirmArchive] = useState(false),
    [showSuccess, setShowSuccess] = useState(!!routeState?.assetMutation);
  const loading = searchParams.get("state") === "loading",
    forcedError = searchParams.get("state") === "error";
  const histories = useMemo(
    () =>
      asset
        ? {
            assignmentHistory: snapshot.assignments.filter(
              (item) => item.assetId === asset.id,
            ),
            locationHistory: snapshot.movements.filter(
              (item) => item.assetCode === asset.code,
            ),
            borrowHistory: snapshot.borrows.filter(
              (item) => item.assetCode === asset.code,
            ),
            repairHistory: snapshot.repairs.filter(
              (item) => item.assetCode === asset.code,
            ),
            maintenanceHistory: snapshot.maintenance.filter(
              (item) => item.assetCode === asset.code,
            ),
            movementHistory: snapshot.movements.filter(
              (item) => item.assetCode === asset.code,
            ),
            auditHistory: snapshot.audits.filter((item) =>
              item.frozenItemIds?.includes(asset.id),
            ),
            statusHistory: snapshot.activity.filter(
              (item) => item.entityId === asset.id,
            ),
          }
        : null,
    [asset, snapshot],
  );
  if (loading) return <Loader />;
  if (forcedError)
    return (
      <State
        type="error"
        title={a("submissionFailed")}
        description={a("notFoundHelp")}
        action={
          <Button onClick={() => navigate(`/assets/${id}`)}>
            {a("retry")}
          </Button>
        }
      />
    );
  if (!asset)
    return (
      <State
        type="error"
        title={a("notFound")}
        description={a("notFoundHelp")}
        action={
          <Button onClick={() => navigate("/assets")}>{a("back")}</Button>
        }
      />
    );
  if (showSuccess)
    return (
      <div className="page">
        <Card className="success-panel">
          <span>
            <Check />
          </span>
          <h1>
            {routeState?.assetMutation === "created"
              ? a("created")
              : a("updated")}
          </h1>
          <p>{routeState?.message}</p>
          <Button onClick={() => setShowSuccess(false)}>
            {a("returnRecord")}
          </Button>
        </Card>
      </div>
    );
  async function toggleArchive() {
    const result = await repository.execute({
      action: asset?.status === "Archived" ? "asset.restore" : "asset.archive",
      entityId: asset?.id,
      actor: app.user?.name,
    });
    setMessage(result.message);
    setConfirmArchive(false);
  }
  const overview = [
    [a("internalId"), asset.id],
    [a("officialCode"), asset.code],
    [a("serial"), asset.serialNumber],
    [a("barcode"), asset.barcode || asset.code],
    [a("description"), asset.description || "—"],
    [a("status"), t(`status.${asset.status}`)],
    [a("condition"), t(`condition.${asset.condition}`)],
    [a("brand"), asset.brand],
    [a("model"), asset.model],
    [a("category"), asset.category],
    [a("subcategory"), asset.subcategory || "—"],
    [a("location"), asset.location],
    [a("department"), asset.department],
    [a("assignedUser"), asset.assignedTo || "—"],
    [a("responsible"), asset.responsibleEmployee || "—"],
    [a("purchaseDate"), asset.purchaseDate],
    [a("warrantyStart"), asset.warrantyStart || "—"],
    [a("warrantyExpiry"), asset.warrantyExpiry],
    [a("supplier"), asset.supplier || "—"],
    [a("manufacturer"), asset.manufacturer || "—"],
    [a("createdBy"), asset.createdBy || "Naomi Williams"],
    [a("createdDate"), asset.dateAdded || "2026-07-30"],
    [a("modifiedBy"), asset.lastModifiedBy || "Naomi Williams"],
    [a("modifiedDate"), asset.lastUpdated],
  ];
  const renderHistory = (key: keyof NonNullable<typeof histories>) => {
    const records = histories?.[key] || [];
    return records.length ? (
      <div className="history-list">
        {records.map((record, index) => (
          <article key={"id" in record ? String(record.id) : index}>
            <strong>
              {"action" in record
                ? String(record.action)
                : "type" in record
                  ? String(record.type)
                  : "status" in record
                    ? String(record.status)
                    : a(key as AssetCopyKey)}
            </strong>
            <pre>{JSON.stringify(record, null, 2)}</pre>
          </article>
        ))}
      </div>
    ) : (
      <State type="empty" title={a("noRecords")} description={a("noRecords")} />
    );
  };
  return (
    <OfflineGate>
      <div className="page asset-detail-page">
        <button className="back" onClick={() => navigate("/assets")}>
          <ArrowLeft />
          {a("back")}
        </button>
        <header className="page-title detail-title">
          <div>
            <h1>{asset.name}</h1>
            <p>
              <b>{asset.code}</b> · {asset.brand} {asset.model}
            </p>
          </div>
          <div className="actions">
            {can(app.user?.role, "assets.edit") && (
              <Button
                variant="secondary"
                onClick={() => navigate(`/assets/${asset.id}/assign`)}
              >
                <UserRound />
                {a("assign")}
              </Button>
            )}
            {can(app.user?.role, "assets.edit") && (
              <Button
                variant="secondary"
                onClick={() => navigate(`/assets/${asset.id}/move`)}
              >
                <MoveRight />
                {a("move")}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => navigate(`/assets/${asset.id}/labels`)}
            >
              <Printer />
              {a("labels")}
            </Button>
            {can(app.user?.role, "assets.edit") && (
              <Button onClick={() => navigate(`/assets/${asset.id}/edit`)}>
                <Edit3 />
                {a("editAsset")}
              </Button>
            )}
            {can(app.user?.role, "assets.archive") && (
              <Button
                variant="secondary"
                onClick={() => setConfirmArchive(true)}
              >
                {asset.status === "Archived" ? <RotateCcw /> : <Archive />}
                {asset.status === "Archived" ? a("restore") : a("archive")}
              </Button>
            )}
          </div>
        </header>
        <MutationFeedback
          status={message ? "success" : "idle"}
          message={message}
        />
        <Card className="asset-digital-card">
          <div className="asset-digital-identity">
            <span className="asset-illustration">{asset.name.slice(0, 1)}</span>
            <div>
              <AssetStatusBadge
                status={asset.status}
              />
              <ConditionBadge condition={asset.condition} />
              <h2>{asset.name}</h2>
              <p>
                {asset.category} · {asset.type}
              </p>
              <span>
                <MapPin /> {asset.location}
              </span>
            </div>
            <div className="asset-qr">
              <QRCodeSVG
                aria-label={`${a("labels")}: ${asset.code}`}
                value={labelPayload(asset)}
                size={112}
              />
              <b>{asset.code}</b>
              <small>{a("secureQrLabel")}</small>
            </div>
          </div>
        </Card>
        <div className="asset-tabs" role="tablist" aria-label={a("details")}>
          {tabs.map((key) => (
            <button
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? "active" : ""}
              key={key}
              onClick={() => setTab(key)}
            >
              {a(key)}
            </button>
          ))}
        </div>
        <aside className="asset-tab-help" aria-live="polite">
          <div>
            <strong>
              {app.language === "nl"
                ? "Wat staat hier?"
                : "What is shown here?"}
            </strong>
            <p>{tabHelp[app.language][tab]}</p>
          </div>
          {tab.endsWith("History") ? (
            <Button
              variant="secondary"
              onClick={() => navigate(`/assets/${asset.id}/history`)}
            >
              <History />
              {app.language === "nl"
                ? "Volledige History Log openen"
                : "Open full History Log"}
            </Button>
          ) : null}
        </aside>
        <Card className="asset-tab-panel">
          <div role="tabpanel">
            {tab === "overview" && (
              <dl className="asset-overview-grid">
                {overview.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {tab === "technicalDetails" && (
              <dl className="asset-overview-grid">
                {Object.entries(asset.technicalSpecifications || {}).map(
                  ([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{value}</dd>
                    </div>
                  ),
                )}
              </dl>
            )}
            {tab === "documents" && (
              <div className="document-list">
                {[...(asset.attachments || []), ...(asset.photos || [])].map(
                  (file) => (
                    <span key={file}>{file}</span>
                  ),
                )}
                {!(asset.attachments?.length || asset.photos?.length) &&
                  a("noRecords")}
              </div>
            )}
            {tab === "accessories" && (
              <State
                type="empty"
                title={a("noRecords")}
                description={a("noRecords")}
              />
            )}
            {tab === "lifecycle" && (
              <div>
                <p>{asset.notes || a("noRecords")}</p>
                {can(app.user?.role, "disposals.request") && (
                  <Button
                    onClick={() => navigate(`/assets/${asset.id}/disposal`)}
                  >
                    <Recycle />
                    {a("disposal")}
                  </Button>
                )}
                {can(app.user?.role, "assets.archive") && (
                  <Button
                    variant="secondary"
                    onClick={() => setConfirmArchive(true)}
                  >
                    {asset.status === "Archived" ? <RotateCcw /> : <Archive />}
                    {asset.status === "Archived" ? a("restore") : a("archive")}
                  </Button>
                )}
              </div>
            )}
            {tab.endsWith("History") &&
              renderHistory(tab as keyof NonNullable<typeof histories>)}
          </div>
        </Card>
        <div className="asset-detail-shortcuts">
          <Button
            variant="ghost"
            onClick={() => navigate(`/assets/${asset.id}/history`)}
          >
            <History />
            {a("history")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate(`/assets/${asset.id}/disposal`)}
          >
            <Recycle />
            {a("disposal")}
          </Button>
        </div>
        <ConfirmDialog
          open={confirmArchive}
          title={asset.status === "Archived" ? a("restore") : a("archive")}
          description={a("correctionWarning")}
          confirmLabel={a("confirm")}
          danger={asset.status !== "Archived"}
          onClose={() => setConfirmArchive(false)}
          onConfirm={toggleArchive}
        />
      </div>
    </OfflineGate>
  );
}
