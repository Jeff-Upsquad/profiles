import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { LEVEL_LABELS, type LeveledItem } from '../../../../shared/src/types/talent';

interface SkillItem { id: string; name: string }
interface SkillWithLevel { skill: string; level: number }

interface Props {
  categoryId: string;
  skills: SkillWithLevel[];
  tools: LeveledItem[];
  aiTools: LeveledItem[];
  onSkillsChange: (s: SkillWithLevel[]) => void;
  onToolsChange: (t: LeveledItem[]) => void;
  onAiToolsChange: (a: LeveledItem[]) => void;
}

function useTemplate(kind: 'skills' | 'tools' | 'ai-tools', categoryId: string) {
  return useQuery<SkillItem[]>({
    queryKey: ['admin-template', kind, categoryId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/categories/${categoryId}/${kind}`);
      const key = kind === 'ai-tools' ? 'ai_tools' : kind;
      return data[key] ?? data;
    },
    enabled: !!categoryId,
  });
}

export default function AdminSkillsAndTools({
  categoryId,
  skills,
  tools,
  aiTools,
  onSkillsChange,
  onToolsChange,
  onAiToolsChange,
}: Props) {
  const { data: availableSkills = [] } = useTemplate('skills', categoryId);
  const { data: availableTools = [] } = useTemplate('tools', categoryId);
  const { data: availableAiTools = [] } = useTemplate('ai-tools', categoryId);

  const toggleSkill = (name: string) => {
    const existing = skills.find((s) => s.skill === name);
    if (existing) onSkillsChange(skills.filter((s) => s.skill !== name));
    else onSkillsChange([...skills, { skill: name, level: 5 }]);
  };
  const setLevel = (name: string, level: number) =>
    onSkillsChange(skills.map((s) => (s.skill === name ? { ...s, level } : s)));

  const toggleLeveled = (name: string) => {
    const existing = tools.find((t) => t.name === name);
    if (existing) {
      onToolsChange(tools.filter((t) => t.name !== name));
    } else {
      onToolsChange([...tools, { name, level: 3 }]);
    }
  };

  const setToolLevel = (name: string, level: number) => {
    onToolsChange(tools.map((t) => (t.name === name ? { ...t, level } : t)));
  };

  const toggleAi = (name: string) => {
    const existing = aiTools.find((t) => t.name === name);
    if (existing) {
      onAiToolsChange(aiTools.filter((t) => t.name !== name));
    } else {
      onAiToolsChange([...aiTools, { name, level: 3 }]);
    }
  };

  const setAiLevel = (name: string, level: number) => {
    onAiToolsChange(aiTools.map((t) => (t.name === name ? { ...t, level } : t)));
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-1 text-sm font-semibold text-gray-800">Skill Sets</h3>
        <p className="mb-3 text-xs text-gray-500">Toggle skills and rate proficiency (1–10)</p>
        {availableSkills.length === 0 ? (
          <p className="text-sm text-gray-400">No skills configured for this category.</p>
        ) : (
          <div className="space-y-2">
            {availableSkills.map((s) => {
              const sel = skills.find((x) => x.skill === s.name);
              return (
                <div key={s.id} className="rounded-lg border border-gray-200 px-4 py-3">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={!!sel}
                      onChange={() => toggleSkill(s.name)}
                    />
                    <span className="text-sm font-medium text-gray-700">{s.name}</span>
                  </label>
                  {sel && (
                    <div className="mt-3 flex items-center gap-3 pl-7">
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={sel.level}
                        onChange={(e) => setLevel(s.name, Number(e.target.value))}
                        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-indigo-600"
                      />
                      <span className="w-8 text-center text-sm font-semibold text-indigo-600">{sel.level}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold text-gray-800">Tools</h3>
        <p className="mb-3 text-xs text-gray-500">Tools the talent uses — rate proficiency 1–5</p>
        {availableTools.length === 0 ? (
          <p className="text-sm text-gray-400">No tools configured for this category.</p>
        ) : (
          <div className="space-y-2">
            {availableTools.map((t) => {
              const sel = tools.find((x) => x.name === t.name);
              return (
                <div key={t.id} className="rounded-lg border border-gray-200 px-4 py-3">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={!!sel}
                      onChange={() => toggleLeveled(t.name)}
                    />
                    <span className="text-sm font-medium text-gray-700">{t.name}</span>
                  </label>
                  {sel && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 pl-7">
                      <span className="mr-1 text-xs font-medium text-gray-500">Proficiency</span>
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setToolLevel(t.name, lvl)}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            sel.level === lvl
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {LEVEL_LABELS[lvl]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold text-gray-800">AI Tools</h3>
        <p className="mb-3 text-xs text-gray-500">AI tools the talent uses — rate proficiency 1–5</p>
        {availableAiTools.length === 0 ? (
          <p className="text-sm text-gray-400">No AI tools configured for this category.</p>
        ) : (
          <div className="space-y-2">
            {availableAiTools.map((t) => {
              const sel = aiTools.find((x) => x.name === t.name);
              return (
                <div key={t.id} className="rounded-lg border border-gray-200 px-4 py-3">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      checked={!!sel}
                      onChange={() => toggleAi(t.name)}
                    />
                    <span className="text-sm font-medium text-gray-700">{t.name}</span>
                  </label>
                  {sel && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 pl-7">
                      <span className="mr-1 text-xs font-medium text-gray-500">Proficiency</span>
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setAiLevel(t.name, lvl)}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            sel.level === lvl
                              ? 'border-purple-500 bg-purple-50 text-purple-700'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {LEVEL_LABELS[lvl]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
