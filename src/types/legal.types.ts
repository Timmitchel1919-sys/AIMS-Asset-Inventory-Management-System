export type LegalDocumentType='terms'|'privacy';
export type LegalDocumentStatus='draft'|'pending_approval'|'approved'|'published'|'archived';
export interface LegalSection{id:string;number:string;title:string;paragraphs?:string[];bulletPoints?:string[];subsections?:LegalSection[];table?:{headers:string[];rows:string[][]}}
export interface LegalDocument{id:string;type:LegalDocumentType;title:string;version:string;effectiveDate:string;lastUpdated:string;status:LegalDocumentStatus;content:LegalSection[];changeSummary?:string;createdAt:unknown;createdBy:string;updatedAt:unknown;updatedBy:string;approvedAt?:unknown;approvedBy?:string;publishedAt?:unknown;publishedBy?:string;archivedAt?:unknown;archivedBy?:string;materialChange?:boolean}
export interface LegalContact{organizationName:string;systemName:string;addressLines:string[];telephone:string;generalEmail:string;privacyEmail:string;website:string;facebook:string;aiProvider:string;copyright:string;developerCredit:string}
export interface PolicyAcknowledgement{id:string;userId:string;documentType:LegalDocumentType;documentVersion:string;acknowledgedAt:unknown;acknowledgementMethod:'login_modal'|'settings'|'manual_admin_record';userAgent?:string}
export interface LegalPolicyMetadata{termsVersion:string;privacyVersion:string;effectiveDate:string;lastUpdated:string}
