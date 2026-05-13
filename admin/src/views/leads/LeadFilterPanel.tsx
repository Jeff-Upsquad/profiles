'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export type FormDataFilterRule = {
  field: string;
  op: 'eq' | 'contains';
  value: string;
  kind?: 'scalar' | 'array';
};

interface SavedFilter {
  id: string;
  name: string;
  form_type: string | null;
  filter_json: FormDataFilterRule[];
}

interface FieldOption {
  field: string;
  kind: 'scalar' | 'array';
  sample_values: string[];
}

interface Props {
  formType: string;
  currentRules: FormDataFilterRule[];
  // Push the rules into the URL. Null clears.
  onApply: (rules: FormDataFilterRule[] | null) => void;
}

const EMPTY_RULE: FormDataFilterRule = { field: '', op: 'contains', value: '' };

export default function LeadFilterPanel({ formType, currentRules, onApply }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingRules, setEditingRules] = useState<FormDataFilterRule[]>([]);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [activeSavedFilterId, setActiveSavedFilterId] = useState<string | null>(null);

  // Pull the URL-applied rules into the editor whenever they change externally
  // (e.g. on category switch, or after a saved filter is applied).
  useEffect(() => {
    setEditingRules(currentRules.length > 0 ? currentRules : []);
  }, [currentRules]);

  const fieldsQuery = useQuery<FieldOption[]>({
    queryKey: ['admin-leads-form-fields', formType],
    queryFn: async () => {
      const { data } = await api.get(`/admin/leads/form-fields?form_type=${formType}`);
      return data.fields ?? [];
    },
    enabled: !!formType,
  });

  const savedQuery = useQuery<SavedFilter[]>({
    queryKey: ['admin-saved-lead-filters', formType],
    queryFn: async () => {
      const { data } = await api.get(`/admin/lead-filters?form_type=${formType}`);
      return data.filters ?? [];
    },
    enabled: !!formType,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; rules: FormDataFilterRule[] }) => {
      const { data } = await api.post('/admin/lead-filters', {
        name: payload.name,
        form_type: formType,
        filter_json: payload.rules,
      });
      return data.filter as SavedFilter;
    },
    onSuccess: (filter) => {
      queryClient.invalidateQueries({ queryKey: ['admin-saved-lead-filters', formType] });
      setActiveSavedFilterId(filter.id);
      toast.success('Filter saved');
      setShowSaveForm(false);
      setSaveName('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to save filter');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; name?: string; rules?: FormDataFilterRule[] }) => {
      const body: Record<string, unknown> = {};
      if (payload.name !== undefined) body.name = payload.name;
      if (payload.rules !== undefined) body.filter_json = payload.rules;
      const { data } = await api.patch(`/admin/lead-filters/${payload.id}`, body);
      return data.filter as SavedFilter;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-saved-lead-filters', formType] });
      toast.success('Filter updated');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update filter');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/lead-filters/${id}`);
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['admin-saved-lead-filters', formType] });
      if (activeSavedFilterId === id) {
        setActiveSavedFilterId(null);
        onApply(null);
      }
      toast.success('Filter deleted');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete filter');
    },
  });

  const fieldsByName = useMemo(() => {
    const map: Record<string, FieldOption> = {};
    for (const f of fieldsQuery.data ?? []) map[f.field] = f;
    return map;
  }, [fieldsQuery.data]);

  const addRule = () => {
    const first = fieldsQuery.data?.[0];
    setEditingRules((prev) => [
      ...prev,
      {
        ...EMPTY_RULE,
        field: first?.field ?? '',
        kind: first?.kind ?? 'scalar',
        op: first?.kind === 'array' ? 'contains' : 'contains',
      },
    ]);
  };

  const updateRule = (idx: number, patch: Partial<FormDataFilterRule>) =>
    setEditingRules((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = { ...r, ...patch };
        // When the field changes, re-derive `kind` from the discovery data so
        // the backend picks the right operator (scalar ilike vs array @>).
        if (patch.field !== undefined) {
          const opt = fieldsByName[patch.field];
          next.kind = opt?.kind ?? 'scalar';
          // Arrays only support a single op semantically — normalize to 'contains'.
          if (next.kind === 'array') next.op = 'contains';
        }
        return next;
      })
    );

  const removeRule = (idx: number) =>
    setEditingRules((prev) => prev.filter((_, i) => i !== idx));

  const handleApply = () => {
    const cleaned = editingRules.filter((r) => r.field && r.value);
    if (cleaned.length === 0) {
      onApply(null);
    } else {
      onApply(cleaned);
    }
  };

  const handleClear = () => {
    setEditingRules([]);
    setActiveSavedFilterId(null);
    onApply(null);
  };

  const applySaved = (filter: SavedFilter) => {
    setEditingRules(filter.filter_json);
    setActiveSavedFilterId(filter.id);
    onApply(filter.filter_json);
  };

  const overwriteSaved = () => {
    if (!activeSavedFilterId) return;
    const cleaned = editingRules.filter((r) => r.field && r.value);
    updateMutation.mutate({ id: activeSavedFilterId, rules: cleaned });
  };

  const renameSaved = (id: string, currentName: string) => {
    const next = window.prompt('Rename filter', currentName);
    if (next == null || next.trim() === '' || next.trim() === currentName) return;
    updateMutation.mutate({ id, name: next.trim() });
  };

  const deleteSaved = (id: string, name: string) => {
    if (!window.confirm(`Delete saved filter "${name}"?`)) return;
    deleteMutation.mutate(id);
  };

  const handleSave = () => {
    const name = saveName.trim();
    if (!name) {
      toast.error('Please name the filter');
      return;
    }
    const cleaned = editingRules.filter((r) => r.field && r.value);
    if (cleaned.length === 0) {
      toast.error('Add at least one rule before saving');
      return;
    }
    createMutation.mutate({ name, rules: cleaned });
  };

  const activeCount = currentRules.length;
  const fieldOptions = fieldsQuery.data ?? [];
  const savedFilters = savedQuery.data ?? [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filter by Application
          {activeCount > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-indigo-100 px-1.5 text-xs font-semibold text-indigo-700">
              {activeCount}
            </span>
          )}
        </span>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="space-y-4 border-t border-gray-200 p-4">
          {/* Saved filters strip */}
          {savedFilters.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Saved Filters
              </div>
              <div className="flex flex-wrap gap-2">
                {savedFilters.map((f) => {
                  const isActive = activeSavedFilterId === f.id;
                  return (
                    <div
                      key={f.id}
                      className={`group flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${
                        isActive
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <button type="button" onClick={() => applySaved(f)} className="font-medium">
                        {f.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => renameSaved(f.id, f.name)}
                        className="ml-1 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-indigo-600"
                        title="Rename"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSaved(f.id, f.name)}
                        className="text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-600"
                        title="Delete"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rule editor */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Rules
            </div>
            {editingRules.length === 0 ? (
              <p className="text-sm text-gray-500">No rules. Click <em>Add rule</em> to filter by an application field.</p>
            ) : (
              <div className="space-y-2">
                {editingRules.map((rule, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-2">
                    <select
                      className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={rule.field}
                      onChange={(e) => updateRule(idx, { field: e.target.value })}
                    >
                      <option value="">Select field…</option>
                      {fieldOptions.map((f) => (
                        <option key={f.field} value={f.field}>
                          {f.field}{f.kind === 'array' ? ' (multi)' : ''}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={rule.op}
                      onChange={(e) => updateRule(idx, { op: e.target.value as FormDataFilterRule['op'] })}
                      disabled={rule.kind === 'array'}
                    >
                      {rule.kind === 'array' ? (
                        <option value="contains">includes</option>
                      ) : (
                        <>
                          <option value="contains">contains</option>
                          <option value="eq">equals</option>
                        </>
                      )}
                    </select>
                    <div className="min-w-[10rem] flex-1">
                      <Input
                        placeholder="Value"
                        value={rule.value}
                        onChange={(e) => updateRule(idx, { value: e.target.value })}
                        list={`field-samples-${idx}`}
                      />
                      <datalist id={`field-samples-${idx}`}>
                        {(fieldOptions.find((f) => f.field === rule.field)?.sample_values ?? []).map((sv) => (
                          <option key={sv} value={sv} />
                        ))}
                      </datalist>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRule(idx)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                      title="Remove rule"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={addRule}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
              disabled={fieldOptions.length === 0}
            >
              + Add rule
            </button>
            {fieldsQuery.isLoading && (
              <p className="text-xs text-gray-400">Loading fields…</p>
            )}
            {!fieldsQuery.isLoading && fieldOptions.length === 0 && (
              <p className="text-xs text-gray-400">
                No filterable fields found for this category yet. (We sample from existing applications.)
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
            <Button onClick={handleApply}>Apply</Button>
            <Button variant="secondary" onClick={handleClear}>Clear</Button>
            {activeSavedFilterId && (
              <Button
                variant="secondary"
                onClick={overwriteSaved}
                loading={updateMutation.isPending}
              >
                Update preset
              </Button>
            )}
            {!showSaveForm ? (
              <button
                type="button"
                onClick={() => setShowSaveForm(true)}
                className="ml-auto text-sm font-medium text-indigo-600 hover:text-indigo-800"
              >
                Save as preset
              </button>
            ) : (
              <div className="ml-auto flex items-center gap-2">
                <Input
                  placeholder="Filter name"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="w-48"
                />
                <Button onClick={handleSave} loading={createMutation.isPending}>Save</Button>
                <Button variant="secondary" onClick={() => { setShowSaveForm(false); setSaveName(''); }}>Cancel</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
