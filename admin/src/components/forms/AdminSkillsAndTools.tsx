import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

interface SkillItem { id: string; name: string }
interface SkillWithLevel { skill: string; level: number }

interface Props {
  categoryId: string;
  skills: SkillWithLevel[];
  tools: string[];
  aiTools: string[];
  onSkillsChange: (s: SkillWithLevel[]) => void;
  onToolsChange: (t: string[]) => void;
  onAiToolsChange: (a: string[]) => void;
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

  const toggle = (list: string[], setter: (v: string[]) => void) => (name: string) => {
    if (list.includes(name)) setter(list.filter((t) => t !== name));
    else setter([...list, name]);
  };

  const Chip = ({
    name,
    selected,
    color,
    onClick,
  }: {
    name: string;
    selected: boolean;
    color: 'indigo' | 'purple';
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
        selected
          ? color === 'indigo'
            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
            : 'border-purple-500 bg-purple-50 text-purple-700'
          : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      {name}
    </button>
  );

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
        <p className="mb-3 text-xs text-gray-500">Tools the talent uses</p>
        {availableTools.length === 0 ? (
          <p className="text-sm text-gray-400">No tools configured for this category.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableTools.map((t) => (
              <Chip
                key={t.id}
                name={t.name}
                color="indigo"
                selected={tools.includes(t.name)}
                onClick={() => toggle(tools, onToolsChange)(t.name)}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold text-gray-800">AI Tools</h3>
        <p className="mb-3 text-xs text-gray-500">AI tools the talent uses</p>
        {availableAiTools.length === 0 ? (
          <p className="text-sm text-gray-400">No AI tools configured for this category.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableAiTools.map((t) => (
              <Chip
                key={t.id}
                name={t.name}
                color="purple"
                selected={aiTools.includes(t.name)}
                onClick={() => toggle(aiTools, onAiToolsChange)(t.name)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
