import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

interface SkillItem {
  id: string;
  name: string;
}

interface SkillWithLevel {
  skill: string;
  level: number;
}

interface PlanWages {
  hourly?: number | '';
  daily?: number | '';
  monthly?: number | '';
}

interface DesignerExtrasProps {
  categoryId: string;
  skills: SkillWithLevel[];
  tools: string[];
  aiTools?: string[];
  planWages?: PlanWages;
  onSkillsChange: (skills: SkillWithLevel[]) => void;
  onToolsChange: (tools: string[]) => void;
  onAiToolsChange?: (aiTools: string[]) => void;
  onPlanWagesChange?: (wages: PlanWages) => void;
}

export default function DesignerExtras({
  categoryId,
  skills,
  tools,
  aiTools = [],
  planWages = {},
  onSkillsChange,
  onToolsChange,
  onAiToolsChange,
  onPlanWagesChange,
}: DesignerExtrasProps) {
  const { data: availableSkills = [] } = useQuery<SkillItem[]>({
    queryKey: ['templateSkills', categoryId],
    queryFn: async () => {
      const { data } = await api.get(`/public/categories/${categoryId}/skills`);
      return data.skills ?? data;
    },
  });

  const { data: availableTools = [] } = useQuery<SkillItem[]>({
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

      {/* Tools */}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-gray-800">Tools</h3>
        <p className="mb-3 text-xs text-gray-500">Select the tools you are proficient in</p>

        {availableTools.length === 0 ? (
          <p className="text-sm text-gray-400">No tools configured for this category yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableTools.map((tool) => {
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
        )}
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

      {/* Plan Wages */}
      {onPlanWagesChange && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-gray-800">Plan Wages</h3>
          <p className="mb-3 text-xs text-gray-500">Set your expected rates (USD)</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Hourly Rate</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                <input
                  type="number"
                  min={0}
                  value={planWages.hourly ?? ''}
                  onChange={(e) =>
                    onPlanWagesChange({ ...planWages, hourly: e.target.value ? Number(e.target.value) : '' })
                  }
                  placeholder="0"
                  className="w-full rounded-lg border border-gray-300 py-2 pl-7 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Daily Rate</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                <input
                  type="number"
                  min={0}
                  value={planWages.daily ?? ''}
                  onChange={(e) =>
                    onPlanWagesChange({ ...planWages, daily: e.target.value ? Number(e.target.value) : '' })
                  }
                  placeholder="0"
                  className="w-full rounded-lg border border-gray-300 py-2 pl-7 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Monthly Rate</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                <input
                  type="number"
                  min={0}
                  value={planWages.monthly ?? ''}
                  onChange={(e) =>
                    onPlanWagesChange({ ...planWages, monthly: e.target.value ? Number(e.target.value) : '' })
                  }
                  placeholder="0"
                  className="w-full rounded-lg border border-gray-300 py-2 pl-7 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
