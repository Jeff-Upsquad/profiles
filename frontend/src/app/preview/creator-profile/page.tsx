'use client';

// Preview of the Social Media Creator job profile form (Basic Information /
// Social Media Platforms / Services and Rates). Mirrors what a creator sees
// at /talent/profiles/create after picking the Social Media Creator category,
// without needing a login.
import { useState } from 'react';
import CreatorProfileDetails from '@/components/forms/CreatorProfileDetails';
import { validateCreatorProfile } from '@/constants/creator-profile';

export default function CreatorProfilePreviewPage() {
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Record<string, any> | null>(null);

  const handleChange = (key: string, value: any) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = () => {
    const nextErrors = validateCreatorProfile(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) setSubmitted(values);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F6] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6">
          <p className="font-[family-name:var(--font-inter)] text-[11px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
            Preview · Step 2 of 2 · New Profile
          </p>
          <h1 className="font-[family-name:var(--font-jakarta)] text-[22px] font-semibold tracking-[-0.025em] text-[#0a0a0a] sm:text-[26px]">
            Social Media Creator
          </h1>
          <p className="mt-1 text-sm text-[#737373]">
            This is the creator job profile form — Skills &amp; Tools and Languages are gone, replaced by the three structured sections below.
          </p>
        </section>

        <CreatorProfileDetails values={values} onChange={handleChange} errors={errors} />

        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E7E7EA] bg-white/95 p-3 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)] backdrop-blur-md">
          <div className="px-2 text-xs text-[#737373]">
            {submitted ? 'Valid ✅ — check the JSON below' : 'Fill the sections and try Save & Submit to see validation.'}
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            className="btn-iridescent"
          >
            Save &amp; Submit
          </button>
        </div>

        {submitted && (
          <section className="rounded-2xl border border-[#E7E7EA] bg-white p-5">
            <h2 className="mb-2 font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
              field_data payload
            </h2>
            <pre className="max-h-96 overflow-auto rounded-xl bg-[#0a0a0a] p-4 text-xs leading-relaxed text-emerald-200">
              {JSON.stringify(submitted, null, 2)}
            </pre>
          </section>
        )}
      </div>
    </div>
  );
}
