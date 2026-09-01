import type {
  Asset,
  Audit,
  AuditDiscrepancy,
  BorrowRecord,
  CorrectiveAction,
  Maintenance,
  Movement,
  Notification,
  Repair,
} from "../domain/types";
import type { ListQuery, ListResult } from "./listQuery";

export type StockStatus =
  | "In stock"
  | "Low stock"
  | "Out of stock"
  | "Reserved"
  | "Fully reserved"
  | "Ordered"
  | "Received"
  | "Returned"
  | "Damaged"
  | "Defective"
  | "Lost"
  | "Under inspection"
  | "Archived";
export interface InventoryItem {
  id: string;
  code: string;
  barcode?: string;
  name: string;
  description?: string;
  itemType: string;
  category: string;
  subcategory?: string;
  brand?: string;
  model?: string;
  manufacturer?: string;
  supplier?: string;
  supplierItemCode?: string;
  unit: string;
  onHand: number;
  reserved: number;
  minimum: number;
  reorderLevel: number;
  reorderQuantity: number;
  maximum?: number;
  warehouse: string;
  storageRoom?: string;
  shelf?: string;
  rack?: string;
  location: string;
  department?: string;
  lastPurchaseDate?: string;
  unitCost?: number;
  currency?: string;
  batchNumber?: string;
  expirationDate?: string;
  photograph?: string;
  attachments?: string[];
  notes?: string;
  createdBy: string;
  createdAt: string;
  modifiedBy: string;
  lastUpdated: string;
  archived: boolean;
  archiveReason?: string;
  workflowStatus?: StockStatus;
  sourceData?: Record<string, string>;
  importMetadata?: {
    source: string;
    sourceType: "legacy_inventory";
    importedAt: string;
    importedBy: string;
    sourceRecordCode: string;
    migrationVersion: string;
  };
}
export type ReservationStatus =
  | "Draft"
  | "Pending"
  | "Approved"
  | "Rejected"
  | "Active"
  | "Partially fulfilled"
  | "Fulfilled"
  | "Released"
  | "Expired"
  | "Cancelled";
export interface StockReservation {
  id: string;
  reference: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  fulfilledQuantity: number;
  requestedBy: string;
  beneficiary: string;
  purpose: string;
  requiredDate: string;
  expirationDate: string;
  approvedBy?: string;
  status: ReservationStatus;
  notes?: string;
  createdAt: string;
  history: string[];
}
export interface InventoryMovement {
  id: string;
  reference: string;
  type: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  source?: string;
  destination?: string;
  employee?: string;
  department?: string;
  reason: string;
  date: string;
  performedBy: string;
  approvedBy?: string;
  notes?: string;
  attachments?: string[];
  transactionReference?: string;
}
export type AssignmentStatus =
  | "Draft"
  | "Pending approval"
  | "Approved"
  | "Active"
  | "Return requested"
  | "Returned"
  | "Cancelled"
  | "Expired"
  | "Reassigned"
  | "Closed";
export interface AssignmentAccessory {
  name: string;
  quantity: number;
  conditionAtIssue: string;
  conditionAtReturn?: string;
  returned?: boolean;
  missing?: boolean;
  damaged?: boolean;
  notes?: string;
}
export interface WorkflowHistoryEvent {
  id: string;
  at: string;
  user: string;
  type: string;
  description: string;
  previous?: Record<string, unknown>;
  next?: Record<string, unknown>;
  reason?: string;
  relatedRecord?: string;
}
export interface Assignment {
  id: string;
  reference: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  category?: string;
  assignee: string;
  assigneeType: string;
  department: string;
  location: string;
  assignedAt: string;
  expectedReturn?: string;
  assignedBy: string;
  approvedBy?: string;
  status: AssignmentStatus;
  active: boolean;
  conditionAtIssue: string;
  operationalStatusAtIssue: string;
  accessories: AssignmentAccessory[];
  notes?: string;
  attachments?: string[];
  assigneeSignature?: string;
  staffSignature?: string;
  signature?: string;
  returnSignature?: string;
  returnedAt?: string;
  returnedBy?: string;
  receivedBy?: string;
  conditionAtReturn?: string;
  operationalStatusAfterReturn?: string;
  accessoriesReturned?: string[];
  missingAccessories?: string[];
  returnNotes?: string;
  returnPhotos?: string[];
  createdBy: string;
  createdAt: string;
  modifiedBy: string;
  lastUpdated: string;
  history: WorkflowHistoryEvent[];
}
export type DisposalStatus =
  | "Requested"
  | "Inspected"
  | "Approved"
  | "Rejected"
  | "Method Selected"
  | "Completed"
  | "Permanently Archived";
