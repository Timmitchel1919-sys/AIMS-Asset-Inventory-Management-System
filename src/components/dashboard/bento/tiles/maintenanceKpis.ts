import type { Maintenance } from "../../../../domain/types";

const TERMINAL = new Set<string>(["Completed", "Cancelled", "Skipped"]);
const OVERDUE_STATUS = new Set<string>(["Overdue"]);
const IN_PROGRESS_STATUS = new Set<string>(["In Progress"]);

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export interface MaintenanceKpis {
  open: number;
  dueSoon: number;
  overdue: number;
  inProgress: number;
  schedule: { date: string; count: number }[]; // next 7 days
  invalidDates: number;
}

/**
 * KPI math per the Phase 2C spec (§5.2):
 *  - Open     = not Completed/Cancelled/Skipped
 *  - Due soon = open AND nextDate within [today, today+7)
 *  - Overdue  = open AND (status === "Overdue" OR nextDate < today)
 *               — counted at most once per record
 *  - Schedule = count of open tasks with a valid nextDate per day for the next 7
 *               days; overdue tasks are NOT folded into the 7-day distribution
 *               (per §5.4)
 */
export function computeMaintenanceKpis(
  maintenance: Maintenance[],
  now: Date,
): MaintenanceKpis {
  const today = startOfDay(now);
  const horizon = addDays(today, 7);

  let open = 0;
  let dueSoon = 0;
  let overdue = 0;
  let inProgress = 0;
  let invalidDates = 0;
  const schedule: { date: string; count: number }[] = [];
  for (let i = 0; i < 7; i += 1) {
    schedule.push({ date: addDays(today, i).toISOString().slice(0, 10), count: 0 });
  }
  const dayIndex = new Map(schedule.map((s, i) => [s.date, i]));

  for (const m of maintenance) {
    if (TERMINAL.has(m.status)) continue;
    open += 1;
    if (IN_PROGRESS_STATUS.has(m.status)) inProgress += 1;
    const next = parseDate(m.nextDate);
    const isOverdueStatus = OVERDUE_STATUS.has(m.status);
    const isOverdueByDate = next !== null && next.getTime() < today.getTime();
    if (isOverdueStatus || isOverdueByDate) {
      overdue += 1;
    } else if (next === null) {
      invalidDates += 1;
    } else if (
      next.getTime() >= today.getTime() &&
      next.getTime() < horizon.getTime()
    ) {
      dueSoon += 1;
      const dayKey = startOfDay(next).toISOString().slice(0, 10);
      const idx = dayIndex.get(dayKey);
      if (idx !== undefined) schedule[idx].count += 1;
    }
  }

  return { open, dueSoon, overdue, inProgress, schedule, invalidDates };
}
