'use client';

import type { CategoryField } from '@/types';

interface ThreadsDetailSectionsProps {
  fields: CategoryField[];
  fieldData: Record<string, any>;
  bioFieldKey?: string;
  languages?: { language: string; proficiency: string }[];
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
    default: return 'Novice';
  }
}

function SkillsSection({ skills, delay }: { skills: { skill: string; level: number }[]; delay: number }) {
  return (
    <div className="animate-fade-up" style={{ animationDelay: `${delay}s` }}>
      <h3 className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider mb-2.5">
        Core Skills
      </h3>
      <div className="flex flex-col gap-3">
        {skills.map((s) => {
          const dots = Math.max(1, Math.min(5, Math.ceil(s.level / 2)));
          return (
            <div key={s.skill} className="flex items-center justify-between">
              <span className="text-[14px] font-medium text-zinc-800">{s.skill}</span>
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={`w-3 h-3 rounded-full ${level <= dots ? 'bg-zinc-800' : 'bg-zinc-200'}`}
                    />
                  ))}
                </div>
                <span className="text-[12px] text-zinc-500 w-24 text-right">
                  {getLevelLabel(dots)}
                </span>
              </div>
            </div>
          );
        })}
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

export default function ThreadsDetailSections({ fields, fieldData, bioFieldKey, languages }: ThreadsDetailSectionsProps) {
  const activeFields = fields
    .filter((f) => f.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  let sectionIndex = 0;
  const sections: React.ReactNode[] = [];

  const skills: { skill: string; level: number }[] = fieldData?._skills ?? [];
  const tools: string[] = fieldData?._tools ?? [];
  const aiTools: string[] = fieldData?._ai_tools ?? [];

  if (skills.length > 0) {
    const delay = sectionIndex * 0.04;
    sections.push(<SkillsSection key="_skills" skills={skills} delay={delay} />);
    sectionIndex++;
  }

  if (tools.length > 0) {
    const delay = sectionIndex * 0.04;
    sections.push(<TagSection key="_tools" label="Tools" tags={tools} delay={delay} />);
    sectionIndex++;
  }

  if (aiTools.length > 0) {
    const delay = sectionIndex * 0.04;
    sections.push(<TagSection key="_ai_tools" label="AI Tools" tags={aiTools} delay={delay} />);
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
