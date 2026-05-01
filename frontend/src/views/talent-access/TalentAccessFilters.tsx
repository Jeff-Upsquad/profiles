'use client';

import { useState } from 'react';
import {
  useTalentAccessFilterOptions,
  type Tier,
} from '@/hooks/useTalentAccess';
import TierExplainer from '@/components/talent-access/TierExplainer';

const TIERS: { value: Tier; label: string }[] = [
  { value: 'junior', label: 'Junior' },
  { value: 'pro', label: 'Pro' },
  { value: 'elite', label: 'Elite' },
  { value: 'custom', label: 'Custom' },
];

export interface FilterState {
  tier?: Tier[];
  location?: string[];
  language?: string[];
  skill?: string[];
  ai_tool?: string[];
}

interface Props {
  categoryId: string;
  value: FilterState;
  onChange: (next: FilterState) => void;
  filterOptions?: any;
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
  const languageCount = value.language?.length ?? 0;
  const skillCount = value.skill?.length ?? 0;
  const aiToolCount = value.ai_tool?.length ?? 0;

  const totalSelected =
    tierCount + locationCount + languageCount + skillCount + aiToolCount;

  return (
    <aside className="min-w-0 space-y-5 overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900">Filters</h2>
        {totalSelected > 0 && (
          <button
            onClick={() => onChange({})}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
          >
            Reset all
          </button>
        )}
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

      {/* Location */}
      <Section
        title="Location"
        count={locationCount}
        onClear={() => onChange({ ...value, location: undefined })}
        scroll={(options?.locations ?? []).length > 6}
      >
        {isLoading ? (
          <p className="text-xs text-zinc-400">Loading…</p>
        ) : (options?.locations ?? []).length === 0 ? (
          <p className="text-xs text-zinc-400">No locations available.</p>
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
