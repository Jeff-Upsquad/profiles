import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import MultiSelectSearch from '@/components/ui/MultiSelectSearch';
import {
  ACCOUNTING_SOFTWARE_PRIMARY,
  ACCOUNTING_SOFTWARE_OTHER,
} from '@/constants/lead-form-options';
import type { LeveledItem } from '../../../../shared/src/types/talent';

interface Grouped {
  group?: string | null;
}

interface SkillItem extends Grouped {
  id: string;
  name: string;
}

interface ToolItem extends Grouped {
  id: string;
  name: string;
}

interface SkillWithLevel {
  skill: string;
  level: number;
}

interface CategoryWithLevel {
  category: string;
  level: number;
}

interface DesignerExtrasProps {
  categoryId: string;
  /** Parent category slug — used to relabel the Categories section to
   * "Categories and Skills" on Designer profiles, where Skills was folded
   * into Categories. */
  categorySlug?: string;
  skills: SkillWithLevel[];
  tools: LeveledItem[];
  aiTools?: LeveledItem[];
  categories?: CategoryWithLevel[];
  accountingSoftware?: LeveledItem[];
  onSkillsChange: (skills: SkillWithLevel[]) => void;
  onToolsChange: (tools: LeveledItem[]) => void;
  onAiToolsChange?: (aiTools: LeveledItem[]) => void;
  onCategoriesChange?: (categories: CategoryWithLevel[]) => void;
  onAccountingSoftwareChange?: (accountingSoftware: LeveledItem[]) => void;
  /** When true, renders an "Accounting Software" picker before Tools and relabels Tools to "Other Tools". */
  showAccountingSoftware?: boolean;
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'Learning',
  2: 'Beginner',
  3: 'Intermediate',
  4: 'Advanced',
  5: 'Expert',
};

const LEVEL_OPTIONS = [1, 2, 3, 4, 5] as const;

function LevelButtonGroup({
  value,
  onChange,
  accent,
}: {
  value: number;
  onChange: (level: number) => void;
  accent: 'indigo' | 'zinc' | 'purple';
}) {
  const selectedCls =
    accent === 'indigo'
      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
      : accent === 'purple'
        ? 'border-purple-500 bg-purple-50 text-purple-700'
        : 'border-zinc-500 bg-zinc-100 text-zinc-800';
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 pl-7">
      <span className="mr-1 text-xs font-medium text-gray-500">Proficiency</span>
      {LEVEL_OPTIONS.map((lvl) => {
        const isSelected = value === lvl;
        return (
          <button
            key={lvl}
            type="button"
            onClick={() => onChange(lvl)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              isSelected
                ? selectedCls
                : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            {LEVEL_LABELS[lvl]}
          </button>
        );
      })}
    </div>
  );
}

function groupItems<T extends Grouped>(items: T[]): {
  groups: Map<string, T[]>;
  hasNamedGroups: boolean;
} {
  const groups = new Map<string, T[]>();
  items.forEach((item) => {
    const key = item.group || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  });
  const hasNamedGroups = Array.from(groups.keys()).some((k) => k !== '');
  return { groups, hasNamedGroups };
}

function GroupHeading({ name }: { name: string }) {
  return (
    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
      {name}
    </h4>
  );
}

/**
 * Card-style picker for items that need a per-item proficiency level.
 * Each row: checkbox (toggle selection) + name + (when selected) a
 * 5-button group (Learning / Beginner / Intermediate / Advanced / Expert).
 */
function LeveledCardPicker<T extends { id: string; name: string; group?: string | null }>({
  items,
  selected,
  onChange,
  accent,
  emptyText,
}: {
  items: T[];
  selected: LeveledItem[];
  onChange: (next: LeveledItem[]) => void;
  accent: 'indigo' | 'zinc' | 'purple';
  emptyText?: string;
}) {
  const toggleItem = (name: string) => {
    const existing = selected.find((s) => s.name === name);
    if (existing) {
      onChange(selected.filter((s) => s.name !== name));
    } else {
      onChange([...selected, { name, level: 3 }]);
    }
  };

  const setLevel = (name: string, level: number) => {
    onChange(selected.map((s) => (s.name === name ? { ...s, level } : s)));
  };

  const checkboxCls =
    accent === 'indigo'
      ? 'text-indigo-600 focus:ring-indigo-500'
      : accent === 'purple'
        ? 'text-purple-600 focus:ring-purple-500'
        : 'text-zinc-600 focus:ring-zinc-500';

  const renderCard = (item: T) => {
    const sel = selected.find((s) => s.name === item.name);
    return (
      <div key={item.id} className="rounded-lg border border-gray-200 px-4 py-3">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className={`h-4 w-4 rounded border-gray-300 focus:ring-2 ${checkboxCls}`}
            checked={!!sel}
            onChange={() => toggleItem(item.name)}
          />
          <span className="text-sm font-medium text-gray-700">{item.name}</span>
        </label>
        {sel && <LevelButtonGroup value={sel.level} onChange={(l) => setLevel(item.name, l)} accent={accent} />}
      </div>
    );
  };

  if (items.length === 0) {
    return <p className="text-sm text-gray-400">{emptyText ?? 'No items configured for this category yet.'}</p>;
  }

  const { groups, hasNamedGroups } = groupItems(items);

  if (!hasNamedGroups) {
    return <div className="space-y-2">{items.map(renderCard)}</div>;
  }

  return (
    <div className="space-y-5">
      {Array.from(groups.entries()).map(([groupName, list]) => (
        <div key={groupName || '_ungrouped'}>
          {groupName && <GroupHeading name={groupName} />}
          <div className="space-y-2">{list.map(renderCard)}</div>
        </div>
      ))}
    </div>
  );
}

