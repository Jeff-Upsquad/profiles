'use client';
import Card from '@/components/ui/Card';

export default function AgencyNotifications(){
  return (
    <div className="space-y-6">
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="hero-content">
          <div className="mb-2"><span className="eyebrow-rainbow">Notifications</span></div>
          <h1 className="font-[family-name:var(--font-jakarta)] text-[24px] sm:text-[28px] font-semibold tracking-[-0.025em] text-[#0a0a0a]">Notifications</h1>
          <p className="mt-1.5 text-sm text-[#525252]">Mirrors talent&apos;s notifications — approvals, interests, assignments.</p>
        </div>
      </section>
      <Card className="p-8 text-center text-sm text-[#737373]">No notifications — you&apos;ll be notified when your agency or squad gets activity.</Card>
    </div>
  );
}
