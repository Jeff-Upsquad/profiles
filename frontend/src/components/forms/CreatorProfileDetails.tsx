import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import MultiSelect from '@/components/ui/MultiSelect';
import { COUNTRIES, INDIAN_STATES, DISTRICTS_BY_STATE } from '@/constants/india-locations';
import { GENDER_OPTIONS } from '@/constants/lead-form-options';
import {
  CREATOR_ACCOUNT_TYPES,
  CREATOR_PLATFORM_OPTIONS,
  CREATOR_NICHE_OPTIONS,
  CREATOR_FORMAT_OPTIONS,
  CREATOR_SERVICE_OPTIONS,
  CREATOR_LANGUAGE_OPTIONS,
  CREATOR_CURRENCY_OPTIONS,
  coerceCreatorPlatforms,
  coerceCreatorServices,
  newCreatorPlatform,
  DEFAULT_USAGE_RIGHTS_MONTHS,
  usageMonthsLabel,
  type CreatorPlatformEntry,
  type CreatorServiceEntry,
  type CreatorRateEntry,
} from '@/constants/creator-profile';

interface CreatorProfileDetailsProps {
  values: Record<string, any>;
  onChange: (fieldKey: string, value: any) => void;
  errors?: Record<string, string>;
}

function SectionCard({
  tint,
  icon,
  title,
  description,
  children,
  id,
}: {
  tint: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-2xl border border-[#E7E7EA] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-7"
    >
      <div className="mb-5 flex items-start gap-3">
        <div className={`${tint} flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl`} style={{ color: 'var(--tint-icon)' }}>
          {icon}
        </div>
        <div>
          <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#0a0a0a]">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-[#737373]">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function CreatorProfileDetails({ values, onChange, errors = {} }: CreatorProfileDetailsProps) {
  const platforms = coerceCreatorPlatforms(values.creator_platforms);
  const services = coerceCreatorServices(values.creator_services);

  const setPlatforms = (next: CreatorPlatformEntry[]) => onChange('creator_platforms', next);
  const setServices = (next: CreatorServiceEntry[]) => onChange('creator_services', next);

  const patchPlatform = (id: string, patch: Partial<CreatorPlatformEntry>) =>
    setPlatforms(platforms.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const addPlatform = () => setPlatforms([...platforms, newCreatorPlatform()]);

  const removePlatform = (id: string) => {
    setPlatforms(platforms.filter((p) => p.id !== id));
    // Drop the removed platform's rate rows from every service.
    setServices(
      services.map((s) => {
        if (!(id in s.rates)) return s;
        const rates = { ...s.rates };
        delete rates[id];
        return { ...s, rates };
      }),
    );
  };

  // Multiple services allowed — tapping toggles one on/off. A service starts
  // with no rates and the 1-year default usage periods; every platform the
  // creator entered above is shown for it, each with its own rate field.
  const toggleService = (service: string) => {
    if (services.some((s) => s.service === service)) {
      setServices(services.filter((s) => s.service !== service));
      return;
    }
    setServices([
      ...services,
      {
        service,
        rates: {},
        usage_rights_months: DEFAULT_USAGE_RIGHTS_MONTHS,
        paid_ads_months: DEFAULT_USAGE_RIGHTS_MONTHS,
      },
    ]);
  };

  const patchService = (service: string, patch: Partial<CreatorServiceEntry>) =>
    setServices(services.map((s) => (s.service === service ? { ...s, ...patch } : s)));

  const patchRate = (service: string, platformId: string, patch: Partial<CreatorRateEntry>) =>
    setServices(
      services.map((s) => {
        if (s.service !== service) return s;
        const existing: CreatorRateEntry = s.rates[platformId] ?? { currency: 'INR', amount: '' };
        return { ...s, rates: { ...s.rates, [platformId]: { ...existing, ...patch } } };
      }),
    );

  const intFromInput = (raw: string): number | '' => {
    if (raw.trim() === '') return '';
    const n = Number(raw.replace(/[^\d]/g, ''));
    return raw.trim() !== '' && Number.isFinite(n) ? n : '';
  };

  return (
    <div className="space-y-6">
      {/* ── 1. Basic Information ── */}
      <SectionCard
        tint="tint-purple"
        title="Basic Information"
        description="Who you are on social media"
        icon={
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Creator name"
            required
            placeholder="The name brands should use"
            value={values.creator_name ?? ''}
            onChange={(e) => onChange('creator_name', e.target.value)}
            error={errors.creator_name}
          />
          <Select
            label="Account type"
            required
            placeholder="Select"
            options={CREATOR_ACCOUNT_TYPES}
            value={values.creator_type ?? ''}
            onChange={(e) => onChange('creator_type', e.target.value)}
            error={errors.creator_type}
          />
          <Select
            label="Gender"
            required
            placeholder="Select"
            options={GENDER_OPTIONS}
            value={values.creator_gender ?? ''}
            onChange={(e) => onChange('creator_gender', e.target.value)}
            error={errors.creator_gender}
          />
          <Input
            label="Age"
            required
            type="number"
            inputMode="numeric"
            min={13}
            max={100}
            placeholder="Your age in years"
            value={values.creator_age ?? ''}
            onChange={(e) => onChange('creator_age', intFromInput(e.target.value))}
            error={errors.creator_age}
            helperText="We only show your age group to brands"
          />
        </div>
      </SectionCard>

      {/* ── 2. Social Media Platforms ── */}
      <SectionCard
        id="creator-platforms"
        tint="tint-blue"
        title="Social Media Platforms"
        description="Add every platform you publish on — one card each"
        icon={
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a1.5 1.5 0 003 0zm9-3.5a1.5 1.5 0 013 0v6a4.5 4.5 0 01-4.5 4.5H9.75A4.5 4.5 0 015.25 15v-1a1.5 1.5 0 013 0" />
          </svg>
        }
      >
        {platforms.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-[#E7E7EA] bg-[#F5F5F6] p-6 text-center">
            <p className="text-sm text-[#737373]">
              No platforms yet. Add your first platform to set followers, language, audience location and niches.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {platforms.map((p, index) => {
            const err = (field: string) => errors[`creator_platforms.${p.id}.${field}`];
            const isIndia = p.location.country === 'India';
            return (
              <div key={p.id} id={`creator-platform-${p.id}`} className="scroll-mt-24 rounded-xl border border-[#E7E7EA] bg-white p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#0a0a0a] font-[family-name:var(--font-inter)] text-[11px] font-bold text-white">
                      {index + 1}
                    </span>
                    <p className="truncate font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
                      {p.platform || `Platform ${index + 1}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePlatform(p.id)}
                    className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-[#E7E7EA] px-2.5 py-1.5 text-xs font-medium text-[#737373] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Remove
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    label="Platform"
                    required
                    placeholder="Select platform"
                    options={CREATOR_PLATFORM_OPTIONS.map((v) => ({ label: v, value: v }))}
                    value={p.platform}
                    onChange={(e) => patchPlatform(p.id, { platform: e.target.value })}
                    error={err('platform')}
                  />
                  <Input
                    label="Profile URL"
                    required
                    placeholder="https://youtube.com/@yourchannel"
                    value={p.profile_url}
                    onChange={(e) => patchPlatform(p.id, { profile_url: e.target.value })}
                    error={err('profile_url')}
                    helperText="Public profile or channel link"
                  />
                  <Input
                    label="Followers / subscribers"
                    required
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="e.g. 25000"
                    value={p.followers}
                    onChange={(e) => patchPlatform(p.id, { followers: intFromInput(e.target.value) })}
                    error={err('followers')}
                  />
                  <div>
                    <MultiSelect
                      label="Content format"
                      placeholder="Select formats"
                      searchPlaceholder="Search formats"
                      options={CREATOR_FORMAT_OPTIONS.map((v) => ({ label: v, value: v }))}
                      values={p.formats}
                      onChange={(next) => patchPlatform(p.id, { formats: next })}
                    />
                    {err('formats') && <p className="mt-1 text-xs text-red-600">{err('formats')}</p>}
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  <div className="rounded-xl border border-[#E7E7EA] bg-[#F5F5F6] p-4">
                    <div className="space-y-4">
                      <div>
                        <MultiSelect
                          label="Language used on this platform"
                          placeholder="Select languages"
                          searchPlaceholder="Search languages"
                          options={CREATOR_LANGUAGE_OPTIONS.map((v) => ({ label: v, value: v }))}
                          values={p.languages}
                          onChange={(next) => patchPlatform(p.id, { languages: next })}
                        />
                        {err('languages') && <p className="mt-1 text-xs text-red-600">{err('languages')}</p>}
                      </div>
                      <div>
                        <MultiSelect
                          label="Content niche"
                          placeholder="Select niches"
                          searchPlaceholder="Search niches"
                          options={CREATOR_NICHE_OPTIONS.map((v) => ({ label: v, value: v }))}
                          values={p.niches}
                          onChange={(next) => patchPlatform(p.id, { niches: next })}
                        />
                        {err('niches') && <p className="mt-1 text-xs text-red-600">{err('niches')}</p>}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Select
                      label="Target location"
                      placeholder="Select"
                      options={[
                        { label: 'Global', value: 'global' },
                        { label: 'Specific location', value: 'specific' },
                      ]}
                      value={p.location_scope}
                      onChange={(e) => patchPlatform(p.id, { location_scope: e.target.value as 'global' | 'specific' })}
                    />
                    <p className="mt-1 text-xs text-[#737373]">Where your audience for this platform is</p>
                    {p.location_scope === 'specific' && (
                      <div className="mt-4 grid gap-4 rounded-xl border border-[#E7E7EA] bg-[#F5F5F6] p-4 sm:grid-cols-2">
                        <Select
                          label="Country"
                          required
                          placeholder="Select country"
                          options={COUNTRIES}
                          value={p.location.country}
                          onChange={(e) =>
                            patchPlatform(p.id, {
                              location: { ...p.location, country: e.target.value, state: '', district: '' },
                            })
                          }
                        />
                        {isIndia ? (
                          <Select
                            label="State"
                            required
                            placeholder="Select state"
                            options={INDIAN_STATES}
                            value={p.location.state}
                            onChange={(e) =>
                              patchPlatform(p.id, { location: { ...p.location, state: e.target.value, district: '' } })
                            }
                          />
                        ) : (
                          <Input
                            label="State / Region"
                            required
                            placeholder="State or region"
                            value={p.location.state}
                            onChange={(e) => patchPlatform(p.id, { location: { ...p.location, state: e.target.value } })}
                          />
                        )}
                        {isIndia && p.location.state ? (
                          <Select
                            label="District"
                            placeholder="Select district"
                            options={(DISTRICTS_BY_STATE[p.location.state] || []).map((d) => ({ label: d, value: d }))}
                            value={p.location.district}
                            onChange={(e) => patchPlatform(p.id, { location: { ...p.location, district: e.target.value } })}
                          />
                        ) : (
                          <Input
                            label="District"
                            placeholder={isIndia ? 'Select a state first' : 'District'}
                            disabled={isIndia && !p.location.state}
                            value={p.location.district}
                            onChange={(e) => patchPlatform(p.id, { location: { ...p.location, district: e.target.value } })}
                          />
                        )}
                        <Input
                          label="City"
                          placeholder="City"
                          value={p.location.city}
                          onChange={(e) => patchPlatform(p.id, { location: { ...p.location, city: e.target.value } })}
                        />
                        {err('state') && <p className="text-xs text-red-600 sm:col-span-2">{err('state')}</p>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addPlatform}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#E7E7EA] bg-white px-4 py-3 text-sm font-semibold text-[#0a0a0a] transition-all duration-200 hover:border-[#0a0a0a]/40 hover:bg-[#F5F5F6] active:scale-[0.99]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add New Platform
        </button>
        {errors.creator_platforms && (
          <p className="mt-2 text-sm text-red-600">{errors.creator_platforms}</p>
        )}
      </SectionCard>

      {/* ── 3. Services and Rates ── */}
      <SectionCard
        id="creator-services"
        tint="tint-green"
        title="Services and Rates"
        description="Pick the services you offer and set a rate per platform"
        icon={
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      >
        <div className="space-y-2.5">
          {CREATOR_SERVICE_OPTIONS.map(({ service, description, live }) => {
            const selected = services.some((s) => s.service === service);
            const entry = selected ? services.find((s) => s.service === service)! : null;
            return (
              <div
                key={service}
                className={`rounded-xl border px-4 py-3 text-sm transition-all duration-200 ${
                  !live
                    ? 'border-[#E7E7EA] bg-[#F5F5F6] opacity-70'
                    : selected
                      ? 'border-[#0a0a0a] bg-[#FFFAC2]'
                      : 'border-[#E7E7EA] bg-white hover:border-[#a3a3a3]'
                }`}
              >
                {/* Toggle row — the only click target that selects the service */}
                <label
                  className={`flex items-start gap-3 ${live ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-[#E7E7EA] text-[#0a0a0a] focus:ring-[#0a0a0a]/30"
                    checked={selected}
                    disabled={!live}
                    onChange={() => live && toggleService(service)}
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={`font-[family-name:var(--font-inter)] text-[14px] font-medium ${live ? 'text-[#0a0a0a]' : 'text-[#737373]'}`}>
                        {service}
                      </span>
                      {!live && (
                        <span className="rounded-full bg-[#E7E7EA] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#737373]">
                          Coming soon
                        </span>
                      )}
                    </span>
                    <span className="font-[family-name:var(--font-inter)] text-[13px] leading-snug text-[#525252]">
                      {description}
                    </span>
                  </div>
                </label>

                {/* Rates expand inside the selected service card itself: every
                    platform entered above is shown, each with its own rate
                    field the creator can fill in — or leave blank. */}
                {selected && entry && (
                  <div className="mt-3 border-t border-[#0a0a0a]/10 pt-3">
                    {platforms.length === 0 ? (
                      <p className="rounded-lg bg-white/60 px-3 py-2.5 text-[13px] text-[#737373]">
                        Add a platform above to set rates for this service.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {errors[`creator_services.${service}`] && (
                          <p className="text-xs text-red-600">{errors[`creator_services.${service}`]}</p>
                        )}
                        {platforms.map((p, index) => {
                          const rate = entry.rates[p.id] ?? { currency: 'INR', amount: '' };
                          const rateError = errors[`creator_services.${service}.${p.id}`];
                          const sameName = platforms.filter((x) => x.platform === p.platform).length > 1;
                          const label = p.platform
                            ? sameName ? `${p.platform} (${index + 1})` : p.platform
                            : `Platform ${index + 1}`;
                          return (
                            <div key={p.id}>
                              <div className="grid grid-cols-1 items-end gap-2.5 sm:grid-cols-[1fr_170px_1fr]">
                                <p className="truncate pb-2.5 font-[family-name:var(--font-inter)] text-[13px] font-medium text-[#3F3F46]">
                                  {label} rate
                                </p>
                                <Select
                                  options={CREATOR_CURRENCY_OPTIONS}
                                  value={rate.currency}
                                  onChange={(e) => patchRate(service, p.id, { currency: e.target.value })}
                                  aria-label={`Currency for ${service} on ${label}`}
                                />
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  placeholder="Amount"
                                  value={rate.amount}
                                  onChange={(e) => patchRate(service, p.id, { amount: intFromInput(e.target.value) })}
                                  aria-label={`Amount for ${service} on ${label}`}
                                />
                              </div>
                              {rateError && <p className="mt-1 text-xs text-red-600">{rateError}</p>}
                            </div>
                          );
                        })}
                        <p className="rounded-lg bg-white/60 px-3 py-2.5 text-[13px] text-[#737373]">
                          Enter a rate for each platform you offer this service on — leave the rest blank.
                        </p>
                      </div>
                    )}
                    {/* How long the brand may use the content for this service.
                        Defaults to 1 year; businesses can ask for more later. */}
                    <div className="mt-3 space-y-3 rounded-lg bg-white/60 px-3 py-2.5">
                      <MonthsStepper
                        label="Usage rights"
                        hint="How many months can the brand reuse your content on their website, social pages or marketing?"
                        months={entry.usage_rights_months ?? DEFAULT_USAGE_RIGHTS_MONTHS}
                        onChange={(months) => patchService(service, { usage_rights_months: months })}
                      />
                      <MonthsStepper
                        label="Paid advertising"
                        hint="How many months can the brand use your content in paid ads and promotional campaigns?"
                        months={entry.paid_ads_months ?? DEFAULT_USAGE_RIGHTS_MONTHS}
                        onChange={(months) => patchService(service, { paid_ads_months: months })}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {errors.creator_services && (
          <p className="mt-2 text-sm text-red-600">{errors.creator_services}</p>
        )}
      </SectionCard>
    </div>
  );
}

/** − / + months picker for a service's usage periods (1–60 months, default
 * 1 year). Mirrors the steppers the business brief uses for the same fields. */
function MonthsStepper({ label, hint, months, onChange }: {
  label: string;
  hint: string;
  months: number;
  onChange: (months: number) => void;
}) {
  const value = Number.isFinite(months) && months >= 1 ? Math.min(60, Math.round(months)) : DEFAULT_USAGE_RIGHTS_MONTHS;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
      <div className="min-w-0">
        <p className="font-[family-name:var(--font-inter)] text-[13px] font-medium text-[#3F3F46]">{label}</p>
        <p className="text-[12px] leading-snug text-[#737373]">{hint}</p>
      </div>
      <div className="inline-flex flex-none items-center gap-1.5 rounded-lg border border-[#E7E7EA] bg-white p-1">
        <button
          type="button"
          aria-label={`Decrease ${label} months`}
          disabled={value <= 1}
          onClick={() => onChange(Math.max(1, value - 1))}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[#0a0a0a] bg-white text-sm font-extrabold text-[#0a0a0a] transition-colors hover:bg-[#FCF487] disabled:border-[#E7E7EA] disabled:text-[#C9C3B5] disabled:hover:bg-white"
        >
          −
        </button>
        <span aria-label={`${label} months`} className="min-w-[17ch] px-1 text-center text-[12px] font-semibold text-[#0a0a0a]">
          {usageMonthsLabel(value)}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label} months`}
          disabled={value >= 60}
          onClick={() => onChange(Math.min(60, value + 1))}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[#0a0a0a] bg-white text-sm font-extrabold text-[#0a0a0a] transition-colors hover:bg-[#FCF487] disabled:border-[#E7E7EA] disabled:text-[#C9C3B5] disabled:hover:bg-white"
        >
          +
        </button>
      </div>
    </div>
  );
}
