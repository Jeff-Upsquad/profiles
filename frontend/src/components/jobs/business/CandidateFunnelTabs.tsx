'use client';

// Horizontal-scroll funnel tab strip for the business job console.

export interface FunnelTab<K extends string = string> {
  key: K;
  label: string;
  count?: number | null;
}

export default function CandidateFunnelTabs<K extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: FunnelTab<K>[];
  active: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex items-center gap-1 rounded-xl border border-[#E7E7EA] bg-[#F5F5F6] p-1.5">
        {tabs.map((t) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={`font-[family-name:var(--font-inter)] inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-white text-[#0a0a0a] shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]'
                  : 'text-[#525252] hover:text-[#0a0a0a]'
              }`}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
                    isActive ? 'bg-[#FFFAC2] text-[#0a0a0a]' : 'bg-[#E7E7EA] text-[#525252]'
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
