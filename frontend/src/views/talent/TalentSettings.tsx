import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import LanguagePicker, { type LanguageEntry } from '@/components/forms/LanguagePicker';
import toast from 'react-hot-toast';

export default function TalentSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    age: '',
    current_location: '',
    native_place: '',
  });
  const [languages, setLanguages] = useState<LanguageEntry[]>([]);
  const [initial, setInitial] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data } = await api.get('/talent/me');
        const info = data.talent ?? data;
        const next = {
          full_name: info.full_name ?? '',
          phone: info.phone ?? '',
          age: info.age?.toString() ?? '',
          current_location: info.current_location ?? '',
          native_place: info.native_place ?? '',
        };
        setForm(next);
        setLanguages(info.languages_spoken ?? []);
        setInitial(JSON.stringify({ form: next, languages: info.languages_spoken ?? [] }));
      } catch {
        // ignore
      }
    };
    loadProfile();
  }, []);

  const dirty = JSON.stringify({ form, languages }) !== initial;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put('/talent/me', {
        full_name: form.full_name,
        phone: form.phone,
        age: form.age ? Number(form.age) : undefined,
        current_location: form.current_location,
        native_place: form.native_place,
        languages_spoken: languages.filter((e) => e.language),
      });
      setInitial(JSON.stringify({ form, languages }));
      toast.success('Settings updated');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const initials = (form.full_name || user?.email || '?').split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      {/* Compact Hero */}
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-6 sm:px-7 sm:py-7">
        <div className="hero-content flex items-center gap-4">
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFF27A] via-[#0A0A0A] to-[#737373] text-white font-[family-name:var(--font-jakarta)] text-lg font-semibold shadow-[0_4px_12px_rgba(139,102,248,0.35)]">
              {initials}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 stagger-1">
              <span className="eyebrow-rainbow">Account Settings</span>
            </div>
            <h1 className="font-[family-name:var(--font-jakarta)] text-[22px] sm:text-[26px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a] stagger-2 truncate">
              {form.full_name || 'Your account'}
            </h1>
            <p className="mt-0.5 font-[family-name:var(--font-jakarta)] text-sm text-[#737373] stagger-3 truncate">
              {user?.email}
            </p>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Details */}
        <section className="rounded-2xl border border-[#E7E7EA] bg-white p-6 sm:p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="mb-5 flex items-start gap-3">
            <div className="tint-purple flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ color: 'var(--tint-icon)' }}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#0a0a0a]">
                Personal Details
              </h2>
              <p className="mt-0.5 text-sm text-[#737373]">Shared across all your profiles</p>
            </div>
          </div>

          <div className="space-y-4">
            <Input
              label="Full Name" required
              value={form.full_name}
              onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
            />
            <Input
              label="Email" value={user?.email ?? ''} disabled
              helperText="Email cannot be changed"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Phone (WhatsApp)" value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              />
              <Input
                label="Age" type="number" value={form.age}
                onChange={(e) => setForm((p) => ({ ...p, age: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Current Location" value={form.current_location}
                onChange={(e) => setForm((p) => ({ ...p, current_location: e.target.value }))}
              />
              <Input
                label="Native Place" value={form.native_place}
                onChange={(e) => setForm((p) => ({ ...p, native_place: e.target.value }))}
              />
            </div>
          </div>
        </section>

        {/* Languages */}
        <section className="rounded-2xl border border-[#E7E7EA] bg-white p-6 sm:p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="mb-5 flex items-start gap-3">
            <div className="tint-blue flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ color: 'var(--tint-icon)' }}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
            </div>
            <div>
              <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#0a0a0a]">
                Languages
              </h2>
              <p className="mt-0.5 text-sm text-[#737373]">Languages you speak fluently</p>
            </div>
          </div>
          <LanguagePicker value={languages} onChange={setLanguages} />
        </section>

        {/* Sticky save bar */}
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-[#E7E7EA] bg-white/95 backdrop-blur-md p-3 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)]">
          <div className="px-2 text-xs text-[#737373]">
            {dirty ? 'You have unsaved changes' : 'No changes yet'}
          </div>
          <button
            type="submit"
            disabled={loading || !dirty}
            className="btn-iridescent disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
