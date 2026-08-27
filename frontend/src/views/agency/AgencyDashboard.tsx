'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { agencyApi } from '@/services/agency-api';
import { useAuth } from '@/context/AuthContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function AgencyDashboard() {
  const { user } = useAuth();
  const { data: me } = useQuery({ queryKey: ['agencyMe'], queryFn: agencyApi.me });
  const { data: squad = [] } = useQuery({ queryKey: ['agencySquad'], queryFn: agencyApi.listSquad });
  const { data: memberProfiles = [] } = useQuery({ queryKey: ['agencyMemberProfiles'], queryFn: agencyApi.listMemberProfiles });
  const { data: generalPortfolios = [] } = useQuery({ queryKey: ['agencyGeneral'], queryFn: agencyApi.listGeneral });
  const { data: total } = useQuery({ queryKey: ['agencyTotal'], queryFn: agencyApi.total });

  const agencyName = (me as any)?.agency_name || user?.agency_name || 'your agency';
  const firstName = agencyName.split(' ')[0];

  return (
    <div className="space-y-6">
      {/* hero — matches TalentDashboard hero-glow-orange */}
      <section className="hero-container hero-glow-orange relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="hero-glow-blur" />
        <div className="hero-content flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 inline-flex items-center gap-2">
              <span className="eyebrow-rainbow">Agency Workspace</span>
              <span className="pill-live">Live</span>
            </div>
            <h1 className="font-[family-name:var(--font-jakarta)] text-[24px] sm:text-[28px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a]">
              Welcome back{firstName ? <>, <span className="text-rainbow">{firstName}</span></> : ''}.
            </h1>
            <p className="mt-1 font-[family-name:var(--font-jakarta)] text-sm text-[#525252]">
              Agency profile, squad members, job profiles and your combined portfolio — all in one place.
            </p>
          </div>
        </div>
      </section>

      {/* quick stats — same card language as talent */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-sm text-[#525252]">Squad Members</div>
          <div className="mt-1 text-3xl font-bold tracking-[-0.02em] text-[#0a0a0a]">{squad.length}</div>
          <div className="mt-1 text-xs text-[#737373]">Each mirrors a talent&apos;s basic profile</div>
          <Link href="/agency/squad" className="mt-3 inline-flex text-xs font-medium text-[#0a0a0a] underline">Manage squad →</Link>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-[#525252]">Member Job Profiles</div>
          <div className="mt-1 text-3xl font-bold tracking-[-0.02em] text-[#0a0a0a]">{memberProfiles.length}</div>
          <div className="mt-1 text-xs text-[#737373]">Linked to a squad member + category</div>
          <Link href="/agency/profiles" className="mt-3 inline-flex text-xs font-medium text-[#0a0a0a] underline">View profiles →</Link>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-[#525252]">General Portfolios</div>
          <div className="mt-1 text-3xl font-bold tracking-[-0.02em] text-[#0a0a0a]">{generalPortfolios.length}</div>
          <div className="mt-1 text-xs text-[#737373]">Agency-level, like a talent job profile</div>
          <Link href="/agency/general" className="mt-3 inline-flex text-xs font-medium text-[#0a0a0a] underline">View general →</Link>
        </Card>
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className="font-[family-name:var(--font-jakarta)] text-base font-semibold tracking-[-0.015em] text-[#0a0a0a]">Total Portfolio</h2>
        <p className="mt-1 text-sm text-[#525252]">Your combined showcase: squad members&apos; profiles + general portfolio. Businesses see this.</p>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="rounded-full bg-[#F5F5F6] border border-[#E7E7EA] px-3 py-1 text-xs font-medium">{(total as any)?.portfolio_items?.length || 0} items</span>
          <span className="rounded-full bg-[#FFFAC2] border border-[#0a0a0a] px-3 py-1 text-xs font-medium">Agency</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/agency/squad" className="btn-iridescent text-sm py-2 px-4">Add Squad Member</Link>
          <Link href="/agency/portfolio" className="inline-flex items-center justify-center rounded-xl border border-[#0a0a0a] bg-white px-4 py-2 text-sm font-medium text-[#0a0a0a] hover:bg-[#F5F5F6]">View Total Portfolio</Link>
        </div>
      </Card>

      {/* quick steps — mirrors onboarding strip intent */}
      <Card className="p-5 sm:p-6">
        <h3 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">Get started</h3>
        <ol className="mt-3 space-y-2 text-sm">
          <li className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0a0a0a] text-white text-xs">1</span> Complete <Link href="/agency/profile" className="font-medium underline">Agency Profile</Link> — required before you appear to businesses.</li>
          <li className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0a0a0a] text-white text-xs">2</span> Add <Link href="/agency/squad" className="font-medium underline">Squad Members</Link> — each has talent-like details.</li>
          <li className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0a0a0a] text-white text-xs">3</span> Create <Link href="/agency/profiles" className="font-medium underline">Job Profiles</Link> per member + category, or a <Link href="/agency/general" className="font-medium underline">General Portfolio</Link> for the agency.</li>
          <li className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FFFAC2] border border-[#0a0a0a] text-xs">✓</span> Businesses see your <Link href="/agency/portfolio" className="font-medium underline">Total Portfolio</Link> (both together).</li>
        </ol>
      </Card>
    </div>
  );
}
