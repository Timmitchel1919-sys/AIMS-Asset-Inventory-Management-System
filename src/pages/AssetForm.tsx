import { ArrowLeft, Save, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "react-router-dom";
import { useAssetT } from "../assetCopy";
import {
  Button,
  Card,
  Field,
  SelectField,
  TextAreaField,
} from "../components/ui";
import {
  MutationFeedback,
  OfflineGate,
  PageHeader,
} from "../components/WorkflowUi";
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
import { mappedCondition } from "../domain/assetStatus";
import { AssetStatusBadge } from "../components/AssetStatusBadge";
import { uploadAimsFiles } from "../services/firebaseStorageUploads";

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
const conditions: Condition[] = [
  "New",
  "Excellent",
  "Good",
  "Fair",
  "Poor",
  "Defective",
  "Beyond Repair",
];
const split = (value: string) =>
  value
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
    existing = snapshot.assets.find((asset) => asset.id === id);
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
        name: existing.name,
        description: existing.description || "",
        category: existing.category,
        subcategory: existing.subcategory || "",
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
          snapshot.references.find(
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
        technicalSpecifications: Object.entries(
          existing.technicalSpecifications || {},
        )
          .map(([key, value]) => `${key}: ${value}`)
          .join("\n"),
        attachments: (existing.attachments || []).join(", "),
        photos: (existing.photos || []).join(", "),
        notes: existing.notes || "",
      }
    : assetFormDefaults;
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
    setError,
    setValue,
    watch,
  } = useForm<AssetFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });
  const selectedStatus = watch("status"),
    selectedCondition = watch("condition"),
    lockedCondition = mappedCondition(selectedStatus);
  useEffect(() => {
    if (lockedCondition && selectedCondition !== lockedCondition)
      setValue("condition", lockedCondition, {
        shouldDirty: true,
        shouldValidate: true,
      });
  }, [lockedCondition, selectedCondition, setValue]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (isDirty) event.preventDefault();
    };
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [isDirty]);
  const leave = () => {
    if (!isDirty || window.confirm(a("unsaved")))
      navigate(existing ? `/assets/${existing.id}` : "/assets");
  };
  const submit = handleSubmit(async (values) => {
    const selectedLocation = snapshot.references.find(
      (item) => item.id === values.currentLocationId,
    );
    const specifications = Object.fromEntries(
      values.technicalSpecifications
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line: string) => {
          const [key, ...rest] = line.split(":");
          return [key.trim(), rest.join(":").trim()];
        }),
    );
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
        { message: result.message },
      );
      return;
    }
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
          actions={
            <Button type="submit" form="asset-form" disabled={isSubmitting}>
              <Save />
              {isSubmitting ? a("saving") : a("save")}
            </Button>
          }
        />
        <form id="asset-form" onSubmit={submit} noValidate>
          <div className="asset-form-sections">
            <Card title={a("identity")}>
              <div className="form-grid">
                {existing ? (
                  <Field
                    label={a("officialCode")}
                    value={existing.code}
                    readOnly
                  />
                ) : (
                  <SelectField
                    label={a("codeGroup")}
                    required
                    error={errors.codePrefix?.message}
                    {...register("codePrefix")}
                  >
                    <option value="">Select a code group</option>
                    {[...snapshot.codeGroups]
                      .filter((group) => group.isActive)
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((group) => (
                        <option key={group.id} value={group.prefix}>
                          {group.name} ({group.prefix})
                        </option>
                      ))}
                  </SelectField>
                )}
                <Field
                  label={a("name")}
                  required
                  error={errors.name?.message}
                  {...register("name")}
                />
                <Field
                  label={a("serial")}
                  required
                  error={errors.serialNumber?.message}
                  {...register("serialNumber")}
                />
                <Field label={a("barcode")} {...register("barcode")} />
                <TextAreaField
                  className="wide"
                  label={a("description")}
                  {...register("description")}
                />
                <p className="field-hint wide">{a("qrPreparation")}</p>
              </div>
            </Card>
            <Card title={a("classification")}>
              <div className="form-grid">
                <SelectField
                  label={a("category")}
                  required
                  error={errors.category?.message}
                  {...register("category")}
                >
                  <option value="">{a("all")}</option>
                  {categories.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </SelectField>
                <Field label={a("subcategory")} {...register("subcategory")} />
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
                  {statuses.map((value) => (
                    <option key={value} value={value}>
                      {t(`status.${value}`)}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label={a("condition")}
                  aria-describedby={
                    lockedCondition ? "condition-status-help" : undefined
                  }
                  disabled={!!lockedCondition}
                  {...register("condition")}
                >
                  {conditions.map((value) => (
                    <option key={value} value={value}>
                      {t(`condition.${value}`)}
                    </option>
                  ))}
                </SelectField>
                {lockedCondition && (
                  <div className="wide" id="condition-status-help">
                    <p className="field-hint">
                      {t("assets.conditionDetermined")}
                    </p>
                    <div aria-label={t("assets.statusPreview")}>
                      <AssetStatusBadge
                        status={selectedStatus}
                        condition={lockedCondition}
                        showCondition
                        variant="solid"
                      />
                    </div>
                  </div>
                )}
                <SelectField
                  label={a("location")}
                  required
                  error={errors.currentLocationId?.message}
                  {...register("currentLocationId")}
                >
                  <option value="">{a("all")}</option>
                  {snapshot.references
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
                  label={a("department")}
                  required
                  error={errors.department?.message}
                  {...register("department")}
                />
                <Field label={a("assignedUser")} {...register("assignedTo")} />
                <Field
                  label={a("responsible")}
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
                  placeholder="CPU: Intel Core i5&#10;RAM: 16 GB"
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
            <Button type="button" variant="ghost" onClick={leave}>
              {a("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? a("saving") : a("confirm")}
            </Button>
          </div>
        </form>
      </div>
    </OfflineGate>
  );
}
