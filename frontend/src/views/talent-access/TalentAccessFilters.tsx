'use client';

import { useState, useMemo } from 'react';
import {
  useTalentAccessFilterOptions,
  type Tier,
  type FilterOptions,
} from '@/hooks/useTalentAccess';
import TierExplainer from '@/components/talent-access/TierExplainer';
import MultiSelectSearch from '@/components/ui/MultiSelectSearch';
import {
  COUNTRIES,
  INDIAN_STATES,
  DISTRICTS_BY_STATE,
} from '@/constants/india-locations';

const TIERS: { value: Tier; label: string; tint: string }[] = [
  { value: 'junior', label: 'Junior', tint: 'tint-blue' },
  { value: 'pro', label: 'Pro', tint: 'tint-purple' },
  { value: 'Top Talents', label: 'Top Talents', tint: 'tint-amber' },
  { value: 'custom', label: 'Custom', tint: 'tint-pink' },
];

export interface FilterState {
  tier?: Tier[];
  /** Free-text current_location (legacy). */
  location?: string[];
  /** Structured location: talent_profiles_basic.country/state/current_district. */
  country?: string[];
  state?: string[];
  district?: string[];
  language?: string[];
  skill?: string[];
  ai_tool?: string[];
}

interface Props {
  categoryId: string;
  value: FilterState;
  onChange: (next: FilterState) => void;
  filterOptions?: FilterOptions;
  filterOptionsLoading?: boolean;
}

