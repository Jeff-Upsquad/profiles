import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import ChipSelect from '@/components/ui/ChipSelect';
import MultiSelectSearch from '@/components/ui/MultiSelectSearch';
import {
  ACCOUNTING_SOFTWARE_PRIMARY,
  ACCOUNTING_SOFTWARE_OTHER,
} from '@/constants/lead-form-options';

interface SkillItem {
  id: string;
  name: string;
}

interface ToolItem {
  id: string;
  name: string;
  group?: string | null;
}

interface SkillWithLevel {
  skill: string;
  level: number;
}

interface DesignerExtrasProps {
  categoryId: string;
  skills: SkillWithLevel[];
  tools: string[];
  aiTools?: string[];
  accountingSoftware?: string[];
  onSkillsChange: (skills: SkillWithLevel[]) => void;
  onToolsChange: (tools: string[]) => void;
  onAiToolsChange?: (aiTools: string[]) => void;
  onAccountingSoftwareChange?: (accountingSoftware: string[]) => void;
  /** When true, renders an "Accounting Software" picker before Tools and relabels Tools to "Other Tools". */
  showAccountingSoftware?: boolean;
}

export default function DesignerExtras({
  categoryId,
  skills,
  tools,
  aiTools = [],
  accountingSoftware = [],
  onSkillsChange,
  onToolsChange,
  onAiToolsChange,
  onAccountingSoftwareChange,
  showAccountingSoftware = false,
}: DesignerExtrasProps) {
  const { data: availableSkills = [] } = useQuery<SkillItem[]>({
    queryKey: ['templateSkills', categoryId],
    queryFn: async () => {
      const { data } = await api.get(`/public/categories/${categoryId}/skills`);
      return data.skills ?? data;
    },
  });

  const { data: availableTools = [] } = useQuery<ToolItem[]>({
    queryKey: ['templateTools', categoryId],
    queryFn: async () => {
      const { data } = await api.get(`/public/categories/${categoryId}/tools`);
      return data.tools ?? data;
    },
  });

  const { data: availableAiTools = [] } = useQuery<SkillItem[]>({
    queryKey: ['templateAiTools', categoryId],
    queryFn: async () => {
      const { data } = await api.get(`/public/categories/${categoryId}/ai-tools`);
      return data.ai_tools ?? data;
    },
  });

  const toggleAiTool = (toolName: string) => {
    if (!onAiToolsChange) return;
    if (aiTools.includes(toolName)) {
      onAiToolsChange(aiTools.filter((t) => t !== toolName));
    } else {
      onAiToolsChange([...aiTools, toolName]);
    }
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

  const toggleTool = (toolName: string) => {
    if (tools.includes(toolName)) {
      onToolsChange(tools.filter((t) => t !== toolName));
    } else {
      onToolsChange([...tools, toolName]);
    }
  };

  return (
    <div className="space-y-8">
      {/* Skill Sets */}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-gray-800">Skill Sets</h3>
        <p className="mb-3 text-xs text-gray-500">Select your skills and rate your proficiency level (1-10)</p>

        {availableSkills.length === 0 ? (
          <p className="text-sm text-gray-400">No skills configured for this category yet.</p>
        ) : (
          <div className="space-y-2">
            {availableSkills.map((skill) => {
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
            })}
          </div>
        )}
      </div>

      {/* Accounting Software (accountant category only) */}
      {showAccountingSoftware && onAccountingSoftwareChange && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-gray-800">Accounting Software</h3>
          <p className="mb-3 text-xs text-gray-500">
            Select the accounting tools you have experience with — start with the primary ones, search for more below.
          </p>
          <ChipSelect
            multi
            options={ACCOUNTING_SOFTWARE_PRIMARY}
            selected={accountingSoftware}
            onChange={(v) => onAccountingSoftwareChange(v as string[])}
          />
          <div className="mt-2">
            <MultiSelectSearch
              options={ACCOUNTING_SOFTWARE_OTHER}
              selected={accountingSoftware}
              onChange={onAccountingSoftwareChange}
              placeholder="Search more software..."
            />
          </div>
        </div>
      )}

      {/* Tools (or "Other Tools" when accounting software section is visible) */}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-gray-800">
          {showAccountingSoftware ? 'Other Tools' : 'Tools'}
        </h3>
        <p className="mb-3 text-xs text-gray-500">
          {showAccountingSoftware
            ? 'Any non-accounting tools you use day-to-day'
            : 'Select the tools you are proficient in'}
        </p>

        {availableTools.length === 0 ? (
          <p className="text-sm text-gray-400">No tools configured for this category yet.</p>
        ) : (() => {
          const groups = new Map<string, ToolItem[]>();
          availableTools.forEach((t) => {
            const key = t.group || '';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(t);
          });
          const hasNamedGroups = Array.from(groups.keys()).some((k) => k !== '');

          const renderChips = (list: ToolItem[]) => (
            <div className="flex flex-wrap gap-2">
              {list.map((tool) => {
                const isSelected = tools.includes(tool.name);
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => toggleTool(tool.name)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {tool.name}
                  </button>
                );
              })}
            </div>
          );

          if (!hasNamedGroups) {
            return renderChips(availableTools);
          }

          return (
            <div className="space-y-5">
              {Array.from(groups.entries()).map(([groupName, list]) => (
                <div key={groupName || '_ungrouped'}>
                  {groupName && (
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {groupName}
                    </h4>
                  )}
                  {renderChips(list)}
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* AI Tools */}
      {onAiToolsChange && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-gray-800">AI Tools</h3>
          <p className="mb-3 text-xs text-gray-500">Select the AI tools you use</p>

          {availableAiTools.length === 0 ? (
            <p className="text-sm text-gray-400">No AI tools configured for this category yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableAiTools.map((tool) => {
                const isSelected = aiTools.includes(tool.name);
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => toggleAiTool(tool.name)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {tool.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
