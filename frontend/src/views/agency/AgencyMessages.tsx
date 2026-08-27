'use client';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function AgencyMessages(){
  return (
    <div className="space-y-6">
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="hero-content">
          <div className="mb-2"><span className="eyebrow-rainbow">Chatroom</span></div>
          <h1 className="font-[family-name:var(--font-jakarta)] text-[24px] sm:text-[28px] font-semibold tracking-[-0.025em] text-[#0a0a0a]">Chatroom</h1>
          <p className="mt-1.5 text-sm text-[#525252]">Same intro rooms as talent — businesses can open a chat with your agency or squad.</p>
        </div>
      </section>
      <Card className="p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#F5F5F6] border border-[#E7E7EA]">💬</div>
        <h3 className="mt-3 font-semibold text-[#0a0a0a]">No conversations yet</h3>
        <p className="mt-1 text-sm text-[#737373]">When a business shows interest in a squad profile or your general portfolio, a chat opens here.</p>
        <Button size="sm" variant="outline" className="mt-4" onClick={()=>alert('Chat will open when a business contacts you')}>How it works</Button>
      </Card>
    </div>
  );
}
