'use client';

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
  tier?: Tier;
  location?: string;
  language?: string;
  skill?: string;
  ai_tool?: string;
}

interface Props {
  categoryId: string;
  value: FilterState;
  onChange: (next: FilterState) => void;
}

export default function TalentAccessFilters({ categoryId, value, onChange }: Props) {
  const { data: options, isLoading } = useTalentAccessFilterOptions(categoryId);

  function patch(p: Partial<FilterState>) {
    onChange({ ...value, ...p });
  }

  function reset() {
    onChange({});
  }

  const hasAny =
    value.tier ||
    value.location ||
    value.language ||
    value.skill ||
    value.ai_tool;

  return (
    <aside className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">Filters</h2>
        {hasAny && (
          <button
            onClick={reset}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
          >
            Reset
          </button>
        )}
      </div>

      {/* Tier */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Tier
        </h3>
        <div className="space-y-1.5">
          {TIERS.map((t) => (
            <label
              key={t.value}
              className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700"
            >
              <input
                type="radio"
                name="tier"
                checked={value.tier === t.value}
                onChange={() => patch({ tier: t.value })}
                className="h-4 w-4 border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
              {t.label}
            </label>
          ))}
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-500">
            <input
              type="radio"
              name="tier"
              checked={!value.tier}
              onChange={() => patch({ tier: undefined })}
              className="h-4 w-4 border-zinc-300 text-indigo-600 focus:ring-indigo-500"
            />
            Any
          </label>
        </div>
        <div className="mt-3">
          <TierExplainer />
        </div>
      </section>

      {/* Location */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Location
        </h3>
        <select
          value={value.location ?? ''}
          onChange={(e) => patch({ location: e.target.value || undefined })}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          disabled={isLoading}
        >
          <option value="">All locations</option>
          {(options?.locations ?? []).map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
      </section>

      {/* Language */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Language
        </h3>
        <select
          value={value.language ?? ''}
          onChange={(e) => patch({ language: e.target.value || undefined })}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          disabled={isLoading}
        >
          <option value="">All languages</option>
          {(options?.languages ?? []).map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
      </section>

      {/* Skills */}
      {(options?.skills ?? []).length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Skill set
          </h3>
          <div className="space-y-1.5">
            {options!.skills.map((skill) => (
              <label
                key={skill}
                className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700"
              >
                <input
                  type="radio"
                  name="skill"
                  checked={value.skill === skill}
                  onChange={() => patch({ skill })}
                  className="h-4 w-4 border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                />
                {skill}
              </label>
            ))}
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-500">
              <input
                type="radio"
                name="skill"
                checked={!value.skill}
                onChange={() => patch({ skill: undefined })}
                className="h-4 w-4 border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
              Any
            </label>
          </div>
        </section>
      )}

      {/* AI tools */}
      {(options?.ai_tools ?? []).length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            AI tools
          </h3>
          <div className="space-y-1.5">
            {options!.ai_tools.map((tool) => (
              <label
                key={tool}
                className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700"
              >
                <input
                  type="radio"
                  name="ai_tool"
                  checked={value.ai_tool === tool}
                  onChange={() => patch({ ai_tool: tool })}
                  className="h-4 w-4 border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                />
                {tool}
              </label>
            ))}
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-500">
              <input
                type="radio"
                name="ai_tool"
                checked={!value.ai_tool}
                onChange={() => patch({ ai_tool: undefined })}
                className="h-4 w-4 border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
              Any
            </label>
          </div>
        </section>
      )}
    </aside>
  );
}
