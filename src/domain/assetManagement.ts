import { z } from "zod";
import type { Asset, AssetStatus, Condition, Role } from "./types";
import { normalizeAssetCode } from "./assetCode";
import { isValidStatusCondition } from "./assetStatus";

export type AssetCodePrefix = string;
export interface AssetFormValues {
  codePrefix: AssetCodePrefix;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  type: string;
  brand: string;
  model: string;
  serialNumber: string;
  barcode: string;
  status: AssetStatus;
  condition: Condition;
  location: string;
  currentLocationId?: string;
  department: string;
  assignedTo: string;
  responsibleEmployee: string;
  purchaseDate: string;
  purchasePrice: string;
  supplier: string;
  manufacturer: string;
  warrantyStart: string;
  warrantyExpiry: string;
  technicalSpecifications: string;
  attachments: string;
  photos: string;
  notes: string;
  codeCorrection: string;
  correctionReason: string;
}
export const assetFormDefaults: AssetFormValues = {
  codePrefix: "KCSMD",
  name: "",
  description: "",
  category: "",
  subcategory: "",
  type: "Device",
  brand: "",
  model: "",
  serialNumber: "",
  barcode: "",
  status: "Available" as AssetStatus,
  condition: "Good" as Condition,
  location: "",
  currentLocationId: "",
  department: "",
  assignedTo: "",
  responsibleEmployee: "",
  purchaseDate: "",
  purchasePrice: "",
  supplier: "",
  manufacturer: "",
  warrantyStart: "",
  warrantyExpiry: "",
  technicalSpecifications: "",
  attachments: "",
  photos: "",
  notes: "",
  codeCorrection: "",
  correctionReason: "",
};
export type ValidationMessages = {
  required: string;
  serial: string;
  prefix: string;
  correctionReason: string;
  price: string;
};
export function assetFormSchema(messages: ValidationMessages, isEdit = false) {
  return z
    .object({
      codePrefix: z
        .string()
        .trim()
        .regex(/^[A-Z][A-Z0-9]{1,11}$/, { message: messages.prefix }),
      name: z.string().trim().min(2, messages.required),
      description: z.string(),
      category: z.string().min(1, messages.required),
      subcategory: z.string(),
      type: z.string().min(1, messages.required),
      brand: z.string(),
      model: z.string(),
      serialNumber: z.string().trim().min(3, messages.serial),
      barcode: z.string(),
      status: z.enum([
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
      ]),
      condition: z.enum([
        "New",
        "Excellent",
        "Good",
        "Fair",
        "Poor",
        "Defective",
        "Beyond Repair",
      ]),
      location: z.string(),
      currentLocationId: z.string().default(""),
      department: z.string().min(1, messages.required),
      assignedTo: z.string(),
      responsibleEmployee: z.string(),
      purchaseDate: z.string(),
      purchasePrice: z
        .string()
        .refine((value) => !value || Number(value) >= 0, messages.price),
      supplier: z.string(),
      manufacturer: z.string(),
      warrantyStart: z.string(),
      warrantyExpiry: z.string(),
      technicalSpecifications: z.string(),
      attachments: z.string(),
      photos: z.string(),
      notes: z.string(),
      codeCorrection: z.string(),
      correctionReason: z.string(),
    })
    .superRefine((value, context) => {
      if(!value.currentLocationId&&!value.location)context.addIssue({code:"custom",path:["currentLocationId"],message:messages.required});
      if (!isValidStatusCondition(value.status, value.condition))
        context.addIssue({
          code: "custom",
          path: ["condition"],
          message: "Condition must match asset status.",
        });
      if (
        isEdit &&
        value.codeCorrection &&
        !normalizeAssetCode(value.codeCorrection)
      )
        context.addIssue({
          code: "custom",
          path: ["codeCorrection"],
          message: messages.prefix,
        });
      if (isEdit && value.codeCorrection && !value.correctionReason.trim())
        context.addIssue({
          code: "custom",
          path: ["correctionReason"],
          message: messages.correctionReason,
        });
    });
}
export const canCorrectOfficialCode = (role: Role | undefined) =>
  role === "administrator" || role === "ict-staff";
