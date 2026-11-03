'use client';

import { useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import { CURRENCIES } from '@/lib/currency';
import { INDIAN_STATES, DISTRICTS_BY_STATE } from '@/constants/india-locations';
import DescribedSelect from './DescribedSelect';
import AdditionalRequirementsField, { type AdditionalRequirements } from './AdditionalRequirementsField';
import { cleanProfile, Draft, Profile, Bundle, emptyBundle, Field, TextField, TextArea, Section, ImageField, SocialFields, PhotoFields, inputClass, str, list } from './HiringProfileFields';

const newJob = (title: string, currency = 'INR'): Draft => ({ id: '', title, description: '', responsibilities: [], requirements: [], skills: [],
  min_experience_years: null, max_experience_years: null, education: '', employment_type: 'full_time', work_mode: 'remote',
  working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], working_hours: { start: '', end: '', timezone: 'Asia/Kolkata' },
  salary_min: null, salary_max: null, salary_currency: currency, salary_period: 'monthly', benefits: [], growth_path: '',
  preference_rules: {}, squadhire_category_ids: [], location_id: null });
const newLocation = (): Draft => ({ id: crypto.randomUUID(), label: '', address: '', city: '', region: '', district: '', postal_code: '', description: '', country_id: null, google_maps_url: '', is_primary: true });
const requiredBusinessFields = ['contact_name', 'contact_email', 'contact_phone', 'name', 'about', 'industry', 'company_size', 'founded_year'];
const completeLocation = (profile: Draft) => ['label', 'address', 'city', 'region', 'district'].every((key) => str(profile[key]).trim());
const newBrand = (): Draft => ({ id: '', name: '', about: '', industry: '', website: '', socials: {}, logo_url: '', photos: [] });
const primary = 'rounded-xl bg-[#0a0a0a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50';
const secondary = 'rounded-xl border border-[#D9D5C7] bg-white px-4 py-2.5 text-sm font-semibold text-[#525252] disabled:opacity-50';
const previewCategories = [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', name: 'Designer', slug: 'designer' }, { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', name: 'Accountant', slug: 'accountant' }];
// Candidate-preference chip options — the same values the subscription briefs
// send (tiers match v_talent_profile_tier; languages match talent languages).
const TIERS = ['Junior', 'Pro', 'Top Talents', 'Agencies'];
const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Urdu', 'Arabic', 'Spanish', 'French', 'German', 'Mandarin'];
const GENDERS = ['Male', 'Female', 'Other'];
// State chips per country, mirroring the subscription brief's location picker.
// India's states and districts come from the shared india-locations constants.
const PREFERENCE_STATES: Record<string, string[]> = {
  'United States': ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming', 'District of Columbia'],
  'United Kingdom': ['England', 'Scotland', 'Wales', 'Northern Ireland'],
  'United Arab Emirates': ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'],
  Singapore: ['Central', 'East', 'North', 'North-East', 'West'],
  Australia: ['New South Wales', 'Victoria', 'Queensland', 'Western Australia', 'South Australia', 'Tasmania', 'Australian Capital Territory', 'Northern Territory'],
  Canada: ['Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador', 'Nova Scotia', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan', 'Northwest Territories', 'Nunavut', 'Yukon'],
};
const toggleList = (values: string[], value: string) => values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
type Category = { id: string; name: string; slug?: string };
type Kind = 'business' | 'brand' | 'job' | 'location';
const bundleKey: Record<Kind, keyof Bundle> = { business: 'businesses', brand: 'brands', job: 'jobs', location: 'locations' };

export default function JobBriefForm({ categoryName, preview, onClose }: { categoryName: string; preview: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const tabId = useId();
  const [step, setStep] = useState(1);
  const [bundle, setBundle] = useState<Bundle>(emptyBundle);
  const [business, setBusiness] = useState<Draft>({});
  const [brand, setBrand] = useState<Draft>(newBrand);
  const [job, setJob] = useState<Draft>(() => newJob(categoryName));
  const [businessId, setBusinessId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [jobId, setJobId] = useState('');
  const [showAdditional, setShowAdditional] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState(true);
  const [editingBrand, setEditingBrand] = useState(false);
  const [editingJob, setEditingJob] = useState(true);
  const [initialLocation, setInitialLocation] = useState<Draft>(newLocation);
  const [location, setLocation] = useState<Draft | null>(null);
  const [categories, setCategories] = useState<Category[]>(preview ? previewCategories : []);
  const [countries, setCountries] = useState<Category[]>([]);
  const [requestId, setRequestId] = useState('');
  const [openings, setOpenings] = useState('1');
  const [joiningDate, setJoiningDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [cardId, setCardId] = useState('');
  const [reload, setReload] = useState(0);
  const draftKey = `squadhire:hiring-wizard:${user?.id || 'preview'}:${categoryName}`;
  const libraryKey = `squadhire:hiring-library:${user?.id || 'preview'}`;

  useEffect(() => {
    if (!user && !preview) return;
    let cancelled = false;
    setReady(false); setError('');
    async function load() {
      try {
        let draft: Record<string, any> = {};
        try { draft = JSON.parse(localStorage.getItem(draftKey) || '{}') || {}; } catch { /* new draft */ }
        const profiles: Bundle = preview ? JSON.parse(localStorage.getItem(libraryKey) || JSON.stringify(emptyBundle)) : (await api.get<Bundle>('/business/jobs/profiles')).data;
        const catalog: Category[] = preview ? previewCategories : (await api.get<Category[]>('/public/categories')).data;
        if (cancelled) return;
        setBundle(profiles); setCategories(catalog || []);
        setInitialLocation(draft.initialLocation || newLocation());
        const savedBusiness = profiles.businesses.find((p) => p.id === draft.businessId) || profiles.businesses[0];
        const owner = savedBusiness?.id || '';
        setBusinessId(owner);
        setBusiness(draft.editingBusiness && draft.business ? draft.business : savedBusiness || {
          id: crypto.randomUUID(), name: user?.company_name || '', about: user?.business_note || '', industry: user?.industry || '',
          company_size: '', website: '', socials: {}, logo_url: '', photos: [], culture: '', perks: [], founded_year: null,
          contact_name: user?.contact_person_name || user?.full_name || '', contact_email: user?.contact_email || user?.email || '', contact_phone: user?.contact_phone || '',
        });
        setEditingBusiness(!savedBusiness || Boolean(draft.editingBusiness));
        const savedBrand = profiles.brands.find((p) => p.id === draft.brandId && p.business_profile_id === owner);
        setBrandId(savedBrand?.id || ''); setBrand(draft.editingBrand && draft.brand ? draft.brand : savedBrand || newBrand());
        setEditingBrand(Boolean(draft.editingBrand));
        const savedJob = profiles.jobs.find((p) => p.id === draft.jobId && p.business_profile_id === owner && (p.brand_profile_id || '') === (savedBrand?.id || '') && p.status !== 'archived');
        const initial = draft.editingJob && draft.job ? draft.job : savedJob || { ...newJob(categoryName, user?.default_currency || 'INR'), id: crypto.randomUUID() };
        if (!list(initial.squadhire_category_ids).length) {
          const normalize = (name: string) => name.trim().toLowerCase().replace(/s$/, '');
          const match = catalog.find((c) => normalize(c.name) === normalize(categoryName));
          if (match) initial.squadhire_category_ids = [match.id];
        }
        setJob(initial); setJobId(savedJob?.id || ''); setEditingJob(!savedJob || Boolean(draft.editingJob));
        setStep(owner ? Math.min(3, Math.max(1, Number(draft.step) || 1)) : 1);
        setOpenings(typeof draft.openings === 'string' ? draft.openings : '1');
        setJoiningDate(typeof draft.joiningDate === 'string' ? draft.joiningDate : '');
        setRequestId(typeof draft.requestId === 'string' ? draft.requestId : crypto.randomUUID());
        setReady(true);
      } catch { if (!cancelled) setError('Could not load your saved profiles. Retry before continuing.'); }
    }
    void load();
    if (!preview) api.get('/business/connect-brief/countries').then((r) => { if (!cancelled) setCountries(r.data.data || []); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user, preview, categoryName, draftKey, libraryKey, reload]);

  useEffect(() => {
    if (!ready || cardId) return;
    try { localStorage.setItem(draftKey, JSON.stringify({ step, initialLocation, business, brand, job, businessId, brandId, jobId, editingBusiness, editingBrand, editingJob, openings, joiningDate, requestId })); } catch { /* optional draft */ }
  }, [ready, cardId, draftKey, step, initialLocation, business, brand, job, businessId, brandId, jobId, editingBusiness, editingBrand, editingJob, openings, joiningDate, requestId]);

  function changeBusiness(profile: Profile) {
    setBusiness(profile); setBusinessId(profile.id); setEditingBusiness(false);
    setInitialLocation(newLocation()); setLocation(null);
    setBrandId(''); setBrand(newBrand()); setEditingBrand(false); resetJob();
  }
  function resetJob() { setJobId(''); setJob({ ...newJob(categoryName, user?.default_currency || 'INR'), id: crypto.randomUUID(), squadhire_category_ids: list(job.squadhire_category_ids) }); setEditingJob(true); }
  function changeBrand(id: string) {
    setBrandId(id); setBrand(bundle.brands.find((p) => p.id === id) || newBrand()); setEditingBrand(false); setLocation(null); resetJob();
  }
  async function save(kind: Kind, draft: Draft): Promise<Profile> {
    const id = str(draft.id) || crypto.randomUUID();
    const payload = cleanProfile(draft, kind);
    const saved: Profile = preview ? { ...payload, id } : (await api.post<Profile>(`/business/jobs/profiles/${kind}`, { id, data: payload })).data;
    const key = bundleKey[kind];
    setBundle((current) => {
      const next = { ...current, [key]: [...current[key].filter((p) => p.id !== saved.id), saved] };
      return next;
    });
    if (preview) {
      const current: Bundle = JSON.parse(localStorage.getItem(libraryKey) || JSON.stringify(emptyBundle));
      localStorage.setItem(libraryKey, JSON.stringify({ ...current, [key]: [...current[key].filter((p) => p.id !== saved.id), saved] }));
    }
    return saved;
  }
  async function run(action: () => Promise<void>) {
    if (busy) return; setBusy(true); setError('');
    try { await action(); }
    catch (err) { const response = (err as {response?: {data?: {message?: string}}}).response; setError(response?.data?.message || (err instanceof Error ? err.message : 'Could not save. Please try again.')); }
    finally { setBusy(false); }
  }
  const updateBusiness = (key: string, value: unknown) => setBusiness((current) => ({ ...current, [key]: value }));
  const updateBrand = (key: string, value: unknown) => setBrand((current) => ({ ...current, [key]: value }));
  const updateJob = (key: string, value: unknown) => setJob((current) => ({ ...current, [key]: value }));
  const brands = bundle.brands.filter((p) => p.business_profile_id === businessId);
  const locations = bundle.locations.filter((p) => p.business_profile_id === businessId);
  // '' = business-level (brand is the business itself); otherwise the brand's outlets.
  const brandLocations = locations.filter((p) => (str(p.brand_profile_id) || '') === brandId);
  const jobLocations = locations.filter((p) => !str(p.brand_profile_id) || str(p.brand_profile_id) === brandId);
  const selectedCategory = categories.find((c) => c.name.trim().toLowerCase().replace(/s$/, '') === categoryName.trim().toLowerCase().replace(/s$/, ''));
  // Skills & tools catalog is per category — the same template tables the
  // subscription briefs use (designer, video-editor, accountant, …). Fallback
  // slug keeps the "add your own" inputs alive even without a catalog match.
  const jobRole = { slug: selectedCategory?.slug || categoryName.trim().toLowerCase().replace(/\s+/g, '-'), label: categoryName.trim().replace(/s$/i, '') };
  const jobs = bundle.jobs.filter((p) => p.business_profile_id === businessId && (p.brand_profile_id || '') === brandId && p.status !== 'archived' && (!selectedCategory || list(p.squadhire_category_ids).includes(selectedCategory.id)));
  const businessComplete = requiredBusinessFields.every((key) => str(business[key]).trim());
  const hasLocation = locations.some(completeLocation);
  const canContinue = Boolean(businessId && !editingBusiness && businessComplete && hasLocation);
  useEffect(() => { if (ready && !canContinue && step > 1) setStep(1); }, [ready, canContinue, step]);
  const rules = job.preference_rules as Draft || {};
  const hours = job.working_hours as Draft || {};
  const additionalRules = (job.additional_requirements && typeof job.additional_requirements === 'object' ? job.additional_requirements : {}) as AdditionalRequirements;
  const prefCountry = list(rules.target_country_names)[0] || '';
  const countryNames = countries.map((c) => c.name);
  const withCurrent = (options: string[], current: string) => current && !options.includes(current) ? [current, ...options] : options;
  const prefStateOptions = prefCountry === 'India' ? INDIAN_STATES.map((s) => s.value) : PREFERENCE_STATES[prefCountry] ?? [];
  const prefDistrictOptions = prefCountry === 'India' ? [...new Set(list(rules.target_regions).flatMap((state) => DISTRICTS_BY_STATE[state] ?? []))] : [];

  if (cardId) return <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-[#F7F4EC] p-8 text-center">
    <span className="text-4xl">✓</span><h2 className="text-2xl font-semibold">{preview ? 'Preview complete' : 'Job card created'}</h2>
    <p className="max-w-md text-sm leading-relaxed text-[#7A7568]">{preview ? 'Profiles were saved in this preview only.' : 'Your saved business, brand selection, and job profile are linked to this card. Your team can review them in SquadHub before publishing. You can reuse or edit these profiles next time.'}</p>
    <button type="button" className={primary} onClick={() => { onClose(); if (!preview) router.push(`/business/job-posts/${cardId}`); }}>{preview ? 'Done' : 'View job card'}</button>
  </div>;

  return <div className="min-h-full bg-[#F7F4EC] text-[#222]">
    <div className="sticky top-0 z-10 space-y-3 border-b border-[#E8E5DD] bg-[#F7F4EC] px-4 py-4 sm:px-6">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-[#7A7568]">Job card · {categoryName}</p><h2 className="mt-1 text-xl font-semibold">Build your hiring profile</h2></div>
      <div role="tablist" aria-label="Hiring profiles" className="flex flex-wrap gap-2">{['Business profile', 'Brand profile', 'Job profile'].map((title, index) => <button key={title} id={`${tabId}-tab-${index + 1}`} type="button" role="tab" aria-selected={step === index + 1} aria-controls={`${tabId}-panel-${index + 1}`} disabled={busy || !ready || (index > 0 && !canContinue)} onClick={() => setStep(index + 1)} className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold disabled:opacity-40 ${step === index + 1 ? 'border-black bg-[#F2FCBC] text-black' : 'border-[#D9D5C7] bg-white text-[#7A7568]'}`}><span className="flex h-4 w-4 items-center justify-center rounded-full bg-black/5">{index + 1}</span>{title}</button>)}</div>
    </div>
    {!ready ? <div className="p-6"><p role="status" className="text-sm">{error || 'Loading saved profiles…'}</p>{error && <button type="button" className={`${secondary} mt-3`} onClick={() => setReload((v) => v + 1)}>Retry</button>}</div> : <div className="space-y-5 p-4 sm:p-6" role="tabpanel" id={`${tabId}-panel-${step}`} aria-labelledby={`${tabId}-tab-${step}`}>
      {step === 1 && <>
        {bundle.businesses.length > 0 && <Section title="Your business" hint="Select the same business profile used in SquadHub admin."><DescribedSelect label="Saved business profile" value={businessId || bundle.businesses[0].id} options={bundle.businesses.map((p) => ({ value: p.id, label: p.name, description: str(p.industry) || 'Saved business profile' }))} onChange={(id) => { const selected = bundle.businesses.find((p) => p.id === id); if (selected) changeBusiness(selected); }} /></Section>}
        {editingBusiness ? <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void run(async () => {
          if (!businessComplete) throw new Error('Complete all required contact and business profile details.');
          if (!hasLocation && !completeLocation(initialLocation)) throw new Error('Complete the location name, address, city, state, and district.');
          const saved = await save('business', business); setBusiness(saved); setBusinessId(saved.id);
          if (!hasLocation) await save('location', { ...initialLocation, business_profile_id: saved.id });
          setEditingBusiness(false);
        }); }}>
          <Section title="Contact details">
            <TextField label="Contact name" required value={business.contact_name} onChange={(v) => updateBusiness('contact_name', v)} />
            <div className="grid gap-4 sm:grid-cols-2"><TextField label="Contact email" required type="email" value={business.contact_email} onChange={(v) => updateBusiness('contact_email', v)} /><TextField label="Contact phone" required type="tel" maxLength={30} value={business.contact_phone} onChange={(v) => updateBusiness('contact_phone', v)} /></div>
          </Section>
          <Section title="Business profile details" hint="Tell candidates about the business they could join.">
            <TextField label="Business name" required value={business.name} onChange={(v) => updateBusiness('name', v)} />
            <TextArea label="About the business" required value={business.about} onChange={(v) => updateBusiness('about', v)} />
            <div className="grid gap-4 sm:grid-cols-2"><TextField label="Industry" required value={business.industry} onChange={(v) => updateBusiness('industry', v)} /><TextField label="Company size" required value={business.company_size} maxLength={50} hint="For example, 11–50 employees." onChange={(v) => updateBusiness('company_size', v)} /></div>
            <TextField label="Business website (optional)" type="url" maxLength={500} value={business.website} onChange={(v) => updateBusiness('website', v)} />
            <TextField label="Founded year" required type="number" value={business.founded_year} onChange={(v) => updateBusiness('founded_year', v)} />
          </Section>
          {!hasLocation && <Section title="Location details" hint="Add your business location. City and state / region are required."><LocationFields value={initialLocation} onChange={setInitialLocation} countries={countries} /></Section>}
          <div className="rounded-2xl border border-[#E8E5DD] bg-white shadow-sm">
            <button type="button" aria-expanded={showAdditional} onClick={() => setShowAdditional((open) => !open)} className="flex w-full items-center justify-between gap-3 p-5 text-left">
              <span><span className="block text-lg font-semibold">Additional details</span><span className="mt-1 block text-xs leading-relaxed text-[#7A7568]">Logo, social links, and photos — optional.</span></span>
              <span className="text-xs font-semibold text-[#525252]">{showAdditional ? 'Hide −' : 'Show +'}</span>
            </button>
            {showAdditional && <div className="space-y-4 border-t border-[#E8E5DD] p-5"><h4 className="text-sm font-semibold">Business identity details</h4>
              <ImageField label="Business logo URL" value={str(business.logo_url)} onChange={(v) => updateBusiness('logo_url', v)} preview={preview} /><SocialFields value={business.socials} onChange={(v) => updateBusiness('socials', v)} /><PhotoFields value={business.photos} onChange={(v) => updateBusiness('photos', v)} preview={preview} />
            </div>}
          </div>
          {businessId && <p className="text-xs text-[#7A7568]">Changes update the shared profile wherever it is used.</p>}
          <button className={primary} disabled={busy} type="submit">{busy ? 'Saving…' : 'Save business profile'}</button>
        </form> : <Section title={str(business.name)} hint={`${str(business.industry)}${business.company_size ? ` · ${str(business.company_size)} employees` : ''}`}><p className="whitespace-pre-wrap text-sm text-[#7A7568]">{str(business.about)}</p><button type="button" className={secondary} onClick={() => setEditingBusiness(true)}>Edit business profile</button></Section>}
        {businessId && !editingBusiness && !canContinue && <p className="text-sm text-[#7A7568]">{!businessComplete ? 'Edit your business profile to complete all required contact and business details.' : 'Edit your business profile to add a location with a city, state, and district.'}</p>}
        {businessId && !editingBusiness && <button type="button" disabled={!canContinue} className={primary} onClick={() => setStep(2)}>Continue to brand profile →</button>}
      </>}
      {step === 2 && <>
        <Section title="Brand profile" hint="Hire under the business itself, or select a brand belonging to this business.">
          <DescribedSelect label="Brand for this role" value={brandId} options={[{ value: '', label: 'Same as business profile', description: `Use ${str(business.name)} as the hiring identity. A separate brand is optional.` }, ...brands.map((p) => ({ value: p.id, label: p.name, description: str(p.industry) || 'Saved brand profile' }))]} onChange={changeBrand} />
          <button type="button" className={secondary} onClick={() => { setBrand({ ...newBrand(), id: crypto.randomUUID() }); setEditingBrand(true); }}>+ Add another brand</button>
          {brandId && !editingBrand && <button type="button" className={`${secondary} ml-2`} onClick={() => setEditingBrand(true)}>Edit brand profile</button>}
        </Section>
        {editingBrand && <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void run(async () => {
          const saved = await save('brand', { ...brand, business_profile_id: businessId }); setBrand(saved); setBrandId(saved.id); setEditingBrand(false); resetJob();
        }); }}><Section title={brands.some((p) => p.id === brand.id) ? 'Edit brand profile' : 'Add brand profile'}>
          <TextField label="Brand name" required value={brand.name} onChange={(v) => updateBrand('name', v)} />
          <TextArea label="About the brand" value={brand.about} onChange={(v) => updateBrand('about', v)} />
          <TextField label="Brand industry" value={brand.industry} onChange={(v) => updateBrand('industry', v)} />
          <TextField label="Brand website" type="url" maxLength={500} value={brand.website} onChange={(v) => updateBrand('website', v)} />
          <ImageField label="Brand logo URL" value={str(brand.logo_url)} onChange={(v) => updateBrand('logo_url', v)} preview={preview} />
          <SocialFields value={brand.socials} onChange={(v) => updateBrand('socials', v)} /><PhotoFields value={brand.photos} onChange={(v) => updateBrand('photos', v)} preview={preview} />
          <div className="flex gap-3"><button type="submit" className={primary} disabled={busy}>Save brand profile</button><button type="button" className={secondary} onClick={() => setEditingBrand(false)}>Cancel</button></div>
        </Section></form>}
        {!editingBrand && <Section title={brandId ? `Locations for ${str(bundle.brands.find((p) => p.id === brandId)?.name) || 'this brand'}` : 'Business locations'} hint={brandId ? 'Outlets of this brand. The location chosen on a job profile is shown to candidates as the matching location.' : 'Locations shared across the business and its brands. The location chosen on a job profile is shown to candidates as the matching location.'}>
          {brandLocations.map((p) => <div key={p.id} className="flex items-start justify-between gap-3 rounded-xl border border-[#E8E5DD] p-3"><div><p className="text-sm font-semibold">{str(p.label)}</p><p className="mt-1 text-xs text-[#7A7568]">{[str(p.address), str(p.city), str(p.district), str(p.region)].filter(Boolean).join(', ')}</p></div><button type="button" className="text-xs font-semibold underline" onClick={() => setLocation(p)}>Edit location</button></div>)}
          {!location && <button className={secondary} type="button" onClick={() => setLocation({ ...newLocation(), is_primary: locations.length === 0 })}>+ Add location</button>}
          {location && <form className="space-y-4 rounded-xl border border-[#E8E5DD] p-4" onSubmit={(e) => { e.preventDefault(); void run(async () => { if (!completeLocation(location)) throw new Error('Complete the location name, address, city, state, and district.'); await save('location', { ...location, business_profile_id: businessId, brand_profile_id: brandId || null }); setLocation(null); }); }}>
            <LocationFields value={location} onChange={setLocation} countries={countries} />
            <div className="flex gap-3"><button type="submit" className={primary} disabled={busy}>Save location</button><button type="button" className={secondary} onClick={() => setLocation(null)}>Cancel</button></div>
          </form>}
        </Section>}
        {!editingBrand && <button type="button" className={primary} onClick={() => setStep(3)}>Continue to job profile →</button>}
      </>}
      {step === 3 && <>
        <Section title="Job profile" hint={`Hiring for ${str(brandId ? brands.find((p) => p.id === brandId)?.name : business.name)}. Saved profiles can be reused for another card.`}>
          {jobs.length > 0 && <DescribedSelect label="Saved job profile" value={jobId || 'new'} options={[{ value: 'new', label: 'Create a new job profile', description: 'Save a new role for this business or brand.' }, ...jobs.map((p) => ({ value: p.id, label: p.title, description: `${str(p.employment_type).replace('_', '-')} · ${str(p.work_mode)}` }))]} onChange={(id) => { const saved = jobs.find((p) => p.id === id); if (saved) { setJob(saved); setJobId(saved.id); setEditingJob(false); } else resetJob(); }} />}
          {jobId && !editingJob && <><p className="text-lg font-semibold">{str(job.title)}</p><p className="whitespace-pre-wrap text-sm text-[#7A7568]">{str(job.description)}</p><button type="button" className={secondary} onClick={() => setEditingJob(true)}>Edit job profile</button></>}
        </Section>
        {editingJob && <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void run(async () => {
          // The card always starts from a chosen category, so the category is
          // derived, never hand-picked: keep the saved ids, else fall back to
          // the category this flow was opened from.
          const categoryIds = list(job.squadhire_category_ids).length ? list(job.squadhire_category_ids) : selectedCategory ? [selectedCategory.id] : [];
          if (!categoryIds.length) throw new Error('Talent categories did not load. Please retry.');
          if (job.work_mode !== 'remote' && !job.location_id) throw new Error('Choose a saved location for hybrid or on-site work.');
          const saved = await save('job', { ...job, squadhire_category_ids: categoryIds, business_profile_id: businessId, brand_profile_id: brandId || null }); setJob(saved); setJobId(saved.id); setEditingJob(false);
        }); }}>
          <Section title="The role"><TextField label="Job title" required value={job.title} onChange={(v) => updateJob('title', v)} /><TextArea label="Job description" maxLength={16000} value={job.description} onChange={(v) => updateJob('description', v)} />
            <TextArea label="Responsibilities" lines value={job.responsibilities} onChange={(v) => updateJob('responsibilities', v)} /><TextArea label="Requirements" lines value={job.requirements} onChange={(v) => updateJob('requirements', v)} /><TextArea label="Skills" lines value={job.skills} onChange={(v) => updateJob('skills', v)} />
            <div className="grid gap-4 sm:grid-cols-2"><TextField label="Minimum experience (years)" type="number" value={job.min_experience_years} onChange={(v) => updateJob('min_experience_years', v)} /><TextField label="Maximum experience (years)" type="number" value={job.max_experience_years} onChange={(v) => updateJob('max_experience_years', v)} /></div><TextField label="Education" maxLength={500} value={job.education} onChange={(v) => updateJob('education', v)} />
          </Section>
          <Section title="Working arrangement"><div className="grid gap-4 sm:grid-cols-2">
            <DescribedSelect label="Employment type" value={str(job.employment_type)} onChange={(v) => updateJob('employment_type', v)} options={[{ value: 'full_time', label: 'Full-time', description: 'An ongoing role with regular full-time hours.' }, { value: 'part_time', label: 'Part-time', description: 'Fewer working hours or days each week.' }, { value: 'contract', label: 'Contract', description: 'A fixed period or a defined scope of work.' }, { value: 'internship', label: 'Internship', description: 'A role focused on learning and practical work experience.' }]} />
            <DescribedSelect label="Work mode" value={str(job.work_mode)} onChange={(v) => updateJob('work_mode', v)} options={[{ value: 'remote', label: 'Remote', description: 'Work away from the office, from an agreed location.' }, { value: 'hybrid', label: 'Hybrid', description: 'Split time between the office and remote work.' }, { value: 'onsite', label: 'On-site', description: 'Work in person at your specified location.' }]} />
          </div><Field label="Work location" hint={brandId ? "This brand's outlets plus shared business locations." : 'Locations saved for this business.'}><select className={inputClass} value={str(job.location_id)} onChange={(e) => updateJob('location_id', e.target.value || null)} required={job.work_mode !== 'remote'}><option value="">No fixed location</option>{jobLocations.map((p) => <option key={p.id} value={p.id}>{str(p.label)} · {str(p.city)}</option>)}</select></Field>
            <div><p className="text-xs font-semibold text-[#525252]">Working days</p><div className="mt-2 flex flex-wrap gap-2">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <button key={day} type="button" aria-pressed={list(job.working_days).includes(day)} onClick={() => updateJob('working_days', list(job.working_days).includes(day) ? list(job.working_days).filter((v) => v !== day) : [...list(job.working_days), day])} className={`rounded-lg border px-3 py-2 text-xs ${list(job.working_days).includes(day) ? 'border-black bg-[#F2FCBC]' : 'border-[#D9D5C7]'}`}>{day}</button>)}</div></div>
            <div className="grid gap-4 sm:grid-cols-3"><TextField label="Start time" type="time" value={hours.start} onChange={(v) => updateJob('working_hours', { ...hours, start: v })} /><TextField label="End time" type="time" value={hours.end} onChange={(v) => updateJob('working_hours', { ...hours, end: v })} /><TextField label="Timezone" maxLength={60} value={hours.timezone} onChange={(v) => updateJob('working_hours', { ...hours, timezone: v })} /></div>
          </Section>
          <Section title="Salary & benefits"><div className="grid gap-4 sm:grid-cols-2"><Field label="Salary currency"><select className={inputClass} value={str(job.salary_currency)} onChange={(e) => updateJob('salary_currency', e.target.value)}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</select></Field><Field label="Salary period"><select className={inputClass} value={str(job.salary_period)} onChange={(e) => updateJob('salary_period', e.target.value)}><option value="monthly">Monthly</option><option value="annual">Annual</option></select></Field><TextField label="Minimum salary" type="number" value={job.salary_min} onChange={(v) => updateJob('salary_min', v)} /><TextField label="Maximum salary" type="number" value={job.salary_max} onChange={(v) => updateJob('salary_max', v)} /></div>
            <TextArea label="Role benefits" lines value={job.benefits} onChange={(v) => updateJob('benefits', v)} /><TextArea label="Growth path" maxLength={4000} value={job.growth_path} onChange={(v) => updateJob('growth_path', v)} />
          </Section>
          <Section title="Candidate preferences" hint="Optional matching preferences. Leave everything blank to accept any candidate.">
            <ChipField label="Talent tiers" hint="Experience levels to match. Leave empty to accept every tier." options={TIERS} selected={list(rules.target_tiers)} onToggle={(value) => updateJob('preference_rules', { ...rules, target_tiers: toggleList(list(rules.target_tiers), value) })} />
            {/* Location targeting is opt-in and grouped, like the subscription brief. Empty = anywhere. */}
            <div className="space-y-4 rounded-xl border border-[#E0DCCE] bg-[#FBFAF6] p-4">
              <div>
                <div className="mb-1 flex items-baseline gap-2"><h4 className="text-sm font-semibold text-[#0a0a0a]">Preferred location</h4><span className="text-xs font-normal text-[#9C9486]">(optional)</span></div>
                <p className="text-xs leading-relaxed text-[#7A7568]">Want candidates based in a specific place? Pick a country, then narrow to states or districts. Leave empty to match great talent anywhere.</p>
              </div>
              <Field label="Country"><select className={inputClass} value={prefCountry} onChange={(e) => updateJob('preference_rules', { ...rules, target_country_names: e.target.value ? [e.target.value] : [], target_regions: [], target_districts: [] })}><option value="">Anywhere (no preference)</option>{withCurrent(countryNames, prefCountry).map((name) => <option key={name} value={name}>{name}</option>)}</select></Field>
              {prefStateOptions.length > 0 && <ChipField label="States / regions" hint="Narrow to specific states. Helpful when local context or rules matter." options={prefStateOptions} selected={list(rules.target_regions)} onToggle={(value) => { const regions = toggleList(list(rules.target_regions), value); updateJob('preference_rules', { ...rules, target_regions: regions, target_districts: list(rules.target_districts).filter((d) => regions.some((state) => (DISTRICTS_BY_STATE[state] ?? []).includes(d))) }); }} />}
              {prefDistrictOptions.length > 0 && <ChipField label="Districts" hint="Narrow further to specific districts within the selected states." options={prefDistrictOptions} selected={list(rules.target_districts)} onToggle={(value) => updateJob('preference_rules', { ...rules, target_districts: toggleList(list(rules.target_districts), value) })} />}
            </div>
            <ChipField label="Languages" hint="Languages the candidate should be fluent in. Pick all that apply." options={LANGUAGES} selected={list(rules.target_languages)} onToggle={(value) => updateJob('preference_rules', { ...rules, target_languages: toggleList(list(rules.target_languages), value) })} />
            <ChipField label="Genders" hint="Narrow by gender. Leave empty to accept everyone." options={GENDERS} selected={list(rules.target_genders)} onToggle={(value) => updateJob('preference_rules', { ...rules, target_genders: toggleList(list(rules.target_genders), value) })} />
            <div className="grid gap-4 sm:grid-cols-2">{['min_experience_years', 'max_experience_years', 'min_age', 'max_age'].map((key) => <TextField key={key} label={({ min_experience_years: 'Preferred minimum experience', max_experience_years: 'Preferred maximum experience', min_age: 'Minimum age', max_age: 'Maximum age' } as Record<string, string>)[key]} type="number" value={rules[key]} onChange={(v) => { const next = { ...rules }; if (v === '') delete next[key]; else next[key] = Number(v); updateJob('preference_rules', next); }} />)}</div>
          </Section>
          <AdditionalRequirementsField variant="embedded" roles={[jobRole]} values={{ [jobRole.slug]: additionalRules }} onChange={(_slug, next) => { const cleaned = Object.fromEntries(Object.entries(next).filter(([, entries]) => Array.isArray(entries) && entries.some((v) => v.trim()))) as AdditionalRequirements; updateJob('additional_requirements', Object.keys(cleaned).length ? cleaned : undefined); }} />
          {jobId && <p className="text-xs text-[#7A7568]">Changes update the shared job profile wherever it is used.</p>}
          <button type="submit" className={primary} disabled={busy}>{busy ? 'Saving…' : 'Save job profile'}</button>
        </form>}
        {jobId && !editingJob && <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void run(async () => {
          if (preview) { setCardId('preview'); return; }
          const { data } = await api.post<{card_id: string}>('/business/jobs/brief', { request_id: requestId, job_profile_id: jobId, category_name: categoryName, openings_count: Number(openings), expected_joining_date: joiningDate || undefined });
          setCardId(data.card_id); localStorage.removeItem(draftKey); await qc.invalidateQueries({ queryKey: ['business-jobs'] });
        }); }}><Section title="Create job card" hint="The card uses the saved profiles above. Your team will review it in admin before publishing."><TextField label="Number of openings" required type="number" value={openings} onChange={setOpenings} /><TextField label="Expected joining date (optional)" type="date" value={joiningDate} onChange={setJoiningDate} /><button type="submit" className={primary} disabled={busy}>{busy ? 'Creating…' : 'Create job card'}</button></Section></form>}
      </>}
    </div>}
    {ready && error && <div role="alert" className="sticky bottom-0 z-10 border-t border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
  </div>;
}
// Subscription-brief style chip picker: pill toggles with a check mark and the
// lime highlight when selected. Always optional in candidate preferences.
function ChipField({ label, hint, options, selected, onToggle }: { label: string; hint?: string; options: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return <div>
    <p className="text-xs font-semibold text-[#525252]">{label}</p>
    {hint && <p className="mt-1 text-xs leading-relaxed text-[#7A7568]">{hint}</p>}
    <div className="mt-2 flex flex-wrap gap-2">{options.map((option) => { const on = selected.includes(option); return <button key={option} type="button" aria-pressed={on} onClick={() => onToggle(option)} className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition ${on ? 'border-black bg-[#F2FCBC] text-black shadow-[inset_0_0_0_1px_#0a0a0a]' : 'border-[#D9D5C7] bg-white text-[#525252] hover:border-black'}`}>{on ? `✓ ${option}` : option}</button>; })}</div>
  </div>;
}

function LocationFields({ value, onChange, countries }: { value: Draft; onChange: (value: Draft) => void; countries: Category[] }) {
  const update = (key: string, next: unknown) => onChange({ ...value, [key]: next });
  // Same curated dataset the subscription / talent location pickers use:
  // India gets state + district dropdowns; other countries fall back to text.
  const countryName = countries.find((c) => c.id === value.country_id)?.name || '';
  const usesIndiaData = !countryName || countryName === 'India';
  const stateOptions = usesIndiaData ? INDIAN_STATES.map((s) => s.value) : [];
  const districtOptions = usesIndiaData ? DISTRICTS_BY_STATE[str(value.region)] ?? [] : [];
  const withCurrent = (options: string[], current: string) => current && !options.includes(current) ? [current, ...options] : options;
  const changeState = (next: string) => onChange({ ...value, region: next, district: (DISTRICTS_BY_STATE[next] ?? []).includes(str(value.district)) ? str(value.district) : '' });
  return <>
    <TextField label="Location name" required value={value.label} onChange={(v) => update('label', v)} />
    <TextField label="Address" required maxLength={1000} value={value.address} onChange={(v) => update('address', v)} />
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField label="City" required value={value.city} onChange={(v) => update('city', v)} />
      <TextField label="Pin code" maxLength={20} value={value.postal_code} onChange={(v) => update('postal_code', v)} />
      <Field label="State" required>{stateOptions.length
        ? <select className={inputClass} value={str(value.region)} onChange={(e) => changeState(e.target.value)} required><option value="">Select state</option>{withCurrent(stateOptions, str(value.region)).map((s) => <option key={s} value={s}>{s}</option>)}</select>
        : <input className={inputClass} value={str(value.region)} onChange={(e) => update('region', e.target.value)} required maxLength={200} />}</Field>
      <Field label="District" required>{districtOptions.length
        ? <select className={inputClass} value={str(value.district)} onChange={(e) => update('district', e.target.value)} required><option value="">Select district</option>{withCurrent(districtOptions, str(value.district)).map((d) => <option key={d} value={d}>{d}</option>)}</select>
        : <input className={inputClass} value={str(value.district)} onChange={(e) => update('district', e.target.value)} required maxLength={200} placeholder={usesIndiaData && str(value.region) ? 'Not listed — type the district' : 'District'} />}</Field>
      <Field label="Country"><select className={inputClass} value={str(value.country_id)} onChange={(e) => update('country_id', e.target.value || null)}><option value="">Not specified</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
    </div>
    <TextArea label="Description (optional)" maxLength={2000} hint="Shown to candidates as details of the matching location." value={value.description} onChange={(v) => update('description', v)} />
    <TextField label="Google Maps URL (optional)" type="url" maxLength={1000} value={value.google_maps_url} onChange={(v) => update('google_maps_url', v)} />
    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(value.is_primary)} onChange={(e) => update('is_primary', e.target.checked)} />Primary location</label>
  </>;
}
