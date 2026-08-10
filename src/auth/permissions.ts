import type {Role} from '../domain/types';

export type Permission =
  | 'dashboard.view' | 'assets.view' | 'assets.create' | 'assets.edit' | 'assets.archive'
  | 'inventory.view' | 'inventory.manage' | 'inventory.create'|'inventory.edit'|'inventory.receive'|'inventory.issue'|'inventory.transfer'|'inventory.return'|'inventory.reserve'|'inventory.reservations.approve'|'inventory.correct'|'inventory.financial.view'|'inventory.export'|'inventory.archive'|'inventory.restore'|'inventory.movements.view' | 'categories.manage' | 'locations.manage'|'departments.manage'
  | 'assignments.manage'|'assignments.view'|'assignments.create'|'assignments.edit'|'assignments.approve'|'assignments.return'|'assignments.reassign'|'assignments.export'|'assignments.print'|'assignments.history'
  | 'borrow.manage'|'borrows.view'|'borrows.create'|'borrows.edit'|'borrows.approve'|'borrows.reject'|'borrows.issue'|'borrows.partialReturn'|'borrows.return'|'borrows.overdue'|'borrows.export'|'borrows.print'|'borrows.history'
  | 'repairs.manage'|'repairs.view'|'repairs.create'|'repairs.edit'|'repairs.diagnose'|'repairs.approve'|'repairs.parts'|'repairs.perform'|'repairs.test'|'repairs.complete'|'repairs.unrepairable'|'repairs.return'|'repairs.export'|'repairs.print'|'repairs.history'|'repairs.costs'
  | 'maintenance.manage'|'maintenance.view'|'maintenance.create'|'maintenance.edit'|'maintenance.assign'|'maintenance.start'|'maintenance.complete'|'maintenance.skip'|'maintenance.reschedule'|'maintenance.cancel'|'maintenance.export'|'maintenance.print'|'maintenance.history'
  | 'movements.manage'|'movements.view'|'movements.create'|'movements.approve'|'movements.complete'|'movements.correct'|'movements.export'|'movements.print'|'movements.sensitive.view'
  | 'audits.view'|'audits.perform'|'audits.create'|'audits.edit'|'audits.generate'|'audits.freeze'|'audits.prepare'|'audits.start'|'audits.scan'|'audits.evidence'|'audits.pause'|'audits.review'|'audits.amend'|'audits.complete'|'audits.close'|'audits.cancel'|'audits.reopen'|'audits.export'|'audits.print'|'audits.history'
  | 'discrepancies.view'|'discrepancies.create'|'discrepancies.assign'|'discrepancies.review'|'discrepancies.reclassify'|'discrepancies.resolve'|'discrepancies.escalate'|'discrepancies.close'
  | 'corrective.view'|'corrective.create'|'corrective.assign'|'corrective.perform'|'corrective.approve'|'corrective.reject'|'corrective.verify'|'corrective.reopen'
  | 'auditAdjustments.assets'|'auditAdjustments.stock'|'auditAdjustments.approve'|'auditAdjustments.repair'|'auditAdjustments.maintenance'|'auditAdjustments.loss'|'auditAdjustments.disposal'
  | 'reports.view'|'reports.generate'|'reports.custom.create'|'reports.private.save'|'reports.shared.publish'|'reports.csv'|'reports.excel'|'reports.print'|'reports.financial'|'reports.personal'|'reports.schedule'|'reports.history'
  | 'notifications.view'|'notifications.role.view'|'notifications.preferences'|'notifications.defaults'|'notifications.history'|'notifications.escalate'|'notifications.resolve'
  | 'management.view'|'management.assets'|'management.inventory'|'management.service'|'management.audits'|'management.lifecycle'|'management.risks'|'management.export'|'management.financial'
  | 'assistant.use' | 'users.manage' | 'roles.manage'
  | 'activity.view' | 'disposals.view' | 'disposals.request' | 'disposals.approve'
  | 'settings.manage'|'locationTypes.manage'|'legal.read'|'legal.manage'|'legal.approve'|'legal.publish'|'legal.audit'
  | 'admin.access'|'admin.users.manage'|'admin.roles.manage'|'admin.audit.read'|'admin.legal.manage'|'admin.system.configure';

