'use client';

import type { CategoryField } from '@/types';
import {
  coerceLeveledList,
  LEVEL_LABELS,
  type LeveledItem,
} from '../../../../shared/src/types/talent';

interface ThreadsDetailSectionsProps {
  fields: CategoryField[];
  fieldData: Record<string, any>;
  bioFieldKey?: string;
  languages?: { language: string; proficiency: string }[];
  /**
   * Parent category slug — used to relabel the Categories section to
   * "Categories and Skills" on Designer profiles, where Skills was folded
   * into Categories.
   */
  categorySlug?: string;
}

function isEmpty(value: any): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function getLevelLabel(dots: number): string {
  switch (dots) {
    case 5: return 'Expert';
    case 4: return 'Advanced';
    case 3: return 'Intermediate';
    case 2: return 'Beginner';
    default: return 'Learning';
  }
}

function SkillRow({ skill, level, maxLevel = 5 }: { skill: string; level: number; maxLevel?: number }) {
  // maxLevel=5  -> dots = level (1..5)
  // maxLevel=10 -> dots = Math.ceil(level / 2) (legacy 1..10 scale)
  const dots =
    maxLevel === 10
      ? Math.max(1, Math.min(5, Math.ceil(level / 2)))
      : Math.max(1, Math.min(5, Math.round(level)));
  return (
    <div className="flex items-center justify-between">
      <span className="text-[14px] font-medium text-zinc-800">{skill}</span>
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((l) => (
            <div
              key={l}
              className={`w-3 h-3 rounded-full ${l <= dots ? 'bg-zinc-800' : 'bg-zinc-200'}`}
            />
          ))}
        </div>
        <span className="text-[12px] text-zinc-500 w-24 text-right">
          {getLevelLabel(dots)}
        </span>
      </div>
    </div>
  );
}

function SkillsSection({
  label,
  skills,
  delay,
  maxLevel = 5,
}: {
  label: string;
  skills: { skill: string; level: number }[];
  delay: number;
  maxLevel?: number;
}) {
  return (
    <div className="animate-fade-up" style={{ animationDelay: `${delay}s` }}>
      <h3 className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider mb-2.5">
        {label}
      </h3>
      <div className="flex flex-col gap-3">
        {skills.map((s) => (
          <SkillRow key={s.skill} skill={s.skill} level={s.level} maxLevel={maxLevel} />
        ))}
      </div>
    </div>
  );
}

