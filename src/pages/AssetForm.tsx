import { ArrowLeft, Save, ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "react-router-dom";
import { useAssetT } from "../assetCopy";
import { ASSET_CONDITIONS } from "../domain/assetCondition";
import {
  formatTechnicalSpecifications,
  parseTechnicalSpecifications,
} from "../domain/technicalSpecifications";
import {
  Button,
  Card,
  Field,
  SelectField,
  TextAreaField,
} from "../components/ui";
import {
  ConfirmDialog,
  MutationFeedback,
  OfflineGate,
  PageHeader,
} from "../components/WorkflowUi";
import { can } from "../auth/permissions";
import { ClassificationFields } from "../components/ClassificationFields";
import { useAssetTypes } from "../data/assetTypesStore";
import { allowedStatusTargets } from "../domain/assetStatusTransitions";
import {
  assetTypeAllowed,
  effectiveCategoryRelations,
} from "../domain/categoryRelations";
import { useApp } from "../context/AppContext";
import { useMockSnapshot, useRepository } from "../data/repositoryContext";
import {
  assetFormDefaults,
  assetFormSchema,
  canCorrectOfficialCode,
  type AssetFormValues,
} from "../domain/assetManagement";
import type { AssetStatus, Condition } from "../domain/types";
import { useT } from "../i18n";
import { uploadAimsFiles } from "../services/firebaseStorageUploads";
import { readLocalDraft, useAutosaveDraft } from "../hooks/useAutosaveDraft";

const categories = [
  "Laptops",
  "Printers",
  "Projectors",
  "Network switches",
  "UPS devices",
  "Tablets",
];
const statuses: AssetStatus[] = [
  "Available",
  "Assigned",
  "Borrowed",
  "Under Repair",
  "Under Maintenance",
  "Reserved",
  "Lost",
  "Missing",
  "Damaged",
  "Disposed",
  "Archived",
];
const conditions: readonly Condition[] = ASSET_CONDITIONS;
const split = (value?: string) =>
  (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export default function AssetForm() {
  const navigate = useNavigate(),
    params = useParams(),
    id = params.assetId || params.id,
    repository = useRepository(),
    snapshot = useMockSnapshot(),
    app = useApp(),
    a = useAssetT(),
    t = useT(),
    existing = snapshot.assets.find((asset) => asset.id === id),
    trackingTypes = useAssetTypes();
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const schema = assetFormSchema(
    {
      required: a("required"),
      serial: a("invalidSerial"),
      prefix: a("invalidPrefix"),
      correctionReason: a("reasonRequired"),
      price: a("invalidPrice"),
    },
    !!existing,
  );
  const defaults: AssetFormValues = existing
    ? {
        ...assetFormDefaults,
        codePrefix: existing.codePrefix as AssetFormValues["codePrefix"],
        codeNumber: String(existing.codeNumber),
        name: existing.name,
        description: existing.description || "",
        category: existing.category,
        subcategory: existing.subcategory || "",
        assetTypeId: existing.assetTypeId || "",
        type: existing.type,
        brand: existing.brand,
        model: existing.model,
        serialNumber: existing.serialNumber,
        barcode: existing.barcode || "",
        status: existing.status,
        condition: existing.condition,
        location: existing.location,
        currentLocationId:
          existing.currentLocationId ||
          (snapshot.references || []).find(
            (item) =>
              item.kind === "location" && item.name === existing.location,
          )?.id ||
          "",
        department: existing.department,
        assignedTo: existing.assignedTo || "",
        responsibleEmployee: existing.responsibleEmployee || "",
        purchaseDate: existing.purchaseDate,
        purchasePrice: String(existing.purchasePrice || ""),
        supplier: existing.supplier || "",
        manufacturer: existing.manufacturer || "",
        warrantyStart: existing.warrantyStart || "",
        warrantyExpiry: existing.warrantyExpiry,
        technicalSpecifications: formatTechnicalSpecifications(
          existing.technicalSpecifications,
        ),
        attachments: Array.isArray(existing.attachments) ? existing.attachments.join(", ") : (existing.attachments || ""),
        photos: Array.isArray(existing.photos) ? existing.photos.join(", ") : (existing.photos || ""),
        notes: existing.notes || "",
      }
    : assetFormDefaults;
  const statusOptions: AssetStatus[] = existing
    ? statuses.filter(
        (value) =>
          value === existing.status ||
          allowedStatusTargets(existing.status).includes(value),
      )
    : statuses.filter(
        (value) => value === "Available" || allowedStatusTargets("Available").includes(value),
      );
  const draftKey = `asset-form:${existing?.id || "new"}`;
  const recoveredDraft = readLocalDraft<AssetFormValues>(draftKey);
  const formMethods = useForm<AssetFormValues>({
    resolver: zodResolver(schema),
    // Merge so a draft saved before a field existed still validates.
    defaultValues: recoveredDraft?.value
      ? { ...defaults, ...recoveredDraft.value }
      : defaults,
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
    setError,
    watch,
    setValue,
    getValues,
  } = formMethods;
  const watchedValues = watch();
  // Category relations: default Codegroep and allowed tracking types.
  const relations = useMemo(
    () =>
      effectiveCategoryRelations(
        watchedValues.category,
        snapshot.references,
        snapshot.codeGroups,
      ),
    [watchedValues.category, snapshot.references, snapshot.codeGroups],
  );
  const previousCategory = useRef(watchedValues.category);
  useEffect(() => {
    if (previousCategory.current === watchedValues.category) return;
    previousCategory.current = watchedValues.category;
    // A newly chosen category pre-selects its default Codegroep (new assets
    // only; an existing asset's identifier never changes here).
    if (!existing && relations.codeGroup)
      setValue("codePrefix", relations.codeGroup.prefix as AssetFormValues["codePrefix"], {
        shouldDirty: true,
        shouldValidate: true,
      });
    const chosen = getValues("assetTypeId");
    if (chosen && !assetTypeAllowed(chosen, relations))
      setValue("assetTypeId", "", { shouldDirty: true });
  }, [watchedValues.category, relations, existing, setValue, getValues]);
  const draftAutosave = useAutosaveDraft({
    key: draftKey,
    value: watchedValues,
    delay: 1000,
    enabled: isDirty,
    save: async () => undefined,
  });
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (isDirty) event.preventDefault();
    };
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [isDirty]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const leave = () => {
    if (!isDirty || window.confirm(a("unsaved")))
      navigate(existing ? `/assets/${existing.id}` : "/assets");
  };
  const handleDelete = async () => {
    if (!existing) return;
    setIsDeleting(true);
    try {
      const result = await repository.execute({
        action: "asset.archive",
        entityId: existing.id,
        actor: app.user?.name || app.user?.email || "System",
        values: {
          reason:
            app.language === "nl"
              ? "Verwijderd vanuit middelformulier"
              : "Deleted from asset form",
        },
      });
      setConfirmDelete(false);
      navigate("/assets", {
        state: {
          message:
            result.message ||
            (app.language === "nl"
              ? "Middel verplaatst naar prullenbak"
              : "Asset moved to recycle bin"),
        },
      });
    } finally {
      setIsDeleting(false);
    }
  };
  const submit = handleSubmit(async (values) => {
    const selectedLocation = snapshot.references.find(
      (item) => item.id === values.currentLocationId,
    );
    const specifications = parseTechnicalSpecifications(
      values.technicalSpecifications,
    );
    // Tracking type: the chosen one; new assets default to "Serialized"
    // (individual accountability) when that type exists. An edit never
    // silently assigns one.
    const assetTypeId =
      values.assetTypeId ||
      (!existing &&
      trackingTypes.items.some((t) => t.id === "serialized" && t.status === "Active")
        ? "serialized"
        : "");
    const uploadId = existing?.id || crypto.randomUUID();
    const [uploadedAttachments, uploadedPhotos] = await Promise.all([
      uploadAimsFiles(attachmentFiles, "assets", uploadId),
      uploadAimsFiles(photoFiles, "assets", uploadId),
    ]);
    const result = await repository.execute({
      action: existing ? "asset.edit" : "asset.create",
      entityId: existing?.id,
      actor: app.user?.name,
      values: {
        ...values,
        location: selectedLocation?.name || values.location,
        currentLocationId: selectedLocation?.id || null,
        homeLocationId: selectedLocation?.id || null,
        mainLocationId:
          selectedLocation?.type === "Main location"
            ? selectedLocation.id
            : selectedLocation?.mainLocationId || null,
        purchasePrice: Number(values.purchasePrice || 0),
        assetTypeId: assetTypeId || null,
        technicalSpecifications: specifications,
        attachments: [...split(values.attachments), ...uploadedAttachments],
        photos: [...split(values.photos), ...uploadedPhotos],
      },
    });
    if (!result.ok) {
      setError(
        result.message.toLowerCase().includes("serial")
          ? "serialNumber"
          : "root",
        {
          message: result.message.includes("connected to Firebase")
            ? a("correctionUnavailable")
            : result.message,
        },
      );
      return;
    }
    draftAutosave.clear();
    navigate(`/assets/${result.entityId || existing?.id}`, {
      replace: true,
      state: {
        assetMutation: existing ? "updated" : "created",
        message: result.message,
      },
    });
  });
  const errorMessage =
    errors.root?.message || Object.values(errors)[0]?.message || "";
  return (
    <OfflineGate>
      <div className="page asset-form-page">
        <button className="back" onClick={leave}>
          <ArrowLeft />
          {a("back")}
        </button>
        <PageHeader
          title={existing ? a("editTitle") : a("addTitle")}
          description={a("formDescription")}
          actions={<>
            <span className={`autosave-status ${draftAutosave.status}`} role="status">
              {recoveredDraft && isDirty ? "Draft recovered" : draftAutosave.status === "saving" ? "Saving draft…" : draftAutosave.status === "saved" ? "Draft saved" : draftAutosave.status === "error" ? "Draft save failed" : ""}
            </span>
            {existing && can(app.user?.role, "assets.archive") && (
              <Button
                type="button"
                variant="danger"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 />
                {app.language === "nl" ? "Verwijderen naar prullenbak" : "Move to recycle bin"}
              </Button>
            )}
            <Button type="submit" form="asset-form" disabled={isSubmitting || isDeleting}>
              <Save />
              {isSubmitting ? a("saving") : a("save")}
            </Button>
          </>}
        />
        <FormProvider {...formMethods}>
        <form id="asset-form" onSubmit={submit} noValidate>
          <div className="asset-form-sections">
            <Card title={a("identity")} className="asset-identity-card">
              <div className="form-grid">
                {existing ? (
                  <div className="field-with-hint asset-identity-code">
                    <Field
                      label={a("officialCode")}
                      value={existing.code}
                      readOnly
                    />
                  </div>
                ) : (
                  <div className="field-with-hint asset-identity-code">
                    <SelectField
                      label={a("codeGroup")}
                      required
                      error={errors.codePrefix?.message}
                      {...register("codePrefix")}
                    >
                      <option value="">Select a code group</option>
                      {[...(snapshot.codeGroups || [])]
                        .filter((group) => group.isActive)
                        .sort((a, b) =>
                          a.name.localeCompare(b.name, undefined, {
                            numeric: true,
                            sensitivity: "base",
                          }),
                        )
                        .map((group) => (
                          <option key={group.id} value={group.prefix}>
                            {group.name} ({group.prefix})
                          </option>
                        ))}
                    </SelectField>
                    <Field label={app.language === "nl" ? "Bestaand volgnummer" : "Existing sequence number"} type="number" min="1" max="1000000000" required error={errors.codeNumber?.message} {...register("codeNumber")} />
                    <p className="field-hint">{app.language === "nl" ? "Voer het bestaande nummer uit het inventarisoverzicht in." : "Enter the existing number from the inventory list."}</p>
                  </div>
                )}
                <div className="asset-identity-serial">
                  <Field
                    label={a("serial")}
                    required
                    error={errors.serialNumber?.message}
                    {...register("serialNumber")}
                  />
                </div>
                <div className="asset-identity-barcode">
                  <Field label={a("barcode")} {...register("barcode")} />
                </div>
                <div className="asset-identity-name">
                  <Field
                    label={a("name")}
                    required
                    error={errors.name?.message}
                    {...register("name")}
                  />
                </div>
                <div className="asset-identity-description wide">
                  <TextAreaField
                    className="wide"
                    label={a("description")}
                    {...register("description")}
                  />
                </div>
                <p className="field-hint wide">{a("qrPreparation")}</p>
              </div>
            </Card>
            <Card title={a("classification")} className="asset-classification-card">
              <div className="form-grid">
                <ClassificationFields />
                {relations.codeGroup && !existing && (
                  <p className="field-hint wide">
                    {app.language === "nl" ? "Standaard codegroep voor deze categorie" : "Default code group for this category"}
                    : {relations.codeGroup.name} ({relations.codeGroup.prefix})
                  </p>
                )}
                {trackingTypes.connected && (
                  <SelectField
                    label={app.language === "nl" ? "Beheertype" : "Tracking type"}
                    {...register("assetTypeId")}
                  >
                    <option value="">
                      {existing
                        ? app.language === "nl" ? "Niet ingesteld" : "Not set"
                        : app.language === "nl" ? "Standaard (Serialized)" : "Default (Serialized)"}
                    </option>
                    {trackingTypes.items
                      .filter(
                        (item) =>
                          (item.status === "Active" && assetTypeAllowed(item.id, relations)) ||
                          item.id === existing?.assetTypeId,
                      )
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </SelectField>
                )}
                <Field
                  label={a("itemType")}
                  required
                  error={errors.type?.message}
                  {...register("type")}
                />
                <Field label={a("brand")} {...register("brand")} />
                <Field label={a("model")} {...register("model")} />
                <Field
                  label={a("manufacturer")}
                  {...register("manufacturer")}
                />
              </div>
            </Card>
            <Card title={a("ownership")}>
              <div className="form-grid">
                <SelectField label={a("status")} {...register("status")}>
                  {/* Only logical next statuses; the current one stays selectable. */}
                  {statusOptions.map((value) => (
                    <option key={value} value={value}>
                      {t(`status.${value}`)}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label={a("condition")}
                  {...register("condition")}
                >
                  {conditions.map((value) => (
                    <option key={value} value={value}>
                      {t(`condition.${value}`)}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label={app.language === "nl" ? "Hoofdlocatie" : "Main location"}
                  required
                  error={errors.currentLocationId?.message}
                  {...register("currentLocationId")}
                >
                  <option value="">{a("all")}</option>
                  {(snapshot.references || [])
                    .filter(
                      (item) =>
                        item.kind === "location" && item.status === "Active",
                    )
                    .sort((x, y) => x.name.localeCompare(y.name))
                    .map((value) => (
                      <option key={value.id} value={value.id}>
                        {value.name}
                      </option>
                    ))}
                </SelectField>
                <Field
                  label={app.language === "nl" ? "Sublocatie" : "Sub-location"}
                  required
                  error={errors.department?.message}
                  {...register("department")}
                />
                <Field label={a("assignedUser")} {...register("assignedTo")} />
                <Field
                  label={app.language === "nl" ? "Afdeling" : "Department"}
                  {...register("responsibleEmployee")}
                />
              </div>
            </Card>
            <Card title={a("purchase")}>
              <div className="form-grid">
                <Field
                  type="date"
                  label={a("purchaseDate")}
                  {...register("purchaseDate")}
                />
                <Field
                  type="number"
                  min="0"
                  step=".01"
                  label={a("purchasePrice")}
                  error={errors.purchasePrice?.message}
                  {...register("purchasePrice")}
                />
                <Field label={a("supplier")} {...register("supplier")} />
                <Field
                  type="date"
                  label={a("warrantyStart")}
                  {...register("warrantyStart")}
                />
                <Field
                  type="date"
                  label={a("warrantyExpiry")}
                  {...register("warrantyExpiry")}
                />
              </div>
            </Card>
            <Card title={a("technical")}>
              <div className="form-grid">
                <TextAreaField
                  className="wide"
                  label={a("specifications")}
                  placeholder={app.language === "nl" ? "Vrije tekst, of per regel Sleutel: waarde\nCPU: Intel Core i5\nRAM: 16 GB" : "Free text, or one Key: value per line\nCPU: Intel Core i5\nRAM: 16 GB"}
                  {...register("technicalSpecifications")}
                />
              </div>
            </Card>
            <Card title={a("media")}>
              <div className="form-grid">
                <label className="field">
                  <span>{a("attachments")}</span>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,application/pdf,text/plain,.doc,.docx,.xls,.xlsx"
                    onChange={(event) =>
                      setAttachmentFiles(Array.from(event.target.files || []))
                    }
                  />
                </label>
                <label className="field">
                  <span>{a("photos")}</span>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    onChange={(event) =>
                      setPhotoFiles(Array.from(event.target.files || []))
                    }
                  />
                </label>
                <small id="attachment-help" className="field-hint wide">
                  {a("attachmentsHelp")}
                </small>
                <TextAreaField
                  className="wide"
                  label={a("notes")}
                  {...register("notes")}
                />
              </div>
            </Card>
            {existing && canCorrectOfficialCode(app.user?.role) && (
              <Card title={a("correction")}>
                <div className="admin-warning">
                  <ShieldAlert />
                  <span>{a("correctionWarning")}</span>
                </div>
                <div className="form-grid">
                  <Field
                    label={a("correction")}
                    error={errors.codeCorrection?.message}
                    {...register("codeCorrection")}
                  />
                  <TextAreaField
                    label={a("correctionReason")}
                    error={errors.correctionReason?.message}
                    {...register("correctionReason")}
                  />
                </div>
              </Card>
            )}
          </div>
          <MutationFeedback
            status={errorMessage ? "error" : "idle"}
            message={errorMessage}
          />
          <div className="form-actions">
            {existing && can(app.user?.role, "assets.archive") && (
              <Button
                type="button"
                variant="danger"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 />
                {app.language === "nl" ? "Verwijderen naar prullenbak" : "Move to recycle bin"}
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={leave}>
              {a("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || isDeleting}>
              {isSubmitting ? a("saving") : a("confirm")}
            </Button>
          </div>
        </form>
        </FormProvider>
        {existing && (
          <ConfirmDialog
            open={confirmDelete}
            title={
              app.language === "nl"
                ? "Middel verwijderen naar prullenbak"
                : "Move asset to recycle bin"
            }
            description={
              app.language === "nl"
                ? "Weet u zeker dat u dit middel wilt verwijderen? Het middel wordt veilig verplaatst naar de prullenbak (Instellingen → Prullenbak) en blijft bewaard."
                : "Are you sure you want to delete this asset? It will be safely moved to the recycle bin (Settings → Recycle Bin) and preserved."
            }
            confirmLabel={
              app.language === "nl"
                ? "Verwijderen naar prullenbak"
                : "Move to recycle bin"
            }
            danger
            onClose={() => setConfirmDelete(false)}
            onConfirm={handleDelete}
          />
        )}
      </div>
    </OfflineGate>
  );
}
