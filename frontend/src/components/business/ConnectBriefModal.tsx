'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import ChipSelect from '@/components/ui/ChipSelect';
import {
  useConnectBriefCountries,
  useSubmitConnectBrief,
  type ConnectBriefPayload,
  type ConnectBriefRoleRequirement,
} from '@/hooks/useConnectBrief';
import {
  CONNECT_BRIEF_CATEGORIES,
  EXPERIENCE_LEVELS,
  PLAN_OPTIONS,
  LANGUAGES,
  WORKING_DAYS,
  DEFAULT_WORKING_DAYS,
  type ConnectBriefCategory,
  type ServiceType,
} from '@/constants/connectBriefCategories';

type Product = 'subscription' | 'assignment';

// Per-role requirement captured in the form. Strings for numeric inputs so
// half-typed values don't fight the input; parsed on submit.
interface RoleReq {
  tiers: string[];
  plan: string;
  budget: string;
  duration: string;
  note: string;
}

const emptyRoleReq: RoleReq = { tiers: [], plan: '', budget: '', duration: '', note: '' };

interface FormState {
  brand_name: string;
  business_nature: string;
  business_note: string;
  business_location: string;
  contact_name: string;
  email: string;
  phone: string;
  country_id: string;
  languages: string[];
  working_days: string[];
}

function initialForm(): FormState {
  return {
    brand_name: '',
    business_nature: '',
    business_note: '',
    business_location: '',
    contact_name: '',
    email: '',
    phone: '',
    country_id: '',
    languages: [],
    working_days: DEFAULT_WORKING_DAYS,
  };
}

