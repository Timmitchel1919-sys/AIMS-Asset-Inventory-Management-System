export type ThemeId = "aimsAzureGlass" | "aimsMidnight" | "aimsEmeraldGloss" | "aimsLight";
export type Role =
  | "administrator"
  | "ict-manager"
  | "warehouse-manager"
  | "ict-staff"
  | "warehouse-staff"
  | "management"
  | "auditor";
export type AssetStatus =
  | "Available"
  | "Assigned"
  | "Borrowed"
  | "Under Repair"
  | "Under Maintenance"
  | "Reserved"
  | "Lost"
  | "Missing"
  | "Damaged"
  | "Disposed"
  | "Archived";
export type Condition =
  | "New"
  | "Excellent"
  | "Good"
  | "Fair"
  | "Poor"
  | "Defective"
  | "Beyond Repair";
export interface User {
  id: string;
  name: string;
  email: string;
  accountType?: "school-user" | "demo-user";
  authProvider?: "password" | "google" | "anonymous";
  isDemoUser?: boolean;
  role: Role;
  department: string;
  jobTitle?: string;
  accountCreatedAt?: string;
  initials: string;
  status?: "Active" | "Disabled";
  profilePhoto?: string;
}
export interface Asset {
  id: string;
  code: string;
  codePrefix: string;
  codeNumber: number;
  previousCodes?: string[];
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  type: string;
  brand: string;
  model: string;
  serialNumber: string;
  barcode?: string;
  location: string;
  currentLocationId?: string;
  homeLocationId?: string;
  mainLocationId?: string;
  lastMovementAt?: string;
  department: string;
  assignedTo?: string;
  responsibleEmployee?: string;
  supplier?: string;
  manufacturer?: string;
  status: AssetStatus;
  condition: Condition;
  purchaseDate: string;
  purchasePrice?: number;
  warrantyStart?: string;
  warrantyExpiry: string;
  dateAdded?: string;
  createdBy?: string;
  lastUpdated: string;
  lastModifiedBy?: string;
  maintenanceRequired?: boolean;
  usefulLifeEnd?: string;
  technicalSpecifications?: Record<string, string>;
  remoteAccess?: {
    anydeskId?: string;
    teamviewerId?: string;
  };
  attachments?: string[];
  photos?: string[];
  notes?: string;
  sourceData?: Record<string, string>;
  importMetadata?: {
    source: string;
    sourceType: "legacy_inventory";
    importedAt: string;
    importedBy: string;
    sourceRecordCode: string;
    migrationVersion: string;
  };
  qr: boolean;
}
export interface Movement {
  id: string;
  reference: string;
  type: string;
  asset: string;
  assetCode: string;
  from: string;
  to: string;
  by: string;
  date: string;
  quantity: number;
  reason?: string;
  approvedBy?: string;
  notes?: string;
  attachments?: string[];
  unit?: string;
  assetId?: string;
  itemId?: string;
  locationId?: string;
  sourceLocationId?: string;
  destinationLocationId?: string;
  sourceDepartment?: string;
  destinationDepartment?: string;
  sourceResponsible?: string;
  destinationResponsible?: string;
  relatedEmployee?: string;
  relatedDepartment?: string;
  relatedType?: string;
  relatedId?: string;
  previousSourceQuantity?: number;
  newSourceQuantity?: number;
  previousDestinationQuantity?: number;
  newDestinationQuantity?: number;
  immutable?: boolean;
  correctsMovementId?: string;
  correctionType?: string;
  createdBy?: string;
}
export interface BorrowRecord {
  id: string;
  reference: string;
  asset: string;
  assetCode: string;
  assetId?: string;
  locationId?: string;
  borrower: string;
  borrowerType?: string;
  contact?: string;
  department: string;
  reason?: string;
  requestedDate?: string;
  borrowDate: string;
  dueDate: string;
  actualReturnDate?: string;
  intendedLocation?: string;
  status:
    | "Draft"
    | "Pending Approval"
    | "Approved"
    | "Rejected"
    | "Issued"
    | "Partially Returned"
    | "Returned"
    | "Overdue"
    | "Cancelled";
  approvalStatus?: string;
  approvedBy?: string;
  approvalDate?: string;
  rejectionReason?: string;
  approvalNotes?: string;
  issuedBy?: string;
  issueDate?: string;
  condition: string;
  returnCondition?: string;
  accessoriesRequested?: string[];
  accessoriesIssued?: string[];
  accessoriesReturned?: string[];
  missingAccessories?: string[];
  damageFound?: boolean;
  receivedBy?: string;
  finalOutcome?: string;
  borrowerSignature?: string;
  staffSignature?: string;
  notes?: string;
  attachments?: string[];
  history?: import("../data/contracts").WorkflowHistoryEvent[];
  createdBy?: string;
  createdAt?: string;
  modifiedBy?: string;
  lastUpdated?: string;
  reminderAt?: string;
  escalationLevel?: number;
  followUpOwner?: string;
}
export type RepairStatus =
  | "Reported"
  | "Diagnosing"
  | "Awaiting Approval"
  | "Approved"
  | "Rejected"
  | "Waiting for Parts"
  | "In Repair"
  | "External Repair"
  | "Testing"
  | "Completed"
  | "Returned to User"
  | "Unrepairable"
  | "Cancelled";
