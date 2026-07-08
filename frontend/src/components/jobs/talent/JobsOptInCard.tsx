'use client';

import { useState, type KeyboardEvent } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
  useOptInToJobs,
  useOptOutOfJobs,
  useUpdateJobPreferences,
  type JobPreferences,
} from '@/hooks/useJobs';

// Opt-in gate + preferences form. mode='optin' renders the full pitch card
// with an "Opt in" CTA; mode='edit' renders the same form pre-filled, with
// Save + Opt out.

const JOB_TYPE_SUGGESTIONS = ['Full-time', 'Part-time', 'Internship', 'Contract'];

function TagInput({
  label,
  placeholder,
  values,
  onChange,
  suggestions,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (values.some((x) => x.toLowerCase() === v.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...values, v]);
    setDraft('');
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  const unusedSuggestions = (suggestions ?? []).filter(
    (s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div className="w-full">
      <label className="mb-1.5 block text-[13px] font-medium text-[#3F3F46]">{label}</label>
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[#E7E7EA] bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.05)] focus-within:border-[#0a0a0a] focus-within:ring-2 focus-within:ring-[#0a0a0a]/12">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full bg-[#F1F1F3] px-2.5 py-1 text-xs font-medium text-[#0a0a0a]"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-[#737373] hover:text-[#0a0a0a]"
              aria-label={`Remove ${v}`}
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => add(draft)}
          placeholder={values.length === 0 ? placeholder : ''}
          className="min-w-[8rem] flex-1 border-none bg-transparent py-0.5 text-sm text-[#0a0a0a] placeholder:text-[#a3a3a3] focus:outline-none"
        />
      </div>
      {unusedSuggestions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {unusedSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-dashed border-[#D4D4D4] px-2.5 py-0.5 text-[11px] font-medium text-[#737373] transition-colors hover:border-[#0a0a0a] hover:text-[#0a0a0a]"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function JobsOptInCard({
  mode,
  preferences,
  onDone,
}: {
  mode: 'optin' | 'edit';
  preferences?: JobPreferences;
  onDone?: () => void;
}) {
  const [districts, setDistricts] = useState<string[]>(preferences?.preferred_districts ?? []);
  const [jobTypes, setJobTypes] = useState<string[]>(preferences?.preferred_job_types ?? []);
  const [relocation, setRelocation] = useState<boolean>(preferences?.open_to_relocation ?? false);
  const [salary, setSalary] = useState<string>(
    preferences?.expected_salary_monthly != null ? String(preferences.expected_salary_monthly) : '',
  );
  const [notice, setNotice] = useState<string>(
    preferences?.notice_period_days != null ? String(preferences.notice_period_days) : '',
  );

  const optIn = useOptInToJobs();
  const optOut = useOptOutOfJobs();
  const update = useUpdateJobPreferences();
  const saving = optIn.isPending || update.isPending;

  const buildPayload = () => ({
    preferred_districts: districts,
    preferred_job_types: jobTypes,
    open_to_relocation: relocation,
    expected_salary_monthly: salary.trim() === '' ? null : Math.max(0, Math.round(Number(salary))),
    notice_period_days: notice.trim() === '' ? null : Math.max(0, Math.round(Number(notice))),
  });

  const handleSubmit = () => {
    const payload = buildPayload();
    if (mode === 'optin') {
      optIn.mutate(payload, { onSuccess: () => onDone?.() });
    } else {
      update.mutate(payload, { onSuccess: () => onDone?.() });
    }
  };

  return (
    <div className="rounded-2xl border border-[#E7E7EA] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {mode === 'optin' && (
        <div className="mb-5">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFFAC2]">
            <svg className="h-5 w-5 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">
            Get discovered for jobs
          </h2>
          <p className="mt-1 text-sm text-[#525252]">
            Opt in and businesses hiring full-time roles can reach you with job openings matched to
            your profile and the preferences below. You can opt out anytime.
          </p>
        </div>
      )}

      <div className="space-y-4">
        <TagInput
          label="Preferred districts"
          placeholder="Type a district and press Enter"
          values={districts}
          onChange={setDistricts}
        />
        <TagInput
          label="Job types"
          placeholder="e.g. Full-time"
          values={jobTypes}
          onChange={setJobTypes}
          suggestions={JOB_TYPE_SUGGESTIONS}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Expected salary (monthly)"
            type="number"
            min={0}
            placeholder="e.g. 25000"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
          />
          <Input
            label="Notice period (days)"
            type="number"
            min={0}
            placeholder="e.g. 30"
            value={notice}
            onChange={(e) => setNotice(e.target.value)}
          />
        </div>

        <div className="flex items-start justify-between gap-4 rounded-xl border border-[#E7E7EA] px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#0a0a0a]">Open to relocation</p>
            <p className="mt-0.5 text-xs text-[#737373]">
              Show me openings outside my preferred districts too.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={relocation}
            onClick={() => setRelocation((v) => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
              relocation ? 'bg-emerald-500' : 'bg-[#D4D4D4]'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                relocation ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        {mode === 'edit' ? (
          <button
            type="button"
            disabled={optOut.isPending}
            onClick={() => optOut.mutate(undefined, { onSuccess: () => onDone?.() })}
            className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
          >
            {optOut.isPending ? 'Opting out…' : 'Opt out of job openings'}
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {mode === 'edit' && onDone && (
            <Button variant="ghost" size="sm" onClick={onDone}>
              Cancel
            </Button>
          )}
          <Button size="sm" loading={saving} onClick={handleSubmit}>
            {mode === 'optin' ? 'Opt in to job openings' : 'Save preferences'}
          </Button>
        </div>
      </div>
    </div>
  );
}
