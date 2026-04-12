'use client';

interface ThreadsTopBarProps {
  displayName: string;
  onBack: () => void;
}

export default function ThreadsTopBar({ displayName, onBack }: ThreadsTopBarProps) {
  return (
    <div
      className="sticky top-0 z-50 flex h-12 items-center justify-between border-b border-[var(--threads-border)] px-4"
      style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', backgroundColor: 'rgba(255,255,255,0.85)' }}
    >
      <button
        onClick={onBack}
        className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[var(--threads-bg-hover)]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--threads-text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <span className="text-sm font-semibold text-[var(--threads-text-primary)] truncate max-w-[200px]">
        {displayName}
      </span>

      <button className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[var(--threads-bg-hover)]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--threads-text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="19" r="1" />
        </svg>
      </button>
    </div>
  );
}
