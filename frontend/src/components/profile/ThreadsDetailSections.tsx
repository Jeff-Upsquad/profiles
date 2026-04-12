'use client';

import type { CategoryField } from '@/types';

interface ThreadsDetailSectionsProps {
  fields: CategoryField[];
  fieldData: Record<string, any>;
  bioFieldKey?: string;
}

function isEmpty(value: any): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function TagSection({ label, tags, delay }: { label: string; tags: string[]; delay: number }) {
  return (
    <div className="animate-fade-up px-5 py-2" style={{ animationDelay: `${delay}s` }}>
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--threads-text-tertiary)]">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-[var(--threads-bg-tag)] px-[13px] py-[6px] text-[13px] font-medium text-[var(--threads-text-primary)] transition-colors hover:bg-[#e5e5e5]"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function FieldRow({ label, value, delay }: { label: string; value: string; delay: number }) {
  return (
    <div className="animate-fade-up flex items-baseline justify-between px-5 py-2" style={{ animationDelay: `${delay}s` }}>
      <span className="text-[13px] text-[var(--threads-text-secondary)]">{label}</span>
      <span className="text-right text-[14px] font-medium text-[var(--threads-text-primary)]">{value}</span>
    </div>
  );
}

function TextBlock({ label, text, delay }: { label: string; text: string; delay: number }) {
  return (
    <div className="animate-fade-up px-5 py-2" style={{ animationDelay: `${delay}s` }}>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--threads-text-tertiary)]">
        {label}
      </p>
      <p className="text-[14.5px] leading-relaxed text-[var(--threads-text-primary)] whitespace-pre-line">
        {text}
      </p>
    </div>
  );
}

function FileLink({ label, url, delay }: { label: string; url: string; delay: number }) {
  const isImage = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url);

  return (
    <div className="animate-fade-up px-5 py-2" style={{ animationDelay: `${delay}s` }}>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--threads-text-tertiary)]">
        {label}
      </p>
      {isImage ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img
            src={url}
            alt={label}
            className="h-32 w-auto rounded-lg border border-[var(--threads-border-light)] object-cover"
            loading="lazy"
          />
        </a>
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[var(--threads-accent)] hover:underline"
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

export default function ThreadsDetailSections({ fields, fieldData, bioFieldKey }: ThreadsDetailSectionsProps) {
  const activeFields = fields
    .filter((f) => f.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  let sectionIndex = 0;
  const sections: React.ReactNode[] = [];

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

  // Special field_data keys: _skills, _tools, _ai_tools
  const skills: { skill: string; level: number }[] = fieldData?._skills ?? [];
  const tools: string[] = fieldData?._tools ?? [];
  const aiTools: string[] = fieldData?._ai_tools ?? [];

  if (skills.length > 0) {
    const delay = sectionIndex * 0.04;
    const tags = skills.map((s) => `${s.skill} (${s.level}/10)`);
    sections.push(<TagSection key="_skills" label="Skills" tags={tags} delay={delay} />);
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

  if (sections.length === 0) return null;

  return <div className="mt-2 space-y-1">{sections}</div>;
}
