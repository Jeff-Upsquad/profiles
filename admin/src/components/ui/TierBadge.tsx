import Badge from './Badge';

// 'elite' is being renamed to 'Top Talents' (Phase 1 accepts both;
// Phase 2 backfills lowercase 'elite' rows; Phase 3 drops the old value).
export type Tier = 'junior' | 'pro' | 'elite' | 'Top Talents' | 'custom';

interface Props {
  tier: Tier | string | null | undefined;
  tierCustom?: string | null;
}

const VARIANT: Record<Tier, 'gray' | 'green' | 'indigo' | 'yellow'> = {
  junior: 'gray',
  pro: 'green',
  elite: 'indigo',
  'Top Talents': 'indigo',
  custom: 'yellow',
};

const LABEL: Record<Tier, string> = {
  junior: 'Junior',
  pro: 'Pro',
  elite: 'Top Talents',
  'Top Talents': 'Top Talents',
  custom: 'Custom',
};

export default function TierBadge({ tier, tierCustom }: Props) {
  if (!tier) return null;
  const t = tier as Tier;
  if (!(t in VARIANT)) return null;
  const text = t === 'custom' && tierCustom ? tierCustom : LABEL[t];
  return <Badge variant={VARIANT[t]}>{text}</Badge>;
}
