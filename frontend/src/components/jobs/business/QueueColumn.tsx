'use client';

// One column of the interview-day console (queue / showed up / done / absent).

export default function QueueColumn({
  title,
  count,
  accent,
  children,
}: {
  title: string;
  count: number;
  accent?: 'default' | 'green' | 'amber' | 'red';
  children: React.ReactNode;
}) {
  const accentClass =
    accent === 'green'
      ? 'border-emerald-200 bg-emerald-50/40'
      : accent === 'amber'
        ? 'border-amber-200 bg-amber-50/40'
        : accent === 'red'
          ? 'border-red-200 bg-red-50/40'
          : 'border-[#E7E7EA] bg-[#FAFAFA]';

  return (
    <div className={`flex min-w-[16rem] flex-1 flex-col rounded-2xl border ${accentClass}`}>
      <div className="flex items-center justify-between border-b border-inherit px-4 py-3">
        <h3 className="font-[family-name:var(--font-jakarta)] text-[13px] font-semibold text-[#0a0a0a]">
          {title}
        </h3>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-semibold text-[#525252] ring-1 ring-inset ring-[#E7E7EA]">
          {count}
        </span>
      </div>
      <div className="flex-1 space-y-2 p-3">
        {count === 0 ? <p className="px-1 py-2 text-xs text-[#a3a3a3]">Nobody here yet.</p> : children}
      </div>
    </div>
  );
}
