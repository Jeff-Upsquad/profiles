'use client';

import { useEffect, useMemo, useState } from 'react';
import Badge from '@/components/ui/Badge';
import {
  useSquadhubDirectory,
  useCreateStaffFromSquadhub,
  type SquadhubDirectoryUser,
  type StaffSummary,
} from '@/hooks/useTeamAccess';

export interface GrantResult {
  staff: StaffSummary;
  user: SquadhubDirectoryUser;
}

function isPartner(u: SquadhubDirectoryUser): boolean {
  return u.user_type === 'partner' || u.user_type === 'partner_employee';
}

export default function SquadhubPicker({ onGranted }: { onGranted: (r: GrantResult) => void }) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Debounce the search so we don't hit SquadHub on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  const { data: users, isLoading, isError, error } = useSquadhubDirectory(debounced, true);
  const createFromSquadhub = useCreateStaffFromSquadhub();

  const groups = useMemo(() => {
    const internal: SquadhubDirectoryUser[] = [];
    const partners: SquadhubDirectoryUser[] = [];
    for (const u of users ?? []) (isPartner(u) ? partners : internal).push(u);
    return { internal, partners };
  }, [users]);

  function grant(u: SquadhubDirectoryUser) {
    setPendingId(u.id);
    createFromSquadhub.mutate(
      { squadhub_user_id: u.id, email: u.email, name: u.name },
      {
        onSuccess: (staff) => onGranted({ staff, user: u }),
        onSettled: () => setPendingId(null),
      },
    );
  }

  const section = (label: string, list: SquadhubDirectoryUser[]) =>
    list.length > 0 && (
      <div key={label}>
        <p className="px-1 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
          {label}
        </p>
        <ul className="divide-y divide-gray-100">
          {list.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 px-1 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{u.name}</p>
                <p className="truncate text-xs text-gray-500">{u.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {u.partner_org && <Badge variant="gray">{u.partner_org}</Badge>}
                <button
                  type="button"
                  onClick={() => grant(u)}
                  disabled={pendingId === u.id}
                  className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  {pendingId === u.id ? 'Granting…' : 'Grant access'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <div className="space-y-2">
      <input
        type="search"
        autoFocus
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search SquadHub by name or email…"
        className="h-11 w-full rounded-lg border border-gray-300 px-3.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
      />
      <p className="px-1 text-xs text-gray-500">
        Pick a SquadHub team member or partner employee. They&rsquo;ll sign in to the staff portal
        with their existing SquadHub login — no separate password.
      </p>

      <div className="max-h-72 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
            {(error as any)?.response?.data?.error || 'Could not load the SquadHub directory.'}
          </div>
        ) : !users?.length ? (
          <div className="py-10 text-center text-sm text-gray-500">
            {debounced ? 'No matching SquadHub users.' : 'No eligible SquadHub users found.'}
          </div>
        ) : (
          <>
            {section('Internal', groups.internal)}
            {section('Partner employees', groups.partners)}
          </>
        )}
      </div>
    </div>
  );
}
