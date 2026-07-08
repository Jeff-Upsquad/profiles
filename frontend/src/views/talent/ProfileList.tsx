import Link from 'next/link';
import {
  useMyProfiles,
  useDeactivateProfile,
  useReactivateProfile,
  useDeleteProfile,
} from '@/hooks/useProfiles';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import Badge, { statusToBadgeVariant } from '@/components/ui/Badge';
import { SkeletonCard } from '@/components/ui/Skeleton';
import PendingApprovalBanner from '@/components/talent/PendingApprovalBanner';
import { formatDate } from '@/lib/formatDate';

const TINTS = ['tint-purple', 'tint-blue', 'tint-orange', 'tint-green', 'tint-pink', 'tint-amber'] as const;

function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return TINTS[Math.abs(hash) % TINTS.length];
}

export default function ProfileList() {
  const { user } = useAuth();
  const isApproved = user?.approval_status === 'approved';
  const { data: profiles, isLoading } = useMyProfiles();
  const deactivate = useDeactivateProfile();
  const reactivate = useReactivateProfile();
  const deleteProfile = useDeleteProfile();

  const visibleProfiles = (profiles ?? []).filter(
    (p) => !p.is_ghost || p.status === 'approved',
  );

  const stats = {
    total: visibleProfiles.length,
    approved: visibleProfiles.filter((p) => p.status === 'approved').length,
    pending: visibleProfiles.filter((p) => p.status === 'pending_review').length,
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-[#E7E7EA] bg-white px-5 py-6">
          <div className="h-7 w-40 animate-pulse rounded bg-[#f0f0f0]" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-[#f0f0f0]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-6 sm:px-7 sm:py-7">
        <div className="hero-content flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2.5 stagger-1">
              <span className="eyebrow-rainbow">
                {stats.total} {stats.total === 1 ? 'profile' : 'profiles'}
                {stats.approved > 0 && ` · ${stats.approved} live`}
              </span>
            </div>
            <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a] stagger-2">
              Your <span className="text-rainbow">job profiles</span>.
            </h1>
            <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252] stagger-3">
              Each profile is a different way brands can hire you.
            </p>
          </div>
          <div className="stagger-4">
            <Link href="/talent/profiles/new" className="btn-iridescent text-sm py-2 px-3.5">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Profile
            </Link>
          </div>
        </div>
      </section>

      {!isApproved && <PendingApprovalBanner />}

      {visibleProfiles.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-6 py-16 text-center">
          <div className="hero-glow-orange absolute inset-0 pointer-events-none" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFFAC2]">
              <svg className="h-7 w-7 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-xl font-semibold tracking-[-0.02em] text-[#0a0a0a]">
              No profiles yet
            </h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#737373]">
              Create your first job profile to get discovered by brands and businesses.
            </p>
            <div className="mt-5 inline-flex">
              <Link href="/talent/profiles/new" className="btn-iridescent text-sm py-2 px-3.5">
                Create your first profile
                <svg className="arrow-icon h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleProfiles.map((profile, i) => {
            const tint = tintFor(profile.category?.name ?? profile.id);
            const isLive = profile.status === 'approved';
            return (
              <article
                key={profile.id}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 stagger-${Math.min(i + 1, 6)}`}
              >
                {/* Tinted top strip */}
                <div className={`${tint} h-20 relative overflow-hidden`}>
                  <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/40 blur-2xl" />
                  <div className="absolute bottom-3 left-4">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm"
                      style={{ color: 'var(--tint-icon)' }}
                    >
                      <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                  </div>
                  {isLive && (
                    <div className="absolute top-3 right-3">
                      <span className="pill-live">Live</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-[family-name:var(--font-jakarta)] text-[17px] font-semibold tracking-[-0.015em] text-[#0a0a0a] truncate">
                      {profile.category?.name ?? 'Profile'}
                    </h3>
                    {!isLive && (
                      <Badge variant={statusToBadgeVariant(profile.status)}>
                        {profile.status.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>

                  {profile.is_ghost ? (
                    <p className="mt-1 text-xs text-[#a3a3a3]">
                      Auto-generated from your Designer + Video Editor profiles
                    </p>
                  ) : (
                    <p className="mt-1 font-[family-name:var(--font-inter)] text-xs text-[#a3a3a3]">
                      Created {formatDate(profile.created_at)}
                    </p>
                  )}

                  {profile.rejection_reason && (
                    <div className="mt-3 rounded-lg bg-red-50 ring-1 ring-inset ring-red-200 p-2.5 text-xs text-red-700">
                      <span className="font-medium">Rejected:</span> {profile.rejection_reason}
                    </div>
                  )}

                  <div className="mt-auto pt-4 flex flex-wrap gap-1.5">
                    <Link href={`/talent/profiles/${profile.id}`}>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </Link>
                    {!profile.is_ghost && (profile.status === 'draft' || profile.status === 'rejected' || profile.status === 'approved' || profile.status === 'pending_review') && (
                      <Link href={`/talent/profiles/${profile.id}/edit`}>
                        <Button variant="secondary" size="sm">
                          Edit
                        </Button>
                      </Link>
                    )}
                    {!profile.is_ghost && profile.status === 'approved' && (
                      <Button
                        variant="secondary" size="sm"
                        loading={deactivate.isPending}
                        onClick={() => deactivate.mutate(profile.id)}
                      >
                        Pause
                      </Button>
                    )}
                    {!profile.is_ghost && profile.status === 'inactive' && (
                      <Button
                        variant="secondary" size="sm"
                        loading={reactivate.isPending}
                        onClick={() => reactivate.mutate(profile.id)}
                      >
                        Reactivate
                      </Button>
                    )}
                    {!profile.is_ghost && (
                      <button
                        type="button"
                        disabled={deleteProfile.isPending}
                        onClick={() => {
                          const isLiveProfile = profile.status === 'approved' || profile.status === 'pending_review';
                          const msg = isLiveProfile
                            ? 'This profile is currently live. Deleting it will remove it from public view and move it to the archive. Are you sure?'
                            : 'Are you sure you want to delete this profile?';
                          if (confirm(msg)) deleteProfile.mutate(profile.id);
                        }}
                        className="font-[family-name:var(--font-inter)] inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-[#a3a3a3] transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
