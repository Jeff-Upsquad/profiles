'use client';

import { useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import {
  useAdminModules,
  useSaveStaffGrants,
  type StaffSummary,
  type StaffGrant,
} from '@/hooks/useTeamAccess';
import {
  CANDIDATE_CATEGORIES,
  CANDIDATE_SECTIONS,
  type ModulePermission,
} from '../../../../shared/src/types/access';

const TIERS: { value: '' | ModulePermission; label: string }[] = [
  { value: '', label: 'No access' },
  { value: 'view', label: 'View only' },
  { value: 'edit', label: 'Edit' },
  { value: 'full', label: 'Full' },
  { value: 'admin', label: 'Admin' },
];

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function GrantMatrix({
  staff,
  onClose,
}: {
  staff: StaffSummary;
  onClose: () => void;
}) {
  const { data: modules, isLoading } = useAdminModules();
  const saveMutation = useSaveStaffGrants();

  const [selection, setSelection] = useState<Record<string, '' | ModulePermission>>(() => {
    const init: Record<string, '' | ModulePermission> = {};
    for (const g of staff.grants ?? []) init[g.module_slug] = g.permission;
    return init;
  });

  // Candidates intra-module scope. Empty array = "all" on that dimension.
  const candidatesGrant = (staff.grants ?? []).find((g) => g.module_slug === 'candidates');
  const [candCategories, setCandCategories] = useState<string[]>(
    () => candidatesGrant?.scope?.categories ?? [],
  );
  const [candSections, setCandSections] = useState<string[]>(
    () => candidatesGrant?.scope?.sections ?? [],
  );

  const grouped = useMemo(() => {
    const out: { section: string; items: typeof modules }[] = [];
    for (const m of modules ?? []) {
      let bucket = out.find((b) => b.section === m.section);
      if (!bucket) {
        bucket = { section: m.section, items: [] };
        out.push(bucket);
      }
      bucket.items!.push(m);
    }
    return out;
  }, [modules]);

  const grantedCount = Object.values(selection).filter(Boolean).length;

  function handleSave() {
    const grants: StaffGrant[] = Object.entries(selection)
      .filter(([, v]) => v)
      .map(([module_slug, permission]) => {
        const g: StaffGrant = { module_slug, permission: permission as ModulePermission };
        if (module_slug === 'candidates') {
          const hasScope = candCategories.length > 0 || candSections.length > 0;
          g.scope = hasScope
            ? {
                ...(candCategories.length ? { categories: candCategories } : {}),
                ...(candSections.length ? { sections: candSections } : {}),
              }
            : null;
        }
        return g;
      });
    saveMutation.mutate({ id: staff.id, grants }, { onSuccess: onClose });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Choose what <span className="font-medium text-gray-700">{staff.name}</span> can do in each
        module. Access is deny-by-default — anything left on{' '}
        <span className="font-medium">No access</span> stays hidden. <br />
        <span className="text-xs">
          View = read · Edit = create &amp; update · Full = incl. delete · Admin = full + can manage
          others&apos; access to that module.
        </span>
      </p>

      <div className="max-h-[55vh] space-y-5 overflow-y-auto pr-1">
        {grouped.map((group) => (
          <div key={group.section}>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {group.section}
            </div>
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {group.items!.map((m) => (
                <div key={m.slug}>
                  <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <span className="text-sm font-medium text-gray-800">{m.name}</span>
                    <select
                      value={selection[m.slug] ?? ''}
                      onChange={(e) =>
                        setSelection((prev) => ({
                          ...prev,
                          [m.slug]: e.target.value as '' | ModulePermission,
                        }))
                      }
                      className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {TIERS.map((t) => (
                        <option key={t.value || 'none'} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Candidates: per-category + per-section sub-scope */}
                  {m.slug === 'candidates' && selection['candidates'] && (
                    <div className="space-y-3 border-t border-dashed border-gray-200 bg-gray-50 px-4 py-3">
                      <ScopePicker
                        label="Categories"
                        hint="Leave all unchecked = every category"
                        options={CANDIDATE_CATEGORIES}
                        selected={candCategories}
                        onToggle={(v) => setCandCategories((prev) => toggle(prev, v))}
                      />
                      <ScopePicker
                        label="Sections"
                        hint="Leave all unchecked = every section"
                        options={CANDIDATE_SECTIONS}
                        selected={candSections}
                        onToggle={(v) => setCandSections((prev) => toggle(prev, v))}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-gray-200 pt-4">
        <span className="text-xs text-gray-500">{grantedCount} module(s) granted</span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saveMutation.isPending}>
            Save access
          </Button>
        </div>
      </div>
    </div>
  );
}

function ScopePicker({
  label,
  hint,
  options,
  selected,
  onToggle,
}: {
  label: string;
  hint: string;
  options: readonly { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-xs font-semibold text-gray-600">{label}</span>
        <span className="text-[11px] text-gray-400">{hint}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const checked = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggle(opt.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                checked
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-100'
              }`}
            >
              {checked ? '✓ ' : ''}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
