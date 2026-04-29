'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';
import {
  FORM_FIELD_DEFINITIONS,
  OPERATORS_BY_TYPE,
  getFieldDef,
  needsArrayValue,
} from './auto-approval-fields';

interface Rule {
  field: string;
  operator: string;
  value: string | number | string[];
}

interface Config {
  enabled: boolean;
  match_mode: 'all' | 'any';
  rules: Rule[];
  approved_redirect_url: string;
  approved_message?: string;
}

const DEFAULT_CONFIG: Config = {
  enabled: false,
  match_mode: 'all',
  rules: [],
  approved_redirect_url: '',
  approved_message: '',
};

export default function AutoApprovalEditor({
  formId,
  formType,
}: {
  formId: string;
  formType: string;
}) {
  const queryClient = useQueryClient();
  const fields = FORM_FIELD_DEFINITIONS[formType] ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['auto-approval', formId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/forms/${formId}/auto-approval`);
      return data.auto_approval_rules as Config;
    },
  });

  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setConfig({
        ...DEFAULT_CONFIG,
        ...data,
        rules: Array.isArray(data.rules) ? data.rules : [],
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (cfg: Config) => {
      await api.put(`/admin/forms/${formId}/auto-approval`, cfg);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-approval', formId] });
      queryClient.invalidateQueries({ queryKey: ['admin-forms'] });
      setDirty(false);
      toast.success('Auto-approval rules saved');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to save rules');
    },
  });

  const update = (partial: Partial<Config>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
    setDirty(true);
  };

  const updateRule = (idx: number, partial: Partial<Rule>) => {
    setConfig((prev) => {
      const rules = [...prev.rules];
      rules[idx] = { ...rules[idx], ...partial };
      return { ...prev, rules };
    });
    setDirty(true);
  };

  const addRule = () => {
    const firstField = fields[0];
    if (!firstField) return;
    const ops = OPERATORS_BY_TYPE[firstField.type];
    update({
      rules: [
        ...config.rules,
        { field: firstField.key, operator: ops[0].value, value: '' },
      ],
    });
  };

  const removeRule = (idx: number) => {
    update({ rules: config.rules.filter((_, i) => i !== idx) });
  };

  const onFieldChange = (idx: number, fieldKey: string) => {
    const def = getFieldDef(formType, fieldKey);
    if (!def) return;
    const ops = OPERATORS_BY_TYPE[def.type];
    const newOp = ops[0].value;
    updateRule(idx, {
      field: fieldKey,
      operator: newOp,
      value: needsArrayValue(newOp) ? [] : '',
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Enable toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => update({ enabled: !config.enabled })}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
            config.enabled ? 'bg-indigo-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
              config.enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
        <span className="text-sm font-medium text-gray-700">
          {config.enabled ? 'Auto-approval enabled' : 'Auto-approval disabled'}
        </span>
      </div>

      {config.enabled && (
        <>
          {/* Match mode */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Match mode
            </label>
            <select
              value={config.match_mode}
              onChange={(e) => update({ match_mode: e.target.value as 'all' | 'any' })}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">ALL rules must match (AND)</option>
              <option value="any">ANY rule can match (OR)</option>
            </select>
          </div>

          {/* Redirect URL */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Redirect URL (shown on approval)
            </label>
            <input
              type="url"
              value={config.approved_redirect_url}
              onChange={(e) => update({ approved_redirect_url: e.target.value })}
              placeholder="https://upsquadconnect.com/partner-program/"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Custom message */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Approval message (optional)
            </label>
            <input
              type="text"
              value={config.approved_message || ''}
              onChange={(e) => update({ approved_message: e.target.value || undefined })}
              placeholder="Your profile is auto-approved!"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Rules */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Rules
            </label>
            {config.rules.length === 0 && (
              <p className="text-sm text-gray-400">
                No rules yet. Add a rule to start auto-approving candidates.
              </p>
            )}
            <div className="space-y-3">
              {config.rules.map((rule, idx) => {
                const def = getFieldDef(formType, rule.field);
                const fieldType = def?.type ?? 'string';
                const operators = OPERATORS_BY_TYPE[fieldType];
                const showArrayValue = needsArrayValue(rule.operator);
                const hasOptions = !!def?.options;

                return (
                  <div
                    key={idx}
                    className="flex flex-wrap items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3"
                  >
                    {/* Field */}
                    <select
                      value={rule.field}
                      onChange={(e) => onFieldChange(idx, e.target.value)}
                      className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {fields.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                    </select>

                    {/* Operator */}
                    <select
                      value={rule.operator}
                      onChange={(e) => {
                        const newOp = e.target.value;
                        const wasArray = needsArrayValue(rule.operator);
                        const isArray = needsArrayValue(newOp);
                        updateRule(idx, {
                          operator: newOp,
                          value: wasArray !== isArray ? (isArray ? [] : '') : rule.value,
                        });
                      }}
                      className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {operators.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>

                    {/* Value */}
                    <div className="min-w-[180px] flex-1">
                      {showArrayValue && hasOptions ? (
                        <div className="flex flex-wrap gap-1.5">
                          {def!.options!.map((opt) => {
                            const selected =
                              Array.isArray(rule.value) && rule.value.includes(opt.value);
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  const arr = Array.isArray(rule.value) ? rule.value : [];
                                  updateRule(idx, {
                                    value: selected
                                      ? arr.filter((v) => v !== opt.value)
                                      : [...arr, opt.value],
                                  });
                                }}
                                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                                  selected
                                    ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300'
                                    : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      ) : showArrayValue ? (
                        <input
                          type="text"
                          value={
                            Array.isArray(rule.value) ? rule.value.join(', ') : ''
                          }
                          onChange={(e) =>
                            updateRule(idx, {
                              value: e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="Value1, Value2, ..."
                          className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      ) : hasOptions ? (
                        <select
                          value={String(rule.value)}
                          onChange={(e) => updateRule(idx, { value: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Select...</option>
                          {def!.options!.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={fieldType === 'number' ? 'number' : 'text'}
                          value={String(rule.value)}
                          onChange={(e) =>
                            updateRule(idx, {
                              value:
                                fieldType === 'number'
                                  ? Number(e.target.value) || 0
                                  : e.target.value,
                            })
                          }
                          placeholder={
                            fieldType === 'number' ? 'Enter number' : 'Enter value'
                          }
                          className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      )}
                    </div>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => removeRule(idx)}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={addRule}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:border-indigo-300 hover:text-indigo-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Rule
            </button>
          </div>

          {/* Save */}
          {dirty && (
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => saveMutation.mutate(config)}
                disabled={saveMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                {saveMutation.isPending ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving…
                  </>
                ) : (
                  'Save Rules'
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
