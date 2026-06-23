'use client';

import { useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import type { GrantResult } from './SquadhubPicker';

export default function AccessApprovedDialog({
  result,
  onManageAccess,
  onClose,
}: {
  result: GrantResult;
  onManageAccess: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const { firstName, message } = useMemo(() => {
    const name = result.staff.name || result.user.name || 'there';
    const first = name.split(' ')[0];
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const staffLoginUrl = `${origin}/staff/login`;
    const msg = [
      `Hi ${first},`,
      ``,
      `You've been granted staff access to the SquadHire admin.`,
      ``,
      `Sign in here: ${staffLoginUrl}`,
      `Click "Sign in with SquadHub" and use your existing SquadHub email and password — no separate password needed.`,
      ``,
      `You'll only see the areas you've been given access to.`,
    ].join('\n');
    return { firstName: first, message: msg };
  }, [result]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — user can still select the text manually */
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100">
          <svg className="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path
              fillRule="evenodd"
              d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.1 3.1 6.8-6.8a1 1 0 0 1 1.4 0Z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Access approved</p>
          <p className="mt-0.5 text-sm text-gray-500">
            {result.staff.name} can now sign in to the staff portal with their SquadHub account.
            Assign which modules they can see, then send them the note below.
          </p>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium text-gray-700">Message for {firstName}</label>
          <button
            type="button"
            onClick={copy}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            {copied ? 'Copied ✓' : 'Copy message'}
          </button>
        </div>
        <textarea
          readOnly
          value={message}
          rows={8}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs leading-relaxed text-gray-700 outline-none"
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onClose}>
          Done
        </Button>
        <Button type="button" onClick={onManageAccess}>
          Assign modules
        </Button>
      </div>
    </div>
  );
}