export interface Repair {
  id: string;
  reference: string;
  asset: string;
  assetCode: string;
  assetId?: string;
  assetName?: string;
  serialNumber?: string;
  category?: string;
  issue: string;
  problemTitle?: string;
  reportedBy?: string;
  reportedAt?: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  technician: string;
  status: RepairStatus;
  received: string;
  due: string;
  diagnosis?: string;
  rootCause?: string;
  diagnosticDate?: string;
  diagnosticChecklist?: string[];
  recommendedAction?: string;
  estimatedDuration?: string;
  estimatedParts?: string[];
  estimatedCost?: number;
  warrantyRepair?: boolean;
  safetyRisk?: boolean;
  repairFeasible?: boolean;
  approvalRequired?: boolean;
  approvalStatus?: string;
  approvedBy?: string;
  approvalDate?: string;
  rejectionReason?: string;
  approvalNotes?: string;
  approvedCostLimit?: number;
  externalCompany?: string;
  externalReference?: string;
  repairStartedAt?: string;
  workPerformed?: string;
  parts?: string;
  partsRecords?: Array<Record<string, unknown>>;
  actualCost?: number;
  testedAt?: string;
  testedBy?: string;
  testChecklist?: string[];
  testResult?: string;
  remainingIssues?: string;
  outcome?: string;
  finalAssetStatus?: AssetStatus;
  finalAssetCondition?: Condition;
  returnLocation?: string;
  returnedTo?: string;
  completedBy?: string;
  completedAt?: string;
  notes?: string;
  attachments?: string[];
  beforePhotos?: string[];
  afterPhotos?: string[];
  history?: import("../data/contracts").WorkflowHistoryEvent[];
  createdBy?: string;
  createdAt?: string;
  modifiedBy?: string;
  lastUpdated?: string;
  previousAssetStatus?: AssetStatus;
  previousAssetCondition?: Condition;
}
export type MaintenanceStatus =
  | "Draft"
  | "Scheduled"
  | "Due"
  | "Overdue"
  | "In Progress"
  | "Paused"
  | "Completed"
  | "Skipped"
  | "Cancelled";
export interface Maintenance {
  id: string;
  reference?: string;
  scheduleId?: string;
  asset: string;
  assetCode: string;
  assetId?: string;
  category?: string;
  location?: string;
  locationId?: string;
  department?: string;
  type: string;
  frequency: string;
  interval?: number;
  startDate?: string;
  nextDate: string;
  assignee: string;
  priority?: string;
  status: MaintenanceStatus;
  checklist?: string[];
  completedItems?: string[];
  notes?: string;
  attachments?: string[];
  customDays?: number;
  lastCompletedAt?: string;
  workSummary?: string;
  partsUsed?: string[];
  conditionAfter?: Condition;
  statusAfter?: AssetStatus;
  issuesFound?: string;
  followUpAction?: string;
  reminderAt?: string;
  escalationLevel?: number;
  history?: import("../data/contracts").WorkflowHistoryEvent[];
  createdBy?: string;
  createdAt?: string;
  lastUpdated?: string;
  active?: boolean;
}
export type AuditStatus =
  | "Draft"
  | "Scheduled"
  | "Sample Generated"
  | "Prepared"
  | "In Progress"
  | "Paused"
  | "Review Required"
  | "Corrective Actions Required"
  | "Completed"
  | "Closed"
  | "Cancelled"
  | "Overdue";
