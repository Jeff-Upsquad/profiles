'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTalentMe } from '@/hooks/useTalentMe';

export default function TalentSidebarFooter() {
  const { user, logout } = useAuth();
  const { data: me } = useTalentMe();
  const [showContactDetails, setShowContactDetails] = useState(true);

  if (!user) return null;

  const displayName = user.full_name || me?.full_name || user.email;

  return (
    <div className="border-t border-gray-100 p-3">
      <div className="mb-2 px-1">
        <button
          type="button"
          onClick={() => setShowContactDetails((visible) => !visible)}
          aria-expanded={showContactDetails}
          aria-label={showContactDetails ? 'Hide email' : 'Show email'}
          className="flex w-full items-center justify-between gap-2 rounded-md py-0.5 text-left"
        >
          <span className="truncate text-sm font-semibold text-zinc-900">{displayName}</span>
          <svg
            className={`h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform ${showContactDetails ? '' : 'rotate-180'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showContactDetails && (
          <p className="truncate text-[11px] text-zinc-500">{user.email}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => logout()}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Logout
      </button>
    </div>
  );
}
