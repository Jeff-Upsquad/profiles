'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import AdditionalRequirementsField, { type AdditionalRequirements } from './AdditionalRequirementsField';

type Product = 'subscription' | 'assignment';
type Country = { id: string; name: string; currency: string; sort_order: number };
const PREVIEW_COUNTRIES: Country[] = [
  { id: 'preview-india', name: 'India', currency: 'INR', sort_order: 1 },
  { id: 'preview-united-states', name: 'United States', currency: 'USD', sort_order: 2 },
  { id: 'preview-united-kingdom', name: 'United Kingdom', currency: 'GBP', sort_order: 3 },
  { id: 'preview-united-arab-emirates', name: 'United Arab Emirates', currency: 'AED', sort_order: 4 },
  { id: 'preview-singapore', name: 'Singapore', currency: 'SGD', sort_order: 5 },
  { id: 'preview-australia', name: 'Australia', currency: 'AUD', sort_order: 6 },
  { id: 'preview-canada', name: 'Canada', currency: 'CAD', sort_order: 7 },
];
type FormState = {
  contactName: string;
  email: string;
  phone: string;
  brandName: string;
  businessNature: string;
  businessNote: string;
  requirement: string;
  channels: string[];
  objectives: string[];
  tiers: string[];
  plan: string;
  tierBudgets: Record<string, string>;
  currency: string;
  mediaSpend: string;
  mediaSpendCurrency: string;
  duration: string;
  startDate: string;
  deadline: string;
  countryId: string;
  stateRegions: string[];
  workingDays: string[];
  languages: string[];
  additionalRequirements: Record<string, AdditionalRequirements>;
};

