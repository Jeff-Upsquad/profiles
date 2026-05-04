'use client';

export default function JobOpeningsPage() {
  return (
    <div className="space-y-6">
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white px-5 py-6 sm:px-7 sm:py-7">
        <div className="hero-glow-blur" />
        <div className="hero-content">
          <div className="mb-2.5 stagger-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F2FCBC] px-3 py-1 text-xs font-semibold text-[#0a0a0a]">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Opportunities
            </span>
          </div>
          <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a] stagger-2">
            Job Openings
          </h1>
          <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252] max-w-xl stagger-3">
            Browse job opportunities posted by businesses looking to hire.
          </p>
        </div>
      </section>

      <div className="relative overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white px-6 py-16 text-center">
        <div className="hero-glow-purple absolute inset-0 pointer-events-none" />
        <div className="relative">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F2FCBC]">
            <svg className="h-6 w-6 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
            Coming Soon
          </h3>
          <p className="mt-1 text-sm text-[#737373]">
            Job openings from businesses will appear here — check back soon.
          </p>
        </div>
      </div>
    </div>
  );
}
