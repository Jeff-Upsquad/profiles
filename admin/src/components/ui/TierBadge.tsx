import Badge from './Badge';

export type Tier = 'junior' | 'pro' | 'elite' | 'custom';

interface Props {
  tier: Tier | string | null | undefined;
  tierCustom?: string | null;
}

const VARIANT: Record<Tier, 'gray' | 'green' | 'indigo' | 'yellow'> = {
  junior: 'gray',
  pro: 'green',
  elite: 'indigo',
  custom: 'yellow',
};

const LABEL: Record<Tier, string> = {
  junior: 'Junior',
  pro: 'Pro',
  elite: 'Elite',
  custom: 'Custom',
};

export default function TierBadge({ tier, tierCustom }: Props) {
  if (!tier) return null;
  const t = tier as Tier;
  if (!(t in VARIANT)) return null;
  const text = t === 'custom' && tierCustom ? tierCustom : LABEL[t];
  return <Badge variant={VARIANT[t]}>{text}</Badge>;
}
