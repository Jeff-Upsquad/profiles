'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import PartnerProgramPreference from '@/components/forms/PartnerProgramPreference';
import { useApplyForPartnerProgram, type PartnerTrack } from '@/hooks/usePartnerProgram';
import { useAuth } from '@/context/AuthContext';
import type { DayAvailableHours, DayHours } from '@/lib/workHours';

const TRACKS: { value: PartnerTrack; label: string; description: string }[] = [
  {
    value: 'partner_program',
    label: 'Subscriptions',
    description: 'Ongoing client work with a regular monthly commitment and payment.',
  },
  {
    value: 'freelance',
    label: 'Assignments',
    description: 'One-time or pay-per-project work with its own scope, deadline and payment.',
  },
];

function LockIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

/**
 * The header of a locked Partner module: why it's locked, and — for anyone who
 * hasn't applied — the application form itself, inline on the same page.
 *
 * Renders nothing for an approved partner, so callers can mount it
 * unconditionally above the real feed.
 */
export default function PartnerApplyPanel({
  variant,
}: {
  variant: 'subscription' | 'assignment';
}) {
  const { user, refetchUser } = useAuth();
  const apply = useApplyForPartnerProgram();
  const status = user?.partner_approval_status;

  const [open, setOpen] = useState(false);
  const [tracks, setTracks] = useState<PartnerTrack[]>(
    variant === 'assignment' ? ['freelance'] : ['partner_program'],
  );
  const [officeHours, setOfficeHours] = useState<DayHours[]>([]);
  const [dailyAvailable, setDailyAvailable] = useState<DayAvailableHours[]>([]);

  if (status === 'approved' || status === undefined) return null;

  const moduleLabel = variant === 'assignment' ? 'Assignments' : 'Subscriptions';

  // Already in the queue — show where the application stands, no form.
  if (status === 'pending') {
    return (
      <section className="rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:px-6">
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFFAC2] text-[#0a0a0a]">
            <LockIcon />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
              Your Partner Program application is under review
            </h2>
            <p className="mt-1 font-[family-name:var(--font-inter)] text-sm leading-relaxed text-[#525252]">
              {moduleLabel} stay read-only until you&apos;re approved. Browse the live
              opportunities below to see the kind of work coming through — you can apply to
              them once your application is approved.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/talent/training" className="btn-iridescent inline-flex px-4 py-2 text-sm">
                Continue training
              </Link>
              <Link
                href="/talent/contact-support"
                className="inline-flex rounded-lg border border-[#E7E7EA] px-4 py-2 text-sm font-semibold text-[#0a0a0a] transition-colors hover:bg-[#F5F5F6]"
              >
                Contact support
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const toggleTrack = (value: PartnerTrack) => {
    setTracks((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value],
    );
  };

  const handleSubmit = () => {
    if (apply.isPending) return;
    if (tracks.length === 0) {
      toast.error('Choose at least one kind of work');
      return;
    }
    const hours = officeHours.filter((h) => h.from && h.to);
    if (hours.length === 0) {
      toast.error('Set your office hours for at least one day');
      return;
    }
    apply.mutate(
      { tracks, virtual_office_hours: hours, daily_available_hours: dailyAvailable },
      {
        onSuccess: async () => {
          toast.success('Application submitted — we will review it shortly');
          setOpen(false);
          await refetchUser();
        },
        onError: (err: unknown) => {
          const message =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
          toast.error(message || 'Could not submit your application');
        },
      },
    );
  };

  const declined = status === 'rejected';

  return (
    <section className="overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="hero-glow-purple relative px-5 py-5 sm:px-6">
        <div className="relative flex flex-wrap items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFFAC2] text-[#0a0a0a]">
            <LockIcon />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-[family-name:var(--font-jakarta)] text-base font-semibold tracking-[-0.015em] text-[#0a0a0a]">
              {declined
                ? 'Your Partner Program application was declined'
                : 'Join the UpSquad Partner Program'}
            </h2>
            <p className="mt-1 font-[family-name:var(--font-inter)] text-sm leading-relaxed text-[#525252]">
              {declined
                ? `You can apply again below. Until you're approved, ${moduleLabel} stay read-only.`
                : `${moduleLabel} are read-only until an admin approves you. Apply below — then you can accept, bid on and negotiate the opportunities you see here.`}
            </p>
            {!open && (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="btn-iridescent mt-3 inline-flex px-4 py-2 text-sm"
              >
                {declined ? 'Apply again' : 'Apply for the Partner Program'}
                <svg className="arrow-icon h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {open && (
        <div className="space-y-8 border-t border-[#E7E7EA] px-5 py-6 sm:px-6">
          <div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
              What kind of work do you want? <span className="text-red-500">*</span>
            </h3>
            <p className="mb-4 mt-1 text-sm text-[#737373]">
              Pick one or both — you can change this later from your basic profile.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {TRACKS.map((t) => {
                const checked = tracks.includes(t.value);
                return (
                  <label
                    key={t.value}
                    className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
                      checked
                        ? 'border-[#0a0a0a] bg-[#FFFAC2]/40'
                        : 'border-[#E7E7EA] bg-white hover:border-[#0a0a0a]/40'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTrack(t.value)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[#0a0a0a]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[#0a0a0a]">{t.label}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-[#737373]">
                        {t.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <PartnerProgramPreference
            officeHours={officeHours}
            onOfficeHoursChange={setOfficeHours}
            dailyAvailable={dailyAvailable}
            onDailyAvailableChange={setDailyAvailable}
          />

          <div className="flex flex-wrap items-center gap-3 border-t border-[#E7E7EA] pt-5">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={apply.isPending}
              className="btn-iridescent inline-flex px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {apply.isPending ? 'Submitting…' : 'Submit application'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={apply.isPending}
              className="inline-flex rounded-lg border border-[#E7E7EA] px-4 py-2.5 text-sm font-semibold text-[#525252] transition-colors hover:bg-[#F5F5F6] disabled:opacity-60"
            >
              Cancel
            </button>
            <p className="text-xs text-[#737373]">An admin reviews every application.</p>
          </div>
        </div>
      )}
    </section>
  );
}
