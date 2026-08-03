'use client';

import BusinessHireHub from '@/views/business/BusinessHireHub';

/**
 * Public UI prototype for the unified Hire hub.
 * No auth required — open http://localhost:<port>/preview/hire
 */
export default function HireHubPreviewPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F6]">
      {/* Fake business chrome so the preview feels like the real portal */}
      <div className="flex min-h-screen">
        <aside className="hidden w-56 shrink-0 border-r border-gray-200 bg-white md:flex md:flex-col">
          <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0a0a0a] text-[11px] font-bold text-white">
              SH
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-[family-name:var(--font-jakarta)] text-[15px] font-semibold tracking-[-0.02em] text-[#0a0a0a]">
                SquadHire
              </span>
              <span className="text-[10px] text-[#737373]">UI prototype</span>
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 p-3">
            <PreviewNavItem label="Find talent" active />
            <PreviewNavItem label="All profiles" muted />
            <PreviewNavItem label="How it works" muted />
          </nav>
          <div className="border-t border-gray-100 p-3">
            <p className="truncate text-sm font-semibold text-zinc-900">Preview business</p>
            <p className="truncate text-[11px] text-zinc-500">no login required</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="border-b border-[#E7E7EA] bg-white px-4 py-3 md:hidden">
            <p className="text-sm font-semibold text-[#0a0a0a]">Find talent · UI prototype</p>
            <p className="text-[11px] text-[#737373]">No login · sample data</p>
          </div>
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
            <BusinessHireHub preview />
          </div>
        </main>
      </div>
    </div>
  );
}

function PreviewNavItem({ label, active, muted }: { label: string; active?: boolean; muted?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
        active
          ? 'bg-[#F5F5F6] text-[#0a0a0a]'
          : muted
            ? 'text-gray-400'
            : 'text-gray-600'
      }`}
    >
      <span className="h-5 w-5 rounded bg-current opacity-20" />
      {label}
    </div>
  );
}
