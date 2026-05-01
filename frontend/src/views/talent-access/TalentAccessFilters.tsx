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

const TIERS: { value: Tier; label: string }[] = [
  { value: 'junior', label: 'Junior' },
  { value: 'pro', label: 'Pro' },
  { value: 'elite', label: 'Elite' },
  { value: 'custom', label: 'Custom' },
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
    <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-zinc-900 px-1.5 text-[10px] font-semibold text-white">
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
        <h3 className="flex items-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {title}
          <CountBadge n={count} />
        </h3>
        {count > 0 && onClear && (
          <button
            onClick={onClear}
            className="text-[11px] font-medium text-zinc-500 hover:text-zinc-900"
          >
            Clear
          </button>
        )}
      </div>
      <div
        className={
          scroll
            ? 'max-h-48 space-y-1.5 overflow-y-auto rounded-md border border-zinc-200 bg-white p-2'
            : 'space-y-1.5'
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
    <label className="flex min-w-0 cursor-pointer items-center gap-2 text-sm text-zinc-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
      />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </label>
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

  // District options cascade off selected states. With ≥1 state picked we
  // restrict to those states' districts; otherwise we flatten every known
  // district so the user can filter on district alone if they want.
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
    <aside className="min-w-0 space-y-5 overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900">Filters</h2>
        <button
          onClick={() => onChange({})}
          disabled={totalSelected === 0}
          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
            totalSelected > 0
              ? 'border-zinc-300 text-zinc-700 hover:bg-zinc-50'
              : 'cursor-default border-zinc-200 text-zinc-400'
          }`}
        >
          Clear all filters
        </button>
      </div>

      {/* Tier */}
      <Section
        title="Tier"
        count={tierCount}
        onClear={() => onChange({ ...value, tier: undefined })}
      >
        {TIERS.map((t) => (
          <CheckboxRow
            key={t.value}
            checked={!!value.tier?.includes(t.value)}
            onChange={() =>
              onChange({ ...value, tier: toggle(value.tier, t.value) })
            }
          >
            {t.label}
          </CheckboxRow>
        ))}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setTierExpanded((v) => !v)}
            className="flex w-full items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-left text-xs font-medium text-zinc-600 hover:bg-zinc-100"
          >
            <span>What the tiers mean</span>
            <span className="text-zinc-400">{tierExpanded ? '–' : '+'}</span>
          </button>
          {tierExpanded && (
            <div className="mt-2">
              <TierExplainer />
            </div>
          )}
        </div>
      </Section>

      {/* Country / State / District — sourced from a static list (not from
          existing talents). The business user can pre-emptively pick a
          location even before any talent in that area has signed up; the
          filter still narrows the result set if there's no match — that's
          fine, intentional, and matches the talent-signup form's options. */}
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

      {/* District — cascades off selected states. With states picked, the
          dropdown narrows to only those states' districts. With nothing
          picked, it lists every district across all known states so the
          user isn't blocked from filtering on district alone. */}
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

      {/* Location (legacy free-text current_location). Hidden when no values
          remain — once everyone has structured country/state/district set,
          this section disappears organically without a code change. */}
      {(options?.locations ?? []).length > 0 && (
        <Section
          title="Location (free-text)"
          count={locationCount}
          onClear={() => onChange({ ...value, location: undefined })}
          scroll={(options?.locations ?? []).length > 6}
        >
          {isLoading ? (
            <p className="text-xs text-zinc-400">Loading…</p>
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
          <p className="text-xs text-zinc-400">Loading…</p>
        ) : (options?.languages ?? []).length === 0 ? (
          <p className="text-xs text-zinc-400">No languages available.</p>
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
    </aside>
  );
}
