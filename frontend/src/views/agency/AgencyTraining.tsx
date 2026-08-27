'use client';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Link from 'next/link';

export default function AgencyTraining(){
  return (
    <div className="space-y-6">
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="hero-content">
          <div className="mb-2"><span className="eyebrow-rainbow">Training Program</span></div>
          <h1 className="font-[family-name:var(--font-jakarta)] text-[24px] sm:text-[28px] font-semibold tracking-[-0.025em] text-[#0a0a0a]">Training <span className="text-rainbow">Program</span></h1>
          <p className="mt-1.5 text-sm text-[#525252]">Same onboarding & SOPs as talent — unlock modules.</p>
        </div>
      </section>
      <Card className="p-6">
        <h3 className="font-semibold text-[#0a0a0a]">Onboarding</h3>
        <p className="mt-1 text-sm text-[#737373]">Complete onboarding to unlock all agency modules — mirrors talent flow.</p>
        <Link href="/talent/training"><Button variant="outline" size="sm" className="mt-3">View Talent Training (reference)</Button></Link>
      </Card>
      <Card className="p-8 text-center text-sm text-[#737373]">No agency-specific training assigned yet — you have access to the shared program.</Card>
    </div>
  );
}