export interface AuditItem {
  id: string;
  recordId: string;
  recordType: "asset" | "inventory";
  code: string;
  name: string;
  category: string;
  location: string;
  department: string;
  expectedStatus: string;
  expectedCondition?: string;
  expectedQuantity?: number;
  result?: string;
  observedLocation?: string;
  observedDepartment?: string;
  observedStatus?: string;
  observedCondition?: string;
  countedQuantity?: number;
  variance?: number;
  auditor?: string;
  verifiedAt?: string;
  notes?: string;
  evidence?: string[];
  deferred?: boolean;
  inaccessible?: boolean;
  history?: import("../data/contracts").WorkflowHistoryEvent[];
}
export interface Audit {
  id: string;
  reference: string;
  name: string;
  description?: string;
  auditType?: string;
  scope: string;
  assignee: string;
  assignedAuditors?: string[];
  reviewer?: string;
  approver?: string;
  responsibleDepartment?: string;
  scheduledStart?: string;
  deadline: string;
  actualStart?: string;
  completedAt?: string;
  closedAt?: string;
  frequency?: string;
  progress: number;
  verified: number;
  discrepancies: number;
  status: AuditStatus;
  selectionMode?: string;
  sampleMethod?: "Fixed count" | "Percentage" | "Full audit";
  sampleValue?: number;
  randomSeed?: string;
  strategyVersion?: string;
  sampleFrozen?: boolean;
  generatedBy?: string;
  generatedAt?: string;
  frozenItemIds?: string[];
  sampleItems?: AuditItem[];
  results?: Record<string, string>;
  correctiveActions?: string[];
  history?: import("../data/contracts").WorkflowHistoryEvent[];
  createdBy?: string;
  createdAt?: string;
  lastUpdated?: string;
  offlineQueue?: AuditItem[];
}
export interface AuditDiscrepancy {
  id: string;
  reference: string;
  auditId: string;
  auditItemId: string;
  recordId: string;
  recordName: string;
  type: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  expectedValue: string;
  observedValue: string;
  variance?: number;
  detectedBy: string;
  detectedAt: string;
  evidence: string[];
  notes?: string;
  department?: string;
  assignedTo?: string;
  dueDate?: string;
  status:
    | "Open"
    | "Under Review"
    | "Assigned"
    | "Recount Required"
    | "Reinspection Required"
    | "Action Required"
    | "Pending Approval"
    | "Resolved"
    | "Closed"
    | "Escalated"
    | "Rejected";
  rootCause?: string;
  resolution?: string;
  history: import("../data/contracts").WorkflowHistoryEvent[];
}
export interface CorrectiveAction {
  id: string;
  reference: string;
  auditId: string;
  discrepancyId: string;
  type: string;
  description: string;
  owner: string;
  dueDate: string;
  priority: string;
  approvalRequired: boolean;
  approvalStatus?: string;
  status:
    | "Draft"
    | "Assigned"
    | "In Progress"
    | "Pending Approval"
    | "Approved"
    | "Rejected"
    | "Completed"
    | "Verified"
    | "Closed"
    | "Cancelled"
    | "Overdue";
  result?: string;
  verifiedBy?: string;
  history: import("../data/contracts").WorkflowHistoryEvent[];
}
export interface Notification {
  id: string;
  title: string;
  message: string;
  category: "warning" | "danger" | "info" | "success";
  time: string;
  read: boolean;
  type?: string;
  sourceEventId?: string;
  recipient?: string;
  recipientRole?: Role;
  relatedType?: string;
  relatedId?: string;
  severity?: "Informational" | "Low" | "Medium" | "High" | "Critical";
  createdAt?: string;
  expiresAt?: string;
  dismissed?: boolean;
  acknowledgedAt?: string;
  escalationLevel?: number;
  actions?: string[];
}
