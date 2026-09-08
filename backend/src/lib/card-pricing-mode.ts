type CardContent = Record<string, unknown> | null | undefined;

function hasPositiveAmount(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * A subscription without a displayed amount is a request-for-quote card.
 * Explicit payload flags win; the missing-price fallback keeps cards that
 * were delivered before those flags existed safe as well.
 */
export function isSubscriptionRequestQuote(
  cardType: string | null | undefined,
  content: CardContent,
): boolean {
  if (cardType !== 'subscription') return false;
  if (content?.pricing_mode === 'unpriced' || content?.request_quote === true) return true;
  if (content?.pricing_mode === 'priced' || content?.request_quote === false) return false;

  if (
    hasPositiveAmount(content?.monthly_price) ||
    hasPositiveAmount(content?.customer_monthly_price) ||
    hasPositiveAmount(content?.proposed_price)
  ) {
    return false;
  }

  // Legacy cards may carry a formatted price without the numeric fields.
  return !(typeof content?.price_label === 'string' && content.price_label.trim().length > 0);
}

export function resolveCardPricingMode(
  cardType: string | null | undefined,
  content: CardContent,
): 'priced' | 'unpriced' {
  if (isSubscriptionRequestQuote(cardType, content)) return 'unpriced';
  if (cardType === 'assignment') {
    const details = (content?.assignment_details ?? {}) as Record<string, unknown>;
    if (details.pricing_mode === 'unpriced') return 'unpriced';
  }
  return 'priced';
}
