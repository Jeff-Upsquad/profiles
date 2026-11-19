'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface ThreadsTopBarMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon?: ReactNode;
}

interface ProfileNavigation {
  current: number;
  total: number;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
}

interface ThreadsTopBarProps {
  displayName: string;
  onBack: () => void;
  onShare?: () => void;
  menuItems?: ThreadsTopBarMenuItem[];
  navigation?: ProfileNavigation;
  /** Overrides displayName as the bar's title (admin preview shows "Profile"). */
  title?: string;
  /** Category name, shown after the "3 of 24" position in the subtitle. */
  subtitle?: string;
}

const roundButton =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors sm:border sm:border-zinc-200 sm:bg-white sm:hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-default';

export default function ThreadsTopBar({
  displayName,
  onBack,
  onShare,
  menuItems = [],
  navigation,
  title,
  subtitle,
}: ThreadsTopBarProps) {
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

  // Combine the admin share action with any additional menu items.
  const allMenuItems: ThreadsTopBarMenuItem[] = [
    ...(onShare
      ? [
          {
            label: 'Share Profile',
            onClick: onShare,
            disabled: false,
            icon: (
              <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
            ),
          },
        ]
      : []),
    ...menuItems,
  ];

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
        {allMenuItems.length > 0 && (
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
                className="absolute right-0 top-12 z-40 min-w-[190px] overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg"
              >
                {allMenuItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => {
                      setMenuOpen(false);
                      item.onClick();
                    }}
                    className="flex h-10 w-full items-center gap-2.5 px-3.5 text-left text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-40"
                  >
                    {item.icon}
                    <span>{item.label}</span>
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
