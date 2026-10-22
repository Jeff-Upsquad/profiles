'use client';

import { useEffect, useRef, useState } from 'react';

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
  /** Overrides displayName as the bar's title (talent profiles show "Profile"). */
  title?: string;
  /** Category name, shown after the "3 of 24" position in the subtitle. */
  subtitle?: string;
  /** Actions for the "More options" menu. The button is hidden when empty. */
  menuItems?: { label: string; onClick: () => void; disabled?: boolean }[];
}

const roundButton =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors sm:border sm:border-zinc-200 sm:bg-white sm:hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-default';

export default function ThreadsTopBar({ displayName, onBack, navigation, title, subtitle, menuItems }: ThreadsTopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const subtitleText = [
    navigation ? `${navigation.current} of ${navigation.total}` : null,
    subtitle || null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex items-center gap-1 px-2 pt-2 pb-1 sm:gap-3 sm:px-0 sm:pt-1 sm:pb-2">
      <button type="button" onClick={onBack} aria-label="Back" className={roundButton}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-950" aria-hidden="true">
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="min-w-0 flex-1 sm:text-center">
        <p className="truncate text-[17px] font-bold tracking-tight text-zinc-950">
          {title ?? displayName}
        </p>
        {subtitleText && (
          <p className="mt-px truncate text-[12px] text-zinc-500 sm:text-[13px]">{subtitleText}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {navigation && (
          <>
            <button
              type="button"
              onClick={navigation.onPrev ?? undefined}
              disabled={!navigation.onPrev}
              aria-label="Previous profile"
              className={`${roundButton} hidden sm:flex`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-950" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={navigation.onNext ?? undefined}
              disabled={!navigation.onNext}
              aria-label="Next profile"
              className={`${roundButton} hidden sm:flex`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-950" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </>
        )}
        {menuItems && menuItems.length > 0 && (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-label="More options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className={roundButton}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-zinc-950" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <circle cx="7.5" cy="12" r="0.6" fill="currentColor" />
                <circle cx="12" cy="12" r="0.6" fill="currentColor" />
                <circle cx="16.5" cy="12" r="0.6" fill="currentColor" />
              </svg>
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-12 z-40 min-w-[180px] overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg"
              >
                {menuItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => {
                      setMenuOpen(false);
                      item.onClick();
                    }}
                    className="flex h-11 w-full items-center px-4 text-left text-[15px] font-medium text-zinc-950 hover:bg-zinc-50 disabled:opacity-40"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
