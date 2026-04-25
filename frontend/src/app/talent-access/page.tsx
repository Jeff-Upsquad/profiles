'use client';

import { useState } from 'react';
import { useTalentAccessSession } from '@/hooks/useTalentAccess';
import TalentAccessLogin from '@/views/talent-access/TalentAccessLogin';
import TalentAccessBrowse from '@/views/talent-access/TalentAccessBrowse';

export default function TalentAccessPage() {
  const { meta, ready } = useTalentAccessSession();
  // `tick` forces re-read of localStorage after login/logout — useTalentAccessSession
  // already listens for storage events but a same-tab nudge is safer.
  const [, setTick] = useState(0);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
      </div>
    );
  }

  if (!meta) {
    return <TalentAccessLogin onSuccess={() => setTick((t) => t + 1)} />;
  }

  return <TalentAccessBrowse meta={meta} onLogout={() => setTick((t) => t + 1)} />;
}