export interface Disposal {
  id: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  reason: string;
  status: DisposalStatus;
  requestedBy: string;
  requestedAt: string;
  inspectionNotes?: string;
  decisionReason?: string;
  method?: string;
  technicalAssessment?: string;
  estimatedValue?: number;
  completionDate?: string;
  finalHandler?: string;
  attachments?: string[];
}
export type ReferenceKind = "category" | "location" | "department";
export interface ReferenceRecord {
  id: string;
  kind: ReferenceKind;
  name: string;
  type: string;
  typeId?: string;
  parent?: string;
  parentId?: string;
  parentLocationId?: string | null;
  managerId?: string | null;
  status: "Active" | "Inactive" | "Temporarily closed" | "Archived";
  mainLocationId?: string | null;
  containerLocationId?: string | null;
  managerUserId?: string | null;
  directAssetCount?: number;
  directSubLocationCount?: number;
  openTaskCount?: number;
  relatedCount: number;
  details: Record<string, string | number | boolean | string[]>;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}
export interface LocationType {
  id: string;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  allowedParentTypeIds: string[];
  createdAt: string;
  updatedAt: string;
}
export interface CodeGroup {
  id: string;
  name: string;
  prefix: string;
  minimumNumber: number;
  maximumNumber: number;
  nextAvailableNumber: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
  deletionReason?: string;
}
export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: "Active" | "Inactive";
  lastLogin: string;
  photo?: string;
}
export interface RoleRecord {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  system: boolean;
}
export interface ReportDefinition {
  id: string;
  name: string;
  description?: string;
  reportType?: string;
  category: string;
  version?: number;
  frequency: string;
  format: string;
  lastGenerated?: string;
  scheduled: boolean;
  scope?: Record<string, string>;
  dateRange?: { from: string; to: string };
  comparisonPeriod?: string;
  grouping?: string;
  filters?: Record<string, string>;
  columns?: string[];
  sort?: string;
  metrics?: string[];
  charts?: string[];
  orientation?: "Portrait" | "Landscape";
  paperSize?: string;
  exportFormats?: string[];
  requiredPermissions?: string[];
  sensitiveFields?: string[];
  allowedRoles?: string[];
  shared?: boolean;
  archived?: boolean;
  createdBy?: string;
  createdAt?: string;
  modifiedBy?: string;
  lastUpdated?: string;
}
export interface ReportResult {
  id: string;
  definitionId: string;
  reportType: string;
  title: string;
  parameters: Record<string, unknown>;
  filters: Record<string, string>;
  grouping?: string;
  snapshotAt: string;
  generatedBy: string;
  generatedAt: string;
  recordCount: number;
  metrics: Record<string, number | string>;
  chartData: Record<string, unknown[]>;
  rows: Record<string, unknown>[];
  warnings: string[];
  missingData: string[];
  permissionExclusions: string[];
  formats: string[];
  status:
    | "Draft"
    | "Generating"
    | "Completed"
    | "Completed with Warnings"
    | "Failed"
    | "Cancelled"
    | "Expired";
  error?: string;
}
export interface ScheduledReport {
  id: string;
  definitionId: string;
  name: string;
  recurrence: "Daily" | "Weekly" | "Monthly" | "Quarterly" | "Annual";
  nextRun: string;
  timeZone: string;
  recipients: string[];
  active: boolean;
  lastRun?: string;
  createdBy: string;
}
export interface ActivityRecord {
  id: string;
  at: string;
  user: string;
  action: string;
  entityType: string;
  entityId: string;
  result: "Success" | "Failure";
  detail: string;
}
export type AssetHistoryEventStatus = "Draft" | "Final";
export interface AssetHistoryEvent {
  id: string;
  assetId: string;
  assetCode: string;
  eventType: string;
  category: string;
  title: string;
  description: string;
  previous?: Record<string, unknown>;
  next?: Record<string, unknown>;
  issue?: string;
  solution?: string;
  notes?: string;
  sourceModule: string;
  sourceRecordId?: string;
  source: "system" | "manual" | "legacy_import" | "correction";
  createdAt: string;
  occurredAt: string;
  createdBy: string;
  performedBy?: string;
  importBatchId?: string;
  originalLegacyText?: string;
  isLegacyImport: boolean;
  isManual: boolean;
  status: AssetHistoryEventStatus;
  updatedAt?: string;
  version: number;
  fingerprint?: string;
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
}
export interface MockSnapshot {
  assets: Asset[];
  inventory: InventoryItem[];
  assignments: Assignment[];
  borrows: BorrowRecord[];
  repairs: Repair[];
  maintenance: Maintenance[];
  movements: Movement[];
  audits: Audit[];
  auditDiscrepancies: AuditDiscrepancy[];
  correctiveActions: CorrectiveAction[];
  disposals: Disposal[];
  notifications: Notification[];
  activity: ActivityRecord[];
  assetHistoryEvents: AssetHistoryEvent[];
  references: ReferenceRecord[];
  locationTypes: LocationType[];
  codeGroups: CodeGroup[];
  systemSettings: {
    hierarchyValidationMode: "strict" | "warning" | "disabled";
  };
  users: SystemUser[];
  roles: RoleRecord[];
  reports: ReportDefinition[];
  reportResults: ReportResult[];
  scheduledReports: ScheduledReport[];
  reservations: StockReservation[];
  inventoryMovements: InventoryMovement[];
}
export type WorkflowAction =
  | "asset.create"
  | "asset.edit"
  | "asset.archive"
  | "asset.restore"
  | "asset.move"
  | "asset.return"
  | "history.manual.saveDraft"
  | "history.manual.finalize"
  | "history.manual.delete"
  | "history.manual.correct"
  | "history.legacy.import"
  | "inventory.create"
  | "inventory.legacy.importBatch"
  | "inventory.edit"
  | "inventory.archive"
  | "inventory.restore"
  | "stock.receive"
  | "stock.issue"
  | "stock.transfer"
  | "stock.reserve"
  | "stock.return"
  | "stock.correct"
  | "reservation.create"
  | "reservation.approve"
  | "reservation.reject"
  | "reservation.release"
  | "reservation.fulfill"
  | "reservation.cancel"
  | "assignment.create"
  | "assignment.edit"
  | "assignment.approve"
  | "assignment.requestReturn"
  | "assignment.return"
  | "assignment.cancel"
  | "assignment.reassign"
  | "borrow.create"
  | "borrow.edit"
  | "borrow.submit"
  | "borrow.approve"
  | "borrow.reject"
  | "borrow.issue"
  | "borrow.return"
  | "borrow.cancel"
  | "borrow.remind"
  | "borrow.escalate"
  | "repair.create"
  | "repair.edit"
  | "repair.diagnose"
  | "repair.approve"
  | "repair.reject"
  | "repair.parts"
  | "repair.start"
  | "repair.external"
  | "repair.test"
  | "repair.complete"
  | "repair.unrepairable"
  | "repair.return"
  | "repair.cancel"
  | "repair.progress"
  | "maintenance.create"
  | "maintenance.edit"
  | "maintenance.start"
  | "maintenance.pause"
  | "maintenance.resume"
  | "maintenance.reschedule"
  | "maintenance.skip"
  | "maintenance.cancel"
  | "maintenance.remind"
  | "maintenance.escalate"
  | "maintenance.complete"
  | "movement.create"
  | "movement.correct"
  | "movement.approve"
  | "movement.complete"
  | "audit.create"
  | "audit.edit"
  | "audit.generate"
  | "audit.freeze"
  | "audit.prepare"
  | "audit.start"
  | "audit.pause"
  | "audit.resume"
  | "audit.verify"
  | "audit.discrepancy"
  | "audit.review"
  | "audit.complete"
  | "audit.close"
  | "audit.cancel"
  | "discrepancy.assign"
  | "discrepancy.recount"
  | "discrepancy.reclassify"
  | "discrepancy.resolve"
  | "discrepancy.escalate"
  | "discrepancy.close"
  | "corrective.create"
  | "corrective.assign"
  | "corrective.start"
  | "corrective.approve"
  | "corrective.reject"
  | "corrective.complete"
  | "corrective.verify"
  | "corrective.reopen"
  | "disposal.create"
  | "disposal.inspect"
  | "disposal.approve"
  | "disposal.reject"
  | "disposal.method"
  | "disposal.complete"
  | "disposal.archive"
  | "reference.create"
  | "reference.edit"
  | "reference.archive"
  | "reference.restore"
  | "reference.delete"
  | "locationType.create"
  | "locationType.edit"
  | "locationType.activate"
  | "locationType.deactivate"
  | "locationType.reorder"
  | "locationType.delete"
  | "codeGroup.create"
  | "codeGroup.edit"
  | "codeGroup.activate"
  | "codeGroup.deactivate"
  | "codeGroup.reorder"
  | "codeGroup.delete"
  | "codeGroup.restore"
  | "user.create"
  | "user.edit"
  | "user.activate"
  | "user.deactivate"
  | "role.create"
  | "role.edit"
  | "report.create"
  | "report.edit"
  | "report.archive"
  | "report.restore"
  | "report.generate"
  | "report.export"
  | "report.print"
  | "report.schedule.create"
  | "report.schedule.edit"
  | "report.schedule.pause"
  | "report.schedule.resume"
  | "report.schedule.run"
  | "settings.appearance"
  | "settings.hierarchyValidation"
  | "notification.create"
  | "notification.read"
  | "notification.unread"
  | "notification.readAll"
  | "notification.dismiss"
  | "notification.restore"
  | "notification.escalate"
  | "notification.resolve";

export interface WorkflowCommand {
  action: WorkflowAction;
  entityId?: string;
  values?: Record<string, unknown>;
  actor?: string;
}
export interface WorkflowResult {
  ok: boolean;
  message: string;
  entityId?: string;
}
export interface InventoryRepository {
  subscribe(listener: () => void): () => void;
  snapshot(): MockSnapshot;
  execute(command: WorkflowCommand): Promise<WorkflowResult>;
  queryAssets(query: ListQuery): Promise<ListResult<Asset>>;
  assetFacets(): Promise<Record<string, string[]>>;
  queryInventory(query: ListQuery): Promise<ListResult<InventoryItem>>;
  inventoryFacets(): Promise<Record<string, string[]>>;
  queryAssetHistory(
    assetId: string,
    maximum?: number,
  ): Promise<AssetHistoryEvent[]>;
  reset(): void;
}
