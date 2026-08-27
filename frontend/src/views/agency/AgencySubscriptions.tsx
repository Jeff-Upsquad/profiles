'use client';
import { useQuery } from '@tanstack/react-query';
import { agencyApi } from '@/services/agency-api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Link from 'next/link';

export default function AgencySubscriptions(){
  const { data=[] } = useQuery({ queryKey:['agencySubscriptions'], queryFn: ()=> agencyApi.me().then(()=>[] as any[]) }); // stub
  return (
    <div className="space-y-6">
      <section className="hero-container hero-glow-orange relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="hero-content">
          <div className="mb-2"><span className="eyebrow-rainbow">Agency Workspace</span></div>
          <h1 className="font-[family-name:var(--font-jakarta)] text-[24px] sm:text-[28px] font-semibold tracking-[-0.025em] text-[#0a0a0a]">Subscriptions</h1>
          <p className="mt-1.5 text-sm text-[#525252]">Recurring client plans for your squad — mirrors talent&apos;s Subscriptions.</p>
        </div>
      </section>
      <Card className="p-8 text-center">
        <div className="mx-auto max-w-md">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#F5F5F6] border border-[#E7E7EA]">📦</div>
          <h3 className="mt-3 font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">No subscriptions yet</h3>
          <p className="mt-1 text-sm text-[#737373]">When businesses subscribe to your agency, they&apos;ll appear here — same as talent.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/agency/squad"><Button size="sm">Add Squad Member</Button></Link>
            <Link href="/agency/portfolio"><Button variant="outline" size="sm">View Portfolio</Button></Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