export default function ConnectBriefModal({
  open,
  onClose,
  product,
}: {
  open: boolean;
  onClose: () => void;
  product: Product;
}) {
  const { user } = useAuth();
  const isAssignment = product === 'assignment';
  const noun = isAssignment ? 'assignment' : 'subscription';

  const countriesQuery = useConnectBriefCountries(open);
  const countries = countriesQuery.data ?? [];
  const submit = useSubmitConnectBrief();

  const [step, setStep] = useState<'category' | 'form' | 'done'>('category');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [roleSlugs, setRoleSlugs] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [roleReqs, setRoleReqs] = useState<Record<string, RoleReq>>({});
  const [pricingMode, setPricingMode] = useState<'priced' | 'unpriced'>('priced');
  const [error, setError] = useState('');
  // Portals need document — only render after mount (avoids SSR access).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const category: ConnectBriefCategory | null = useMemo(
    () => CONNECT_BRIEF_CATEGORIES.find((c) => c.id === categoryId) ?? null,
    [categoryId],
  );

  // (Re)initialise on open: reset to the category step and pre-fill contact +
  // brand from the signed-in business account.
  useEffect(() => {
    if (!open) return;
    setStep('category');
    setCategoryId(null);
    setRoleSlugs([]);
    setRoleReqs({});
    setPricingMode('priced');
    setError('');
    setForm({
      ...initialForm(),
      brand_name: user?.company_name ?? '',
      contact_name: user?.contact_person_name ?? user?.full_name ?? '',
      email: user?.contact_email ?? user?.email ?? '',
      phone: user?.contact_phone ?? '',
    });
  }, [open, user]);

  // Default the country to India (or the first country) once the list loads.
  useEffect(() => {
    if (!open || form.country_id || countries.length === 0) return;
    const india = countries.find((c) => c.name === 'India');
    setForm((prev) => ({ ...prev, country_id: india?.id ?? countries[0].id }));
  }, [open, countries, form.country_id]);

  // Escape to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  function chooseCategory(cat: ConnectBriefCategory) {
    setCategoryId(cat.id);
    // Single-role categories (e.g. Accountant) auto-select their only role.
    setRoleSlugs(cat.roles.length === 1 ? [cat.roles[0].slug] : []);
    setRoleReqs(
      Object.fromEntries(cat.roles.map((r) => [r.slug, { ...emptyRoleReq }])),
    );
    setError('');
    setStep('form');
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setRoleReq(slug: string, patch: Partial<RoleReq>) {
    setRoleReqs((prev) => ({ ...prev, [slug]: { ...prev[slug], ...patch } }));
  }

  function toggleRole(slug: string) {
    setRoleSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category) return;
    setError('');

    const selectedRoles = category.roles.filter((r) => roleSlugs.includes(r.slug));
    if (selectedRoles.length === 0) {
      setError('Please pick at least one service.');
      return;
    }
    if (!form.brand_name.trim() || !form.business_nature.trim() || !form.business_note.trim()) {
      setError('Please fill in your brand name, nature of business, and a short note.');
      return;
    }
    if (!form.contact_name.trim() || !form.email.trim() || !form.phone.trim()) {
      setError('Please provide a contact name, email, and phone number.');
      return;
    }
    if (form.languages.length === 0) {
      setError('Please pick at least one language.');
      return;
    }
    if (!isAssignment && form.working_days.length === 0) {
      setError('Please pick at least one working day.');
      return;
    }
    if (!form.country_id) {
      setError('Please select a country.');
      return;
    }

    // De-dupe service_types (two roles can map to the same one) and build the
    // role_requirements payload keyed by service_type.
    const serviceTypes: ServiceType[] = [];
    const roleRequirements: Partial<Record<ServiceType, ConnectBriefRoleRequirement>> = {};
    for (const role of selectedRoles) {
      if (!serviceTypes.includes(role.serviceType)) serviceTypes.push(role.serviceType);
      const req = roleReqs[role.slug] ?? emptyRoleReq;
      const entry: ConnectBriefRoleRequirement = {};
      if (req.tiers.length) entry.tiers = req.tiers;
      if (req.note.trim()) entry.note = req.note.trim();
      if (isAssignment) {
        const budget = req.budget.trim() ? Math.round(Number(req.budget)) : NaN;
        if (Number.isFinite(budget) && budget > 0) entry.budget = budget;
        if (req.duration.trim()) entry.duration = req.duration.trim();
        entry.pricing_mode = pricingMode;
      } else if (req.plan) {
        entry.plan = req.plan;
      }
      if (Object.keys(entry).length > 0) roleRequirements[role.serviceType] = entry;
    }

    const payload: ConnectBriefPayload = {
      service_types: serviceTypes,
      brand_name: form.brand_name.trim(),
      business_nature: form.business_nature.trim(),
      business_note: form.business_note.trim(),
      business_location: form.business_location.trim() || undefined,
      contact_name: form.contact_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      country_id: form.country_id,
      languages: form.languages,
      working_days: isAssignment ? [] : form.working_days,
      card_type: product,
      ...(Object.keys(roleRequirements).length > 0 ? { role_requirements: roleRequirements } : {}),
    };

    try {
      await submit.mutateAsync(payload);
      setStep('done');
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data
          ?.error ??
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not submit your request. Please try again.';
      setError(message);
    }
  }

  const countryOptions = countries.map((c) => ({ label: c.name, value: c.id }));
  const tierOptions = EXPERIENCE_LEVELS.map((l) => ({ label: l.label, value: l.value }));
  const planOptions = PLAN_OPTIONS.map((p) => ({ label: `${p.name} — ${p.hoursLabel}`, value: p.name }));
  const languageOptions = LANGUAGES.map((l) => ({ label: l, value: l }));
  const dayOptions = WORKING_DAYS.map((d) => ({ label: d, value: d }));

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-[#E7E7EA] bg-white shadow-xl sm:mx-4 sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#E7E7EA] px-5 py-4 sm:px-6">
          <div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#0a0a0a]">
              {step === 'done'
                ? 'Request received'
                : `Request ${isAssignment ? 'an assignment' : 'a subscription'}`}
            </h3>
            {step !== 'done' && (
              <p className="mt-0.5 text-sm text-[#737373]">
                {step === 'category'
                  ? 'Pick what you need — you can add more categories over time.'
                  : category?.label}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 rounded-lg p-1.5 text-[#a3a3a3] transition-colors hover:bg-[#f0f0f0] hover:text-[#0a0a0a]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {step === 'category' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {CONNECT_BRIEF_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => chooseCategory(cat)}
                  className="group flex items-start gap-3 rounded-xl border border-[#E7E7EA] bg-white p-4 text-left transition-all hover:border-[#0a0a0a] hover:shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                >
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#FFFAC2] text-[#0a0a0a]">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={cat.iconPath} />
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
                      {cat.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-[#737373]">
                      {cat.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {step === 'form' && category && (
            <form id="connect-brief-form" onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Roles — only when the category offers a choice */}
              {category.multiRole && (
                <SectionShell title="What do you need?" hint="Pick one or more services.">
                  <div className="space-y-2">
                    <ChipSelect
                      multi
                      options={category.roles.map((r) => ({ label: r.title, value: r.slug }))}
                      selected={roleSlugs}
                      onChange={(v) => setRoleSlugs(Array.isArray(v) ? v : [v])}
                    />
                    {roleSlugs.length === 0 && (
                      <p className="text-xs text-[#C97744]">Pick at least one to continue.</p>
                    )}
                  </div>
                </SectionShell>
              )}

              {/* Contact — pre-filled from the account */}
              <SectionShell title="Your contact" hint="Pre-filled from your account — edit if needed.">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setField('email', e.target.value)}
                    placeholder="you@company.com"
                  />
                  <Input
                    label="Phone"
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setField('phone', e.target.value)}
                    placeholder="+91 90000 00000"
                    helperText="Ideally a WhatsApp number"
                  />
                  <div className="sm:col-span-2">
                    <Input
                      label="Contact person"
                      required
                      value={form.contact_name}
                      onChange={(e) => setField('contact_name', e.target.value)}
                      placeholder="Full name"
                    />
                  </div>
                </div>
              </SectionShell>

              {/* Brand */}
              <SectionShell title="About your brand" hint="Helps us match the right talent.">
                <div className="space-y-4">
                  <Input
                    label="Brand name"
                    required
                    value={form.brand_name}
                    onChange={(e) => setField('brand_name', e.target.value)}
                    placeholder="Your brand name"
                  />
                  <Input
                    label="Nature of business"
                    required
                    value={form.business_nature}
                    onChange={(e) => setField('business_nature', e.target.value)}
                    placeholder="e.g. Retail, SaaS, Education"
                  />
                  <Textarea
                    label="Short note about the business"
                    required
                    rows={3}
                    value={form.business_note}
                    onChange={(e) => setField('business_note', e.target.value)}
                    placeholder="What you do, who you serve, what makes you different."
                  />
                  <Input
                    label="Location (optional)"
                    value={form.business_location}
                    onChange={(e) => setField('business_location', e.target.value)}
                    placeholder="City, area"
                  />
                </div>
              </SectionShell>

              {/* Pricing mode — assignment only, brief-level */}
              {isAssignment && (
                <SectionShell title="How do you want to price this?" hint="Choose whether talents see a set price or send their own offers.">
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {([
                      { value: 'priced' as const, title: 'Send with a price', desc: 'Talents can accept, decline, or counter.' },
                      { value: 'unpriced' as const, title: 'Invite offers', desc: 'No price shown — talents submit an offer.' },
                    ]).map((o) => {
                      const on = pricingMode === o.value;
                      return (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => setPricingMode(o.value)}
                          className={`rounded-xl border p-3.5 text-left transition ${
                            on ? 'border-[#0a0a0a] bg-[#FFFAC2]/40' : 'border-[#E7E7EA] bg-white hover:border-[#737373]'
                          }`}
                        >
                          <span className="block text-sm font-semibold text-[#0a0a0a]">{o.title}</span>
                          <span className="mt-0.5 block text-xs text-[#737373]">{o.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </SectionShell>
              )}

              {/* Requirement per selected role */}
              {roleSlugs.length > 0 && (
                <SectionShell
                  title={isAssignment ? 'Scope, budget & timeline' : 'Experience level & plan'}
                  hint="All optional — we can finalise on the call."
                >
                  <div className="space-y-4">
                    {category.roles
                      .filter((r) => roleSlugs.includes(r.slug))
                      .map((role) => {
                        const req = roleReqs[role.slug] ?? emptyRoleReq;
                        return (
                          <div key={role.slug} className="rounded-xl border border-[#E7E7EA] bg-[#FBFBFB] p-4">
                            <div className="mb-3 flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full bg-[#FFFAC2] ring-1 ring-[#0a0a0a]" />
                              <span className="text-sm font-semibold text-[#0a0a0a]">{role.title}</span>
                            </div>
                            <div className="space-y-4">
                              <ChipSelect
                                label="Experience level(s)"
                                multi
                                options={tierOptions}
                                selected={req.tiers}
                                onChange={(v) => setRoleReq(role.slug, { tiers: Array.isArray(v) ? v : [v] })}
                              />
                              {isAssignment ? (
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                  <Input
                                    label="Project budget"
                                    inputMode="numeric"
                                    value={req.budget}
                                    onChange={(e) => setRoleReq(role.slug, { budget: e.target.value.replace(/[^0-9]/g, '') })}
                                    placeholder="e.g. 50000"
                                  />
                                  <Input
                                    label="Duration / timeline"
                                    value={req.duration}
                                    onChange={(e) => setRoleReq(role.slug, { duration: e.target.value })}
                                    placeholder="e.g. 4 weeks"
                                  />
                                </div>
                              ) : (
                                <Select
                                  label="Plan"
                                  placeholder="Select a weekly plan"
                                  options={planOptions}
                                  value={req.plan}
                                  onChange={(e) => setRoleReq(role.slug, { plan: e.target.value })}
                                />
                              )}
                              <Textarea
                                label={isAssignment ? 'Scope & deliverables' : 'Short note'}
                                rows={2}
                                value={req.note}
                                onChange={(e) => setRoleReq(role.slug, { note: e.target.value })}
                                placeholder={isAssignment ? 'Describe the project scope and deliverables.' : "Explain the kind of work you're looking to get done."}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </SectionShell>
              )}

              {/* Talent preferences */}
              <SectionShell title="Talent preferences" hint="Where they're based, what they speak, and when they work.">
                <div className="space-y-4">
                  <Select
                    label="Country"
                    required
                    placeholder={countriesQuery.isLoading ? 'Loading…' : 'Select a country'}
                    options={countryOptions}
                    value={form.country_id}
                    onChange={(e) => setField('country_id', e.target.value)}
                  />
                  <ChipSelect
                    label="Languages"
                    required
                    multi
                    options={languageOptions}
                    selected={form.languages}
                    onChange={(v) => setField('languages', Array.isArray(v) ? v : [v])}
                  />
                  {!isAssignment && (
                    <ChipSelect
                      label="Working days"
                      required
                      multi
                      options={dayOptions}
                      selected={form.working_days}
                      onChange={(v) => setField('working_days', Array.isArray(v) ? v : [v])}
                    />
                  )}
                </div>
              </SectionShell>
            </form>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFFAC2]">
                <svg className="h-8 w-8 text-[#0a0a0a]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">
                Thank you!
              </h4>
              <p className="mt-1.5 max-w-sm text-sm text-[#737373]">
                Your {noun} request is in. Our team will review it and reach out within one business day.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[#E7E7EA] px-5 py-4 sm:px-6">
          {step === 'form' ? (
            <>
              <Button type="button" variant="ghost" onClick={() => setStep('category')}>
                Back
              </Button>
              <Button
                type="submit"
                form="connect-brief-form"
                loading={submit.isPending}
                disabled={submit.isPending}
              >
                Submit request
              </Button>
            </>
          ) : step === 'done' ? (
            <Button type="button" className="ml-auto" onClick={onClose}>
              Done
            </Button>
          ) : (
            <Button type="button" variant="ghost" className="ml-auto" onClick={onClose}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Lightweight labelled section used throughout the form.
function SectionShell({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h4 className="font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
        {title}
      </h4>
      {hint && <p className="mb-3 mt-0.5 text-xs text-[#737373]">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </section>
  );
}
