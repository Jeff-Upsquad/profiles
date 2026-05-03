import Link from 'next/link';
import { useMyInterests } from '@/hooks/useBusiness';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { SkeletonCard } from '@/components/ui/Skeleton';

const TINTS = ['tint-purple', 'tint-blue', 'tint-orange', 'tint-green', 'tint-pink', 'tint-amber'] as const;

function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return TINTS[Math.abs(hash) % TINTS.length];
}

function initials(name: string | undefined | null): string {
  if (!name) return 'T';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || 'T';
}

function statusVariant(status: string) {
  switch (status) {
    case 'accepted':
      return 'green' as const;
    case 'declined':
      return 'red' as const;
    case 'pending':
      return 'yellow' as const;
    default:
      return 'gray' as const;
  }
}

function relativeTime(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Interests() {
  const { data: interests, isLoading } = useMyInterests();
  const visible = interests ?? [];

  const counts = visible.reduce(
    (acc, i) => {
      if (i.status === 'pending') acc.pending++;
      else if (i.status === 'accepted') acc.accepted++;
      else if (i.status === 'declined') acc.declined++;
      return acc;
    },
    { pending: 0, accepted: 0, declined: 0 },
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-[#E8E5DE] bg-white px-5 py-6">
          <div className="h-7 w-40 animate-pulse rounded bg-[#f0f0f0]" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-[#f0f0f0]" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <section className="hero-container hero-glow-blue relative overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white px-5 py-6 sm:px-7 sm:py-7">
        <div className="hero-content flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2.5 flex flex-wrap items-center gap-1.5 stagger-1">
              <span className="eyebrow-rainbow">
                {visible.length} {visible.length === 1 ? 'request' : 'requests'} sent
              </span>
              {counts.pending > 0 && (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  {counts.pending} pending
                </span>
              )}
              {counts.accepted > 0 && (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  {counts.accepted} accepted
                </span>
              )}
            </div>
            <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a] stagger-2">
              Interest <span className="text-rainbow">requests</span>.
            </h1>
            <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252] stagger-3">
              Track the status of every interest request you've sent to talent.
            </p>
          </div>
          <div className="stagger-4">
            <Link href="/business/discover" className="btn-iridescent text-sm py-2 px-3.5">
              Send More
              <svg className="arrow-icon h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {visible.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white px-6 py-16 text-center">
          <div className="hero-glow-orange absolute inset-0 pointer-events-none" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F2FCBC]">
              <svg className="h-7 w-7 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-xl font-semibold tracking-[-0.02em] text-[#0a0a0a]">
              No interest requests yet
            </h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#737373]">
              Browse approved talent and send a request to get the conversation started.
            </p>
            <div className="mt-5 inline-flex">
              <Link href="/business/discover" className="btn-iridescent text-sm py-2 px-3.5">
                Discover Talent
                <svg className="arrow-icon h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <ul className="divide-y divide-[#E8E5DE]">
            {visible.map((interest, i) => {
              const fullName =
                (interest.profile as any)?.talent_user?.full_name ??
                interest.profile?.category?.name ??
                'Talent';
              const tint = tintFor(interest.id);
              const profileHref = interest.profile
                ? `/business/discover/${interest.profile.category?.slug ?? 'profile'}/${interest.talent_profile_id}`
                : null;

              return (
                <li
                  key={interest.id}
                  className={`group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-[#F7F6F3] sm:px-6 stagger-${Math.min(i + 1, 6)}`}
                >
                  <div
                    className={`${tint} flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl font-[family-name:var(--font-jakarta)] text-sm font-semibold`}
                    style={{ color: 'var(--tint-icon)' }}
                  >
                    {initials(fullName)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a] truncate">
                        {fullName}
                      </p>
                      <Badge variant={statusVariant(interest.status)}>
                        {interest.status}
                      </Badge>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                      {interest.profile?.category?.name && (
                        <span className="text-[#737373]">
                          {interest.profile.category.name}
                        </span>
                      )}
                      {interest.profile?.category?.name && (
                        <span className="text-[#D4D4D8]">·</span>
                      )}
                      <span className="text-[#a3a3a3]">
                        Sent {relativeTime(interest.created_at)}
                      </span>
                    </div>
                    {interest.message && (
                      <p className="mt-2 font-[family-name:var(--font-inter)] text-sm text-[#525252] line-clamp-2 italic">
                        &ldquo;{interest.message}&rdquo;
                      </p>
                    )}
                  </div>

                  {profileHref && (
                    <div className="hidden flex-shrink-0 sm:block">
                      <Link href={profileHref}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
