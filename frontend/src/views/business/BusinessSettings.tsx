'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import toast from 'react-hot-toast';

const COUNTRY_CODES = [
  { code: '+91', flag: '🇮🇳' },
  { code: '+1', flag: '🇺🇸' },
  { code: '+44', flag: '🇬🇧' },
  { code: '+971', flag: '🇦🇪' },
  { code: '+65', flag: '🇸🇬' },
  { code: '+61', flag: '🇦🇺' },
  { code: '+49', flag: '🇩🇪' },
  { code: '+33', flag: '🇫🇷' },
  { code: '+81', flag: '🇯🇵' },
  { code: '+86', flag: '🇨🇳' },
];

function splitPhone(stored: string | null | undefined): { code: string; number: string } {
  const fallback = { code: '+91', number: '' };
  if (!stored) return fallback;
  const trimmed = stored.trim();
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const c of sorted) {
    if (trimmed.startsWith(c.code)) {
      return { code: c.code, number: trimmed.slice(c.code.length).trim() };
    }
  }
  return { code: fallback.code, number: trimmed };
}

export default function BusinessSettings() {
  const { user, refetchUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    company_name: '',
    company_website: '',
    industry: '',
    company_size: '',
    business_note: '',
    business_location: '',
    contact_person_name: '',
    contact_email: '',
    country_code: '+91',
    phone: '',
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data } = await api.get('/business/me');
        const info = data.business ?? data;
        const phone = splitPhone(info.contact_phone);
        setForm({
          company_name: info.company_name ?? '',
          company_website: info.company_website ?? '',
          industry: info.industry ?? '',
          company_size: info.company_size ?? '',
          business_note: info.business_note ?? '',
          business_location: info.business_location ?? '',
          contact_person_name: info.contact_person_name ?? '',
          contact_email: info.contact_email ?? '',
          country_code: phone.code,
          phone: phone.number,
        });
      } catch {
        // ignore
      }
    };
    loadProfile();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const contact_phone = form.phone.trim()
        ? `${form.country_code} ${form.phone.trim()}`.trim()
        : '';
      await api.put('/business/me', {
        company_name: form.company_name,
        company_website: form.company_website,
        industry: form.industry,
        company_size: form.company_size || undefined,
        business_note: form.business_note,
        business_location: form.business_location,
        contact_person_name: form.contact_person_name,
        contact_email: form.contact_email,
        contact_phone,
      });
      await refetchUser();
      toast.success('Settings updated');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <section className="hero-container hero-glow-blue relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-6 sm:px-7 sm:py-7">
        <div className="hero-content flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2.5 stagger-1">
              <span className="eyebrow-rainbow">Account</span>
            </div>
            <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a] stagger-2">
              Company <span className="text-rainbow">settings</span>.
            </h1>
            <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252] stagger-3">
              Keep your company profile and contact details up to date.
            </p>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Company section ── */}
        <section className="rounded-2xl border border-[#E7E7EA] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="mb-5 flex items-start gap-4">
            <div className="tint-purple flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl">
              <svg
                className="h-5 w-5"
                style={{ color: 'var(--tint-icon)' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#0a0a0a]">
                Company
              </h2>
              <p className="mt-0.5 text-sm text-[#737373]">
                Public details that show up in talent communications and requirement forms.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Input
              label="Brand Name"
              value={form.company_name}
              onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))}
              required
            />
            <Input label="Login Email" value={user?.email ?? ''} disabled />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Company Website"
                value={form.company_website}
                onChange={(e) => setForm((p) => ({ ...p, company_website: e.target.value }))}
                placeholder="https://example.com"
              />
              <Input
                label="Nature of Business"
                value={form.industry}
                onChange={(e) => setForm((p) => ({ ...p, industry: e.target.value }))}
                placeholder="e.g. Retail, SaaS, Education"
              />
            </div>
            <Textarea
              label="Short Note About the Business"
              value={form.business_note}
              onChange={(e) => setForm((p) => ({ ...p, business_note: e.target.value }))}
              placeholder="What you do, who you serve, what makes you different."
              rows={3}
            />
            <Input
              label="Location of Business"
              value={form.business_location}
              onChange={(e) => setForm((p) => ({ ...p, business_location: e.target.value }))}
              placeholder="City, area"
            />
            <Select
              label="Company Size"
              value={form.company_size}
              onChange={(e) => setForm((p) => ({ ...p, company_size: e.target.value }))}
              options={[
                { label: '1-10 employees', value: '1-10' },
                { label: '11-50 employees', value: '11-50' },
                { label: '51-200 employees', value: '51-200' },
                { label: '201-500 employees', value: '201-500' },
                { label: '500+ employees', value: '500+' },
              ]}
              placeholder="Select size..."
            />
          </div>
        </section>

        {/* ── Contact person section ── */}
        <section className="rounded-2xl border border-[#E7E7EA] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="mb-5 flex items-start gap-4">
            <div className="tint-green flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl">
              <svg
                className="h-5 w-5"
                style={{ color: 'var(--tint-icon)' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#0a0a0a]">
                Contact Person
              </h2>
              <p className="mt-0.5 text-sm text-[#737373]">
                Whoever talents should reach out to. Email and phone here also fill requirement forms.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Input
              label="Contact Person Name"
              value={form.contact_person_name}
              onChange={(e) => setForm((p) => ({ ...p, contact_person_name: e.target.value }))}
              required
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Contact Email"
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm((p) => ({ ...p, contact_email: e.target.value }))}
              />
              <div className="w-full">
                <label className="mb-1.5 block text-[13px] font-medium text-[#3F3F46]">
                  Contact Phone
                </label>
                <div className="flex overflow-hidden rounded-lg border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] focus-within:border-[#0a0a0a] focus-within:ring-2 focus-within:ring-[#0a0a0a]/12">
                  <select
                    value={form.country_code}
                    onChange={(e) => setForm((p) => ({ ...p, country_code: e.target.value }))}
                    className="shrink-0 border-0 bg-transparent py-2.5 pl-3 pr-1 text-sm text-[#0a0a0a] focus:outline-none"
                    aria-label="Country code"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>
                  <span className="my-2 w-px self-stretch bg-[#E7E7EA]" />
                  <input
                    type="tel"
                    inputMode="tel"
                    value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="Phone number"
                    className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm text-[#0a0a0a] placeholder:text-[#a3a3a3] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Sticky save bar ── */}
        <div className="sticky bottom-4 z-10">
          <div className="flex items-center justify-end gap-3 rounded-2xl border border-[#E7E7EA] bg-white/95 px-5 py-3 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.08)] backdrop-blur-sm">
            <p className="hidden text-xs text-[#737373] sm:block">
              Changes are saved to your account
            </p>
            <Button type="submit" loading={loading}>
              Save Changes
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
