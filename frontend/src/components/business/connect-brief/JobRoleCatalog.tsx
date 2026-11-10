'use client';

import { useState } from 'react';
import { useRoleTemplateCatalog, type TemplateItem } from '@/hooks/useCategories';

// ── Skills, tools & software picker for the job-profile step ────────────────
// Same catalogue the subscription / assignment briefs use: per-category
// template_categories, template_skill_sets, template_tools and template_ai_tools.
// Unlike the brief's optional block, this is a first-class section of the job
// profile: skill sets become job.skills (shown on the job card), while
// categories / tools / AI tools travel with the job as additional requirements.

export type ProficiencyEntry = { name: string; level: number };

export type JobRoleRequirements = {
  categories?: string[];
  tools?: string[];
  ai_tools?: string[];
  skills_proficiency?: ProficiencyEntry[];
  tools_proficiency?: ProficiencyEntry[];
  ai_tools_proficiency?: ProficiencyEntry[];
};

const PROFICIENCY_LABELS: Record<number, string> = {
  1: 'Learning',
  2: 'Beginner',
  3: 'Intermediate',
  4: 'Advanced',
  5: 'Expert',
};

type CatalogData = {
  categories: TemplateItem[];
  skills: TemplateItem[];
  tools: TemplateItem[];
  aiTools: TemplateItem[];
  isLoading: boolean;
};

type GroupKey = 'categories' | 'skills' | 'tools' | 'ai_tools';

const GROUP_META: { key: GroupKey; label: string; hint: string; placeholder: string }[] = [
  {
    key: 'categories',
    label: 'Categories',
    hint: 'Specialisations the candidate should be comfortable owning.',
    placeholder: 'Add your own category…',
  },
  {
    key: 'skills',
    label: 'Skill sets',
    hint: 'Day-to-day skills for the role. These appear on the job card.',
    placeholder: 'Add your own skill…',
  },
  {
    key: 'tools',
    label: 'Tools',
    hint: 'Software and platforms the candidate should already know.',
    placeholder: 'Add your own tool…',
  },
  {
    key: 'ai_tools',
    label: 'AI tools',
    hint: 'AI tools that make the work faster or better.',
    placeholder: 'Add your own AI tool…',
  },
];

export default function JobRoleCatalog({
  role,
  preview,
  skills,
  onSkillsChange,
  requirements,
  onRequirementsChange,
}: {
  role: { slug: string; label: string };
  preview: boolean;
  skills: string[];
  onSkillsChange: (next: string[]) => void;
  requirements: JobRoleRequirements;
  onRequirementsChange: (next: JobRoleRequirements) => void;
}) {
  return preview ? (
    <CatalogBody
      role={role}
      data={previewCatalog(role.slug)}
      skills={skills}
      onSkillsChange={onSkillsChange}
      requirements={requirements}
      onRequirementsChange={onRequirementsChange}
    />
  ) : (
    <LiveCatalog
      role={role}
      skills={skills}
      onSkillsChange={onSkillsChange}
      requirements={requirements}
      onRequirementsChange={onRequirementsChange}
    />
  );
}

function LiveCatalog({
  role,
  skills,
  onSkillsChange,
  requirements,
  onRequirementsChange,
}: {
  role: { slug: string; label: string };
  skills: string[];
  onSkillsChange: (next: string[]) => void;
  requirements: JobRoleRequirements;
  onRequirementsChange: (next: JobRoleRequirements) => void;
}) {
  const catalog = useRoleTemplateCatalog(role.slug);
  return (
    <CatalogBody
      role={role}
      data={catalog}
      skills={skills}
      onSkillsChange={onSkillsChange}
      requirements={requirements}
      onRequirementsChange={onRequirementsChange}
    />
  );
}

// ── Proficiency helpers ───────────────────────────────────────────────────────

type ProficiencyKey = 'skills_proficiency' | 'tools_proficiency' | 'ai_tools_proficiency';

