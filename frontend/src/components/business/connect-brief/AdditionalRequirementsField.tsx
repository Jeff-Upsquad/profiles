'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import {
  useRoleTemplateCatalog,
  type TemplateItem,
} from '@/hooks/useCategories';

// ── Additional requirements (optional skills & tools on a brief) ─────────────
// Catalog chips come from the same template tables as talent job-profile
// creation (template_categories / template_skill_sets / template_tools /
// template_ai_tools). Businesses pick chips or add their own; the selection
// is forwarded to squadhub as role_requirements.<role>.additional_requirements.
// Descriptive only — never used to match talent during broadcast.

export type AdditionalRequirements = Record<string, string[]>;

const CATALOG_GROUPS: {
  key: 'categories' | 'skills' | 'tools' | 'ai_tools';
  field: 'categories' | 'skills' | 'tools' | 'aiTools';
  label: string;
  placeholder: string;
}[] = [
  { key: 'categories', field: 'categories', label: 'Categories', placeholder: 'Add your own category…' },
  { key: 'skills', field: 'skills', label: 'Skill sets', placeholder: 'Add your own skill set…' },
  { key: 'tools', field: 'tools', label: 'Tools', placeholder: 'Add your own tool…' },
  { key: 'ai_tools', field: 'aiTools', label: 'AI tools', placeholder: 'Add your own AI tool…' },
];

function hasAny(req: AdditionalRequirements | undefined): boolean {
  if (!req) return false;
  return Object.values(req).some((l) => Array.isArray(l) && l.some((s) => s.trim()));
}

function groupItems(items: TemplateItem[]): { name: string; items: TemplateItem[] }[] {
  const groups = new Map<string, TemplateItem[]>();
  items.forEach((item) => {
    const key = item.group || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  });
  const hasNamedGroups = Array.from(groups.keys()).some((k) => k !== '');
  if (!hasNamedGroups) return [{ name: '', items }];
  return Array.from(groups.entries()).map(([name, list]) => ({ name, items: list }));
}

export interface AdditionalRequirementsRole {
  slug: string;
  label: string;
}

/**
 * Optional "Additional requirements" block for the business connect-brief forms.
 * Single visible toggle; when on, shows the live template catalog chips plus an
 * "Add your own" input per group. Handles one role (accountant) or several
 * (designer/video), keying values by role slug.
 */
