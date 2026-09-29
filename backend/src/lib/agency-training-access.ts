/** The lock requires at least one published, nonempty onboarding course. */
export function agencyRequirementsComplete(required: Array<{ total_count: number; completed_count: number }>): boolean {
  return required.length > 0 && required.every((item) =>
    item.total_count > 0 && item.completed_count === item.total_count,
  );
}

/** The preview contains only non-identifying structured fields. */
export function redactAgencyCard<T extends { card: any }>(item: T): T {
  const content = item.card?.content ?? {};
  const allowed = [
    'card_type', 'subscription_name', 'plan_name', 'hours_label',
    'capacity_label', 'monthly_price', 'currency', 'price_label',
    'pricing_mode', 'request_quote', 'working_days', 'target_country_names',
    'target_languages', 'expiresAt',
  ];
  const preview: Record<string, unknown> = {
    title: 'Client hidden until training is complete',
    brand_name: 'Client hidden',
  };
  for (const key of allowed) if (content[key] !== undefined) preview[key] = content[key];
  const card = item.card ?? {};
  return {
    ...item,
    client_hidden: true,
    card: {
      id: card.id,
      external_id: null,
      status: card.status,
      published_at: card.published_at,
      expires_at: card.expires_at,
      card_type: card.card_type,
      content: preview,
    },
  } as T;
}
