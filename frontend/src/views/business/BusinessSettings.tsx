'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import toast from 'react-hot-toast';

export default function BusinessSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    company_name: '',
    company_website: '',
    industry: '',
    company_size: '',
    contact_person_name: '',
    contact_email: '',
    contact_phone: '',
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data } = await api.get('/business/me');
        const info = data.business ?? data;
        setForm({
          company_name: info.company_name ?? '',
          company_website: info.company_website ?? '',
          industry: info.industry ?? '',
          company_size: info.company_size ?? '',
          contact_person_name: info.contact_person_name ?? '',
          contact_email: info.contact_email ?? '',
          contact_phone: info.contact_phone ?? '',
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
      await api.put('/business/me', form);
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
                Public details that show up in talent communications.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Input
              label="Company Name"
              value={form.company_name}
              onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))}
              required
            />
            <Input label="Email" value={user?.email ?? ''} disabled />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Company Website"
                value={form.company_website}
                onChange={(e) => setForm((p) => ({ ...p, company_website: e.target.value }))}
                placeholder="https://example.com"
              />
              <Input
                label="Industry"
                value={form.industry}
                onChange={(e) => setForm((p) => ({ ...p, industry: e.target.value }))}
              />
            </div>
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
                Whoever talents should reach out to.
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
              <Input
                label="Contact Phone"
                value={form.contact_phone}
                onChange={(e) => setForm((p) => ({ ...p, contact_phone: e.target.value }))}
              />
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
