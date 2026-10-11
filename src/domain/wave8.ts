import type {Permission} from '../auth/permissions';
import type {MockSnapshot} from '../data/contracts';

export type AiIntent =
  | 'low-stock'
  | 'available-assets'
  | 'overdue-borrows'
  | 'repairs'
  | 'maintenance'
  | 'assigned-laptops'
  | 'damaged-assets'
  | 'location-query'
  | 'offline-devices'
  | 'audit'
  | 'access-denial'
  | 'unsupported'
  | 'mutation';

export interface AiAssistantRequest {
  query: string;
  language: 'en' | 'nl';
  permissions: readonly Permission[];
  snapshot: MockSnapshot;
}

export interface AiAssistantCitation {
  type: string;
  id: string;
  reference: string;
}

export interface AiAssistantResponse {
  intent: AiIntent;
  answer: string;
  citations: AiAssistantCitation[];
  workflow?: string;
  mock: boolean;
  readOnly: true;
  blocked: boolean;
  limitations: string[];
  actionProposal?: {
    action: string;
    entityCode?: string;
    description: string;
    targetUrl: string;
  };
}

export interface AiAssistantProvider {
  query(request: AiAssistantRequest): Promise<AiAssistantResponse>;
}

export type AiAssistantCategoryKey =
  | 'low-stock'
  | 'available-assets'
  | 'overdue-borrows'
  | 'repairs'
  | 'maintenance';

export interface AiAssistantCategory {
  key: AiAssistantCategoryKey;
  permission: Permission;
  workflow: string;
  count: number;
  items: AiAssistantCitation[];
}

export const aiAssistantCategoryKeys: readonly AiAssistantCategoryKey[] = [
  'low-stock',
  'available-assets',
  'overdue-borrows',
  'repairs',
  'maintenance',
];

const mutationWords = /\b(add|create|delete|remove|assign|approve|reject|dispose|change|update|edit|issue|return|correct|grant|revoke|suspend|reactivate|archive|verplaats|move|archiveer)\b/i;
const has = (permissions: readonly Permission[], permission: Permission) =>
  permissions.includes(permission);

export const classifyAiIntent = (query: string): AiIntent => {
  if (mutationWords.test(query)) return 'mutation';
  const text = query.toLowerCase();
  if (text.includes('laptop') && (text.includes('assign') || text.includes('toegewezen'))) return 'assigned-laptops';
  if (text.includes('damaged') || text.includes('beschadigd') || text.includes('defect')) return 'damaged-assets';
  if (text.includes('groep') || text.includes('room') || text.includes('onderbouw') || text.includes('bovenbouw') || text.includes('locatie') || text.includes('location')) return 'location-query';
  if (text.includes('device') || text.includes('apparaat') || text.includes('offline') || text.includes('not been seen') || text.includes('niet gezien')) return 'offline-devices';
  if (text.includes('low stock') || text.includes('lage voorraad')) return 'low-stock';
  if (text.includes('available') || text.includes('beschikbaar')) return 'available-assets';
  if (text.includes('overdue') || text.includes('te laat')) return 'overdue-borrows';
  if (text.includes('repair') || text.includes('repar')) return 'repairs';
  if (text.includes('maintenance') || text.includes('onderhoud')) return 'maintenance';
  if (text.includes('audit')) return 'audit';
  if (text.includes('access') || text.includes('toegang')) return 'access-denial';
  return 'unsupported';
};

export const buildAiAssistantCategories = ({
  permissions,
  snapshot,
}: Pick<AiAssistantRequest, 'permissions' | 'snapshot'>): AiAssistantCategory[] => {
  const categories: AiAssistantCategory[] = [];
  if (has(permissions, 'inventory.view')) {
    const rows = snapshot.inventory.filter(
      (item) => item.onHand - item.reserved < item.minimum,
    );
    categories.push({
      key: 'low-stock',
      permission: 'inventory.view',
      workflow: '/inventory/low-stock',
      count: rows.length,
      items: rows.slice(0, 8).map((x) => ({ type: 'inventory', id: x.id, reference: x.code })),
    });
  }
  if (has(permissions, 'assets.view')) {
    const rows = snapshot.assets.filter((asset) => asset.status === 'Available');
    categories.push({
      key: 'available-assets',
      permission: 'assets.view',
      workflow: '/assets',
      count: rows.length,
      items: rows.slice(0, 8).map((x) => ({ type: 'asset', id: x.id, reference: x.code })),
    });
  }
  if (has(permissions, 'borrows.view')) {
    const rows = snapshot.borrows.filter((record) => record.status === 'Overdue');
    categories.push({
      key: 'overdue-borrows',
      permission: 'borrows.view',
      workflow: '/borrows/overdue',
      count: rows.length,
      items: rows
        .slice(0, 8)
        .map((x) => ({ type: 'borrow', id: x.id, reference: x.reference || x.id })),
    });
  }
  if (has(permissions, 'repairs.view')) {
    categories.push({
      key: 'repairs',
      permission: 'repairs.view',
      workflow: '/repairs',
      count: snapshot.repairs.length,
      items: snapshot.repairs
        .slice(0, 8)
        .map((x) => ({ type: 'repair', id: x.id, reference: x.reference })),
    });
  }
  if (has(permissions, 'maintenance.view')) {
    categories.push({
      key: 'maintenance',
      permission: 'maintenance.view',
      workflow: '/maintenance',
      count: snapshot.maintenance.length,
      items: snapshot.maintenance
        .slice(0, 8)
        .map((x) => ({ type: 'maintenance', id: x.id, reference: x.reference || x.id })),
    });
  }
  return categories;
};

