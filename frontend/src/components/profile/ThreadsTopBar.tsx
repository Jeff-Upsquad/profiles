'use client';

interface ProfileNavigation {
  current: number;
  total: number;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
}

interface ThreadsTopBarProps {
  displayName: string;
  onBack: () => void;
  navigation?: ProfileNavigation;
}

export default function ThreadsTopBar({ displayName, onBack, navigation }: ThreadsTopBarProps) {
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

      {navigation ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">
            {navigation.current} of {navigation.total}
          </span>
          <button
            onClick={navigation.onPrev ?? undefined}
            disabled={!navigation.onPrev}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-default"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-700">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={navigation.onNext ?? undefined}
            disabled={!navigation.onNext}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-default"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-700">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      ) : (
        <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white border border-zinc-200 shadow-sm transition-colors hover:bg-zinc-50">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-950">
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>
      )}
    </div>
  );
}
