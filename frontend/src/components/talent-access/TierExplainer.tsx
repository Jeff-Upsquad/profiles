'use client';

/**
 * Hardcoded copy explaining what each tier means.
 * TODO: Replace placeholder text with real copy from the team.
 */
const TIER_COPY: { key: string; label: string; blurb: string }[] = [
  {
    key: 'junior',
    label: 'Junior',
    blurb: 'Early-career talent. Reliable for well-scoped tasks under guidance.',
  },
  {
    key: 'pro',
    label: 'Pro',
    blurb:
      'Experienced operators who own deliverables end-to-end with minimal oversight.',
  },
  {
    key: 'Top Talents',
    label: 'Top Talents',
    blurb:
      'Top-tier talent for high-stakes work. Strong portfolios and proven outcomes.',
  },
  {
    key: 'custom',
    label: 'Custom',
    blurb: 'Specialized profiles that don’t fit cleanly into the other tiers.',
  },
];

export default function TierExplainer() {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-600">
      <p className="mb-1.5 font-semibold text-zinc-700">What the tiers mean</p>
      <ul className="space-y-1">
        {TIER_COPY.map((t) => (
          <li key={t.key}>
            <span className="font-medium text-zinc-800">{t.label}:</span>{' '}
            {t.blurb}
          </li>
        ))}
      </ul>
    </div>
  );
}