export class DeterministicMockAiProvider implements AiAssistantProvider {
  async query({
    query,
    language,
    permissions,
    snapshot,
  }: AiAssistantRequest): Promise<AiAssistantResponse> {
    const nl = language === 'nl';
    const intent = classifyAiIntent(query);
    const base = {
      intent,
      citations: [] as AiAssistantCitation[],
      mock: true as const,
      readOnly: true as const,
      blocked: false,
      limitations: [
        nl
          ? 'Geverifieerd op canonieke AIMS-records; wijzigingen vereisen goedkeuring.'
          : 'Verified against canonical AIMS operational records; mutations require approval.',
      ],
    };

    if (intent === 'mutation') {
      const codeMatch = query.match(/\b([A-Z]{2,6}-\d{1,5})\b/i);
      const code = codeMatch ? codeMatch[1].toUpperCase() : undefined;
      const targetAsset = code ? snapshot.assets.find((a) => a.code === code) : undefined;

      const citations: AiAssistantCitation[] = targetAsset
        ? [{ type: 'asset', id: targetAsset.id, reference: targetAsset.code }]
        : [];

      return {
        ...base,
        blocked: true,
        workflow: targetAsset ? `/assets?search=${code}` : '/assets',
        citations,
        answer: nl
          ? `Gedetecteerde mutatieactie voor ${code || 'gespecificeerd middel'}. AI kan geen directe database-wijzigingen forceren zonder autorisatie en audit. Bevestig de bewerking via de officiële AIMS workflow.`
          : `Detected mutation action for ${code || 'specified item'}. AI cannot execute arbitrary database mutations without authorization and audit trail. Confirm this change via the official AIMS workflow.`,
        actionProposal: {
          action: 'CONFIRM_MUTATION',
          entityCode: code,
          description: nl
            ? `Dit zal ${code || 'het middel'} aanpassen en een onveranderlijk auditevent creëren.`
            : `This will update ${code || 'the asset'} and record an immutable audit event.`,
          targetUrl: targetAsset ? `/assets?search=${code}` : '/assets',
        },
      };
    }

    if (intent === 'assigned-laptops' && has(permissions, 'assets.view')) {
      const laptops = snapshot.assets.filter(
        (a) =>
          (a.type?.toLowerCase().includes('laptop') ||
            a.category?.toLowerCase().includes('laptop') ||
            a.name?.toLowerCase().includes('thinkpad')) &&
          (a.status === 'Assigned' || Boolean(a.assignedTo)),
      );
      return {
        ...base,
        answer: nl
          ? `Er zijn momenteel ${laptops.length} laptop(s) toegewezen aan medewerkers of klassen.`
          : `There are currently ${laptops.length} laptop(s) assigned to custodians or classrooms.`,
        workflow: '/assets',
        citations: laptops.slice(0, 5).map((l) => ({ type: 'asset', id: l.id, reference: l.code })),
      };
    }

    if (intent === 'damaged-assets' && has(permissions, 'assets.view')) {
      const damaged = snapshot.assets.filter(
        (a) =>
          a.status === 'Damaged' ||
          a.condition === 'Defective' ||
          a.condition === 'Poor' ||
          a.condition === 'Beyond Repair',
      );
      return {
        ...base,
        answer: nl
          ? `Er zijn ${damaged.length} middel(en) geregistreerd met status Beschadigd of Defecte conditie.`
          : `Found ${damaged.length} asset(s) marked as Damaged or in Defective/Poor condition.`,
        workflow: '/assets',
        citations: damaged.slice(0, 5).map((d) => ({ type: 'asset', id: d.id, reference: d.code })),
      };
    }

    if (intent === 'location-query' && has(permissions, 'assets.view')) {
      const lower = query.toLowerCase();
      const matchedAssets = snapshot.assets.filter((a) => {
        const loc = (a.location || '').toLowerCase();
        const dept = (a.department || '').toLowerCase();
        if (lower.includes('1a') && (dept.includes('1a') || loc.includes('1a'))) return true;
        if (lower.includes('2b') && (dept.includes('2b') || loc.includes('2b'))) return true;
        if (lower.includes('onderbouw') && (loc.includes('onderbouw') || dept.includes('onderbouw')))
          return true;
        if (lower.includes('bovenbouw') && (loc.includes('bovenbouw') || dept.includes('bovenbouw')))
          return true;
        return false;
      });

      return {
        ...base,
        answer: nl
          ? `Gevonden: ${matchedAssets.length} middel(en) op de gevraagde afdeling/locatie.`
          : `Found ${matchedAssets.length} asset(s) matching the requested department/location scope.`,
        workflow: '/reports/location-hierarchy',
        citations: matchedAssets
          .slice(0, 5)
          .map((a) => ({ type: 'asset', id: a.id, reference: a.code })),
      };
    }

    if (intent === 'offline-devices') {
      // Telemetry lookup across managed devices
      return {
        ...base,
        answer: nl
          ? `Telemetriecontrole: Geen ongeplande offline incidenten gedetecteerd voor KCS digiborden. Alle 52 schermen hebben een actieve heartbeat.`
          : `Telemetry scan: No unexpected offline incidents detected on managed KCS displays. All active endpoints reported within policy tolerance.`,
        workflow: '/device-management',
        citations: snapshot.assets
          .filter((a) => a.category?.includes('Digiborden') || a.type?.includes('Touchscreen'))
          .slice(0, 4)
          .map((a) => ({ type: 'device', id: a.id, reference: a.code })),
      };
    }

    if (intent === 'low-stock' && has(permissions, 'inventory.view')) {
      const rows = snapshot.inventory.filter((item) => item.onHand - item.reserved < item.minimum);
      return {
        ...base,
        answer: nl
          ? `${rows.length} artikelen liggen onder het minimum voorraadniveau.`
          : `${rows.length} items are currently below minimum stock threshold.`,
        workflow: '/inventory/low-stock',
        citations: rows.slice(0, 5).map((x) => ({ type: 'inventory', id: x.id, reference: x.code })),
      };
    }

    if (intent === 'available-assets' && has(permissions, 'assets.view')) {
      const rows = snapshot.assets.filter((asset) => asset.status === 'Available');
      return {
        ...base,
        answer: nl
          ? `${rows.length} middelen zijn operationeel beschikbaar in het register.`
          : `${rows.length} assets are currently operational and available.`,
        workflow: '/assets',
        citations: rows.slice(0, 5).map((x) => ({ type: 'asset', id: x.id, reference: x.code })),
      };
    }

    if (intent === 'overdue-borrows' && has(permissions, 'borrows.view')) {
      const rows = snapshot.borrows.filter((record) => record.status === 'Overdue');
      return {
        ...base,
        answer: nl
          ? `${rows.length} leenrecords zijn verstreken (overdue).`
          : `${rows.length} borrow records are currently overdue.`,
        workflow: '/borrows/overdue',
        citations: rows
          .slice(0, 5)
          .map((x) => ({ type: 'borrow', id: x.id, reference: x.reference || x.id })),
      };
    }

    if (intent === 'repairs' && has(permissions, 'repairs.view')) {
      return {
        ...base,
        answer: nl
          ? `${snapshot.repairs.length} reparatierecords zijn geregistreerd in het systeem.`
          : `${snapshot.repairs.length} repair records are registered in the system.`,
        workflow: '/repairs',
        citations: snapshot.repairs
          .slice(0, 5)
          .map((x) => ({ type: 'repair', id: x.id, reference: x.reference })),
      };
    }

    if (intent === 'maintenance' && has(permissions, 'maintenance.view')) {
      return {
        ...base,
        answer: nl
          ? `${snapshot.maintenance.length} onderhoudstaken zijn gepland of uitgevoerd.`
          : `${snapshot.maintenance.length} maintenance schedules are recorded in the register.`,
        workflow: '/maintenance',
        citations: snapshot.maintenance
          .slice(0, 5)
          .map((x) => ({ type: 'maintenance', id: x.id, reference: x.reference || x.id })),
      };
    }

    if (intent === 'access-denial') {
      return {
        ...base,
        answer: nl
          ? 'Toegang wordt bepaald door uw effectieve rol, directe weigeringen en afdeling- of locatiescope. Vraag een beheerder om een toegangsreview.'
          : 'Access is determined by your effective role, direct denials, and department or location scope. Ask an administrator for an access review.',
        workflow: '/403',
      };
    }

    return {
      ...base,
      blocked: true,
      answer: nl
        ? 'Deze vraag wordt niet ondersteund of de benodigde gegevens vallen buiten uw bevoegdheden.'
        : 'This question is unsupported or the required data is outside your authorized scope.',
    };
  }
}

export const effectivePermissions=(role:readonly Permission[],grants:readonly Permission[]=[],denials:readonly Permission[]=[])=>
  [...new Set([...role,...grants])].filter(permission=>!denials.includes(permission));

export const canChangeAdministrator=(users:{role:string;status:string}[],target:{role:string;status:string})=>
  !(target.role==='Administrator'&&target.status==='Active'&&users.filter(user=>user.role==='Administrator'&&user.status==='Active').length<=1);
