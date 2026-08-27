'use client';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function AgencySupport(){
  return (
    <div className="space-y-6">
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="hero-content">
          <div className="mb-2"><span className="eyebrow-rainbow">Support</span></div>
          <h1 className="font-[family-name:var(--font-jakarta)] text-[24px] sm:text-[28px] font-semibold tracking-[-0.025em] text-[#0a0a0a]">Support</h1>
          <p className="mt-1.5 text-sm text-[#525252]">Contact the UpSquad team — same as talent&apos;s Contact Support.</p>
        </div>
      </section>
      <Card className="p-6">
        <h3 className="font-semibold text-[#0a0a0a]">Need help?</h3>
        <p className="mt-1 text-sm text-[#737373]">Reach us on WhatsApp — we&apos;ll help with agency, squad, or portfolio.</p>
        <a href="https://wa.me/919995266342" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700">WhatsApp Support</a>
      </Card>
      <Card className="p-6">
        <h3 className="font-semibold text-[#0a0a0a]">What we help with</h3>
        <ul className="mt-2 list-disc pl-5 text-sm text-[#737373] space-y-1">
          <li>Agency profile & verification</li>
          <li>Squad members & job profiles</li>
          <li>Subscriptions, assignments & clients</li>
          <li>Chatroom & notifications</li>
        </ul>
      </Card>
    </div>
  );
}