const all: Permission[] = [
  'dashboard.view','assets.view','assets.create','assets.edit','assets.archive','inventory.view',
  'inventory.manage','inventory.create','inventory.edit','inventory.receive','inventory.issue','inventory.transfer','inventory.return','inventory.reserve','inventory.reservations.approve','inventory.correct','inventory.financial.view','inventory.export','inventory.archive','inventory.restore','inventory.movements.view','categories.manage','locations.manage','departments.manage','assignments.manage','assignments.view','assignments.create','assignments.edit','assignments.approve','assignments.return','assignments.reassign','assignments.export','assignments.print','assignments.history','borrow.manage','borrows.view','borrows.create','borrows.edit','borrows.approve','borrows.reject','borrows.issue','borrows.partialReturn','borrows.return','borrows.overdue','borrows.export','borrows.print','borrows.history',
  'repairs.manage','repairs.view','repairs.create','repairs.edit','repairs.diagnose','repairs.approve','repairs.parts','repairs.perform','repairs.test','repairs.complete','repairs.unrepairable','repairs.return','repairs.export','repairs.print','repairs.history','repairs.costs',
  'maintenance.manage','maintenance.view','maintenance.create','maintenance.edit','maintenance.assign','maintenance.start','maintenance.complete','maintenance.skip','maintenance.reschedule','maintenance.cancel','maintenance.export','maintenance.print','maintenance.history',
  'movements.manage','movements.view','movements.create','movements.approve','movements.complete','movements.correct','movements.export','movements.print','movements.sensitive.view',
  'audits.view','audits.perform','audits.create','audits.edit','audits.generate','audits.freeze','audits.prepare','audits.start','audits.scan','audits.evidence','audits.pause','audits.review','audits.amend','audits.complete','audits.close','audits.cancel','audits.reopen','audits.export','audits.print','audits.history',
  'discrepancies.view','discrepancies.create','discrepancies.assign','discrepancies.review','discrepancies.reclassify','discrepancies.resolve','discrepancies.escalate','discrepancies.close','corrective.view','corrective.create','corrective.assign','corrective.perform','corrective.approve','corrective.reject','corrective.verify','corrective.reopen','auditAdjustments.assets','auditAdjustments.stock','auditAdjustments.approve','auditAdjustments.repair','auditAdjustments.maintenance','auditAdjustments.loss','auditAdjustments.disposal',
  'reports.view','reports.generate','reports.custom.create','reports.private.save','reports.shared.publish','reports.csv','reports.excel','reports.print','reports.financial','reports.personal','reports.schedule','reports.history',
  'notifications.view','notifications.role.view','notifications.preferences','notifications.defaults','notifications.history','notifications.escalate','notifications.resolve',
  'management.view','management.assets','management.inventory','management.service','management.audits','management.lifecycle','management.risks','management.export','management.financial',
  'assistant.use','users.manage','roles.manage','activity.view',
  'disposals.view','disposals.request','disposals.approve','settings.manage','locationTypes.manage','legal.read','legal.manage','legal.approve','legal.publish','legal.audit',
  'admin.access','admin.users.manage','admin.roles.manage','admin.audit.read','admin.legal.manage','admin.system.configure'
];

export const rolePermissions: Record<Role, Permission[]> = {
  administrator: all,
  'ict-manager': all.filter(p => !['users.manage','roles.manage','locationTypes.manage'].includes(p)&&!p.startsWith('admin.')),
  'warehouse-manager': all.filter(p=>!['users.manage','roles.manage','settings.manage'].includes(p)&&!p.startsWith('admin.')),
  'ict-staff': ['dashboard.view','assets.view','assets.create','assets.edit','assignments.manage','borrow.manage','repairs.manage','maintenance.manage','movements.manage','audits.view','audits.perform','notifications.view','assistant.use','disposals.view','disposals.request'],
  'warehouse-staff': ['dashboard.view','assets.view','inventory.view','inventory.manage','inventory.create','inventory.edit','inventory.receive','inventory.issue','inventory.transfer','inventory.return','inventory.reserve','inventory.export','inventory.movements.view','assignments.manage','borrow.manage','movements.manage','audits.view','audits.perform','notifications.view','disposals.view','disposals.request'],
  management: ['dashboard.view','assets.view','inventory.view','audits.view','reports.view','notifications.view','disposals.view','disposals.approve'],
  auditor: ['dashboard.view','assets.view','inventory.view','audits.view','reports.view','activity.view','disposals.view']
};

export const can = (role: Role | undefined, permission?: Permission) =>
  !permission || !!role && rolePermissions[role].includes(permission);
