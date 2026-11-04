'use client';

// Social Media Creator brief — the Marketing squad's creator request form.
// Split from SpecialistBriefForm because creators are matched on channel fit
// (publishing platforms, creator niche, content format, follower level) rather
// than specialist experience tiers. Niche / format / platform chips load from
// the same category_fields catalog the creator job profile uses, so options
// added in admin appear here automatically and both sides share vocabulary.

import { useEffect, useRef, useState } from 'react';
import api from '@/services/api';
import BusinessLinksDialog from '@/components/business/BusinessLinksDialog';
import { businessProfileLinks, hasBusinessLink, type BusinessLinks } from '../../../../../shared/src/businessLinks';
import { useAuth } from '@/context/AuthContext';
import CurrencyField from '@/components/business/CurrencyField';
import { isCurrencyCode, saveDefaultCurrency, type CurrencyCode } from '@/lib/currency';
import { ANY_CREATOR_PREFERENCE, toggleCreatorPreference } from '@/lib/creatorBriefPreferences';
import SubmitErrorSummary, { showBriefErrors, type SubmitError } from './SubmitErrorSummary';
// Same vocabulary the creator job profile renders from (constants/creator-profile):
// services, niches, formats and platforms all live there, so a service
// flipped to live (or a new niche) appears in both forms together.
import {
  CREATOR_SERVICE_OPTIONS,
  LIVE_CREATOR_SERVICES,
  CREATOR_NICHE_OPTIONS,
  CREATOR_FORMAT_OPTIONS,
  CREATOR_PLATFORM_OPTIONS,
} from '@/constants/creator-profile';

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
  referenceLinks: string[];
  platforms: string[];
  niches: string[];
  formats: string[];
  serviceType: string;
  serviceCount: string;
  levels: string[];
  levelBudgets: Record<string, string>;
  currency: string;
  duration: string;
  startDate: string;
  deliveryDate: string;
  countryId: string;
  stateRegions: string[];
  ageGroups: string[];
  languages: string[];
  usageRights: string;
  paidAds: string;
  exclusivity: string;
  approvals: string;
  productDelivery: string;
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

// Follower-count creator levels replace the specialist experience tiers. The
// business picks one or more levels and can state a budget for each; the level
// values double as the tier_budgets keys sent upstream.
const CREATOR_LEVELS = [
  { value: 'Below 5,000', desc: 'Nano creators with engaged early audiences.' },
  { value: '5,000 to 10,000', desc: 'Rising nano creators with a loyal core.' },
  { value: '10,000 to 25,000', desc: 'Micro creators with steady niche reach.' },
  { value: '25,000 to 50,000', desc: 'Established micro creators.' },
  { value: '50,000 to 100k', desc: 'Mid-tier creators with broad niche reach.' },
  { value: '100k to 500k', desc: 'Established creators and channels.' },
  { value: '500k to 1 mil', desc: 'Large channels with wide reach.' },
  { value: '1 million+', desc: 'Top creators and flagship channels.' },
];

const AGE_GROUPS = ['13-17', '18-24', '25-34', '35-44', '45-54', '55+'];
const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Urdu', 'Arabic', 'Spanish', 'French', 'German', 'Mandarin'];

// Subscriptions upstream still require at least one working day on the lead
// contract. Creator campaigns don't track working days in the UI any more, so
// the brief always sends the squad's standard Mon–Fri schedule.
const DEFAULT_WORKING_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

// Service cards mirror the creator job profile: only services the creator
// form offers as live are selectable here, with the same descriptions.
const SERVICE_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  CREATOR_SERVICE_OPTIONS.map((s) => [s.service, s.description]),
);

const emptyForm: FormState = {
  contactName: '', email: '', phone: '', brandName: '', businessNature: '', businessNote: '',
  requirement: '', referenceLinks: [], platforms: [], niches: [], formats: [], serviceType: '', serviceCount: '', levels: [], levelBudgets: {},
  currency: 'INR', duration: '', startDate: '', deliveryDate: '',
  countryId: '', stateRegions: [], ageGroups: [], languages: ['English'],
  usageRights: '', paidAds: '', exclusivity: '', approvals: '', productDelivery: '',
};

const ROLE_NAME = 'Social Media Creator';

// Reference links ride inside the brief's additional_requirements (string
// values up to 1000 chars upstream) — cap the repeater to a tidy number.
const MAX_REFERENCE_LINKS = 10;