function toggle<T>(list: T[] | undefined, item: T): T[] {
  const arr = list ?? [];
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

function CountBadge({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#0a0a0a] px-1.5 text-[10px] font-semibold text-white">
      {n}
    </span>
  );
}

interface SectionProps {
  title: string;
  count: number;
  onClear?: () => void;
  scroll?: boolean;
  children: React.ReactNode;
}

function Section({ title, count, onClear, scroll, children }: SectionProps) {
  return (
    <section className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center font-[family-name:var(--font-inter)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[#737373]">
          {title}
          <CountBadge n={count} />
        </h3>
        {count > 0 && onClear && (
          <button
            onClick={onClear}
            className="font-[family-name:var(--font-inter)] text-[11px] font-semibold text-[#0a0a0a] transition-colors hover:text-[#0a0a0a]"
          >
            Clear
          </button>
        )}
      </div>
      <div
        className={
          scroll
            ? 'max-h-48 space-y-1 overflow-y-auto rounded-lg border border-[#E7E7EA] bg-[#F5F5F6] p-2'
            : 'space-y-1'
        }
      >
        {children}
      </div>
    </section>
  );
}

interface CheckboxRowProps {
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}

function CheckboxRow({ checked, onChange, children }: CheckboxRowProps) {
  return (
    <label
      className={`group flex min-w-0 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors ${
        checked ? 'bg-[#FFFAC2] text-[#0a0a0a]' : 'text-[#525252] hover:bg-[#F5F5F6]'
      }`}
    >
      <span
        className={`relative flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${
          checked
            ? 'border-[#0a0a0a] bg-[#0a0a0a]'
            : 'border-[#D4D4D8] bg-white group-hover:border-[#a3a3a3]'
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        {checked && (
          <svg
            className="h-3 w-3 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      <span
        className={`min-w-0 flex-1 truncate font-[family-name:var(--font-inter)] ${
          checked ? 'font-semibold' : 'font-medium'
        }`}
      >
        {children}
      </span>
    </label>
  );
}

function TierChip({
  tier,
  checked,
  onClick,
}: {
  tier: { value: Tier; label: string; tint: string };
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex items-center justify-center rounded-lg border px-2.5 py-2 font-[family-name:var(--font-inter)] text-[13px] font-semibold transition-all duration-150 active:scale-[0.97] ${
        checked
          ? `${tier.tint} border-transparent shadow-[0_1px_2px_rgba(0,0,0,0.06)]`
          : 'border-[#E7E7EA] bg-white text-[#525252] hover:border-[#D4D4D8] hover:bg-[#F5F5F6] hover:text-[#0a0a0a]'
      }`}
      style={checked ? { color: 'var(--tint-text)' } : undefined}
    >
      {tier.label}
      {checked && (
        <svg
          className="absolute right-1 top-1 h-3 w-3"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <circle cx="12" cy="12" r="6" opacity="0.25" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

export default function TalentAccessFilters({ categoryId, value, onChange, filterOptions, filterOptionsLoading }: Props) {
  const useExternal = filterOptionsLoading !== undefined;
  const query = useTalentAccessFilterOptions(useExternal ? undefined : categoryId);
  const options = useExternal ? filterOptions : query.data;
  const isLoading = useExternal ? !!filterOptionsLoading : query.isLoading;
  const [tierExpanded, setTierExpanded] = useState(false);

  const tierCount = value.tier?.length ?? 0;
  const locationCount = value.location?.length ?? 0;
  const countryCount = value.country?.length ?? 0;
  const stateCount = value.state?.length ?? 0;
  const districtCount = value.district?.length ?? 0;
  const languageCount = value.language?.length ?? 0;
  const skillCount = value.skill?.length ?? 0;
  const aiToolCount = value.ai_tool?.length ?? 0;

  const totalSelected =
    tierCount +
    locationCount +
    countryCount +
    stateCount +
    districtCount +
    languageCount +
    skillCount +
    aiToolCount;

  const districtOptions = useMemo(() => {
    const selectedStates = value.state ?? [];
    const sourceStates =
      selectedStates.length > 0 ? selectedStates : Object.keys(DISTRICTS_BY_STATE);
    const seen = new Set<string>();
    const out: { label: string; value: string }[] = [];
    for (const st of sourceStates) {
      for (const d of DISTRICTS_BY_STATE[st] ?? []) {
        if (seen.has(d)) continue;
        seen.add(d);
        out.push({ label: d, value: d });
      }
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [value.state]);

  return (
    <aside className="min-w-0 overflow-hidden">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="tint-purple flex h-8 w-8 items-center justify-center rounded-lg">
            <svg
              className="h-4 w-4"
              style={{ color: 'var(--tint-icon)' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </div>
          <div>
            <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold tracking-[-0.01em] text-[#0a0a0a]">
              Filters
            </h2>
            {totalSelected > 0 && (
              <p className="font-[family-name:var(--font-inter)] text-[11px] text-[#737373]">
                {totalSelected} active
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => onChange({})}
          disabled={totalSelected === 0}
          className={`rounded-lg px-2.5 py-1 font-[family-name:var(--font-inter)] text-[11px] font-semibold transition-colors ${
            totalSelected > 0
              ? 'text-[#0a0a0a] hover:bg-[#FFFAC2]'
              : 'cursor-default text-[#D4D4D8]'
          }`}
        >
          Clear all
        </button>
      </div>

      <div className="space-y-5">
        {/* Tier — chip grid */}
        <Section
          title="Tier"
          count={tierCount}
          onClear={() => onChange({ ...value, tier: undefined })}
        >
          <div className="grid grid-cols-2 gap-1.5">
            {TIERS.map((t) => (
              <TierChip
                key={t.value}
                tier={t}
                checked={!!value.tier?.includes(t.value)}
                onClick={() =>
                  onChange({ ...value, tier: toggle(value.tier, t.value) })
                }
              />
            ))}
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setTierExpanded((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg border border-[#E7E7EA] bg-[#F5F5F6] px-3 py-2 text-left font-[family-name:var(--font-inter)] text-[12px] font-medium text-[#525252] transition-colors hover:bg-[#F0F0F0]"
            >
              <span className="flex items-center gap-1.5">
                <svg
                  className="h-3.5 w-3.5 text-[#a3a3a3]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                What the tiers mean
              </span>
              <svg
                className={`h-3.5 w-3.5 text-[#a3a3a3] transition-transform ${
                  tierExpanded ? 'rotate-180' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {tierExpanded && (
              <div className="mt-2">
                <TierExplainer />
              </div>
            )}
          </div>
        </Section>

        {/* Country */}
        <Section
          title="Country"
          count={countryCount}
          onClear={() => onChange({ ...value, country: undefined })}
        >
          <MultiSelectSearch
            options={COUNTRIES}
            selected={value.country ?? []}
            onChange={(vals) =>
              onChange({ ...value, country: vals.length ? vals : undefined })
            }
            placeholder="Add a country…"
          />
        </Section>

        {/* State */}
        <Section
          title="State"
          count={stateCount}
          onClear={() => onChange({ ...value, state: undefined })}
        >
          <MultiSelectSearch
            options={INDIAN_STATES}
            selected={value.state ?? []}
            onChange={(vals) =>
              onChange({ ...value, state: vals.length ? vals : undefined })
            }
            placeholder="Add a state…"
          />
        </Section>

        {/* District */}
        <Section
          title="District"
          count={districtCount}
          onClear={() => onChange({ ...value, district: undefined })}
        >
          <MultiSelectSearch
            options={districtOptions}
            selected={value.district ?? []}
            onChange={(vals) =>
              onChange({ ...value, district: vals.length ? vals : undefined })
            }
            placeholder={
              (value.state?.length ?? 0) > 0
                ? 'Add a district…'
                : 'Pick a state first, or search any district…'
            }
          />
        </Section>

        {/* Location (legacy free-text) */}
        {(options?.locations ?? []).length > 0 && (
          <Section
            title="Location (free-text)"
            count={locationCount}
            onClear={() => onChange({ ...value, location: undefined })}
            scroll={(options?.locations ?? []).length > 6}
          >
            {isLoading ? (
              <p className="px-2 text-xs text-[#a3a3a3]">Loading…</p>
            ) : (
              options!.locations.map((loc) => (
                <CheckboxRow
                  key={loc}
                  checked={!!value.location?.includes(loc)}
                  onChange={() =>
                    onChange({ ...value, location: toggle(value.location, loc) })
                  }
                >
                  {loc}
                </CheckboxRow>
              ))
            )}
          </Section>
        )}

        {/* Language */}
        <Section
          title="Language"
          count={languageCount}
          onClear={() => onChange({ ...value, language: undefined })}
          scroll={(options?.languages ?? []).length > 6}
        >
          {isLoading ? (
            <p className="px-2 text-xs text-[#a3a3a3]">Loading…</p>
          ) : (options?.languages ?? []).length === 0 ? (
            <p className="px-2 text-xs text-[#a3a3a3]">No languages available.</p>
          ) : (
            options!.languages.map((lang) => (
              <CheckboxRow
                key={lang}
                checked={!!value.language?.includes(lang)}
                onChange={() =>
                  onChange({ ...value, language: toggle(value.language, lang) })
                }
              >
                {lang}
              </CheckboxRow>
            ))
          )}
        </Section>

        {/* Skills */}
        {(options?.skills ?? []).length > 0 && (
          <Section
            title="Skill set"
            count={skillCount}
            onClear={() => onChange({ ...value, skill: undefined })}
            scroll={options!.skills.length > 6}
          >
            {options!.skills.map((skill) => (
              <CheckboxRow
                key={skill}
                checked={!!value.skill?.includes(skill)}
                onChange={() =>
                  onChange({ ...value, skill: toggle(value.skill, skill) })
                }
              >
                {skill}
              </CheckboxRow>
            ))}
          </Section>
        )}

        {/* AI tools */}
        {(options?.ai_tools ?? []).length > 0 && (
          <Section
            title="AI tools"
            count={aiToolCount}
            onClear={() => onChange({ ...value, ai_tool: undefined })}
            scroll={options!.ai_tools.length > 6}
          >
            {options!.ai_tools.map((tool) => (
              <CheckboxRow
                key={tool}
                checked={!!value.ai_tool?.includes(tool)}
                onChange={() =>
                  onChange({ ...value, ai_tool: toggle(value.ai_tool, tool) })
                }
              >
                {tool}
              </CheckboxRow>
            ))}
          </Section>
        )}
      </div>
    </aside>
  );
}