function proficiencyKey(group: GroupKey): ProficiencyKey | null {
  if (group === 'skills') return 'skills_proficiency';
  if (group === 'tools') return 'tools_proficiency';
  if (group === 'ai_tools') return 'ai_tools_proficiency';
  return null; // categories don't have proficiency
}

function getLevelFor(entries: ProficiencyEntry[], name: string): number {
  return entries.find((e) => e.name.toLowerCase() === name.toLowerCase())?.level ?? 0;
}

function setLevelFor(entries: ProficiencyEntry[], name: string, level: number): ProficiencyEntry[] {
  const without = entries.filter((e) => e.name.toLowerCase() !== name.toLowerCase());
  return level > 0 ? [...without, { name, level }] : without;
}

function CatalogBody({
  role,
  data,
  skills,
  onSkillsChange,
  requirements,
  onRequirementsChange,
}: {
  role: { slug: string; label: string };
  data: CatalogData;
  skills: string[];
  onSkillsChange: (next: string[]) => void;
  requirements: JobRoleRequirements;
  onRequirementsChange: (next: JobRoleRequirements) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [openGroup, setOpenGroup] = useState<GroupKey | null>('skills');

  const selectedFor = (group: GroupKey) =>
    group === 'skills' ? skills : requirements[group] ?? [];
  const proficiencyFor = (group: GroupKey): ProficiencyEntry[] => {
    const key = proficiencyKey(group);
    return key ? requirements[key] ?? [] : [];
  };
  const itemsFor = (group: GroupKey) =>
    group === 'categories' ? data.categories
      : group === 'skills' ? data.skills
        : group === 'tools' ? data.tools
          : data.aiTools;

  const changeFor = (group: GroupKey, next: string[]) => {
    if (group === 'skills') onSkillsChange(next);
    else onRequirementsChange({ ...requirements, [group]: next });
  };
  const changeProficiency = (group: GroupKey, next: ProficiencyEntry[]) => {
    const key = proficiencyKey(group);
    if (!key) return;
    onRequirementsChange({ ...requirements, [key]: next });
  };
  const toggle = (group: GroupKey, label: string) => {
    const selected = selectedFor(group);
    const exists = selected.some((v) => v.toLowerCase() === label.toLowerCase());
    if (exists) {
      const key = proficiencyKey(group);
      const newSelected = selected.filter((v) => v.toLowerCase() !== label.toLowerCase());
      if (key) {
        const newProf = proficiencyFor(group).filter((e) => e.name.toLowerCase() !== label.toLowerCase());
        onRequirementsChange({ ...requirements, [group]: newSelected, [key]: newProf });
      } else {
        changeFor(group, newSelected);
      }
    } else {
      changeFor(group, [...selected, label]);
    }
  };
  const addCustom = (group: GroupKey) => {
    const label = (drafts[group] ?? '').trim();
    if (!label) return;
    const selected = selectedFor(group);
    if (!selected.some((v) => v.toLowerCase() === label.toLowerCase())) {
      changeFor(group, [...selected, label]);
    }
    setDrafts((cur) => ({ ...cur, [group]: '' }));
  };

  return (
    <div className="space-y-2">
      {/* Catalogue badge + hint */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-[#7A7568]">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D9D5C7] bg-white px-2.5 py-1 font-semibold text-[#525252]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#B7D53A]" />
          {role.label} catalogue
        </span>
        <span>Click a section to expand and select.</span>
      </div>

      {GROUP_META.map((group) => {
        const items = itemsFor(group.key);
        const selected = selectedFor(group.key);
        const proficiency = proficiencyFor(group.key);
        const optionNames = items.map((item) => item.name.toLowerCase());
        const customs = selected.filter((label) => !optionNames.includes(label.toLowerCase()));
        const clusters = groupItems(items);
        const isOpen = openGroup === group.key;
        const hasProficiency = proficiencyKey(group.key) !== null;

        if (!data.isLoading && items.length === 0 && selected.length === 0) return null;

        return (
          <div key={group.key} className="overflow-hidden rounded-xl border border-[#E0DCCE] bg-white">

            {/* ── Accordion trigger ── */}
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpenGroup(isOpen ? null : group.key)}
              className={`group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                isOpen ? 'bg-[#FBFAF6]' : 'hover:bg-[#FBFAF6]'
              }`}
            >
              {/* animated chevron */}
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#E0DCCE] bg-white text-[#9C9486] transition-transform"
                style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M3.5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>

              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-[#0a0a0a]">{group.label}</span>

                {/* count / selected badge */}
                {selected.length > 0 ? (
                  <span className="rounded-full border border-[#c8e63b] bg-[#F2FCBC] px-2 py-0.5 text-[10px] font-bold text-[#3a5000]">
                    {selected.length} selected
                  </span>
                ) : (
                  !data.isLoading && (
                    <span className="rounded-full border border-[#E0DCCE] bg-[#F7F5EF] px-2 py-0.5 text-[10px] font-semibold text-[#9C9486]">
                      {items.length}
                    </span>
                  )
                )}

                {/* collapsed summary — selected chips with level label */}
                {!isOpen && selected.length > 0 && (
                  <span className="flex flex-wrap gap-1">
                    {selected.slice(0, 3).map((name) => {
                      const lv = getLevelFor(proficiency, name);
                      return (
                        <span key={name} className="inline-flex items-center gap-1 rounded-full border border-[#c8e63b] bg-[#F2FCBC] pl-2.5 pr-1.5 py-0.5 text-[10px] font-semibold text-[#3a5000]">
                          {name}
                          {lv > 0 && (
                            <span className="rounded-full bg-[#B7D53A] px-1.5 py-0 text-[9px] font-bold text-white leading-4">
                              {PROFICIENCY_LABELS[lv]}
                            </span>
                          )}
                        </span>
                      );
                    })}
                    {selected.length > 3 && (
                      <span className="rounded-full border border-[#E0DCCE] bg-[#F7F5EF] px-2 py-0.5 text-[10px] font-semibold text-[#7A7568]">
                        +{selected.length - 3} more
                      </span>
                    )}
                  </span>
                )}
              </span>
            </button>

            {/* ── Expanded panel ── */}
            {isOpen && (
              <div className="border-t border-[#E0DCCE]">

                {/* Item list */}
                <div className="px-4 pt-3 pb-2">
                  {data.isLoading ? (
                    <div className="space-y-2.5" aria-hidden>
                      {[0,1,2,3,4].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="h-3.5 flex-1 animate-pulse rounded bg-[#ECE8DC]" />
                          <span className="h-6 w-40 animate-pulse rounded bg-[#ECE8DC]" />
                        </div>
                      ))}
                    </div>
                  ) : items.length === 0 && customs.length === 0 ? (
                    <p className="py-2 text-xs text-[#9C9486]">
                      No {group.label.toLowerCase()} in the catalogue yet — add your own below.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {clusters.map((cluster) => (
                        <div key={cluster.name || '_flat'}>
                          {cluster.name && (
                            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#B0A99A]">
                              {cluster.name}
                            </div>
                          )}
                          <div className="flex flex-col items-stretch gap-1">
                            {cluster.items.map((item) => {
                              const on = selected.some((v) => v.toLowerCase() === item.name.toLowerCase());
                              const level = on ? getLevelFor(proficiency, item.name) : 0;
                              return (
                                <CatalogChip
                                  key={item.id}
                                  name={item.name}
                                  selected={on}
                                  level={level}
                                  hasProficiency={hasProficiency}
                                  onToggle={() => toggle(group.key, item.name)}
                                  onLevelChange={(lv) => changeProficiency(group.key, setLevelFor(proficiency, item.name, lv))}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {customs.length > 0 && (
                        <div>
                          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#B0A99A]">
                            Added by you
                          </div>
                          <div className="flex flex-col items-stretch gap-1">
                            {customs.map((label) => {
                              const level = getLevelFor(proficiency, label);
                              return (
                                <CatalogChip
                                  key={label}
                                  name={label}
                                  selected
                                  removable
                                  level={level}
                                  hasProficiency={hasProficiency}
                                  onToggle={() => toggle(group.key, label)}
                                  onLevelChange={(lv) => changeProficiency(group.key, setLevelFor(proficiency, label, lv))}
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Add custom */}
                <div className="flex gap-2 border-t border-[#F4F1E8] px-4 py-3">
                  <input
                    className="min-w-0 flex-1 rounded-full border border-dashed border-[#D9D5C7] bg-white px-3.5 py-2 text-xs text-[#222] outline-none transition focus:border-[#0a0a0a] focus:ring-2 focus:ring-[#FCF487]"
                    value={drafts[group.key] ?? ''}
                    placeholder={group.placeholder}
                    maxLength={120}
                    onChange={(e) => setDrafts((cur) => ({ ...cur, [group.key]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(group.key); } }}
                  />
                  <button
                    type="button"
                    onClick={() => addCustom(group.key)}
                    className="shrink-0 rounded-full border border-[#D9D5C7] bg-white px-3.5 py-2 text-xs font-semibold text-[#525252] transition hover:border-black hover:text-black"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Proficiency levels ────────────────────────────────────────────────────────

const LEVELS = [1, 2, 3, 4, 5] as const;

// ── CatalogChip — selectable chip; expands with level options when selected ───

function CatalogChip({
  name,
  selected,
  level,
  hasProficiency,
  removable = false,
  onToggle,
  onLevelChange,
}: {
  name: string;
  selected: boolean;
  level: number;
  hasProficiency: boolean;
  removable?: boolean;
  onToggle: () => void;
  onLevelChange: (level: number) => void;
}) {
  if (!selected) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="rounded-full border border-[#D9D5C7] bg-white px-3.5 py-1.5 text-left text-xs font-medium text-[#525252] transition hover:border-[#0a0a0a] hover:text-[#0a0a0a]"
      >
        {name}
      </button>
    );
  }

  return (
    <div className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-full border border-[#B7D53A] bg-white py-1 pl-1 pr-1.5 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
      {/* Name — click to deselect (clears the level with it) */}
      <button
        type="button"
        onClick={onToggle}
        title="Click to remove"
        className="flex items-center gap-1.5 rounded-full bg-[#F2FCBC] px-2.5 py-1 text-xs font-semibold text-[#1a2e00] transition hover:bg-[#E7F5A3]"
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#6aa800]" />
        {name}
      </button>

      {/* Proficiency options — proper names, no acronyms */}
      {hasProficiency && (
        <>
          <span className="h-4 w-px shrink-0 bg-[#D9D5C7]" />
          <div className="flex flex-wrap items-center">
            {LEVELS.map((lv) => {
              const active = level === lv;
              return (
                <button
                  key={lv}
                  type="button"
                  title={active ? `${PROFICIENCY_LABELS[lv]} — click to clear` : PROFICIENCY_LABELS[lv]}
                  onClick={() => onLevelChange(active ? 0 : lv)}
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold leading-4 transition ${
                    active
                      ? 'bg-[#0a0a0a] text-white'
                      : 'text-[#525252] hover:bg-[#F7F5EF] hover:text-[#0a0a0a]'
                  }`}
                >
                  {PROFICIENCY_LABELS[lv]}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Selected but no proficiency concept (categories) — drop a check mark */}
      {!hasProficiency && (
        <svg className="mx-1.5 h-3 w-3 shrink-0 text-[#6aa800]" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6l2.5 2.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}

      {/* Remove button for custom items */}
      {removable && (
        <button
          type="button"
          onClick={onToggle}
          className="ml-0.5 shrink-0 text-[11px] leading-none text-[#C4BEB4] transition hover:text-[#0a0a0a]"
          aria-label={`Remove ${name}`}
        >
          ✕
        </button>
      )}
    </div>
  );
}

function groupItems(items: TemplateItem[]): { name: string; items: TemplateItem[] }[] {
  const groups = new Map<string, TemplateItem[]>();
  items.forEach((item) => {
    const key = item.group || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  });
  const hasNamedGroups = Array.from(groups.keys()).some((key) => key !== '');
  if (!hasNamedGroups) return [{ name: '', items }];
  return Array.from(groups.entries()).map(([name, list]) => ({ name, items: list }));
}

// ── Preview catalogue ──────────────────────────────────────────────────────
// Public /preview/job-profile has no backend, so show a realistic catalogue for
// the categories in the preview switcher. Production always uses the live
// template tables from admin.

function item(prefix: string, name: string, group?: string, index = 0): TemplateItem {
  return { id: `${prefix}-${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, group };
}

function previewCatalog(slug: string): CatalogData {
  const key = normalizeSlug(slug);
  const catalog = PREVIEW_CATALOGS[key]
    ?? PREVIEW_CATALOGS[key.replace(/s$/, '')]
    ?? PREVIEW_CATALOGS.default;
  return { ...catalog, isLoading: false };
}

// Category-name derived slugs can carry stray characters ('copy / content
// writer' → 'copy-/-content-writer'); normalise before the catalogue lookup.
function normalizeSlug(slug: string): string {
  return slug.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const PREVIEW_CATALOGS: Record<string, Omit<CatalogData, 'isLoading'>> = {
  accountant: {
    categories: [],
    skills: [
      'GST Filing',
      'TDS Calculations and Filing',
      'ESI / PF Calculations and Filing',
      'ITR Filing Personal',
      'ITR Filing Business',
      'UAE VAT related knowledge',
      'Bookkeeping',
      'Bank Reconciliation',
      'Accounts Payable / Receivable',
      'Payroll Processing',
      'Financial Statement Preparation',
      'Cash Flow Management',
      'Inventory Accounting',
      'Audit Support',
      'Cost Accounting',
      'Budgeting & Forecasting',
      'MIS Reporting',
      'ROC / MCA Filings',
      'Management Accounting',
      'Advance Tax Computation',
    ].map((name, i) => item('ac-skill', name, undefined, i)),
    tools: [
      ...[
        'Zohobooks', 'Tally', 'Quick Books', 'Vyapar', 'Odoo', 'ERPnext',
        'Bookkeeper', 'Busy', 'Cleartax', 'Deskera', 'FreshBooks', 'HostBooks',
        'Khatabook', 'Marg ERP', 'MyBillBook', 'Oracle NetSuite', 'Petpooja',
        'ProfitBooks', 'SAP', 'Saral Accounts', 'Wave', 'Winman', 'Xero',
      ].map((name, i) => item('ac-tool-sw', name, 'Accounting Software', i)),
      ...[
        'Microsoft Excel', 'Google Sheets', 'Microsoft Word', 'Google Docs',
        'PowerPoint', 'Gmail / Outlook', 'WhatsApp Business', 'Slack',
        'Google Drive', 'Dropbox', 'Zoom / Google Meet', 'Adobe Acrobat (PDF)',
        'Canva', 'Razorpay / PayU', 'Digital signature (emSigner / DSC)',
      ].map((name, i) => item('ac-tool-ot', name, 'Other Tools', i)),
    ],
    aiTools: [
      'ChatGPT',
      'Claude',
      'Google Gemini',
      'Microsoft Copilot',
      'Perplexity',
      'Zoho Zia',
      'QuickBooks Intuit Assist',
      'Docyt',
      'Vic.ai',
      'Booke AI',
      'Dext',
      'Nanonets',
      'Klippa',
      'Notion AI',
      'Otter.ai',
    ].map((name, i) => item('ac-ai', name, undefined, i)),
  },
  designer: {
    categories: ['Brand design', 'Social media design', 'Presentation design', 'UI / UX'].map((name, i) => item('dz-cat', name, undefined, i)),
    skills: [
      ['Visual identity', 'Typography', 'Colour theory'],
      ['Social creatives', 'Ad creatives', 'Campaign design'],
      ['Wireframing', 'Prototyping', 'Design systems'],
    ].flatMap((names, groupIndex) => names.map((name, i) => item(`dz-skill-${groupIndex}`, name, ['Brand', 'Marketing', 'Product'][groupIndex], i))),
    tools: ['Figma', 'Adobe Illustrator', 'Adobe Photoshop', 'Canva', 'After Effects', 'InDesign'].map((name, i) => item('dz-tool', name, undefined, i)),
    aiTools: ['Midjourney', 'Adobe Firefly', 'Canva Magic Studio'].map((name, i) => item('dz-ai', name, undefined, i)),
  },
  'video-editor': {
    categories: ['Reels & shorts', 'Long-form edits', 'Motion graphics', 'Colour grading'].map((name, i) => item('ve-cat', name, undefined, i)),
    skills: [
      ['Story pacing', 'Cutting to music', 'Captions & subtitles'],
      ['Motion graphics', 'Transitions', 'Sound design'],
    ].flatMap((names, groupIndex) => names.map((name, i) => item(`ve-skill-${groupIndex}`, name, ['Editing', 'Post-production'][groupIndex], i))),
    tools: ['Premiere Pro', 'Final Cut Pro', 'DaVinci Resolve', 'After Effects', 'CapCut'].map((name, i) => item('ve-tool', name, undefined, i)),
    aiTools: ['Runway', 'Descript', 'Opus Clip'].map((name, i) => item('ve-ai', name, undefined, i)),
  },
  'copy-content-writer': {
    categories: ['Website copy', 'Social copy', 'Email & newsletters', 'SEO content'].map((name, i) => item('cw-cat', name, undefined, i)),
    skills: [
      ['Brand voice', 'Headlines', 'Storytelling'],
      ['SEO research', 'Content strategy', 'Editing & proofreading'],
    ].flatMap((names, groupIndex) => names.map((name, i) => item(`cw-skill-${groupIndex}`, name, ['Writing', 'Strategy'][groupIndex], i))),
    tools: ['Google Docs', 'Notion', 'Grammarly', 'Surfer SEO', 'Ahrefs'].map((name, i) => item('cw-tool', name, undefined, i)),
    aiTools: ['ChatGPT', 'Claude', 'Jasper'].map((name, i) => item('cw-ai', name, undefined, i)),
  },
  'social-media-manager': {
    categories: ['Content calendars', 'Community management', 'Paid social', 'Reporting'].map((name, i) => item('sm-cat', name, undefined, i)),
    skills: [
      ['Content planning', 'Copywriting', 'Community engagement'],
      ['Campaign reporting', 'Audience research', 'Trend spotting'],
    ].flatMap((names, groupIndex) => names.map((name, i) => item(`sm-skill-${groupIndex}`, name, ['Social', 'Growth'][groupIndex], i))),
    tools: ['Meta Business Suite', 'Buffer', 'Hootsuite', 'Later', 'Canva'].map((name, i) => item('sm-tool', name, undefined, i)),
    aiTools: ['ChatGPT', 'Canva Magic Studio', 'Metricool AI'].map((name, i) => item('sm-ai', name, undefined, i)),
  },
  default: {
    categories: ['Core delivery', 'Client communication', 'Reporting'].map((name, i) => item('df-cat', name, undefined, i)),
    skills: [
      ['Domain expertise', 'Communication', 'Problem solving'],
      ['Planning', 'Quality control', 'Documentation'],
    ].flatMap((names, groupIndex) => names.map((name, i) => item(`df-skill-${groupIndex}`, name, ['Core', 'Ways of working'][groupIndex], i))),
    tools: ['Google Workspace', 'Notion', 'Slack', 'Excel'].map((name, i) => item('df-tool', name, undefined, i)),
    aiTools: ['ChatGPT', 'Claude'].map((name, i) => item('df-ai', name, undefined, i)),
  },
};
