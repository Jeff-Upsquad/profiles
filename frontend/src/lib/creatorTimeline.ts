export const ASAP_LABEL = 'As soon as possible';
export const ASAP_DESCRIPTION = 'No fixed start or delivery date. Deliver as soon as you can.';

// Uses the existing additional-requirements contract, which survives the
// SquadHub round trip for both assignments and subscriptions.
export function creatorTimelineFields(form: { asSoonAsPossible: boolean; startDate: string; deliveryDate: string }) {
  const additional: Record<string, string[]> = form.asSoonAsPossible ? { delivery_timing: [ASAP_LABEL] } : {};
  return {
    start_date: form.asSoonAsPossible ? '' : form.startDate,
    deadline: form.asSoonAsPossible ? '' : form.deliveryDate,
    additional,
  };
}

export function isAsSoonAsPossible(requirements: Record<string, unknown> | null | undefined) {
  const timing = requirements?.delivery_timing;
  return Array.isArray(timing) && timing.includes(ASAP_LABEL);
}
