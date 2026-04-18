'use client';

interface ThreadsTopBarProps {
  displayName: string;
  onBack: () => void;
}

export default function ThreadsTopBar({ displayName, onBack }: ThreadsTopBarProps) {
  return (
    <div className="flex items-center justify-between px-4 sm:px-6 py-3 mt-2">
      <button
        onClick={onBack}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white border border-zinc-200 shadow-sm transition-colors hover:bg-zinc-50"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-950">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <span className="font-bold text-[17px] text-zinc-950 tracking-tight truncate max-w-[200px]">
        {displayName}
      </span>

      <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white border border-zinc-200 shadow-sm transition-colors hover:bg-zinc-50">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-950">
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="19" r="1" />
        </svg>
      </button>
    </div>
  );
}
