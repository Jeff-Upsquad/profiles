export type WorkPricingUnit = 'design' | 'video';
export type WorkPricingPeriod = 'per_design' | 'per_video';

export interface AssignmentPricingDetails {
  request_type?: string | null;
  work_type?: string | null;
  pricing_basis?: string | null;
  unit?: string | null;
  quantity?: number | null;
  scope_type?: string | null;
  pricing_mode?: string | null;
  duration?: string | null;
  start_date?: string | null;
  deadline?: string | null;
}

export function isPerUnitAssignment(details: AssignmentPricingDetails | null | undefined): boolean {
  return details?.pricing_basis === 'per_unit' && (details.unit === 'design' || details.unit === 'video');
}

export function assignmentOfferPeriod(
  details: AssignmentPricingDetails | null | undefined,
): 'project' | WorkPricingPeriod {
  if (!isPerUnitAssignment(details)) return 'project';
  return details?.unit === 'video' ? 'per_video' : 'per_design';
}

export function assignmentQuantity(details: AssignmentPricingDetails | null | undefined): number {
  return optionalAssignmentQuantity(details) ?? 1;
}

export function optionalAssignmentQuantity(details: AssignmentPricingDetails | null | undefined): number | null {
  const raw = Number(details?.quantity);
  return Number.isInteger(raw) && raw > 0 ? raw : null;
}

export function singularUnit(details: AssignmentPricingDetails | null | undefined): WorkPricingUnit | null {
  return details?.unit === 'design' || details?.unit === 'video' ? details.unit : null;
}

export function pluralizeUnit(unit: string | null | undefined, quantity: number): string {
  if (!unit) return 'items';
  return quantity === 1 ? unit : `${unit}s`;
}

export function periodLabel(period: string | null | undefined): string {
  const labels: Record<string, string> = {
    project: 'for the project',
    per_month: 'per month',
    per_week: 'per week',
    per_day: 'per day',
    per_hour: 'per hour',
    per_design: 'per design',
    per_video: 'per video',
  };
  return period ? (labels[period] ?? period.replace(/_/g, ' ')) : '';
}

export function periodSuffix(period: string | null | undefined): string {
  const suffixes: Record<string, string> = {
    project: '',
    per_month: '/mo',
    per_week: '/week',
    per_day: '/day',
    per_hour: '/hour',
    per_design: '/design',
    per_video: '/video',
  };
  return period ? (suffixes[period] ?? '') : '';
}
