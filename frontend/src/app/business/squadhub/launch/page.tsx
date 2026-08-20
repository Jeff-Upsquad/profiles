'use client';

import { useEffect, useRef, useState } from 'react';
import api from '@/services/api';

/**
 * Auto-login bridge into SquadHub.
 *
 * "Log in via website" on the SquadHub tab opens this page in a new tab rather
 * than linking straight to squadhub.in: the code has to be minted with the
 * business's session, and minting it before the click would leak a live code
 * into the page for every visitor. Opening a real URL in a new tab (instead of
 * fetching first and calling window.open) is also what keeps popup blockers out
 * of it.
 *
 * The mirror of SquadHub's /launch/squadhire page, which does exactly this in
 * the other direction for our /staff portal.
 */
export default function SquadHubLaunchPage() {
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const { data } = await api.post<{ redirect: string }>('/business/squadhub/sso/authorize');
        if (!data?.redirect) {
          setError('Could not open SquadHub. Please try again.');
          return;
        }
        window.location.replace(data.redirect);
      } catch (err: unknown) {
        const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setError(message || 'Could not open SquadHub. Please try again.');
      }
    })();
  }, []);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#0A0A0A]">
          <span className="font-[family-name:var(--font-jakarta)] text-[19px] font-extrabold tracking-tight text-white">
            SH
          </span>
        </div>
        <p
          className={`mt-4 font-[family-name:var(--font-inter)] text-[13px] leading-relaxed ${
            error ? 'text-[#B42318]' : 'text-[#525252]'
          }`}
        >
          {error || 'Signing you in to SquadHub…'}
        </p>
        {error && (
          <a
            href="https://squadhub.in"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#0a0a0a] px-4 py-2 text-[13px] font-semibold text-white"
          >
            Open squadhub.in
          </a>
        )}
      </div>
    </div>
  );
}
