'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';

export interface ThreadsTopBarMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon?: ReactNode;
}

interface ThreadsTopBarProps {
  displayName: string;
  onBack: () => void;
  onShare?: () => void;
  menuItems?: ThreadsTopBarMenuItem[];
}

export default function ThreadsTopBar({
  displayName,
  onBack,
  onShare,
  menuItems = [],
}: ThreadsTopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  // Combine onShare with any additional menu items
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

  return (
    <div className="flex items-center justify-between px-4 sm:px-6 py-3 mt-2">
      <button
        onClick={onBack}
        aria-label="Back"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white border border-zinc-200 shadow-sm transition-colors hover:bg-zinc-50"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-zinc-950"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <span className="font-bold text-[17px] text-zinc-950 tracking-tight truncate max-w-[200px]">
        {displayName}
      </span>

      <div ref={menuRef} className="relative">
        <button
          type="button"
          aria-label="More options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => {
            setMenuOpen((o) => !o);
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white border border-zinc-200 shadow-sm transition-colors hover:bg-zinc-50 focus:outline-none"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-zinc-950"
          >
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>

        {menuOpen && allMenuItems.length > 0 && (
          <div
            role="menu"
            className="absolute right-0 top-11 z-50 min-w-[190px] overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg"
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
    </div>
  );
}