function TagSection({ label, tags, delay }: { label: string; tags: string[]; delay: number }) {
  return (
    <div className="animate-fade-up" style={{ animationDelay: `${delay}s` }}>
      <h3 className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider mb-2.5">
        {label}
      </h3>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="px-3 py-1.5 bg-white border border-zinc-200 rounded-[10px] text-[13px] font-medium text-zinc-800 shadow-sm"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function LeveledTagSection({ label, items, delay }: { label: string; items: LeveledItem[]; delay: number }) {
  return (
    <div className="animate-fade-up" style={{ animationDelay: `${delay}s` }}>
      <h3 className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider mb-2.5">
        {label}
      </h3>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <span
            key={it.name}
            className="px-3 py-1.5 bg-white border border-zinc-200 rounded-[10px] text-[13px] font-medium text-zinc-800 shadow-sm"
          >
            {it.name}
            <span className="ml-1.5 text-zinc-500 font-normal">
              · {LEVEL_LABELS[it.level] ?? 'Intermediate'}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function LanguagesSection({ languages, delay }: { languages: { language: string; proficiency: string }[]; delay: number }) {
  return (
    <div className="animate-fade-up" style={{ animationDelay: `${delay}s` }}>
      <h3 className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider mb-2.5">
        Languages
      </h3>
      <div className="flex flex-wrap gap-2">
        {languages.map((lang) => (
          <span
            key={lang.language}
            className="px-3 py-1.5 bg-zinc-100/80 border border-zinc-200 rounded-[10px] text-[13px] font-medium text-zinc-800 shadow-sm"
          >
            {lang.language} <span className="text-zinc-500 font-normal">&middot; {lang.proficiency}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function FieldRow({ label, value, delay }: { label: string; value: string; delay: number }) {
  return (
    <div className="animate-fade-up flex items-baseline justify-between" style={{ animationDelay: `${delay}s` }}>
      <span className="text-[13px] text-zinc-500">{label}</span>
      <span className="text-right text-[14px] font-medium text-zinc-800">{value}</span>
    </div>
  );
}

function formatExperience(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { years, months } = value as { years?: unknown; months?: unknown };
  if (typeof years !== 'number' || typeof months !== 'number') return null;
  if (years === 0 && months === 0) return null;
  const yPart = years === 1 ? '1 year' : `${years} years`;
  const mPart = months === 1 ? '1 month' : `${months} months`;
  return `${yPart} ${mPart}`;
}

function TextBlock({ label, text, delay }: { label: string; text: string; delay: number }) {
  return (
    <div className="animate-fade-up" style={{ animationDelay: `${delay}s` }}>
      <h3 className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
        {label}
      </h3>
      <p className="text-[14.5px] leading-relaxed text-zinc-800 whitespace-pre-line">
        {text}
      </p>
    </div>
  );
}

function FileLink({ label, url, delay }: { label: string; url: string; delay: number }) {
  const isImage = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url);

  return (
    <div className="animate-fade-up" style={{ animationDelay: `${delay}s` }}>
      <h3 className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
        {label}
      </h3>
      {isImage ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img
            src={url}
            alt={label}
            className="h-32 w-auto rounded-lg border border-zinc-200 object-cover"
            loading="lazy"
          />
        </a>
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[14px] font-medium text-zinc-950 hover:underline"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          View File
        </a>
      )}
    </div>
  );
}

function formatExpMonth(value: string): string {
  if (!value) return '';
  const [y, m] = String(value).split('-').map(Number);
  if (!y || !m) return String(value);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function IndustryExperienceSection({
  items,
  delay,
}: {
  items: { industry: string; from?: string; to?: string; current?: boolean }[];
  delay: number;
}) {
  return (
    <div className="animate-fade-up" style={{ animationDelay: `${delay}s` }}>
      <h3 className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider mb-2.5">
        Industry Experience
      </h3>
      <div className="flex flex-col gap-2">
        {items.map((it, idx) => {
          const range = [formatExpMonth(it.from ?? ''), it.current ? 'Present' : formatExpMonth(it.to ?? '')]
            .filter(Boolean)
            .join(' – ');
          return (
            <div key={`${it.industry}-${it.from}-${idx}`} className="flex items-center justify-between gap-3">
              <span className="text-[14px] font-medium text-zinc-800">{it.industry}</span>
              {range && <span className="text-[12px] text-zinc-500">{range}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ThreadsDetailSections({ fields, fieldData, bioFieldKey, languages, categorySlug }: ThreadsDetailSectionsProps) {
  const categoriesLabel = categorySlug === 'designer' ? 'Categories and Skills' : 'Categories';
  const activeFields = fields
    .filter((f) => f.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  let sectionIndex = 0;
  const sections: React.ReactNode[] = [];

  // Special field_data keys: _skills, _categories, _accounting_software, _tools, _ai_tools
  // Skills use the 1-5 scale (post the level-selector upgrade). Tolerate
  // legacy 1-10 rows by clamping to 1-5.
  const skills: { skill: string; level: number }[] = (fieldData?._skills ?? [])
    .map((s: { skill: string; level: number }) => ({
      skill: s.skill,
      level: Math.max(1, Math.min(5, Math.round(s.level))),
    }))
    .sort((a: { skill: string; level: number }, b: { skill: string; level: number }) => b.level - a.level);
  // Categories: legacy rows may carry plain string[] (pre-proficiency) or
  // 1-10 levels (pre-this-upgrade). Coerce both shapes into {skill, level}
  // and clamp the level to 1-5 so SkillsSection renders uniformly.
  const rawCategories: any[] = fieldData?._categories ?? [];
  const categories: { skill: string; level: number }[] = rawCategories
    .map((c) => {
      if (typeof c === 'string') return { skill: c, level: 3 };
      return {
        skill: c.category ?? c.skill ?? '',
        level: Math.max(1, Math.min(5, Math.round(Number(c.level ?? 3)))),
      };
    })
    .filter((c) => c.skill)
    .sort((a, b) => b.level - a.level);
  const accountingSoftware: LeveledItem[] = coerceLeveledList(fieldData?._accounting_software);
  const tools: LeveledItem[] = coerceLeveledList(fieldData?._tools);
  const aiTools: LeveledItem[] = coerceLeveledList(fieldData?._ai_tools);
  const industryExperience: { industry: string; from?: string; to?: string; current?: boolean }[] =
    Array.isArray(fieldData?._industry_experience)
      ? fieldData._industry_experience.filter((e: any) => e && e.industry)
      : [];

  // Rename "Tools" → "Other Tools" only when Accounting Software is also present
  const toolsLabel = accountingSoftware.length > 0 ? 'Other Tools' : 'Tools';

  // Built-in Experience pseudo-field (always present on job profiles).
  // Rendered first so the talent's total experience reads as the headline
  // fact at the top, above categories / skills / tools / languages.
  const experienceLabel = formatExperience(fieldData?._experience);
  if (experienceLabel) {
    const delay = sectionIndex * 0.04;
    sections.push(<FieldRow key="_experience" label="Experience" value={experienceLabel} delay={delay} />);
    sectionIndex++;
  }

  if (categories.length > 0) {
    const delay = sectionIndex * 0.04;
    sections.push(
      <SkillsSection
        key="_categories"
        label={categoriesLabel}
        skills={categories}
        delay={delay}
      />
    );
    sectionIndex++;
  }

  if (skills.length > 0) {
    const delay = sectionIndex * 0.04;
    sections.push(
      <SkillsSection key="_skills" label="Core Skills" skills={skills} delay={delay} />
    );
    sectionIndex++;
  }

  if (industryExperience.length > 0) {
    const delay = sectionIndex * 0.04;
    sections.push(
      <IndustryExperienceSection key="_industry_experience" items={industryExperience} delay={delay} />
    );
    sectionIndex++;
  }

  if (accountingSoftware.length > 0) {
    const delay = sectionIndex * 0.04;
    sections.push(
      <LeveledTagSection key="_accounting_software" label="Accounting Software" items={accountingSoftware} delay={delay} />
    );
    sectionIndex++;
  }

  if (tools.length > 0) {
    const delay = sectionIndex * 0.04;
    sections.push(<LeveledTagSection key="_tools" label={toolsLabel} items={tools} delay={delay} />);
    sectionIndex++;
  }

  if (aiTools.length > 0) {
    const delay = sectionIndex * 0.04;
    sections.push(<LeveledTagSection key="_ai_tools" label="AI Tools" items={aiTools} delay={delay} />);
    sectionIndex++;
  }

  if (languages && languages.length > 0) {
    const delay = sectionIndex * 0.04;
    sections.push(<LanguagesSection key="_languages" languages={languages} delay={delay} />);
    sectionIndex++;
  }

  for (const field of activeFields) {
    const value = fieldData?.[field.field_key];
    if (isEmpty(value)) continue;
    if (field.field_key === bioFieldKey) continue;

    const delay = sectionIndex * 0.04;

    switch (field.field_type) {
      case 'multi_select': {
        const labels = (field.options ?? []).reduce(
          (acc, opt) => ({ ...acc, [opt.value]: opt.label }),
          {} as Record<string, string>
        );
        const tags = (value as string[]).map((v) => labels[v] || v);
        sections.push(<TagSection key={field.id} label={field.field_label} tags={tags} delay={delay} />);
        break;
      }
      case 'select': {
        const opt = (field.options ?? []).find((o) => o.value === value);
        const label = opt?.label || String(value);
        sections.push(<TagSection key={field.id} label={field.field_label} tags={[label]} delay={delay} />);
        break;
      }
      case 'textarea': {
        sections.push(<TextBlock key={field.id} label={field.field_label} text={String(value)} delay={delay} />);
        break;
      }
      case 'file_upload': {
        sections.push(<FileLink key={field.id} label={field.field_label} url={String(value)} delay={delay} />);
        break;
      }
      case 'currency': {
        sections.push(
          <FieldRow key={field.id} label={field.field_label} value={`₹${Number(value).toLocaleString()}`} delay={delay} />
        );
        break;
      }
      default: {
        sections.push(
          <FieldRow key={field.id} label={field.field_label} value={String(value)} delay={delay} />
        );
        break;
      }
    }

    sectionIndex++;
  }

  if (sections.length === 0) return null;

  return <div className="mt-6 px-6 space-y-5">{sections}</div>;
}
