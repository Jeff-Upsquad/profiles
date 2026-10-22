'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/services/api';
import Modal from '@/components/ui/Modal';
import type { StageInactivity } from '@/types';

function days(n: number): string {
  return `${n} day${n === 1 ? '' : 's'}`;
}

/**
 * Shown in place of every talent page while an application is inactive (a
 * stage time limit ran out). Reactivating restarts the stage's clock.
 */
export default function InactiveLockout({
  items,
  onReactivated,
}: {
  items: StageInactivity[];
  onReactivated: () => Promise<void>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const reactivate = async () => {
    setSaving(true);
    try {
      await api.post('/talent/me/reactivate');
      await onReactivated();
      setConfirmOpen(false);
      toast.success('Your profile is active again');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not reactivate. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl py-6">
      <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm sm:p-6" role="alert">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="mt-4 text-lg font-semibold text-gray-900">Your profile is inactive</h1>
        <div className="mt-2 space-y-2">
          {items.map((it) => (
            <p key={it.track} className="text-sm text-gray-700">
              Your <b>{it.program}</b> application has been inactive for{' '}
              <b>{it.days_inactive < 1 ? 'less than a day' : days(it.days_inactive)}</b> and will be cancelled in{' '}
              <b>{it.cancels_in}</b>.
            </p>
          ))}
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Everything is locked until you reactivate. Reactivate now to pick up where you left off.
        </p>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="mt-5 w-full rounded-xl bg-[#1B6CF2] px-4 py-3 text-sm font-semibold text-white hover:bg-[#155ad0] sm:w-auto"
        >
          Reactivate my profile
        </button>
      </div>

      <Modal open={confirmOpen} onClose={() => !saving && setConfirmOpen(false)} title="Before you continue">
        <div className="space-y-3">
          {items.map((it) => (
            <p key={it.track} className="text-sm text-gray-700">
              {it.task
                ? <>To keep your <b>{it.program}</b> application active, please {it.task}{' '}
                  {it.deadline ? <>within <b>{it.deadline}</b></> : 'as soon as possible'}.</>
                : <>Please complete your current step in <b>{it.program}</b> as soon as possible.</>}
            </p>
          ))}
          <p className="text-xs text-gray-500">If it isn&apos;t done in time, your profile will become inactive again.</p>
          <button
            type="button"
            onClick={reactivate}
            disabled={saving}
            className="w-full rounded-xl bg-[#1B6CF2] px-4 py-3 text-sm font-semibold text-white hover:bg-[#155ad0] disabled:opacity-60"
          >
            {saving ? 'Reactivating…' : 'OK, reactivate my profile'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
