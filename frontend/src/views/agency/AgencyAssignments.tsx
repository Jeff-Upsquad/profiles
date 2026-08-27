'use client';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Link from 'next/link';

export default function AgencyAssignments(){
  return (
    <div className="space-y-6">
      <section className="hero-container hero-glow-orange relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="hero-content">
          <div className="mb-2"><span className="eyebrow-rainbow">Agency Workspace</span></div>
          <h1 className="font-[family-name:var(--font-jakarta)] text-[24px] sm:text-[28px] font-semibold tracking-[-0.025em] text-[#0a0a0a]">Assignments</h1>
          <p className="mt-1.5 text-sm text-[#525252]">Client assignments for your squad — mirrors talent&apos;s Assignments.</p>
        </div>
      </section>
      <Card className="p-8 text-center">
        <div className="mx-auto max-w-md">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#F5F5F6] border border-[#E7E7EA]">✓</div>
          <h3 className="mt-3 font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">No assignments yet</h3>
          <p className="mt-1 text-sm text-[#737373]">Assignments from subscribed businesses will appear here.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/agency/subscriptions"><Button variant="outline" size="sm">View Subscriptions</Button></Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