export default function DesignerExtras({
  categoryId,
  categorySlug,
  skills,
  tools,
  aiTools = [],
  categories = [],
  accountingSoftware = [],
  onSkillsChange,
  onToolsChange,
  onAiToolsChange,
  onCategoriesChange,
  onAccountingSoftwareChange,
  showAccountingSoftware = false,
}: DesignerExtrasProps) {
  const isDesigner = categorySlug === 'designer';
  const categoriesLabel = isDesigner ? 'Categories and Skills' : 'Categories';
  const categoriesHelp = isDesigner
    ? 'Pick the categories and skills you specialize in and rate your proficiency (1-10) — your portfolio uploads are organized by these.'
    : 'Pick the genres you specialize in and rate your proficiency (1-10) — your portfolio uploads are organized by these.';
  const { data: availableSkills = [] } = useQuery<SkillItem[]>({
    queryKey: ['templateSkills', categoryId],
    queryFn: async () => {
      const { data } = await api.get(`/public/categories/${categoryId}/skills`);
      return data.skills ?? data;
    },
  });

  const { data: availableTools = [] } = useQuery<ToolItem[]>({
    queryKey: ['templateTools', categoryId, showAccountingSoftware],
    queryFn: async () => {
      const { data } = await api.get(`/public/categories/${categoryId}/tools`);
      const tools: ToolItem[] = data.tools ?? data;
      return showAccountingSoftware
        ? tools.filter((t) => t.group !== 'Accounting Software')
        : tools;
    },
  });

  const { data: availableAiTools = [] } = useQuery<SkillItem[]>({
    queryKey: ['templateAiTools', categoryId],
    queryFn: async () => {
      const { data } = await api.get(`/public/categories/${categoryId}/ai-tools`);
      return data.ai_tools ?? data;
    },
  });

  const { data: availableCategories = [] } = useQuery<SkillItem[]>({
    queryKey: ['templateCategories', categoryId],
    queryFn: async () => {
      const { data } = await api.get(`/public/categories/${categoryId}/portfolio-categories`);
      return data.portfolio_categories ?? data;
    },
    enabled: Boolean(onCategoriesChange),
  });

  const toggleCategory = (name: string) => {
    if (!onCategoriesChange) return;
    const existing = categories.find((c) => c.category === name);
    if (existing) {
      onCategoriesChange(categories.filter((c) => c.category !== name));
    } else {
      onCategoriesChange([...categories, { category: name, level: 5 }]);
    }
  };

  const setCategoryLevel = (name: string, level: number) => {
    if (!onCategoriesChange) return;
    onCategoriesChange(
      categories.map((c) => (c.category === name ? { ...c, level } : c))
    );
  };

  const toggleSkill = (skillName: string) => {
    const existing = skills.find((s) => s.skill === skillName);
    if (existing) {
      onSkillsChange(skills.filter((s) => s.skill !== skillName));
    } else {
      onSkillsChange([...skills, { skill: skillName, level: 5 }]);
    }
  };

  const setSkillLevel = (skillName: string, level: number) => {
    onSkillsChange(
      skills.map((s) => (s.skill === skillName ? { ...s, level } : s))
    );
  };

  const renderSkillCard = (skill: SkillItem) => {
    const selected = skills.find((s) => s.skill === skill.name);
    return (
      <div key={skill.id} className="rounded-lg border border-gray-200 px-4 py-3">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            checked={!!selected}
            onChange={() => toggleSkill(skill.name)}
          />
          <span className="text-sm font-medium text-gray-700">{skill.name}</span>
        </label>
        {selected && (
          <div className="mt-3 flex items-center gap-3 pl-7">
            <input
              type="range"
              min={1}
              max={10}
              value={selected.level}
              onChange={(e) => setSkillLevel(skill.name, Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-indigo-600"
            />
            <span className="w-8 text-center text-sm font-semibold text-indigo-600">
              {selected.level}
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderSkillList = (list: SkillItem[]) => (
    <div className="space-y-2">{list.map(renderSkillCard)}</div>
  );

  function GroupedSection<T extends Grouped>({
    items,
    renderFlat,
    renderGroup,
  }: {
    items: T[];
    renderFlat: (list: T[]) => React.ReactNode;
    renderGroup: (list: T[]) => React.ReactNode;
  }) {
    const { groups, hasNamedGroups } = groupItems(items);
    if (!hasNamedGroups) return <>{renderFlat(items)}</>;
    return (
      <div className="space-y-5">
        {Array.from(groups.entries()).map(([groupName, list]) => (
          <div key={groupName || '_ungrouped'}>
            {groupName && <GroupHeading name={groupName} />}
            {renderGroup(list)}
          </div>
        ))}
      </div>
    );
  }

  // Accounting Software: primary (6 fixed) + searchable list (35 fixed). The
  // available list is a constant, not a DB-backed template, so we render it
  // directly without a query.
  const allAccountingOptions: { id: string; name: string }[] = [
    ...ACCOUNTING_SOFTWARE_PRIMARY.map((o) => ({ id: `primary:${o.value}`, name: o.value })),
    ...ACCOUNTING_SOFTWARE_OTHER.map((o) => ({ id: `other:${o.value}`, name: o.value })),
  ];

  return (
    <div className="space-y-8">
      {/* Categories — portfolio genres (e.g. Wedding, Movies, AI Video).
          On Designer profiles this section also subsumes Skills. */}
      {onCategoriesChange && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-gray-800">{categoriesLabel}</h3>
          <p className="mb-3 text-xs text-gray-500">{categoriesHelp}</p>
          {availableCategories.length === 0 ? (
            <p className="text-sm text-gray-400">No categories configured for this category yet.</p>
          ) : (
            <div className="space-y-2">
              {availableCategories.map((cat) => {
                const selected = categories.find((c) => c.category === cat.name);
                return (
                  <div key={cat.id} className="rounded-lg border border-gray-200 px-4 py-3">
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        checked={!!selected}
                        onChange={() => toggleCategory(cat.name)}
                      />
                      <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                    </label>
                    {selected && (
                      <div className="mt-3 flex items-center gap-3 pl-7">
                        <input
                          type="range"
                          min={1}
                          max={10}
                          value={selected.level}
                          onChange={(e) => setCategoryLevel(cat.name, Number(e.target.value))}
                          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-emerald-600"
                        />
                        <span className="w-8 text-center text-sm font-semibold text-emerald-600">
                          {selected.level}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Skill Sets */}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-gray-800">Skill Sets</h3>
        <p className="mb-3 text-xs text-gray-500">Select your skills and rate your proficiency level (1-10)</p>

        {availableSkills.length === 0 ? (
          <p className="text-sm text-gray-400">No skills configured for this category yet.</p>
        ) : (
          <GroupedSection
            items={availableSkills}
            renderFlat={renderSkillList}
            renderGroup={renderSkillList}
          />
        )}
      </div>

      {/* Accounting Software (accountant category only) — per-item proficiency
          1-5 (Learning / Beginner / Intermediate / Advanced / Expert). */}
      {showAccountingSoftware && onAccountingSoftwareChange && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-gray-800">Accounting Software</h3>
          <p className="mb-3 text-xs text-gray-500">
            Select the accounting tools you have experience with and rate your proficiency in each.
          </p>
          <div className="mb-3">
            <MultiSelectSearch
              options={ACCOUNTING_SOFTWARE_OTHER}
              selected={accountingSoftware.map((a) => a.name)}
              onChange={(names) => {
                const existing = new Map(accountingSoftware.map((a) => [a.name, a]));
                onAccountingSoftwareChange(
                  names.map((n) => existing.get(n) ?? { name: n, level: 3 })
                );
              }}
              placeholder="Search more software..."
            />
          </div>
          <LeveledCardPicker
            items={allAccountingOptions}
            selected={accountingSoftware}
            onChange={onAccountingSoftwareChange}
            accent="indigo"
          />
        </div>
      )}

      {/* Tools (or "Other Tools" when accounting software section is visible) */}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-gray-800">
          {showAccountingSoftware ? 'Other Tools' : 'Tools'}
        </h3>
        <p className="mb-3 text-xs text-gray-500">
          {showAccountingSoftware
            ? 'Select the non-accounting tools you use and rate your proficiency in each.'
            : 'Select the tools you are proficient in'}
        </p>

        {availableTools.length === 0 ? (
          <p className="text-sm text-gray-400">No tools configured for this category yet.</p>
        ) : (
          <LeveledCardPicker
            items={availableTools}
            selected={tools}
            onChange={onToolsChange}
            accent="zinc"
          />
        )}
      </div>

      {/* AI Tools */}
      {onAiToolsChange && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-gray-800">AI Tools</h3>
          <p className="mb-3 text-xs text-gray-500">
            Select the AI tools you use and rate your proficiency in each.
          </p>

          {availableAiTools.length === 0 ? (
            <p className="text-sm text-gray-400">No AI tools configured for this category yet.</p>
          ) : (
            <LeveledCardPicker
              items={availableAiTools}
              selected={aiTools}
              onChange={onAiToolsChange}
              accent="purple"
            />
          )}
        </div>
      )}

    </div>
  );
}