export default function CreatorBriefForm({ product = 'subscription', preview = false }: { product?: Product; preview?: boolean }) {
  const { user, refetchUser } = useAuth();
  // "Save as my default currency" — defaults on when the account has none yet.
  const [saveDefaultCur, setSaveDefaultCur] = useState(false);
  const currencyTouchedRef = useRef(false);
  const isAssignment = product === 'assignment';
  const [form, setForm] = useState<FormState>(() => preview ? {
    ...emptyForm,
    contactName: 'Jeff', email: 'jeff@tagconnects.in', phone: '+91 9645545553',
    platforms: ['Instagram', 'YouTube'], niches: ['Education', 'Technology'],
    formats: ['Reels / Shorts / TikToks', 'Static posts / carousels'],
    serviceType: 'Brand promotion', serviceCount: '4',
    levels: ['10,000 to 25,000', '50,000 to 100k'], levelBudgets: { '10,000 to 25,000': '8000', '50,000 to 100k': '25000' },
    ageGroups: ['18-24', '25-34'],
    usageRights: 'Organic usage on the creator\'s channels for 6 months.',
    productDelivery: 'Product shipped to the creator before the start date.',
    brandName: 'Northstar Learning', businessNature: 'Online education and professional upskilling',
    businessNote: 'We help working professionals build practical growth and leadership skills through cohort-based programmes.',
    requirement: 'Partner with education creators to launch our new leadership cohort — intro reels, a YouTube integration and carousel posts linking to the cohort page.',
  } : { ...emptyForm });
  const [clientLinks, setClientLinks] = useState<BusinessLinks>({});
  const [linksOpen, setLinksOpen] = useState(false);
  const [checkingLinks, setCheckingLinks] = useState(false);
  const [errors, setErrors] = useState<SubmitError[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [countries, setCountries] = useState<Country[]>(() => preview ? PREVIEW_COUNTRIES : []);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [contactAutoFilled, setContactAutoFilled] = useState(preview);
  const [brandAutoFilled, setBrandAutoFilled] = useState(preview);
  const [editingContact, setEditingContact] = useState(!preview);
  const [editingBrand, setEditingBrand] = useState(!preview);
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
    const savedCurrency = isCurrencyCode(user.default_currency) ? user.default_currency : null;
    setSaveDefaultCur(!savedCurrency);
    setForm((current) => ({
      ...current,
      ...(savedCurrency && !currencyTouchedRef.current
        ? { currency: savedCurrency }
        : {}),
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

  function setReferenceLink(index: number, value: string) {
    setForm((current) => ({ ...current, referenceLinks: current.referenceLinks.map((link, i) => (i === index ? value : link)) }));
  }

  function addReferenceLink() {
    setForm((current) => ({ ...current, referenceLinks: [...current.referenceLinks, ''] }));
  }

  function removeReferenceLink(index: number) {
    setForm((current) => ({ ...current, referenceLinks: current.referenceLinks.filter((_, i) => i !== index) }));
  }

  function toggle(key: 'platforms' | 'niches' | 'formats' | 'levels' | 'stateRegions' | 'ageGroups' | 'languages', value: string) {
    setForm((current) => ({
      ...current,
      [key]: key === 'niches' || key === 'formats'
        ? toggleCreatorPreference(current[key], value)
        : current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value],
    }));
  }

  function changeCountry(countryId: string) {
    setForm((current) => ({ ...current, countryId, stateRegions: [] }));
  }

  function updateLevelBudget(level: string, value: string) {
    setForm((current) => ({ ...current, levelBudgets: { ...current.levelBudgets, [level]: value.replace(/[^0-9]/g, '') } }));
  }

  const selectedCountryName = countries.find((country) => country.id === form.countryId)?.name ?? '';
  const stateOptions = STATES_BY_COUNTRY[selectedCountryName] ?? [];
  const contactComplete = Boolean(form.contactName.trim() && form.email.trim() && form.phone.trim());
  const brandComplete = Boolean(form.brandName.trim() && form.businessNature.trim() && form.businessNote.trim());
  const audienceLocation = form.countryId
    ? `${selectedCountryName}${form.stateRegions.length ? `: ${form.stateRegions.join(', ')}` : ''}`
    : 'Anywhere';
  // Stepper count — defaults to 1 the moment a service is picked.
  const serviceCountValue = Math.min(999, Math.max(1, Number(form.serviceCount) || 1));

  function selectService(value: string) {
    setForm((current) => ({
      ...current,
      serviceType: value,
      // Fresh service → count restarts at the default of 1.
      serviceCount: value === current.serviceType ? current.serviceCount : '1',
    }));
  }

  async function handleSubmit(event?: React.FormEvent, savedLinks?: BusinessLinks) {
    event?.preventDefault();
    if (submitting || checkingLinks) return;
    setErrors([]);
    const validationErrors: SubmitError[] = [];
    if (!form.contactName.trim() || !form.email.trim() || !form.phone.trim()) validationErrors.push({ message: 'Add your contact name, email, and phone number in Customer details.', targetId: 'brief-contact' });
    if (!form.brandName.trim() || !form.businessNature.trim() || !form.businessNote.trim()) validationErrors.push({ message: 'Complete the brand details before submitting.', targetId: 'brief-brand' });
    if (!form.requirement.trim()) validationErrors.push({ message: `Describe what you need the ${ROLE_NAME} to own.`, targetId: 'brief-requirement' });
    // Vocabulary-backed picks are required while options exist.
    if (CREATOR_PLATFORM_OPTIONS.length > 0 && form.platforms.length === 0) validationErrors.push({ message: 'Choose at least one publishing platform in Channel preferences.', targetId: 'brief-preferences' });
    if (CREATOR_NICHE_OPTIONS.length > 0 && form.niches.length === 0) validationErrors.push({ message: 'Choose at least one creator niche in Channel preferences.', targetId: 'brief-preferences' });
    if (CREATOR_FORMAT_OPTIONS.length > 0 && form.formats.length === 0) validationErrors.push({ message: 'Choose at least one content format in Channel preferences.', targetId: 'brief-preferences' });
    if (LIVE_CREATOR_SERVICES.length > 0 && !form.serviceType) validationErrors.push({ message: 'Choose a service type in Service type, levels & budget.', targetId: 'brief-plan' });
    if (form.levels.length === 0) validationErrors.push({ message: 'Select at least one creator level in Service type, levels & budget.', targetId: 'brief-plan' });
    if (form.languages.length === 0) validationErrors.push({ message: 'Choose at least one content language in Channel preferences.', targetId: 'brief-preferences' });
    if (validationErrors.length > 0) {
      showBriefErrors(validationErrors, setErrors);
      return;
    }

    setCheckingLinks(true);
    try {
      let links = savedLinks ?? clientLinks;
      if (!savedLinks && !preview) {
        const { data } = await api.get('/business/me');
        links = businessProfileLinks(data.business ?? data);
      }
      setClientLinks(links);
      if (!hasBusinessLink(links)) { setLinksOpen(true); return; }
    } catch {
      showBriefErrors([{ message: 'Could not check your business links. Please try submitting again.' }], setErrors);
      return;
    } finally { setCheckingLinks(false); }

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
          showBriefErrors(
            [{ message: 'Your voice note couldn’t be uploaded. Check your connection and try again, or remove it to submit without audio.' }],
            setErrors,
          );
          return;
        }
      }

      // Follower levels are custom targeting, not the standard experience
      // brackets, so the card carries them as a Custom tier with per-level
      // budgets. The structured keys below are what matching reads.
      const levelBudgets = Object.fromEntries(form.levels.flatMap((level) => {
        const amount = Number(form.levelBudgets[level]);
        return Number.isFinite(amount) && amount > 0 ? [[level, Math.round(amount)]] : [];
      }));
      const levelBudgetValues = Object.values(levelBudgets);
      const legacyBudget = levelBudgetValues.length === 1 || levelBudgetValues.every((value) => value === levelBudgetValues[0]) ? levelBudgetValues[0] : undefined;
      const usageRightsText = [form.usageRights, form.paidAds, form.exclusivity, form.approvals]
        .map((value) => value.trim())
        .filter(Boolean)
        .join(' ');
      const productDeliveryText = form.productDelivery.trim();
      const referenceLinks = form.referenceLinks.map((link) => link.trim()).filter(Boolean);

      await api.post('/business/connect-brief', {
        service_types: ['social_media_creator'],
        brand_name: form.brandName.trim(),
        business_nature: form.businessNature.trim(),
        business_note: form.businessNote.trim(),
        contact_name: form.contactName.trim(), email: form.email.trim(), phone: form.phone.trim(),
        ...(requirementVoiceUrl ? { requirement_voice_url: requirementVoiceUrl } : {}),
        languages: form.languages,
        working_days: isAssignment ? [] : DEFAULT_WORKING_DAYS,
        ...(form.countryId ? { country_id: form.countryId } : {}),
        state_regions: form.countryId ? form.stateRegions : [],
        card_type: product,
        role_requirements: {
          social_media_creator: {
            note: form.requirement.trim(),
            tiers: ['Custom'],
            ...(legacyBudget ? { budget: legacyBudget } : {}),
            ...(Object.keys(levelBudgets).length ? { tier_budgets: levelBudgets } : {}),
            currency: form.currency,
            duration: form.duration.trim(),
            start_date: form.startDate,
            deadline: form.deliveryDate,
            additional_requirements: {
              channels: form.platforms,
              creator_niches: form.niches,
              creator_formats: form.formats,
              ...(form.serviceType
                ? { creator_services: [form.serviceType], service_count: [`${form.serviceType} × ${serviceCountValue}`] }
                : {}),
              creator_levels: form.levels.map((level) => {
                const amount = Number(form.levelBudgets[level]);
                return Number.isFinite(amount) && amount > 0
                  ? `${level} (${form.currency} ${Math.round(amount).toLocaleString('en-IN')}${isAssignment ? '' : ' / month'})`
                  : level;
              }),
              desired_age: form.ageGroups,
              audience_location: [audienceLocation],
              // Legacy brief keys the upstream card still renders — synthesized
              // from the structured picks so the requirement card reads cleanly.
              creator_audience: [`Creator niches: ${form.niches.join(', ')}. Audience location: ${audienceLocation}. Desired age: ${form.ageGroups.length ? form.ageGroups.join(', ') : 'Any'}.`],
              deliverables: [`Content formats: ${form.formats.join(', ')}.${form.serviceType ? ` Quantity: ${serviceCountValue} × ${form.serviceType}.` : ''}`],
              usage_rights: [usageRightsText || 'Not specified'],
              ...(productDeliveryText ? { campaign_logistics: [productDeliveryText] } : {}),
              ...(referenceLinks.length ? { reference_links: referenceLinks } : {}),
            } satisfies Record<string, string[]>,
          },
        },
      });
      if (saveDefaultCur && form.currency !== user?.default_currency && isCurrencyCode(form.currency)) {
        try {
          await saveDefaultCurrency(form.currency);
          await refetchUser();
        } catch { /* non-fatal — brief already landed */ }
      }
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (caught) {
      if ((caught as { response?: { data?: { code?: string } } }).response?.data?.code === 'BUSINESS_LINK_REQUIRED') {
        setClientLinks({}); setLinksOpen(true); return;
      }
      const message = (caught as { response?: { data?: { error?: string } } })?.response?.data?.error;
      showBriefErrors(
        [{ message: message || 'Failed to submit. Please check the details and try again.' }],
        setErrors,
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return <div className="shb-connect-bg flex min-h-full items-center justify-center px-5 py-16"><div className="w-full max-w-md rounded-2xl border border-[#E8E5DD] bg-white p-8 text-center shadow-sm"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F2FCBC]"><CheckIcon /></div><h1 className="mt-4 text-xl font-semibold text-[#222]">Requirement submitted</h1><p className="mt-2 text-sm leading-relaxed text-[#5C5C5C]">Your {ROLE_NAME} {product} brief will be shared automatically with matching creators while our team reviews it.</p><button type="button" onClick={() => setSubmitted(false)} className="shb-submit mt-6">Back to brief</button></div><style>{styles}</style></div>;
  }

  return (
    <div className="shb-connect-bg min-h-full px-4 py-5 sm:py-7">
      <BusinessLinksDialog open={linksOpen} initialLinks={clientLinks} preview={preview} onClose={() => setLinksOpen(false)} onSaved={links => { setClientLinks(links); setLinksOpen(false); void handleSubmit(undefined, links); }} />
      <div className="mx-auto max-w-[44rem]">
        <header className="mb-4 text-center"><h1 className="text-[18px] font-semibold tracking-tight text-[#222] sm:text-[20px]">Tell us about your brand</h1><p className="mt-1 text-[13px] text-[#5C5C5C]">A few quick details so we can match you with the right creators.</p></header>

        <form onSubmit={event => void handleSubmit(event)} noValidate className="space-y-5 pb-8">
          <CategoryBanner product={product} />
          {errors.length > 0 && <SubmitErrorSummary errors={errors} id="brief-errors-top" />}

          <GroupHeader index={1} title="Business details" subtitle="Who you are and how we reach you." />
          <Section
            id="brief-contact"
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
            id="brief-brand"
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

          <GroupHeader index={2} title={`${ROLE_NAME} requirement`} subtitle="The campaign scope and outcomes you need." />
          <Section id="brief-requirement" eyebrow="Requirement" title={`What should your ${ROLE_NAME} own?`} hint="Be specific about the campaign, deliverables and the commercial outcome.">
            <Field label="Describe your requirement" required><textarea className="shb-input min-h-32 resize-y" value={form.requirement} onChange={(e) => update('requirement', e.target.value)} placeholder="e.g. Partner with lifestyle creators to launch our new product line — intro reels, integration posts and UGC we can reuse on our own channels." /></Field>
            <div>
              <p className="mb-1 text-sm font-medium text-[#222]">Reference links <small className="ml-1 font-normal text-[#9C9486]">(optional)</small></p>
              <p className="mb-2 text-xs leading-relaxed text-[#7A7568]">Links the creators should see — product pages, brand site, past campaigns or moodboards.</p>
              <div className="space-y-2">
                {form.referenceLinks.map((link, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input type="url" inputMode="url" className="shb-input" value={link} onChange={(e) => setReferenceLink(index, e.target.value)} placeholder="https://…" />
                    <button type="button" aria-label={`Remove reference link ${index + 1}`} onClick={() => removeReferenceLink(index)} className="shb-ref-link-remove">✕</button>
                  </div>
                ))}
                {form.referenceLinks.length < MAX_REFERENCE_LINKS && <button type="button" onClick={addReferenceLink} className="shb-ref-link-add">+ Add link</button>}
              </div>
            </div>
            <AudioNote
              audioUrl={audioUrl}
              onChange={(blob, url) => {
                audioBlobRef.current = blob;
                setAudioUrl(url);
              }}
            />
          </Section>

          <Section id="brief-plan" eyebrow={isAssignment ? 'Assignment' : 'Subscription'} title="Service type, levels & budget" hint={isAssignment ? 'Pick the paid work you need, creator levels by follower count, and the project finish line.' : 'Pick the paid work you need and the follower levels to target.'}>
            <ServiceTypeSelector
              options={LIVE_CREATOR_SERVICES}
              descriptions={SERVICE_DESCRIPTIONS}
              selected={form.serviceType}
              count={serviceCountValue}
              onSelect={selectService}
              onCountChange={(value) => update('serviceCount', value)}
            />
            <Field label="Budget currency" required><CurrencyField label="Budget currency" value={form.currency as CurrencyCode} onChange={(code) => { currencyTouchedRef.current = true; update('currency', code); }} accountDefault={user?.default_currency} saveDefault={saveDefaultCur} onSaveDefaultChange={setSaveDefaultCur} /></Field>
            <CreatorLevelSelector product={product} currency={form.currency} selected={form.levels} values={form.levelBudgets} onToggle={(value) => toggle('levels', value)} onBudgetChange={updateLevelBudget} />
            <Field label="Duration" optional><input className="shb-input" value={form.duration} onChange={(e) => update('duration', e.target.value)} placeholder="e.g. 4 weeks, 3 posts per creator" /></Field>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Expected start date" optional><input type="date" className="shb-input" value={form.startDate} onChange={(e) => update('startDate', e.target.value)} /></Field><Field label="Delivery date" optional><input type="date" className="shb-input" value={form.deliveryDate} onChange={(e) => update('deliveryDate', e.target.value)} /></Field></div>
          </Section>

          <GroupHeader index={3} title="Channel preferences" subtitle="Channels, audience, language and content fit." />
          <Section id="brief-preferences" eyebrow="Matching" title="Which creators should we prioritise?" hint="These preferences drive creator matching — the options mirror what creators list on their profiles.">
            <ChipField label="Publishing platforms" options={CREATOR_PLATFORM_OPTIONS} selected={form.platforms} onToggle={(value) => toggle('platforms', value)} hint="Where the sponsored content should be published." />
            <ChipField label="Creator niche" options={[ANY_CREATOR_PREFERENCE, ...CREATOR_NICHE_OPTIONS]} selected={form.niches} onToggle={(value) => toggle('niches', value)} hint="Choose Any to match creators from any niche, or select specific niches." />
            <ChipField label="Content format" options={[ANY_CREATOR_PREFERENCE, ...CREATOR_FORMAT_OPTIONS]} selected={form.formats} onToggle={(value) => toggle('formats', value)} hint="Choose Any to accept any content format, or select specific formats." />
            <Field label="Audience location" optional>
              <select aria-label="Audience location" className="shb-input" value={form.countryId} onChange={(e) => changeCountry(e.target.value)}>
                <option value="">Anywhere (no preference)</option>
                {countries.map((country) => <option key={country.id} value={country.id}>{country.name}</option>)}
              </select>
            </Field>
            {form.countryId && stateOptions.length > 0 && <ChipField label="State / region" options={stateOptions} selected={form.stateRegions} onToggle={(value) => toggle('stateRegions', value)} required={false} hint={`Choose one or more locations within ${selectedCountryName}, or leave blank for anywhere in the country.`} />}
            <ChipField label="Desired age" options={AGE_GROUPS} selected={form.ageGroups} onToggle={(value) => toggle('ageGroups', value)} required={false} hint="Age groups the creator's audience should cover." />
            <div className="rounded-xl border border-[#E0DCCE] bg-[#FBFAF6] p-4">
              <p className="mb-1 text-sm font-medium text-[#222]">Usage rights &amp; approvals <small className="ml-1 font-normal text-[#9C9486]">(optional)</small></p>
              <p className="mb-3 text-xs leading-relaxed text-[#7A7568]">How your brand may reuse the creator's content. Leave anything blank to discuss it with the creator.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Usage rights" optional><input className="shb-input" value={form.usageRights} onChange={(e) => update('usageRights', e.target.value)} placeholder="e.g. Organic reuse on our channels for 6 months" /></Field>
                <Field label="Paid ads" optional><input className="shb-input" value={form.paidAds} onChange={(e) => update('paidAds', e.target.value)} placeholder="e.g. Creator content allowed in Meta ads" /></Field>
                <Field label="Exclusivity" optional><input className="shb-input" value={form.exclusivity} onChange={(e) => update('exclusivity', e.target.value)} placeholder="e.g. No competing brands for 60 days" /></Field>
                <Field label="Approval requirements" optional><input className="shb-input" value={form.approvals} onChange={(e) => update('approvals', e.target.value)} placeholder="e.g. All content approved before publishing" /></Field>
              </div>
            </div>
            <Field label="Product delivery" optional><textarea className="shb-input min-h-20 resize-y" maxLength={1000} value={form.productDelivery} onChange={(e) => update('productDelivery', e.target.value)} placeholder="Product shipping, travel or reporting requirements for the creators." /></Field>
            <ChipField label="Content language" options={LANGUAGES} selected={form.languages} onToggle={(value) => toggle('languages', value)} hint="Select the languages the creators should be comfortable creating in." />
          </Section>

          <div className="shb-submit-wrap"><SubmitErrorSummary errors={errors} id="brief-errors-submit" /><button type="submit" disabled={submitting || checkingLinks} className="shb-submit">{submitting || checkingLinks ? 'Submitting…' : `Submit ${product} brief`}</button></div>
        </form>
      </div>
      <style>{styles}</style>
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

function CategoryBanner({ product }: { product: Product }) { return <div className="shb-category"><div><p>{product} brief · category</p><span>✓ &nbsp;{ROLE_NAME}</span></div></div>; }
function GroupHeader({ index, title, subtitle }: { index: number; title: string; subtitle: string }) { return <div className="flex items-start gap-3 pt-2"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#0a0a0a] bg-[#FCF487] text-base font-bold shadow-[2px_2px_0_#0a0a0a]">{index}</span><div><h2 className="text-lg font-bold text-[#0a0a0a]">{title}</h2><p className="text-sm text-[#7A7568]">{subtitle}</p></div></div>; }
function Section({ eyebrow, title, hint, children, compact = false, action, summary, id }: {
  eyebrow: string;
  title: string;
  hint: string;
  children: React.ReactNode;
  compact?: boolean;
  action?: { label: string; onClick: () => void };
  summary?: React.ReactNode;
  id?: string;
}) { return <section id={id} className={`shb-section scroll-mt-24 ${compact ? 'shb-section-compact' : ''}`}><div className="flex items-start justify-between gap-4"><div>{eyebrow && <p className="shb-eyebrow">{eyebrow}</p>}{title && <h3>{title}</h3>}{hint && <p className="shb-hint">{hint}</p>}</div>{action && <button type="button" onClick={action.onClick} className="shb-edit-button">{action.label}</button>}</div>{compact ? <div className="shb-compact-summary">{summary}</div> : <div className="mt-5 space-y-4">{children}</div>}</section>; }
function CompactSummary({ title, details }: { title: string; details: string[] }) { return <div><strong>{title}</strong><p>{details.filter(Boolean).join(' · ')}</p></div>; }
function Field({ label, required, optional, children }: { label: string; required?: boolean; optional?: boolean; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-sm font-medium text-[#222]">{label}{required && <b className="text-[#D04A2C]">*</b>}{optional && <small className="ml-1 font-normal text-[#9C9486]">(optional)</small>}</span>{children}</label>; }
function Readonly({ value }: { value: string }) { return <div className="shb-readonly">{value || '—'}</div>; }
function ChipField({ label, options, selected, onToggle, required = true, hint }: { label: string; options: string[]; selected: string[]; onToggle: (value: string) => void; required?: boolean; hint?: string }) { return <div><p className="mb-1 text-sm font-medium text-[#222]">{label}{required && options.length > 0 ? <b className="text-[#D04A2C]">*</b> : <small className="ml-1 font-normal text-[#9C9486]">(optional)</small>}</p>{hint && <p className="mb-2 text-xs leading-relaxed text-[#7A7568]">{hint}</p>}{options.length === 0 ? <p className="rounded-xl border border-dashed border-[#D9D5C7] bg-[#FBFAF6] px-4 py-3 text-xs text-[#9C9486]">No options are active in the creator catalog right now — our team will confirm this with you.</p> : <div className="flex flex-wrap gap-2">{options.map((option) => { const on = selected.includes(option); return <button key={option} type="button" aria-pressed={on} className={`shb-chip ${on ? 'shb-chip-on' : ''}`} onClick={() => onToggle(option)}>{on ? `✓ ${option}` : option}</button>; })}</div>}</div>; }
function ServiceTypeSelector({ options, descriptions, selected, count, onSelect, onCountChange }: {
  options: string[];
  descriptions: Record<string, string>;
  selected: string;
  count: number;
  onSelect: (value: string) => void;
  onCountChange: (value: string) => void;
}) {
  return <div>
    <p className="mb-1 text-sm font-medium text-[#222]">Service type{options.length > 0 && <b className="text-[#D04A2C]">*</b>}</p>
    <p className="mb-3 text-xs leading-relaxed text-[#7A7568]">Pick one — same service types creators offer on their job profile. Matching runs on these. The selected card opens a count stepper (how many you need).</p>
    {options.length === 0 ? <p className="rounded-xl border border-dashed border-[#D9D5C7] bg-[#FBFAF6] px-4 py-3 text-xs text-[#9C9486]">No service types are active in the creator catalog right now — our team will confirm the service with you.</p> : <div className="grid items-start gap-2 sm:grid-cols-2">{options.map((option) => {
      const on = selected === option;
      const desc = descriptions[option];
      return <div key={option} className={`shb-tier-card ${on ? 'shb-tier-card-on' : ''}`}>
        <button type="button" aria-pressed={on} onClick={() => onSelect(option)} className="shb-tier-select shb-service-select">
          <span className="shb-tier-card-top"><span className="shb-tier-kicker">Service</span><span className="shb-tier-check">{on ? '✓' : ''}</span></span>
          <strong>{option}</strong>
          {desc && <small>{desc}</small>}
        </button>
        {on && (
          <div className="shb-tier-budget shb-service-count">
            <span>How many do you need?</span>
            <div className="shb-stepper">
              <button type="button" aria-label={`Decrease ${option} count`} disabled={count <= 1} onClick={() => onCountChange(String(Math.max(1, count - 1)))}>−</button>
              <strong aria-label={`${option} count`}>{count}</strong>
              <button type="button" aria-label={`Increase ${option} count`} disabled={count >= 999} onClick={() => onCountChange(String(Math.min(999, count + 1)))}>+</button>
            </div>
          </div>
        )}
      </div>;
    })}</div>}
  </div>;
}
function CreatorLevelSelector({ product, currency, selected, values, onToggle, onBudgetChange }: {
  product: Product;
  currency: string;
  selected: string[];
  values: Record<string, string>;
  onToggle: (value: string) => void;
  onBudgetChange: (level: string, value: string) => void;
}) {
  const budgetLabel = product === 'assignment' ? 'Project budget amount' : 'Monthly budget amount';
  return <div><p className="mb-1 text-sm font-medium text-[#222]">Creator level<b className="text-[#D04A2C]">*</b></p><p className="mb-3 text-xs leading-relaxed text-[#7A7568]">Select one or more follower-count levels. Each selected card opens an optional budget amount field.</p><div className="grid items-start gap-2 sm:grid-cols-2">{CREATOR_LEVELS.map((level) => { const on = selected.includes(level.value); return <div key={level.value} className={`shb-tier-card ${on ? 'shb-tier-card-on' : ''}`}><button type="button" aria-pressed={on} onClick={() => onToggle(level.value)} className="shb-tier-select"><span className="shb-tier-card-top"><span className="shb-tier-kicker">Followers</span><span className="shb-tier-check">{on ? '✓' : ''}</span></span><strong>{level.value}</strong><small>{level.desc}</small></button>{on && <label className="shb-tier-budget"><span>{budgetLabel} <em>Optional</em></span><span className="shb-budget-input"><b>{currency}</b><input aria-label={`${budgetLabel} for ${level.value} followers`} inputMode="numeric" placeholder="Enter amount" value={formatMoneyInput(values[level.value] ?? '', currency)} onChange={(e) => onBudgetChange(level.value, e.target.value)} /></span><small>Leave blank if you want our team to recommend a budget.</small></label>}</div>; })}</div></div>;
}

function formatMoneyInput(value: string, currency: string) {
  if (!value) return '';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return amount.toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US', { maximumFractionDigits: 0 });
}
function MicIcon() { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="9" y="3" width="6" height="11" rx="3" /><path strokeLinecap="round" d="M6 11a6 6 0 0012 0M12 17v4m-3 0h6" /></svg>; }
function CheckIcon() { return <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>; }

const styles = `
.shb-connect-bg{background:#F7F4EC;color:#222;font-family:var(--font-jakarta),sans-serif}
.shb-category{display:flex;align-items:center;justify-content:space-between;gap:16px;border:2px solid #0a0a0a;border-radius:14px;background:#fff;padding:17px 18px;box-shadow:3px 3px 0 #0a0a0a}
.shb-category p{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#7A7568;font-weight:700;margin:0 0 7px}.shb-category span{display:inline-flex;border:1.5px solid #0a0a0a;border-radius:999px;background:#F2FCBC;padding:4px 11px;font-size:14px;font-weight:700}.shb-category button{border:2px solid #0a0a0a;border-radius:9px;background:white;padding:8px 14px;font-size:13px;font-weight:700;box-shadow:2px 2px 0 #0a0a0a}
.shb-section{border:1px solid #E8E5DD;border-radius:18px;background:white;padding:24px;box-shadow:0 2px 5px rgba(41,38,31,.08)}
.shb-eyebrow{font-size:11px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:#8B8374}.shb-section h3{margin-top:4px;font-size:19px;font-weight:700;color:#222}.shb-hint{margin-top:3px;font-size:13px;line-height:1.5;color:#7A7568}
.shb-section-compact{padding:14px 18px}.shb-section-compact h3{margin-top:2px;font-size:15px}.shb-edit-button{flex:none;border:1.5px solid #0a0a0a;border-radius:9px;background:#fff;padding:7px 13px;font-size:12px;font-weight:700;color:#222;box-shadow:2px 2px 0 #FCF487}.shb-edit-button:hover{background:#F9FDEB}.shb-compact-summary{margin-top:9px;border-top:1px solid #E8E5DD;padding-top:9px}.shb-compact-summary strong{display:block;font-size:14px;color:#222}.shb-compact-summary p{display:-webkit-box;overflow:hidden;margin-top:3px;color:#7A7568;font-size:12px;line-height:1.5;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.shb-input{width:100%;border:1px solid #D9D5C7;border-radius:11px;background:#fff;padding:11px 13px;font:inherit;font-size:14px;color:#222;outline:none}.shb-input:focus{border-color:#0a0a0a;box-shadow:0 0 0 3px rgba(252,244,135,.65)}
.shb-readonly{min-height:46px;border:1px solid #E2DFD3;border-radius:11px;background:#F1EFE7;padding:12px 13px;font-size:14px;color:#5C5C5C}.shb-help{margin-top:5px;font-size:11px;color:#9C9486}
.shb-chip{border:1px solid #D9D5C7;border-radius:999px;background:#fff;padding:7px 12px;font-size:12px;font-weight:600;color:#5C5C5C;transition:.15s}.shb-chip-on{border-color:#0a0a0a;background:#F2FCBC;color:#0a0a0a;box-shadow:1px 1px 0 #0a0a0a}
.shb-service-select{min-height:0;padding:12px 13px}.shb-service-select strong{margin-top:8px;font-size:13.5px}.shb-service-count{display:flex;align-items:center;justify-content:space-between;gap:12px}.shb-service-count>span:first-child{margin:0;font-size:11px}
.shb-stepper{display:inline-flex;flex:none;align-items:center;gap:8px;border:1px solid #C9C3B5;border-radius:10px;background:#fff;padding:4px}.shb-stepper button{display:flex;height:30px;width:30px;align-items:center;justify-content:center;border:1.5px solid #0a0a0a;border-radius:8px;background:#fff;font-size:16px;line-height:1;font-weight:800;color:#0a0a0a;transition:.12s}.shb-stepper button:hover:not(:disabled){background:#F2FCBC}.shb-stepper button:disabled{border-color:#D9D5C7;color:#C9C3B5;cursor:not-allowed}.shb-stepper strong{min-width:2.5ch;text-align:center;font-size:14px;color:#222}
.shb-tier-card{width:100%;overflow:hidden;border:1px solid #D9D5C7;border-radius:15px;background:#fff;text-align:left;color:#222;transition:.18s}.shb-tier-card:hover{border-color:#0a0a0a}.shb-tier-card-on{border:2px solid #0a0a0a;background:#F9FDEB;box-shadow:3px 3px 0 #C6F24E}.shb-tier-select{display:block;width:100%;min-height:126px;padding:13px;text-align:left}.shb-tier-card-top{display:flex;align-items:center;justify-content:space-between}.shb-tier-kicker{border-radius:999px;background:#F3F0E7;padding:3px 7px;color:#7A7568;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.shb-tier-card-on .shb-tier-kicker{background:#FCF487;color:#222}.shb-tier-check{display:flex;height:21px;width:21px;align-items:center;justify-content:center;border:1.5px solid #C9C3B5;border-radius:999px;background:#fff;font-size:11px;font-weight:800}.shb-tier-card-on .shb-tier-check{border-color:#0a0a0a;background:#FCF487}.shb-tier-select strong,.shb-tier-select small{display:block}.shb-tier-select strong{margin-top:11px;font-size:14px}.shb-tier-select small{margin-top:4px;font-size:11px;line-height:1.45;color:#7A7568}.shb-tier-budget{display:block;border-top:1px solid #E0DCCE;padding:13px;background:rgba(255,255,255,.68)}.shb-tier-budget>span:first-child{display:block;margin-bottom:7px;font-size:11px;font-weight:700;color:#3A3A3A}.shb-tier-budget em{margin-left:5px;border-radius:999px;background:#EFECE3;padding:2px 6px;font-size:8px;font-style:normal;text-transform:uppercase;color:#7A7568}.shb-tier-budget>small{display:block;margin-top:6px;font-size:10px;line-height:1.4;color:#8B8374}.shb-budget-input{display:flex;align-items:stretch;overflow:hidden;border:1px solid #C9C3B5;border-radius:10px;background:#fff}.shb-budget-input:focus-within{border-color:#0a0a0a;box-shadow:0 0 0 3px rgba(252,244,135,.65)}.shb-budget-input b{display:flex;align-items:center;border-right:1px solid #E0DCCE;background:#F3F0E7;padding:0 10px;font-size:11px;color:#5C5C5C}.shb-budget-input input{min-width:0;flex:1;background:transparent;padding:10px 11px;font:inherit;font-size:14px;outline:none}
.shb-choice{position:relative;min-height:108px;border:1px solid #D9D5C7;border-radius:11px;background:white;padding:11px;text-align:left}.shb-choice strong,.shb-choice span{display:block}.shb-choice strong{font-size:13px}.shb-choice span{margin-top:3px;font-size:10px;color:#7A7568}.shb-choice .shb-choice-daily{margin-top:8px;border-top:1px solid #E8E5DD;padding-top:6px;color:#222;font-size:12px;font-weight:700}.shb-choice .shb-choice-cap{margin-top:5px;font-size:9px;color:#7A7568}.shb-choice em{position:absolute;right:6px;top:6px;border-radius:999px;background:#FCF487;padding:2px 5px;font-size:8px;font-style:normal;font-weight:700;text-transform:uppercase}.shb-choice-on{border:2px solid #0a0a0a;background:#F9FDEB;box-shadow:2px 2px 0 #0a0a0a}
.shb-plan-note{display:flex;align-items:flex-start;gap:8px;margin-top:10px;border:1px solid #E8E5DD;border-radius:10px;background:#FBFAF6;padding:10px 12px;color:#7A7568;font-size:11px;line-height:1.5}.shb-plan-note strong{color:#3A3A3A}
.shb-currency{width:146px;flex:none;padding-right:30px}
.shb-audio-note{border:1px solid #E0DCCE;border-radius:12px;background:#FBFAF6;padding:12px}.shb-audio-primary,.shb-audio-secondary,.shb-audio-stop{display:flex;align-items:center;gap:7px;border-radius:9px;padding:9px 12px;font-size:12px;font-weight:700}.shb-audio-primary{flex:1;border:1px dashed #9C9486;background:#fff;color:#3A3A3A}.shb-audio-primary span{margin-left:auto;border-radius:999px;background:#EFECE3;padding:2px 7px;font-size:9px;text-transform:uppercase}.shb-audio-secondary{border:1px solid #D9D5C7;background:#fff;color:#5C5C5C}.shb-audio-danger{color:#9B3D29}.shb-audio-stop{border:1px solid #0a0a0a;background:#0a0a0a;color:#fff}.shb-recording-dot{height:10px;width:10px;border-radius:999px;background:#D1573B;box-shadow:0 0 0 4px rgba(209,87,59,.16);animation:shb-pulse 1.15s ease-in-out infinite}@keyframes shb-pulse{50%{opacity:.4;transform:scale(.82)}}
.shb-ref-link-remove{display:flex;height:44px;width:40px;flex:none;align-items:center;justify-content:center;border:1px solid #D9D5C7;border-radius:11px;background:#fff;font-size:13px;font-weight:700;color:#9C9486;transition:.15s}.shb-ref-link-remove:hover{border-color:#9B3D29;color:#9B3D29}
.shb-ref-link-add{display:inline-flex;align-items:center;gap:6px;border:1px dashed #9C9486;border-radius:9px;background:#fff;padding:9px 14px;font-size:12px;font-weight:700;color:#3A3A3A;transition:.15s}.shb-ref-link-add:hover{border-color:#0a0a0a;background:#F9FDEB;color:#0a0a0a}
.shb-submit-wrap{position:sticky;bottom:0;z-index:5;background:linear-gradient(transparent,#F7F4EC 28%);padding-top:22px}.shb-submit{width:100%;border:2px solid #0a0a0a;border-radius:11px;background:#0a0a0a;padding:12px 18px;font-size:14px;font-weight:700;color:white;box-shadow:3px 3px 0 #C6F24E}.shb-submit:hover{background:#252525}.shb-submit:disabled{opacity:.55}
@media(max-width:640px){.shb-section{padding:19px}.shb-category{padding:14px}.shb-category button{padding:7px 10px}}
`;
