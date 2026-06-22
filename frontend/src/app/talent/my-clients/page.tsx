import MyClients from '@/views/talent/MyClients';

export default function MyClientsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#E7E7EA] bg-white px-5 py-6 sm:px-7 sm:py-7">
        <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a]">
          My Clients
        </h1>
        <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252]">
          Selected and active subscriptions you&rsquo;re working on.
        </p>
      </section>
      <MyClients />
    </div>
  );
}