const STATES_BY_COUNTRY: Record<string, string[]> = {
  India: ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh'],
  'United States': ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming', 'District of Columbia'],
  'United Kingdom': ['England', 'Northern Ireland', 'Scotland', 'Wales'],
  'United Arab Emirates': ['Abu Dhabi', 'Ajman', 'Dubai', 'Fujairah', 'Ras Al Khaimah', 'Sharjah', 'Umm Al Quwain'],
  Singapore: ['Central', 'East', 'North', 'North-East', 'West'],
  Australia: ['Australian Capital Territory', 'New South Wales', 'Northern Territory', 'Queensland', 'South Australia', 'Tasmania', 'Victoria', 'Western Australia'],
  Canada: ['Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador', 'Nova Scotia', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan', 'Northwest Territories', 'Nunavut', 'Yukon'],
};

const CHANNELS = ['Meta Ads', 'Google Ads', 'LinkedIn Ads', 'YouTube Ads', 'Amazon Ads', 'ChatGPT Ads'];
const OBJECTIVES = ['Lead generation', 'Sales / ROAS', 'App installs', 'Brand awareness', 'Retargeting'];
const TIER_OPTIONS = [
  { value: 'Junior', label: 'Juniors', desc: 'Less than 2 years of experience. Great for straightforward campaign work and cost-effective execution.' },
  { value: 'Pro', label: 'Pros', desc: 'More than 2 years of experience with strong, well-rounded paid media skills.' },
  { value: 'Top Talents', label: 'Top Talents', desc: '5+ years of experience. Best for complex, high-stakes, or premium growth campaigns.' },
  { value: 'Agencies', label: 'Agencies', desc: 'Specialized paid-media teams that can manage multiple channels and deliverables.' },
];
const PLANS = [
  { name: 'Starter', dailyHours: '1 hr', weeklyMax: '5 hrs', monthlyMax: '20 hrs', pct: '10%', capacity: 'Light-touch campaign support', tagline: 'For brands starting paid acquisition.', bestFor: 'Small brands & startups' },
  { name: 'Basic', dailyHours: '2 hrs', weeklyMax: '10 hrs', monthlyMax: '40 hrs', pct: '25%', capacity: 'Quarter of a full-time specialist', tagline: 'Consistent support at an affordable level.', bestFor: 'Active brands' },
  { name: 'Plus', dailyHours: '4 hrs', weeklyMax: '20 hrs', monthlyMax: '80 hrs', pct: '50%', capacity: 'Half specialist capacity', tagline: 'Faster execution with elevated priority.', bestFor: 'Scaling acquisition teams', recommended: true },
  { name: 'Pro', dailyHours: '6 hrs', weeklyMax: '30 hrs', monthlyMax: '120 hrs', pct: '80%', capacity: 'Nearly full-time specialist', tagline: 'High-volume execution and optimisation.', bestFor: 'Growing businesses' },
  { name: 'Personal', dailyHours: '8 hrs', weeklyMax: '40 hrs', monthlyMax: '160 hrs', pct: '100%', capacity: 'Dedicated full-time equivalent', tagline: 'Your own dedicated ads specialist.', bestFor: 'Performance-led organisations' },
];
const CURRENCIES = [
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'AED', label: 'AED — UAE Dirham' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Urdu', 'Arabic', 'Spanish', 'French', 'German', 'Mandarin'];

const emptyForm: FormState = {
  contactName: '', email: '', phone: '', brandName: '', businessNature: '', businessNote: '',
  requirement: '', channels: ['Meta Ads', 'Google Ads'], objectives: ['Lead generation'],
  tiers: ['Pro'], plan: 'Plus', tierBudgets: {}, currency: 'INR', mediaSpend: '', mediaSpendCurrency: 'INR',
  duration: '6 weeks', startDate: '2026-09-14', deadline: '2026-10-25',
  countryId: '', stateRegions: [], workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], languages: ['English'],
  additionalRequirements: {},
};

export default function AdsSpecialistBriefForm({ product = 'subscription', preview = false }: { product?: Product; preview?: boolean }) {
  const { user } = useAuth();
  const isAssignment = product === 'assignment';
  const [form, setForm] = useState<FormState>(() => preview ? {
    ...emptyForm,
    contactName: 'Jeff', email: 'jeff@tagconnects.in', phone: '+91 9645545553',
    mediaSpend: '800000',
    tierBudgets: { Pro: '85000' },
    additionalRequirements: { ads_specialist: { skills: ['Paid media strategy'], tools: ['GA4', 'Google Tag Manager', 'Looker Studio'] } },
    brandName: 'Northstar Learning', businessNature: 'Online education and professional upskilling',
    businessNote: 'We help working professionals build practical growth and leadership skills through cohort-based programmes.',
    requirement: isAssignment
      ? 'Audit our paid acquisition setup, rebuild conversion tracking, launch Q4 campaigns on Meta and Google, and deliver a 30-day scale playbook.'
      : 'Own paid acquisition across Meta and Google. Improve qualified demo bookings by 20% while keeping blended CAC below ₹3,200.',
  } : emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [countries, setCountries] = useState<Country[]>(() => preview ? PREVIEW_COUNTRIES : []);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [contactAutoFilled, setContactAutoFilled] = useState(preview);
  const [brandAutoFilled, setBrandAutoFilled] = useState(preview);
  const [editingContact, setEditingContact] = useState(!preview);
  const [editingBrand, setEditingBrand] = useState(!preview);
  const [comparePlanOpen, setComparePlanOpen] = useState(false);
  const audioBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    api.get('/business/connect-brief/countries')
      .then((res) => res.data)
      .then((data) => {
        if (data.success && Array.isArray(data.data)) setCountries(data.data);
      })
      .catch(() => { /* location options are non-blocking */ });
  }, []);

  useEffect(() => {
    if (!user || preview) return;
    const savedContactName = user.contact_person_name || user.full_name || '';
    const savedEmail = user.contact_email || user.email || '';
    const savedPhone = user.contact_phone || '';
    const savedBrandName = user.company_name || '';
    const savedBusinessNature = user.industry || '';
    const savedBusinessNote = user.business_note || '';
    const hasContact = Boolean(savedContactName.trim() && savedEmail.trim() && savedPhone.trim());
    const hasBrand = Boolean(savedBrandName.trim() && savedBusinessNature.trim() && savedBusinessNote.trim());
    setContactAutoFilled(hasContact);
    setBrandAutoFilled(hasBrand);
    setEditingContact(!hasContact);
    setEditingBrand(!hasBrand);
    setForm((current) => ({
      ...current,
      contactName: current.contactName || savedContactName,
      email: current.email || savedEmail,
      phone: current.phone || savedPhone,
      brandName: current.brandName || savedBrandName,
      businessNature: current.businessNature || savedBusinessNature,
      businessNote: current.businessNote || savedBusinessNote,
    }));
  }, [preview, user]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggle(key: 'channels' | 'objectives' | 'tiers' | 'stateRegions' | 'workingDays' | 'languages', value: string) {
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value],
    }));
  }

  function changeCountry(countryId: string) {
    setForm((current) => ({ ...current, countryId, stateRegions: [] }));
  }

  const selectedCountryName = countries.find((country) => country.id === form.countryId)?.name ?? '';
  const stateOptions = STATES_BY_COUNTRY[selectedCountryName] ?? [];
  const contactComplete = Boolean(form.contactName.trim() && form.email.trim() && form.phone.trim());
  const brandComplete = Boolean(form.brandName.trim() && form.businessNature.trim() && form.businessNote.trim());

  function updateTierBudget(tier: string, value: string) {
    setForm((current) => ({ ...current, tierBudgets: { ...current.tierBudgets, [tier]: value.replace(/[^0-9]/g, '') } }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!form.contactName.trim() || !form.email.trim() || !form.phone.trim()) return setError('Add your contact name, email, and phone number.');
    if (!form.brandName.trim() || !form.businessNature.trim() || !form.businessNote.trim()) return setError('Complete the brand details before submitting.');
    if (!form.requirement.trim()) return setError('Describe what you need the Ads Specialist to own.');
    const mediaSpendAmount = Number(form.mediaSpend);
    if (!Number.isFinite(mediaSpendAmount) || mediaSpendAmount <= 0) return setError('Enter your current monthly ad spend.');
    if (form.channels.length === 0 || form.objectives.length === 0 || form.tiers.length === 0) return setError('Choose at least one channel, objective, and specialist level.');
    if (!isAssignment && (!form.plan || form.workingDays.length === 0)) return setError('Choose a monthly plan and working days.');
    if (form.languages.length === 0) return setError('Choose at least one language.');
    const tierBudgets = Object.fromEntries(form.tiers.flatMap((tier) => {
      const amount = Number(form.tierBudgets[tier]);
      return Number.isFinite(amount) && amount > 0 ? [[tier, Math.round(amount)]] : [];
    }));
    const tierBudgetValues = Object.values(tierBudgets);
    const legacyBudget = tierBudgetValues.length === 1 || tierBudgetValues.every((value) => value === tierBudgetValues[0]) ? tierBudgetValues[0] : undefined;
    const specificRequirements = form.additionalRequirements.ads_specialist ?? {};

    if (preview) {
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);
    try {
      let requirementVoiceUrl = '';
      if (audioBlobRef.current) {
        try {
          requirementVoiceUrl = await uploadVoiceNote(audioBlobRef.current);
        } catch (uploadError) {
          console.error('voice note upload failed', uploadError);
          setError('Your voice note couldn’t be uploaded. Check your connection and try again, or remove it to submit without audio.');
          return;
        }
      }
      await api.post('/business/connect-brief', {
        service_types: ['ads_specialist'],
        brand_name: form.brandName.trim(),
        business_nature: form.businessNature.trim(),
        business_note: form.businessNote.trim(),
        contact_name: form.contactName.trim(), email: form.email.trim(), phone: form.phone.trim(),
        ...(requirementVoiceUrl ? { requirement_voice_url: requirementVoiceUrl } : {}),
        languages: form.languages,
        working_days: isAssignment ? [] : form.workingDays,
        ...(form.countryId ? { country_id: form.countryId } : {}),
        state_regions: form.countryId ? form.stateRegions : [],
        card_type: product,
        role_requirements: {
          ads_specialist: {
            note: form.requirement.trim(), tiers: form.tiers,
            ...(isAssignment
              ? { ...(legacyBudget ? { budget: legacyBudget } : {}), ...(Object.keys(tierBudgets).length ? { tier_budgets: tierBudgets } : {}), currency: form.currency, duration: form.duration, start_date: form.startDate, deadline: form.deadline }
              : { plan: form.plan, ...(legacyBudget ? { budget: legacyBudget } : {}), ...(Object.keys(tierBudgets).length ? { tier_budgets: tierBudgets } : {}), currency: form.currency }),
            additional_requirements: {
              channels: form.channels,
              objectives: form.objectives,
              media_spend: [`${form.mediaSpendCurrency} ${Math.round(mediaSpendAmount)} / month`],
              ...specificRequirements,
            },
          },
        },
      });
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (caught) {
      const message = (caught as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message || 'Failed to submit. Please check the details and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return <div className="shb-connect-bg flex min-h-full items-center justify-center px-5 py-16"><div className="w-full max-w-md rounded-2xl border border-[#E8E5DD] bg-white p-8 text-center shadow-sm"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F2FCBC]"><CheckIcon /></div><h1 className="mt-4 text-xl font-semibold text-[#222]">Requirement ready</h1><p className="mt-2 text-sm leading-relaxed text-[#5C5C5C]">Your Ads Specialist {product} brief is ready for review and matching.</p><button type="button" onClick={() => setSubmitted(false)} className="shb-submit mt-6">Back to brief</button></div><style jsx global>{styles}</style></div>;
  }

  return (
    <div className="shb-connect-bg min-h-full px-4 py-7 sm:py-9">
      <div className="mx-auto max-w-[44rem]">
        {preview && <div className="mb-4 flex justify-center"><div className="inline-flex rounded-full border border-[#D9D5C7] bg-white p-1 text-xs font-semibold"><Link href="/preview/ad-specialist-requirements/subscription" className={`rounded-full px-3 py-1.5 ${!isAssignment ? 'bg-[#0a0a0a] text-white' : 'text-[#7A7568]'}`}>Subscription</Link><Link href="/preview/ad-specialist-requirements/assignment" className={`rounded-full px-3 py-1.5 ${isAssignment ? 'bg-[#0a0a0a] text-white' : 'text-[#7A7568]'}`}>Assignment</Link></div></div>}
        <header className="mb-7 text-center"><h1 className="text-[25px] font-semibold tracking-tight text-[#222] sm:text-[29px]">Tell us about your brand</h1><p className="mt-1.5 text-sm text-[#5C5C5C] sm:text-base">A few quick details so we can match you with the right Ads Specialist.</p></header>

        <form onSubmit={handleSubmit} className="space-y-6 pb-8">
          <button type="button" className="-ml-1 flex items-center gap-1 text-sm text-[#5C5C5C]"><BackIcon /> Back</button>
          <CategoryBanner product={product} />
          {error && <div className="rounded-xl border border-[#E0B7A2] bg-[#FBEFE9] px-4 py-3 text-sm text-[#8B3A1A]">{error}</div>}

          <GroupHeader index={1} title="Business details" subtitle="Who you are and how we reach you." />
          <Section
            eyebrow=""
            title="Customer details"
            hint=""
            compact={contactAutoFilled && contactComplete && !editingContact}
            action={contactAutoFilled && contactComplete ? { label: editingContact ? 'Done' : 'Edit', onClick: () => setEditingContact((value) => !value) } : undefined}
            summary={<CompactSummary title={`Contact person: ${form.contactName}`} details={[`Email: ${form.email}`, `Phone: ${form.phone}`]} />}
          >
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Email"><Readonly value={form.email} /><p className="shb-help">Edit in <span className="underline">account details</span></p></Field><Field label="Phone"><Readonly value={form.phone} /><p className="shb-help">Edit in <span className="underline">account details</span></p></Field></div>
            <Field label="Contact Person Name" required><input className="shb-input" value={form.contactName} onChange={(e) => update('contactName', e.target.value)} /></Field>
          </Section>
          <Section
            eyebrow=""
            title="Brand details"
            hint=""
            compact={brandAutoFilled && brandComplete && !editingBrand}
            action={brandAutoFilled && brandComplete ? { label: editingBrand ? 'Done' : 'Edit', onClick: () => setEditingBrand((value) => !value) } : undefined}
            summary={<CompactSummary title={`Brand name: ${form.brandName}`} details={[`Nature of business: ${form.businessNature}`, `About the brand: ${form.businessNote}`]} />}
          >
            <Field label="Brand Name" required><input className="shb-input" value={form.brandName} onChange={(e) => update('brandName', e.target.value)} placeholder="e.g. Northstar Learning" /></Field>
            <Field label="What does your business do?" required><input className="shb-input" value={form.businessNature} onChange={(e) => update('businessNature', e.target.value)} placeholder="e.g. Online education and professional upskilling" /></Field>
            <Field label="About the brand" required><textarea className="shb-input min-h-24 resize-y" value={form.businessNote} onChange={(e) => update('businessNote', e.target.value)} placeholder="Products, audience, positioning, and anything useful to know." /></Field>
          </Section>

          <GroupHeader index={2} title="Ads requirement" subtitle="The outcome, channels, and ownership you need." />
          <Section eyebrow="Requirement" title="What should your Ads Specialist own?" hint="Be specific about the commercial outcome and day-to-day responsibility.">
            <Field label="Describe your requirement" required><textarea className="shb-input min-h-32 resize-y" value={form.requirement} onChange={(e) => update('requirement', e.target.value)} placeholder="e.g. Own our Meta and Google acquisition, improve qualified leads, and report weekly on CAC and revenue." /></Field>
            <AudioNote
              audioUrl={audioUrl}
              onChange={(blob, url) => {
                audioBlobRef.current = blob;
                setAudioUrl(url);
              }}
            />
            <ChipField label="Advertising channels" options={CHANNELS} selected={form.channels} onToggle={(value) => toggle('channels', value)} />
            <ChipField label="Primary objectives" options={OBJECTIVES} selected={form.objectives} onToggle={(value) => toggle('objectives', value)} />
            <div>
              <p className="mb-1.5 text-sm font-medium text-[#222]">Current monthly ad spend<b className="text-[#D04A2C]">*</b></p>
              <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-2">
                <select aria-label="Ad spend currency" className="shb-input" value={form.mediaSpendCurrency} onChange={(e) => update('mediaSpendCurrency', e.target.value)}>
                  {CURRENCIES.map((currency) => <option key={currency.code} value={currency.code}>{currency.code}</option>)}
                </select>
                <input aria-label="Current monthly ad spend amount" className="shb-input" inputMode="numeric" placeholder="Enter monthly amount" value={formatMoneyInput(form.mediaSpend, form.mediaSpendCurrency)} onChange={(e) => update('mediaSpend', e.target.value.replace(/[^0-9]/g, ''))} />
              </div>
            </div>
          </Section>

          <Section eyebrow={isAssignment ? 'Assignment' : 'Subscription'} title={isAssignment ? 'Budget & timeline' : 'Plan, level & budget'} hint={isAssignment ? 'Set a clear project finish line.' : 'Choose how much specialist capacity you need each month.'}>
            {!isAssignment && <div><div className="mb-2 flex items-center justify-between gap-3"><p className="text-sm font-medium text-[#222]">Monthly plan<b className="text-[#D04A2C]">*</b></p><button type="button" onClick={() => setComparePlanOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#0a0a0a] bg-[#F2FCBC] px-3 py-1.5 text-xs font-bold text-[#0a0a0a] shadow-[2px_2px_0_#0a0a0a]"><CompareIcon />Compare all plans</button></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{PLANS.map((plan) => { const selected = form.plan === plan.name; return <button key={plan.name} type="button" aria-pressed={selected} onClick={() => update('plan', plan.name)} className={`shb-choice ${selected ? 'shb-choice-on' : ''}`}><strong>{plan.name}</strong><span className="shb-choice-daily">{plan.dailyHours} / day</span><span className="shb-choice-cap">{plan.weeklyMax} weekly max</span><span className="shb-choice-cap">{plan.monthlyMax} monthly max</span>{plan.recommended && <em>Popular</em>}</button>; })}</div><div className="shb-plan-note"><InfoIcon /><p><strong>Daily hours come first.</strong> Weekly and monthly figures are maximum caps, not saved-up balances. Unused time doesn&apos;t roll over.</p></div></div>}
            <Field label="Budget currency" required><select aria-label="Budget currency" className="shb-input" value={form.currency} onChange={(e) => update('currency', e.target.value)}>{CURRENCIES.map((currency) => <option key={currency.code} value={currency.code}>{currency.label}</option>)}</select></Field>
            <TierSelector product={product} currency={form.currency} selected={form.tiers} values={form.tierBudgets} onToggle={(value) => toggle('tiers', value)} onBudgetChange={updateTierBudget} />
            {isAssignment && <Field label="Duration"><input className="shb-input" value={form.duration} onChange={(e) => update('duration', e.target.value)} /></Field>}
            {isAssignment && <div className="grid gap-4 sm:grid-cols-2"><Field label="Start date"><input type="date" className="shb-input" value={form.startDate} onChange={(e) => update('startDate', e.target.value)} /></Field><Field label="Deadline"><input type="date" className="shb-input" value={form.deadline} onChange={(e) => update('deadline', e.target.value)} /></Field></div>}
          </Section>

          <GroupHeader index={3} title="Talent preferences" subtitle="Skills, tools, language, and working fit." />
          <Section eyebrow="Matching" title="Who you'd like to work with" hint="These preferences help us prioritise the best-fit profiles.">
            <Field label="Country" optional>
              <select aria-label="Country" className="shb-input" value={form.countryId} onChange={(e) => changeCountry(e.target.value)}>
                <option value="">Anywhere (no preference)</option>
                {countries.map((country) => <option key={country.id} value={country.id}>{country.name}</option>)}
              </select>
            </Field>
            {form.countryId && stateOptions.length > 0 && <ChipField label="State / region" options={stateOptions} selected={form.stateRegions} onToggle={(value) => toggle('stateRegions', value)} required={false} hint={`Choose one or more locations within ${selectedCountryName}, or leave blank for anywhere in the country.`} />}
            <ChipField label="Languages" options={LANGUAGES} selected={form.languages} onToggle={(value) => toggle('languages', value)} hint="Select the languages the specialist should be comfortable working in." />
            {!isAssignment && <WorkingDays selected={form.workingDays} onToggle={(value) => toggle('workingDays', value)} />}
            <AdditionalRequirementsField
              variant="embedded"
              roles={[{ slug: 'ads_specialist', label: 'Ads Specialist' }]}
              values={form.additionalRequirements}
              onChange={(slug, next) => setForm((current) => ({
                ...current,
                additionalRequirements: { ...current.additionalRequirements, [slug]: next },
              }))}
            />
          </Section>

          <div className="shb-submit-wrap"><button type="submit" disabled={submitting} className="shb-submit">{submitting ? 'Submitting…' : `Submit ${product} brief`}</button></div>
        </form>
      </div>
      {comparePlanOpen && <PlanCompareModal selectedPlan={form.plan} onSelect={(name) => update('plan', name)} onClose={() => setComparePlanOpen(false)} />}
      <style jsx global>{styles}</style>
    </div>
  );
}

async function uploadVoiceNote(blob: Blob): Promise<string> {
  const contentType = (blob.type || 'audio/webm').split(';')[0].trim() || 'audio/webm';
  const ext = contentType.includes('mp4') ? 'mp4' : contentType.includes('ogg') ? 'ogg' : contentType.includes('wav') ? 'wav' : 'webm';
  const { data } = await api.post('/business/connect-brief/voice-upload-url', {
    filename: `voice-note.${ext}`,
    content_type: contentType,
  });
  if (!data?.success || !data.data?.upload_url) throw new Error('Voice upload could not be prepared.');
  const upload = await fetch(data.data.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!upload.ok) throw new Error('Voice upload failed.');
  return data.data.public_url as string;
}

function AudioNote({ audioUrl, onChange }: {
  audioUrl: string | null;
  onChange: (blob: Blob | null, url: string | null) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canRecord = typeof navigator !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;

  function stopTimer() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function pickFile() {
    setError('');
    fileInputRef.current?.click();
  }

  function useAudioFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('audio/')) return setError('Please choose an audio recording.');
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setError('');
    onChange(file, URL.createObjectURL(file));
  }

  async function start() {
    setError('');
    if (!canRecord) return pickFile();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
      const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported?.(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      streamRef.current = stream;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        onChange(blob, URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    } catch (caught) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      const name = (caught as { name?: string })?.name;
      setError(name === 'NotAllowedError' || name === 'SecurityError'
        ? 'Microphone permission is blocked. Allow microphone access in Chrome, or tap Upload audio to use your phone recorder.'
        : 'Recording could not start. Tap Upload audio to use your phone recorder instead.');
    }
  }

  function stop() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    recorderRef.current = null;
    setRecording(false);
    stopTimer();
  }

  function clear() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    onChange(null, null);
    setElapsed(0);
    setError('');
  }

  useEffect(() => () => {
    stopTimer();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const formattedTime = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  return <div className="shb-audio-note">
    <input ref={fileInputRef} type="file" accept="audio/*" capture="user" className="hidden" onChange={useAudioFile} />
    {!audioUrl && !recording && <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={start} className="shb-audio-primary"><MicIcon /> Record a voice note <span>Optional</span></button><button type="button" onClick={pickFile} className="shb-audio-secondary">Upload audio</button></div>}
    {recording && <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm font-semibold"><i className="shb-recording-dot" />Recording… {formattedTime}</span><button type="button" onClick={stop} className="shb-audio-stop">■ Stop</button></div>}
    {audioUrl && !recording && <div className="space-y-3"><audio controls src={audioUrl} className="h-10 w-full" /><div className="flex gap-2"><button type="button" onClick={start} className="shb-audio-secondary">Re-record</button><button type="button" onClick={clear} className="shb-audio-secondary shb-audio-danger">Remove</button></div></div>}
    {error && <p className="mt-2 text-xs font-medium leading-relaxed text-[#8B3A1A]">{error}</p>}
  </div>;
}

function CategoryBanner({ product }: { product: Product }) { return <div className="shb-category"><div><p>{product} brief · category</p><span>✓ &nbsp;Ads Specialist</span></div><button type="button">Change</button></div>; }
function GroupHeader({ index, title, subtitle }: { index: number; title: string; subtitle: string }) { return <div className="flex items-start gap-3 pt-2"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#0a0a0a] bg-[#FCF487] text-base font-bold shadow-[2px_2px_0_#0a0a0a]">{index}</span><div><h2 className="text-lg font-bold text-[#0a0a0a]">{title}</h2><p className="text-sm text-[#7A7568]">{subtitle}</p></div></div>; }
function Section({ eyebrow, title, hint, children, compact = false, action, summary }: {
  eyebrow: string;
  title: string;
  hint: string;
  children: React.ReactNode;
  compact?: boolean;
  action?: { label: string; onClick: () => void };
  summary?: React.ReactNode;
}) { return <section className={`shb-section ${compact ? 'shb-section-compact' : ''}`}><div className="flex items-start justify-between gap-4"><div>{eyebrow && <p className="shb-eyebrow">{eyebrow}</p>}{title && <h3>{title}</h3>}{hint && <p className="shb-hint">{hint}</p>}</div>{action && <button type="button" onClick={action.onClick} className="shb-edit-button">{action.label}</button>}</div>{compact ? <div className="shb-compact-summary">{summary}</div> : <div className="mt-5 space-y-4">{children}</div>}</section>; }
function CompactSummary({ title, details }: { title: string; details: string[] }) { return <div><strong>{title}</strong><p>{details.filter(Boolean).join(' · ')}</p></div>; }
function Field({ label, required, optional, children }: { label: string; required?: boolean; optional?: boolean; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-sm font-medium text-[#222]">{label}{required && <b className="text-[#D04A2C]">*</b>}{optional && <small className="ml-1 font-normal text-[#9C9486]">(optional)</small>}</span>{children}</label>; }
function Readonly({ value }: { value: string }) { return <div className="shb-readonly">{value || '—'}</div>; }
function ChipField({ label, options, selected, onToggle, required = true, hint }: { label: string; options: string[]; selected: string[]; onToggle: (value: string) => void; required?: boolean; hint?: string }) { return <div><p className="mb-1 text-sm font-medium text-[#222]">{label}{required ? <b className="text-[#D04A2C]">*</b> : <small className="ml-1 font-normal text-[#9C9486]">(optional)</small>}</p>{hint && <p className="mb-2 text-xs leading-relaxed text-[#7A7568]">{hint}</p>}<div className="flex flex-wrap gap-2">{options.map((option) => { const on = selected.includes(option); return <button key={option} type="button" aria-pressed={on} className={`shb-chip ${on ? 'shb-chip-on' : ''}`} onClick={() => onToggle(option)}>{on ? `✓ ${option}` : option}</button>; })}</div></div>; }
function TierSelector({ product, currency, selected, values, onToggle, onBudgetChange }: {
  product: Product;
  currency: string;
  selected: string[];
  values: Record<string, string>;
  onToggle: (value: string) => void;
  onBudgetChange: (tier: string, value: string) => void;
}) {
  const budgetLabel = product === 'assignment' ? 'Project budget amount' : 'Monthly budget amount';
  return <div><p className="mb-1 text-sm font-medium text-[#222]">Specialist level<b className="text-[#D04A2C]">*</b></p><p className="mb-3 text-xs leading-relaxed text-[#7A7568]">Select one or more levels. Each selected card opens an optional budget amount field.</p><div className="grid items-start gap-2 sm:grid-cols-2">{TIER_OPTIONS.map((tier) => { const on = selected.includes(tier.value); return <div key={tier.value} className={`shb-tier-card ${on ? 'shb-tier-card-on' : ''}`}><button type="button" aria-pressed={on} onClick={() => onToggle(tier.value)} className="shb-tier-select"><span className="shb-tier-card-top"><span className="shb-tier-kicker">{tier.value === 'Top Talents' ? 'Premium' : tier.value === 'Agencies' ? 'Team' : tier.label.replace(/s$/, '')}</span><span className="shb-tier-check">{on ? '✓' : ''}</span></span><strong>{tier.label}</strong><small>{tier.desc}</small></button>{on && <label className="shb-tier-budget"><span>{budgetLabel} <em>Optional</em></span><span className="shb-budget-input"><b>{currency}</b><input aria-label={`${budgetLabel} for ${tier.label}`} inputMode="numeric" placeholder="Enter amount" value={formatMoneyInput(values[tier.value] ?? '', currency)} onChange={(e) => onBudgetChange(tier.value, e.target.value)} /></span><small>Leave blank if you want our team to recommend a budget.</small></label>}</div>; })}</div></div>;
}

function PlanCompareModal({ selectedPlan, onSelect, onClose }: {
  selectedPlan: string;
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const cellClass = (plan: (typeof PLANS)[number], extra = '') =>
    `${plan.recommended ? 'border-x-2 border-[#C6F24E]' : ''} ${selectedPlan === plan.name ? 'bg-[#FCFBE8]' : 'bg-white'} ${extra}`;
  const features = [
    { label: 'Unlimited work requests', values: [true, true, true, true, true] },
    { label: 'Squad Manager', values: [true, true, true, true, true] },
    { label: 'Urgent campaign work', values: [false, false, true, true, true] },
    { label: 'Meetings', values: ['By request', 'By request', 'By request', 'By request', 'Instant access'] },
    { label: 'Live collaboration', values: ['No', 'No', 'No', 'No', 'Yes'] },
    { label: 'Resource type', values: ['Shared', 'Shared', 'Shared', 'High priority', 'Dedicated'] },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Compare plans — Ads Specialist" className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border-2 border-[#0a0a0a] bg-white shadow-[8px_8px_0_rgba(10,10,10,.22)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b-2 border-[#0a0a0a] bg-[#F4F1E8] px-4 py-2.5">
          <div className="flex shrink-0 items-center gap-1.5"><span className="h-3 w-3 rounded-full border border-[#0a0a0a] bg-[#FF5F57]" /><span className="h-3 w-3 rounded-full border border-[#0a0a0a] bg-[#FEBC2E]" /><span className="h-3 w-3 rounded-full border border-[#0a0a0a] bg-[#28C840]" /></div>
          <h3 className="min-w-0 flex-1 truncate text-center text-sm font-bold">Compare plans — Ads Specialist</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 border-[#0a0a0a] bg-white text-lg font-bold shadow-[1px_1px_0_#0a0a0a] hover:bg-[#FCF487]">×</button>
        </div>
        <div className="border-b border-[#E8E5DD] px-5 py-2.5 text-[11px] leading-relaxed text-[#7A7568]"><strong className="text-[#0a0a0a]">Pick the availability that fits.</strong> Daily hours are your allocation; weekly and monthly figures are maximum caps, and unused daily time does not roll over.</div>
        <div className="overflow-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead><tr><th className="sticky left-0 z-20 bg-white px-4 py-4" />{PLANS.map((plan) => <th key={plan.name} className={cellClass(plan, `px-4 pb-4 pt-5 text-center align-top ${plan.recommended ? 'border-t-2' : ''}`)}>{plan.recommended && <span className="mb-2 inline-block rounded-full border border-[#0a0a0a] bg-[#C6F24E] px-2.5 py-0.5 text-[10px] font-bold uppercase">Most popular</span>}<div className="text-base font-extrabold">{plan.name}</div><p className="mx-auto mt-1 max-w-[150px] text-[11px] font-normal leading-snug text-[#7A7568]">{plan.tagline}</p></th>)}</tr></thead>
            <tbody>
              <tr className="border-t border-[#EFECE3]"><td className="sticky left-0 z-20 bg-white px-4 py-4 font-semibold text-[#3A3A3A]">Availability</td>{PLANS.map((plan) => <td key={plan.name} className={cellClass(plan, 'px-4 py-4 text-center align-top')}><div className="text-2xl font-extrabold">{plan.pct}</div><div className="mt-1 text-[11px] text-[#7A7568]">{plan.capacity}</div><div className="mt-2 text-[11px] text-[#3A3A3A]">{plan.dailyHours} per day</div><div className="text-[11px] italic text-[#7A7568]">{plan.weeklyMax} per week</div><div className="text-[11px] italic text-[#7A7568]">{plan.monthlyMax} per month</div></td>)}</tr>
              {features.map((feature) => <tr key={feature.label} className="border-t border-[#EFECE3]"><td className="sticky left-0 z-20 bg-white px-4 py-3 font-medium text-[#3A3A3A]">{feature.label}</td>{feature.values.map((value, index) => <td key={`${feature.label}-${PLANS[index].name}`} className={cellClass(PLANS[index], 'px-4 py-3 text-center')}>{typeof value === 'boolean' ? <span className={`font-bold ${value ? 'text-[#1FA85A]' : 'text-[#D1573B]'}`}>{value ? '✓' : '×'}</span> : <span className="text-xs text-[#3A3A3A]">{value}</span>}</td>)}</tr>)}
              <tr className="border-t border-[#EFECE3]"><td className="sticky left-0 z-20 bg-white px-4 py-3 font-medium text-[#3A3A3A]">Best for</td>{PLANS.map((plan) => <td key={plan.name} className={cellClass(plan, 'px-4 py-3 text-center text-xs text-[#3A3A3A]')}>{plan.bestFor}</td>)}</tr>
            </tbody>
            <tfoot><tr className="border-t border-[#EFECE3]"><td className="sticky left-0 z-20 bg-white px-4 py-4" />{PLANS.map((plan) => { const on = selectedPlan === plan.name; return <td key={plan.name} className={cellClass(plan, `px-3 py-4 text-center ${plan.recommended ? 'border-b-2' : ''}`)}><button type="button" aria-pressed={on} onClick={() => onSelect(plan.name)} className={`w-full rounded-lg border-2 border-[#0a0a0a] px-2 py-2 text-xs font-bold shadow-[2px_2px_0_#0a0a0a] ${on ? 'bg-[#C6F24E]' : 'bg-white hover:bg-[#F2FCBC]'}`}>{on ? 'Selected ✓' : 'Select plan'}</button></td>; })}</tr></tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function formatMoneyInput(value: string, currency: string) {
  if (!value) return '';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return amount.toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US', { maximumFractionDigits: 0 });
}
function WorkingDays({ selected, onToggle }: { selected: string[]; onToggle: (value: string) => void }) {
  const weekendCount = selected.filter((day) => day === 'Sat' || day === 'Sun').length;
  const allWeekdaysSelected = DAYS.slice(0, 5).every((day) => selected.includes(day));
  const showWeekendWarning = weekendCount > 0 && (allWeekdaysSelected || selected.length > 5);

  return <div className="rounded-xl border border-[#E0DCCE] bg-[#FBFAF6] p-4">
    <p className="mb-1 text-sm font-medium text-[#222]">Working days<b className="text-[#D04A2C]">*</b></p>
    <p className="mb-2 text-xs leading-relaxed text-[#7A7568]">Days you need the specialist to be available — we'll match people whose schedule fits yours.</p>
    <p className="mb-3 text-xs leading-relaxed text-[#7A7568]">Mon–Fri are included by default. Add <strong className="text-[#3A3A3A]">Sat</strong> and/or <strong className="text-[#3A3A3A]">Sun</strong> if you need weekend coverage{weekendCount > 0 && <span className="text-[#5C5C5C]"> — currently {weekendCount} weekend day{weekendCount > 1 ? 's' : ''} added</span>}.</p>
    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">{DAYS.map((day) => { const isOn = selected.includes(day); const optional = day === 'Sat' || day === 'Sun'; return <button key={day} type="button" onClick={() => onToggle(day)} aria-pressed={isOn} title={optional ? `${day} (optional)` : day} className={`relative flex min-h-14 flex-col items-center justify-center rounded-xl border py-2 text-xs font-bold transition ${isOn ? 'border-2 border-[#0a0a0a] bg-[#FCF487] text-[#0a0a0a] shadow-[2px_2px_0_#0a0a0a]' : optional ? 'border-dashed border-[#C9C3B5] bg-white text-[#7A7568]' : 'border-[#D9D5C7] bg-white text-[#3A3A3A] hover:border-[#0a0a0a]'}`}><span>{day}</span>{optional && !isOn && <span className="mt-0.5 text-[8px] font-medium uppercase tracking-wider text-[#9C9486]">opt</span>}{isOn && <svg className="absolute right-1 top-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}</button>; })}</div>
    {showWeekendWarning && <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#E0B7A2] bg-[#FBEFE9] p-3"><svg className="mt-0.5 h-4 w-4 shrink-0 text-[#C97744]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg><span className="text-xs font-medium leading-relaxed text-[#8B3A1A]">Less chance of talent accepting the request if weekends are selected.</span></div>}
  </div>;
}
function BackIcon() { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>; }
function MicIcon() { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="9" y="3" width="6" height="11" rx="3" /><path strokeLinecap="round" d="M6 11a6 6 0 0012 0M12 17v4m-3 0h6" /></svg>; }
function CheckIcon() { return <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>; }
function InfoIcon() { return <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 11v5m0-8h.01" /></svg>; }
function CompareIcon() { return <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M9 4v16M15 4v16" /></svg>; }

const styles = `
.shb-connect-bg{background:#F7F4EC;color:#222;font-family:var(--font-jakarta),sans-serif}
.shb-category{display:flex;align-items:center;justify-content:space-between;gap:16px;border:2px solid #0a0a0a;border-radius:14px;background:#fff;padding:17px 18px;box-shadow:3px 3px 0 #0a0a0a}
.shb-category p{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#7A7568;font-weight:700;margin:0 0 7px}.shb-category span{display:inline-flex;border:1.5px solid #0a0a0a;border-radius:999px;background:#F2FCBC;padding:4px 11px;font-size:14px;font-weight:700}.shb-category button{border:2px solid #0a0a0a;border-radius:9px;background:white;padding:8px 14px;font-size:13px;font-weight:700;box-shadow:2px 2px 0 #0a0a0a}
.shb-section{border:1px solid #E8E5DD;border-radius:18px;background:white;padding:24px;box-shadow:0 2px 5px rgba(41,38,31,.08)}
.shb-eyebrow{font-size:11px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:#8B8374}.shb-section h3{margin-top:4px;font-size:19px;font-weight:700;color:#222}.shb-hint{margin-top:3px;font-size:13px;line-height:1.5;color:#7A7568}
.shb-section-compact{padding:18px 20px}.shb-edit-button{flex:none;border:1.5px solid #0a0a0a;border-radius:9px;background:#fff;padding:7px 13px;font-size:12px;font-weight:700;color:#222;box-shadow:2px 2px 0 #FCF487}.shb-edit-button:hover{background:#F9FDEB}.shb-compact-summary{margin-top:13px;border-top:1px solid #E8E5DD;padding-top:12px}.shb-compact-summary strong{display:block;font-size:14px;color:#222}.shb-compact-summary p{display:-webkit-box;overflow:hidden;margin-top:3px;color:#7A7568;font-size:12px;line-height:1.5;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.shb-input{width:100%;border:1px solid #D9D5C7;border-radius:11px;background:#fff;padding:11px 13px;font:inherit;font-size:14px;color:#222;outline:none}.shb-input:focus{border-color:#0a0a0a;box-shadow:0 0 0 3px rgba(252,244,135,.65)}
.shb-readonly{min-height:46px;border:1px solid #E2DFD3;border-radius:11px;background:#F1EFE7;padding:12px 13px;font-size:14px;color:#5C5C5C}.shb-help{margin-top:5px;font-size:11px;color:#9C9486}
.shb-chip{border:1px solid #D9D5C7;border-radius:999px;background:#fff;padding:7px 12px;font-size:12px;font-weight:600;color:#5C5C5C;transition:.15s}.shb-chip-on{border-color:#0a0a0a;background:#F2FCBC;color:#0a0a0a;box-shadow:1px 1px 0 #0a0a0a}
.shb-tier-card{width:100%;overflow:hidden;border:1px solid #D9D5C7;border-radius:15px;background:#fff;text-align:left;color:#222;transition:.18s}.shb-tier-card:hover{border-color:#0a0a0a}.shb-tier-card-on{border:2px solid #0a0a0a;background:#F9FDEB;box-shadow:3px 3px 0 #C6F24E}.shb-tier-select{display:block;width:100%;min-height:126px;padding:13px;text-align:left}.shb-tier-card-top{display:flex;align-items:center;justify-content:space-between}.shb-tier-kicker{border-radius:999px;background:#F3F0E7;padding:3px 7px;color:#7A7568;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.shb-tier-card-on .shb-tier-kicker{background:#FCF487;color:#222}.shb-tier-check{display:flex;height:21px;width:21px;align-items:center;justify-content:center;border:1.5px solid #C9C3B5;border-radius:999px;background:#fff;font-size:11px;font-weight:800}.shb-tier-card-on .shb-tier-check{border-color:#0a0a0a;background:#FCF487}.shb-tier-select strong,.shb-tier-select small{display:block}.shb-tier-select strong{margin-top:11px;font-size:14px}.shb-tier-select small{margin-top:4px;font-size:11px;line-height:1.45;color:#7A7568}.shb-tier-budget{display:block;border-top:1px solid #E0DCCE;padding:13px;background:rgba(255,255,255,.68)}.shb-tier-budget>span:first-child{display:block;margin-bottom:7px;font-size:11px;font-weight:700;color:#3A3A3A}.shb-tier-budget em{margin-left:5px;border-radius:999px;background:#EFECE3;padding:2px 6px;font-size:8px;font-style:normal;text-transform:uppercase;color:#7A7568}.shb-tier-budget>small{display:block;margin-top:6px;font-size:10px;line-height:1.4;color:#8B8374}.shb-budget-input{display:flex;align-items:stretch;overflow:hidden;border:1px solid #C9C3B5;border-radius:10px;background:#fff}.shb-budget-input:focus-within{border-color:#0a0a0a;box-shadow:0 0 0 3px rgba(252,244,135,.65)}.shb-budget-input b{display:flex;align-items:center;border-right:1px solid #E0DCCE;background:#F3F0E7;padding:0 10px;font-size:11px;color:#5C5C5C}.shb-budget-input input{min-width:0;flex:1;background:transparent;padding:10px 11px;font:inherit;font-size:14px;outline:none}
.shb-choice{position:relative;min-height:108px;border:1px solid #D9D5C7;border-radius:11px;background:white;padding:11px;text-align:left}.shb-choice strong,.shb-choice span{display:block}.shb-choice strong{font-size:13px}.shb-choice span{margin-top:3px;font-size:10px;color:#7A7568}.shb-choice .shb-choice-daily{margin-top:8px;border-top:1px solid #E8E5DD;padding-top:6px;color:#222;font-size:12px;font-weight:700}.shb-choice .shb-choice-cap{margin-top:5px;font-size:9px;color:#7A7568}.shb-choice em{position:absolute;right:6px;top:6px;border-radius:999px;background:#FCF487;padding:2px 5px;font-size:8px;font-style:normal;font-weight:700;text-transform:uppercase}.shb-choice-on{border:2px solid #0a0a0a;background:#F9FDEB;box-shadow:2px 2px 0 #0a0a0a}
.shb-plan-note{display:flex;align-items:flex-start;gap:8px;margin-top:10px;border:1px solid #E8E5DD;border-radius:10px;background:#FBFAF6;padding:10px 12px;color:#7A7568;font-size:11px;line-height:1.5}.shb-plan-note strong{color:#3A3A3A}
.shb-currency{width:146px;flex:none;padding-right:30px}
.shb-audio-note{border:1px solid #E0DCCE;border-radius:12px;background:#FBFAF6;padding:12px}.shb-audio-primary,.shb-audio-secondary,.shb-audio-stop{display:flex;align-items:center;gap:7px;border-radius:9px;padding:9px 12px;font-size:12px;font-weight:700}.shb-audio-primary{flex:1;border:1px dashed #9C9486;background:#fff;color:#3A3A3A}.shb-audio-primary span{margin-left:auto;border-radius:999px;background:#EFECE3;padding:2px 7px;font-size:9px;text-transform:uppercase}.shb-audio-secondary{border:1px solid #D9D5C7;background:#fff;color:#5C5C5C}.shb-audio-danger{color:#9B3D29}.shb-audio-stop{border:1px solid #0a0a0a;background:#0a0a0a;color:#fff}.shb-recording-dot{height:10px;width:10px;border-radius:999px;background:#D1573B;box-shadow:0 0 0 4px rgba(209,87,59,.16);animation:shb-pulse 1.15s ease-in-out infinite}@keyframes shb-pulse{50%{opacity:.4;transform:scale(.82)}}
.shb-submit-wrap{position:sticky;bottom:0;z-index:5;background:linear-gradient(transparent,#F7F4EC 28%);padding-top:22px}.shb-submit{width:100%;border:2px solid #0a0a0a;border-radius:11px;background:#0a0a0a;padding:12px 18px;font-size:14px;font-weight:700;color:white;box-shadow:3px 3px 0 #C6F24E}.shb-submit:hover{background:#252525}.shb-submit:disabled{opacity:.55}
@media(max-width:640px){.shb-section{padding:19px}.shb-category{padding:14px}.shb-category button{padding:7px 10px}}
`;
