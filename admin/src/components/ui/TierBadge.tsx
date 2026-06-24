import Badge from './Badge';

// 'Elite'/'elite' has been renamed to 'Top Talents' (rename complete).
export type Tier = 'junior' | 'pro' | 'Top Talents' | 'custom';

interface Props {
  tier: Tier | string | null | undefined;
  tierCustom?: string | null;
}

const VARIANT: Record<Tier, 'gray' | 'green' | 'indigo' | 'yellow'> = {
  junior: 'gray',
  pro: 'green',
  'Top Talents': 'indigo',
  custom: 'yellow',
};

const LABEL: Record<Tier, string> = {
  junior: 'Junior',
  pro: 'Pro',
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
