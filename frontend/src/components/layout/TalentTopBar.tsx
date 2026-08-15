'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useTalentMe } from '@/hooks/useTalentMe';

/**
 * Mobile-only top bar: brand left, profile avatar right.
 * Replaces the hamburger drawer as the place to reach account + logout.
 */
export default function TalentTopBar() {
  const { user, logout } = useAuth();
  const { data: me } = useTalentMe();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const displayName = user?.full_name || me?.full_name || user?.email || '';
  const displayEmail = user?.email || '';
  const photoUrl = me?.profile_photo_url;
  const initials = (displayName || 'T')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || 'T';

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;

  return (
    <header className="sticky top-0 z-40 -mx-4 mb-4 border-b border-[#E7E7EA] bg-white/95 px-4 py-2.5 backdrop-blur-sm md:hidden">
      <div className="flex items-center justify-between gap-3">
        <Link href="/talent/dashboard" className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0a0a0a] text-[11px] font-bold text-white">
            SH
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate font-[family-name:var(--font-jakarta)] text-[14px] font-semibold tracking-[-0.02em] text-[#0a0a0a]">
              SquadHire
            </p>
            <p className="truncate text-[10px] text-[#a3a3a3]">Powered by UpSquad</p>
          </div>
        </Link>

        <div className="relative">
          <button
            ref={btnRef}
            type="button"
            aria-label="Account menu"
            aria-expanded={open}
            aria-haspopup="menu"
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#0a0a0a] text-[12px] font-semibold text-white ring-2 ring-white shadow-sm transition active:scale-95"
          >
            {photoUrl ? (
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </button>

          {open && (
            <div
              ref={menuRef}
              role="menu"
              className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-[#E7E7EA] bg-white py-1 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.22)]"
            >
              <div className="border-b border-[#E7E7EA] px-3.5 py-3">
                {displayName && (
                  <p className="truncate text-sm font-semibold text-[#0a0a0a]">{displayName}</p>
                )}
                {displayEmail && (
                  <p className="mt-0.5 truncate text-[12px] text-[#737373]">{displayEmail}</p>
                )}
              </div>
              <Link
                href="/talent/basic-profile"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-[#0a0a0a] transition-colors hover:bg-[#F5F5F6]"
              >
                <svg className="h-4 w-4 text-[#737373]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Basic profile
              </Link>
              <Link
                href="/talent/settings"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-[#0a0a0a] transition-colors hover:bg-[#F5F5F6]"
              >
                <svg className="h-4 w-4 text-[#737373]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826 3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Account settings
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium text-[#0a0a0a] transition-colors hover:bg-[#F5F5F6]"
              >
                <svg className="h-4 w-4 text-[#737373]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
