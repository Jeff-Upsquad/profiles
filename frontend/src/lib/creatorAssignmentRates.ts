/** The same half-open follower ranges used by the creator audience matcher. */
const FOLLOWER_RANGES: Record<string, readonly [number, number]> = {
  'Below 5,000': [0, 5000],
  '5,000 to 10,000': [5000, 10000],
  '10,000 to 25,000': [10000, 25000],
  '25,000 to 50,000': [25000, 50000],
  '50,000 to 100k': [50000, 100000],
  '100k to 500k': [100000, 500000],
  '500k to 1 mil': [500000, 1000000],
  '1 million+': [1000000, Infinity],
};

export interface CreatorAccount {
  platform: string;
  followers: number | '';
  profile_url?: string;
}

export interface MatchedCreatorRate {
  platform: string;
  account?: string;
  followers: number | null;
  range: string | null;
  rate: string | null;
}

/** Match each requested platform independently; never select another platform's
 * follower count or expose the full list of client rates as a fallback. */
export function matchCreatorRates(channels: string[], accounts: CreatorAccount[], rateLabels: string[]): MatchedCreatorRate[] {
  const tiers = rateLabels.map(label => {
    const parsed = label.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    const range = (parsed ? parsed[1] : label).trim();
    return { range, rate: parsed?.[2] ?? null, bounds: FOLLOWER_RANGES[range] };
  });
  return channels.flatMap<MatchedCreatorRate>(platform => {
    const entries = accounts.filter(account => account.platform.trim().toLowerCase() === platform.trim().toLowerCase());
    if (!entries.length) return [{ platform, followers: null, range: null, rate: null }];
    return entries.map(account => {
      const count = account.followers === '' || account.followers == null ? NaN : Number(account.followers);
      const followers = Number.isFinite(count) && count >= 0 ? count : null;
      const tier = followers === null ? undefined : tiers.find(item => item.bounds && followers >= item.bounds[0] && followers < item.bounds[1]);
      return { platform, account: account.profile_url, followers, range: tier?.range ?? null, rate: tier?.rate?.replace(/^INR\s*/, '₹') ?? null };
    });
  });
}
