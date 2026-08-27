'use client';
import { useQuery } from '@tanstack/react-query';
import { agencyApi } from '@/services/agency-api';
import Card from '@/components/ui/Card';

export default function AgencyClients(){
  const { data: squad=[] } = useQuery({ queryKey:['agencySquad'], queryFn: agencyApi.listSquad });
  return (
    <div className="space-y-6">
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="hero-content">
          <div className="mb-2"><span className="eyebrow-rainbow">My Clients</span></div>
          <h1 className="font-[family-name:var(--font-jakarta)] text-[24px] sm:text-[28px] font-semibold tracking-[-0.025em] text-[#0a0a0a]">My <span className="text-rainbow">Clients</span></h1>
          <p className="mt-1.5 text-sm text-[#525252]">Clients who&apos;ve hired your squad — mirrors talent&apos;s My Clients.</p>
        </div>
      </section>
      <Card className="p-6">
        <h3 className="font-medium text-[#0a0a0a]">Squad ({squad.length})</h3>
        <p className="mt-1 text-sm text-[#737373]">When a business hires a squad member, they appear here as a client.</p>
        {squad.length===0 ? <p className="mt-3 text-sm text-[#737373]">Add squad members first, then create job profiles to get hired.</p> : <div className="mt-3 grid gap-2 sm:grid-cols-2">{squad.map((m:any)=><div key={m.id} className="rounded-lg border border-[#E7E7EA] p-3 text-sm"><div className="font-medium">{m.full_name}</div><div className="text-xs text-[#737373]">{m.role_title||'—'}</div></div>)}</div>}
      </Card>
      <Card className="p-6 text-center text-sm text-[#737373]">No clients yet — complete your portfolio and squad to attract businesses.</Card>
    </div>
  );
}
