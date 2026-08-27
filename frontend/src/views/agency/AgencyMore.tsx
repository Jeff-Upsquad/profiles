'use client';
import Link from 'next/link';
import Card from '@/components/ui/Card';

const items=[
  { href:'/agency/profile', label:'Agency Profile', desc:'Edit agency, location, address, logo' },
  { href:'/agency/squad', label:'Squad Members', desc:'Manage squad' },
  { href:'/agency/profiles', label:'Job Profiles', desc:'Per-member profiles' },
  { href:'/agency/general', label:'General Portfolio', desc:'Agency-level portfolio' },
  { href:'/agency/portfolio', label:'Total Portfolio', desc:'Combined view' },
  { href:'/agency/clients', label:'My Clients', desc:'Hired squad' },
  { href:'/agency/settings', label:'Settings', desc:'Account & notifications' },
  { href:'/agency/training', label:'Training Program', desc:'Onboarding & SOPs' },
  { href:'/agency/support', label:'Contact Support', desc:'Get help' },
];

export default function AgencyMore(){
  return (
    <div className="space-y-6">
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="hero-content">
          <div className="mb-2"><span className="eyebrow-rainbow">More</span></div>
          <h1 className="font-[family-name:var(--font-jakarta)] text-[24px] sm:text-[28px] font-semibold tracking-[-0.025em] text-[#0a0a0a]">More</h1>
        </div>
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map(it=>(
          <Link key={it.href} href={it.href} className="rounded-xl border border-[#E7E7EA] bg-white p-4 hover:border-[#0a0a0a] transition">
            <div className="font-medium text-[#0a0a0a]">{it.label}</div>
            <div className="text-xs text-[#737373]">{it.desc}</div>
          </Link>
        ))}
      </div>
      <Card className="p-4 text-xs text-[#737373]">Mirrors talent&apos;s “More” drawer — all secondary modules in one place.</Card>
    </div>
  );
}