export default function AdditionalRequirementsField({
  roles,
  values,
  onChange,
  variant = 'card',
}: {
  roles: AdditionalRequirementsRole[];
  values: Record<string, AdditionalRequirements>;
  onChange: (slug: string, next: AdditionalRequirements) => void;
  variant?: 'card' | 'embedded';
}) {
  const [open, setOpen] = useState(() => roles.some((r) => hasAny(values[r.slug])));
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const multi = roles.length > 1;

  function has(slug: string, group: string, label: string): boolean {
    return (values[slug]?.[group] ?? []).some((x) => x.toLowerCase() === label.toLowerCase());
  }

  function toggleLabel(slug: string, group: string, label: string) {
    const cur = values[slug] ?? {};
    const list = cur[group] ?? [];
    const exists = list.some((x) => x.toLowerCase() === label.toLowerCase());
    const next = exists
      ? list.filter((x) => x.toLowerCase() !== label.toLowerCase())
      : [...list, label];
    onChange(slug, { ...cur, [group]: next });
  }

  function addCustom(slug: string, group: string) {
    const key = `${slug}:${group}`;
    const label = (drafts[key] ?? '').trim();
    if (!label) return;
    if (!has(slug, group, label)) {
      const cur = values[slug] ?? {};
      onChange(slug, { ...cur, [group]: [...(cur[group] ?? []), label] });
    }
    setDrafts((d) => ({ ...d, [key]: '' }));
  }

  function toggleOpen() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (!nextOpen) roles.forEach((r) => onChange(r.slug, {}));
  }

  return (
    <div className={`arq-card ${variant === 'embedded' ? 'arq-embedded' : ''}`}>
      <style>{ARQ_STYLES}</style>
      <div className="arq-top">
        <div className="arq-txt">
          <div className="arq-t">
            Add specific skills &amp; tools <span className="arq-tag">Optional</span>
          </div>
          <p className="arq-d">
            Have particular categories, skills, software or AI tools in mind? List them
            and we&apos;ll pass them to talent as additional requirements.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={open}
          aria-label="Toggle additional requirements"
          className={`arq-switch ${open ? '' : 'off'}`}
          onClick={toggleOpen}
        >
          <span className="arq-knob" />
        </button>
      </div>

      {open && (
        <div className="arq-reveal">
          {roles.map((role) => (
            <RoleCatalog
              key={role.slug}
              role={role}
              multi={multi}
              values={values[role.slug]}
              drafts={drafts}
              setDrafts={setDrafts}
              has={has}
              toggleLabel={toggleLabel}
              addCustom={addCustom}
            />
          ))}
          <div className="arq-callout">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="9" />
              <path strokeLinecap="round" d="M12 8h.01M11 12h1v4h1" />
            </svg>
            <span>
              These are shared with talent as <b>additional requirements</b> and shown on
              their card. They are <b>not</b> used to match or filter talent during broadcast.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function RoleCatalog({
  role,
  multi,
  values,
  drafts,
  setDrafts,
  has,
  toggleLabel,
  addCustom,
}: {
  role: AdditionalRequirementsRole;
  multi: boolean;
  values: AdditionalRequirements | undefined;
  drafts: Record<string, string>;
  setDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  has: (slug: string, group: string, label: string) => boolean;
  toggleLabel: (slug: string, group: string, label: string) => void;
  addCustom: (slug: string, group: string) => void;
}) {
  const catalog = useRoleTemplateCatalog(role.slug);

  return (
    <div className={multi ? 'arq-role' : ''}>
      {multi && <p className="arq-rolehd">{role.label}</p>}
      {CATALOG_GROUPS.map((group) => {
        const items = catalog[group.field];
        const selected = values?.[group.key] ?? [];
        const optionNames = items.map((item) => item.name);
        const customs = selected.filter(
          (l) => !optionNames.some((o) => o.toLowerCase() === l.toLowerCase()),
        );
        const draftKey = `${role.slug}:${group.key}`;
        const clustered = groupItems(items);
        return (
          <div key={group.key} className="arq-grp">
            <p className="arq-gl">{group.label}</p>
            {catalog.isLoading ? (
              <div className="arq-chips" aria-hidden>
                <span className="arq-skel" />
                <span className="arq-skel" />
                <span className="arq-skel" />
                <span className="arq-skel" />
              </div>
            ) : (
              clustered.map((cluster) => (
                <div key={cluster.name || '_flat'} className={cluster.name ? 'arq-cluster' : undefined}>
                  {cluster.name && <p className="arq-subhd">{cluster.name}</p>}
                  <div className="arq-chips">
                    {cluster.items.map((item) => {
                      const on = has(role.slug, group.key, item.name);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`connect-chip ${on ? 'connect-chip-on' : ''}`}
                          aria-pressed={on}
                          onClick={() => toggleLabel(role.slug, group.key, item.name)}
                        >
                          {on ? `✓ ${item.name}` : item.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
            {customs.length > 0 && (
              <div className="arq-chips">
                {customs.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="connect-chip connect-chip-on"
                    aria-pressed
                    onClick={() => toggleLabel(role.slug, group.key, c)}
                    title="Remove"
                  >
                    ✓ {c} <span className="arq-x">✕</span>
                  </button>
                ))}
              </div>
            )}
            <div className="arq-addrow">
              <input
                className="arq-input"
                placeholder={group.placeholder}
                value={drafts[draftKey] ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [draftKey]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustom(role.slug, group.key);
                  }
                }}
              />
              <button
                type="button"
                className="arq-addbtn"
                onClick={() => addCustom(role.slug, group.key)}
              >
                Add
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const ARQ_STYLES = `
.arq-card{background:#fff;border:2px solid #0a0a0a;border-radius:14px;padding:16px 18px;box-shadow:3px 3px 0 0 #0a0a0a}
.arq-card.arq-embedded{background:#FBFAF6;border:1px solid #E8E5DD;border-radius:12px;padding:16px;box-shadow:none}
.arq-top{display:flex;align-items:flex-start;gap:14px}
.arq-txt{flex:1;min-width:0}
.arq-t{font-size:15.5px;font-weight:700;color:#0a0a0a;display:flex;align-items:center;gap:8px}
.arq-tag{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b6b6b;background:#F1EFE7;border:1px solid #E2DFD3;border-radius:999px;padding:2px 8px}
.arq-d{margin:4px 0 0;font-size:12.5px;color:#5C5C5C}
.arq-switch{flex-shrink:0;width:50px;height:30px;border-radius:999px;background:#0a0a0a;position:relative;cursor:pointer;border:none;padding:0}
.arq-knob{position:absolute;top:3px;left:23px;width:24px;height:24px;border-radius:50%;background:#fff;transition:left .15s}
.arq-switch.off{background:#D9D5C7}
.arq-switch.off .arq-knob{left:3px}
.arq-reveal{margin-top:18px;border-top:1px dashed #E2DFD3;padding-top:16px}
.arq-role{margin-top:18px}
.arq-role:first-child{margin-top:0}
.arq-rolehd{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#7A7568;margin:0 0 10px}
.arq-grp{margin-top:18px}
.arq-grp:first-child{margin-top:2px}
.arq-gl{font-size:13px;font-weight:700;color:#222;margin:0 0 8px}
.arq-cluster{margin-top:10px}
.arq-cluster:first-of-type{margin-top:0}
.arq-subhd{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9C9486;margin:0 0 6px}
.arq-chips{display:flex;flex-wrap:wrap;gap:8px}
.arq-skel{display:inline-block;height:32px;width:92px;border-radius:999px;background:#F1EFE7}
.arq-card .connect-chip{min-height:34px;padding:6px 12px;border:1px solid #D9D5C7;border-radius:999px;background:#fff;color:#3A3A3A;font-family:inherit;font-size:12.5px;font-weight:600;line-height:1.2;cursor:pointer;transition:border-color .15s,background-color .15s,color .15s,box-shadow .15s}
.arq-card .connect-chip:hover{border-color:#0a0a0a}
.arq-card .connect-chip-on{border-color:#0a0a0a;background:#F2FCBC;color:#0a0a0a;box-shadow:inset 0 0 0 1px #0a0a0a}
.arq-x{font-weight:700;opacity:.55;margin-left:1px}
.arq-addrow{display:flex;gap:8px;margin-top:9px}
.arq-input{flex:1;min-width:0;border:1px dashed #D9D5C7;border-radius:999px;background:#FBFAF6;padding:7px 14px;font-size:13.5px;color:#222;font-family:inherit}
.arq-input::placeholder{color:#9C9486}
.arq-input:focus{outline:none;border-color:#3A3A3A;background:#fff}
.arq-addbtn{border:1px solid #D9D5C7;background:#fff;border-radius:999px;padding:0 15px;font-size:13.5px;font-weight:600;color:#3A3A3A;cursor:pointer}
.arq-callout{display:flex;gap:9px;align-items:flex-start;background:#F7FBEC;border:1px solid #E3ECC6;border-radius:10px;padding:10px 12px;margin-top:16px;font-size:12px;color:#586138}
.arq-callout svg{flex-shrink:0;margin-top:1px}
`;
