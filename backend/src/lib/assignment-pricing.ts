export interface CardOfferPricingMetadata {
  period: 'per_month' | 'project' | 'per_design' | 'per_video';
  pricing_basis?: 'per_unit';
  unit?: 'design' | 'video';
  quantity?: number;
}

/** Resolve immutable quote metadata from a card's assignment_details JSON. */
export function offerMetadataForCard(
  content: Record<string, unknown> | null | undefined,
  cardType: string,
): CardOfferPricingMetadata {
  const details = (content?.assignment_details ?? {}) as Record<string, unknown>;
  const unit = details.unit === 'video' || details.unit === 'design' ? details.unit : null;
  if (cardType === 'assignment' && details.pricing_basis === 'per_unit' && unit) {
    const rawQuantity = Number(details.quantity);
    const quantity = Number.isInteger(rawQuantity) && rawQuantity > 0 && rawQuantity <= 999
      ? rawQuantity
      : null;
    return {
      period: unit === 'video' ? 'per_video' : 'per_design',
      pricing_basis: 'per_unit',
      unit,
      ...(quantity ? { quantity } : {}),
    };
  }
  return { period: cardType === 'assignment' ? 'project' : 'per_month' };
}