export const isAssignmentEligible = (asset: Pick<Asset, "status">) =>
  asset.status === "Available" || asset.status === "Reserved";
export function validateAssetMovement(
  asset: Pick<Asset, "location" | "department">,
  destinationLocation: string,
  destinationDepartment: string,
) {
  if (!destinationLocation.trim())
    return { ok: false, message: "Destination location is required." };
  if (
    asset.location === destinationLocation &&
    asset.department === destinationDepartment
  )
    return {
      ok: false,
      message:
        "Destination must differ from the current location or department.",
    };
  return { ok: true, message: "" };
}
export function labelPayload(
  asset: Pick<Asset, "id">,
  origin = "https://inventory.kcs.local",
) {
  return `${origin.replace(/\/$/, "")}/assets/${encodeURIComponent(asset.id)}`;
}

export interface ImportRow {
  row: number;
  submitted: string;
  normalized?: string;
  values?: Record<string, string>;
  errors: ImportError[];
}
export interface ImportError {
  type: string;
  explanation: string;
  recommendation: string;
}
const csvLine = (line: string) =>
  line.split(",").map((value) => value.trim().replace(/^"|"$/g, ""));
export function parseAssetImport(
  text: string,
  existing: Pick<Asset, "code" | "serialNumber">[],
  valid: { categories: string[]; locations: string[]; departments: string[] },
) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean),
    headers = csvLine(lines[0] || "").map((value) => value.toLowerCase());
  const seenCodes = new Set(existing.map((asset) => asset.code)),
    seenSerials = new Set(
      existing.map((asset) => asset.serialNumber.toLowerCase()),
    );
  return lines.slice(1).map((line, index): ImportRow => {
    const cells = csvLine(line),
      values = Object.fromEntries(
        headers.map((header, column) => [header, cells[column] || ""]),
      ),
      submitted = values.code || "",
      normalized = normalizeAssetCode(submitted)?.fullAssetCode,
      errors: ImportError[] = [];
    const add = (type: string, explanation: string, recommendation: string) =>
      errors.push({ type, explanation, recommendation });
    if (!values.name)
      add("MISSING_REQUIRED", "Asset name is required.", "Provide a name.");
    if (!normalized)
      add(
        "INVALID_CODE",
        "KCS code prefix, sequence or range is invalid.",
        "Use KCSMD, KCSL, KCSBD, KCSRT or KCSPW with sequence 01–5000.",
      );
    else if (seenCodes.has(normalized))
      add(
        "DUPLICATE_CODE",
        "The normalized KCS code already exists.",
        "Choose the next unused official sequence.",
      );
    if (!values.serialnumber)
      add(
        "MISSING_REQUIRED",
        "Serial number is required.",
        "Provide a unique serial number.",
      );
    else if (seenSerials.has(values.serialnumber.toLowerCase()))
      add(
        "DUPLICATE_SERIAL",
        "Serial number already exists.",
        "Verify the source record.",
      );
    if (values.category && !valid.categories.includes(values.category))
      add(
        "INVALID_CATEGORY",
        "Category is not recognized.",
        "Use an active category.",
      );
    if (values.location && !valid.locations.includes(values.location))
      add(
        "INVALID_LOCATION",
        "Location is not recognized.",
        "Use an active location.",
      );
    if (values.department && !valid.departments.includes(values.department))
      add(
        "INVALID_DEPARTMENT",
        "Department is not recognized.",
        "Use an active department.",
      );
    if (normalized && !errors.some((error) => error.type === "DUPLICATE_CODE"))
      seenCodes.add(normalized);
    if (
      values.serialnumber &&
      !errors.some((error) => error.type === "DUPLICATE_SERIAL")
    )
      seenSerials.add(values.serialnumber.toLowerCase());
    return { row: index + 2, submitted, normalized, values, errors };
  });
}
