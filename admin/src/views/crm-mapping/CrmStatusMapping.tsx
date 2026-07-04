'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';

interface CrmStage {
  id: string;
  name: string;
  sort_order: number;
}

interface PipelineConfig {
  pipeline_name: string;
  // internalKey -> CRM stage id (new) or CRM stage name (legacy, pre-refresh).
  mappings: Record<string, string>;
  // Cached snapshot of the CRM pipeline's live stages.
  stages?: CrmStage[];
}

interface MultiPipelineConfig {
  crm_webhook_url: string;
  pipelines: Record<string, PipelineConfig>;
}

// The internal candidate stages (lead_status_enum). The CRM pipeline is the
// source of truth for the *right-hand* stage each maps to; these keys are the
// stable internal identity the rest of Profiles runs on.
const SQUADHIRE_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'share_form', label: 'Share Form' },
  { value: 'form_filled', label: 'Form Filled / For Review' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'signed_up', label: 'Signed Up' },
  { value: 'partner_onboarding', label: 'Onboarding' },
  { value: 'onboarding_training', label: 'Onboarding Training' },
  { value: 'basic_profile', label: 'Basic Profile' },
  { value: 'job_profile', label: 'Job Profile' },
  { value: 'portfolio_updation', label: 'Portfolio Updation' },
  { value: 'final_review', label: 'Final Review' },
  { value: 'onboard_completed', label: 'Completed' },
  { value: 'live', label: 'Live' },
  { value: 'no_response', label: 'No Response / In Active' },
  { value: 'archived', label: 'Archived' },
];

const FORM_TYPE_OPTIONS = [
  { value: 'creative', label: 'Creative (Designer / Editor)' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'sales', label: 'Sales' },
];

const EMPTY_PIPELINE: PipelineConfig = { pipeline_name: '', mappings: {}, stages: [] };

const DEFAULT_CONFIG: MultiPipelineConfig = {
  crm_webhook_url: '',
  pipelines: {},
};

// Tolerates the old single-pipeline shape (pre-00069) by collapsing it into
// the new shape under the first listed form_type.
function normalizeIncoming(raw: unknown): MultiPipelineConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_CONFIG;
  const r = raw as Record<string, unknown>;
  if (r.pipelines && typeof r.pipelines === 'object') {
    return {
      crm_webhook_url: String(r.crm_webhook_url ?? ''),
      pipelines: r.pipelines as Record<string, PipelineConfig>,
    };
  }
  // Legacy single-pipeline shape
  const formType =
    Array.isArray(r.form_types) && r.form_types.length > 0
      ? String(r.form_types[0])
      : 'creative';
  return {
    crm_webhook_url: String(r.crm_webhook_url ?? ''),
    pipelines: {
      [formType]: {
        pipeline_name: String(r.pipeline_name ?? ''),
        mappings: (r.mappings as Record<string, string>) ?? {},
        stages: [],
      },
    },
  };
}

// Given a stored mapping value (a stage id, or a legacy stage name) resolve the
// stage it currently points at within the live snapshot.
function stageForValue(value: string | undefined, stages: CrmStage[]): CrmStage | undefined {
  if (!value) return undefined;
  const byId = stages.find((s) => s.id === value);
  if (byId) return byId;
  const norm = value.trim().toLowerCase();
  return stages.find((s) => s.name.trim().toLowerCase() === norm);
}

export default function CrmStatusMapping() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['crm-status-mapping'],
    queryFn: async () => {
      const res = await api.get('/admin/settings/crm-status-mapping');
      return res.data.mapping as unknown;
    },
  });

  const [config, setConfig] = useState<MultiPipelineConfig>(DEFAULT_CONFIG);
  const [dirty, setDirty] = useState(false);
  const [selectedForm, setSelectedForm] = useState<string>('creative');
  const [fetchingFor, setFetchingFor] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      const next = normalizeIncoming(data);
      setConfig(next);
      setDirty(false);
      // Default the category selector to the first linked pipeline.
      const configured = Object.keys(next.pipelines);
      if (configured.length > 0) setSelectedForm((cur) => (next.pipelines[cur] ? cur : configured[0]));
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: MultiPipelineConfig) => {
      await api.put('/admin/settings/crm-status-mapping', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-status-mapping'] });
      // Also refresh the label feed the Leads boards read, so a rename shows on
      // candidate cards / stage tabs immediately after saving — not after the
      // stale window expires or a reload.
      queryClient.invalidateQueries({ queryKey: ['crm-stage-labels'] });
      toast.success('Mapping saved');
      setDirty(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to save');
    },
  });

  const setWebhook = (url: string) => {
    setConfig((prev) => ({ ...prev, crm_webhook_url: url }));
    setDirty(true);
  };

  const setPipelineName = (formType: string, name: string) => {
    setConfig((prev) => ({
      ...prev,
      pipelines: {
        ...prev.pipelines,
        [formType]: { ...(prev.pipelines[formType] ?? EMPTY_PIPELINE), pipeline_name: name },
      },
    }));
    setDirty(true);
  };

  // Store the CRM stage **id** (stable across renames). Empty string = skip.
  const setMapping = (formType: string, statusKey: string, stageId: string) => {
    setConfig((prev) => {
      const existing = prev.pipelines[formType] ?? EMPTY_PIPELINE;
      return {
        ...prev,
        pipelines: {
          ...prev.pipelines,
          [formType]: {
            ...existing,
            mappings: { ...existing.mappings, [statusKey]: stageId },
          },
        },
      };
    });
    setDirty(true);
  };

  const linkPipeline = (formType: string) => {
    setConfig((prev) => ({
      ...prev,
      pipelines: { ...prev.pipelines, [formType]: { ...EMPTY_PIPELINE } },
    }));
    setDirty(true);
  };

  const removePipeline = (formType: string) => {
    setConfig((prev) => {
      const next = { ...prev.pipelines };
      delete next[formType];
      return { ...prev, pipelines: next };
    });
    setDirty(true);
  };

  const fetchStages = useCallback(
    async (formType: string, opts: { silent?: boolean } = {}) => {
      const pipeline = config.pipelines[formType];
      const pipelineName = pipeline?.pipeline_name?.trim();
      if (!pipelineName) {
        if (!opts.silent) toast.error('Set the pipeline name first');
        return;
      }
      setFetchingFor(formType);
      try {
        const res = await api.get('/admin/settings/crm-status-mapping/stages', {
          params: { pipeline: pipelineName },
        });
        const stages = (res.data.stages as CrmStage[] | undefined) ?? [];

        setConfig((prev) => {
          const existing = prev.pipelines[formType] ?? EMPTY_PIPELINE;
          // Reconcile any legacy name-valued mappings to the stable stage id so
          // future CRM renames flow through automatically.
          const reconciled: Record<string, string> = { ...existing.mappings };
          let changed = false;
          for (const [key, value] of Object.entries(reconciled)) {
            const stage = stageForValue(value, stages);
            if (stage && stage.id !== value) {
              reconciled[key] = stage.id;
              changed = true;
            }
          }
          if (changed || JSON.stringify(existing.stages) !== JSON.stringify(stages)) {
            setDirty(true);
          }
          return {
            ...prev,
            pipelines: {
              ...prev.pipelines,
              [formType]: { ...existing, stages, mappings: reconciled },
            },
          };
        });
        if (!opts.silent) toast.success(`Fetched ${stages.length} stages from "${pipelineName}"`);
      } catch (err: any) {
        if (!opts.silent) toast.error(err.response?.data?.error || 'Failed to fetch stages');
      } finally {
        setFetchingFor(null);
      }
    },
    [config.pipelines],
  );

  // Auto-refresh the selected pipeline's stages from the CRM on load and on
  // category switch, so the page always reflects the live CRM pipeline. The
  // fetch only marks the form dirty when the CRM actually changed (rename /
  // add / reorder), so a no-op refresh won't nag the admin to Save.
  const selectedPipeline = config.pipelines[selectedForm];
  useEffect(() => {
    if (
      selectedPipeline &&
      selectedPipeline.pipeline_name?.trim() &&
      config.crm_webhook_url?.trim() &&
      fetchingFor !== selectedForm
    ) {
      fetchStages(selectedForm, { silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedForm, selectedPipeline?.pipeline_name, config.crm_webhook_url]);

  const linkedForms = Object.keys(config.pipelines);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">CRM Status Mapping</h1>
          <p className="mt-1 text-sm text-gray-500">
            The CRM pipeline is the source of truth for stage names. Pick a candidate category to
            see its linked pipeline and map each candidate stage to a live CRM stage. Renames in the
            CRM flow through here after a refresh.
          </p>
        </div>
        <button
          onClick={() => saveMutation.mutate(config)}
          disabled={!dirty || saveMutation.isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save'}
        </button>
      </div>

      <Card>
        <Input
          label="CRM Webhook URL"
          value={config.crm_webhook_url}
          onChange={(e) => setWebhook(e.target.value)}
          placeholder="https://shcrm-api.squadhub.in/integrations/profiles/leads"
          helperText="POST endpoint that receives status_changed events. Shared across all pipelines."
        />
      </Card>

      {/* Candidate category selector */}
      <Card>
        <label className="block text-sm font-medium text-gray-700 mb-2">Candidate category</label>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedForm}
            onChange={(e) => setSelectedForm(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {FORM_TYPE_OPTIONS.map((ft) => (
              <option key={ft.value} value={ft.value}>
                {ft.label}
                {config.pipelines[ft.value]
                  ? ` — ${config.pipelines[ft.value].pipeline_name || 'unnamed pipeline'}`
                  : ' — not linked'}
              </option>
            ))}
          </select>
          {selectedPipeline ? (
            <span className="text-sm text-gray-500">
              linked to CRM pipeline{' '}
              <span className="font-medium text-gray-800">
                {selectedPipeline.pipeline_name || '(name not set)'}
              </span>
            </span>
          ) : (
            <span className="text-sm text-gray-400">not linked to any CRM pipeline yet</span>
          )}
        </div>
      </Card>

      {selectedPipeline ? (
        <PipelineCard
          formType={selectedForm}
          config={selectedPipeline}
          fetching={fetchingFor === selectedForm}
          onPipelineNameChange={(v) => setPipelineName(selectedForm, v)}
          onMappingChange={(statusKey, stageId) => setMapping(selectedForm, statusKey, stageId)}
          onFetchStages={() => fetchStages(selectedForm)}
          onRemove={() => removePipeline(selectedForm)}
        />
      ) : (
        <Card>
          <p className="text-sm text-gray-600">
            <span className="font-medium">
              {FORM_TYPE_OPTIONS.find((f) => f.value === selectedForm)?.label ?? selectedForm}
            </span>{' '}
            isn&apos;t linked to a CRM pipeline yet.
          </p>
          <button
            onClick={() => linkPipeline(selectedForm)}
            className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            + Link a CRM pipeline
          </button>
        </Card>
      )}

      {linkedForms.length > 0 && (
        <p className="text-xs text-gray-400">
          Linked pipelines: {linkedForms.map((f) => config.pipelines[f].pipeline_name || f).join(', ')}
        </p>
      )}
    </div>
  );
}

function PipelineCard({
  formType,
  config,
  fetching,
  onPipelineNameChange,
  onMappingChange,
  onFetchStages,
  onRemove,
}: {
  formType: string;
  config: PipelineConfig;
  fetching: boolean;
  onPipelineNameChange: (value: string) => void;
  onMappingChange: (statusKey: string, stageId: string) => void;
  onFetchStages: () => void;
  onRemove: () => void;
}) {
  const formTypeLabel =
    FORM_TYPE_OPTIONS.find((ft) => ft.value === formType)?.label ?? formType;

  const stages = useMemo(
    () => [...(config.stages ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    [config.stages],
  );
  const hasStages = stages.length > 0;

  return (
    <Card padding={false}>
      <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-200">
        <div className="flex-1">
          <h2 className="text-base font-semibold text-gray-900">{formTypeLabel}</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            form_type: <code>{formType}</code>
          </p>
        </div>
        <button
          onClick={onRemove}
          className="text-xs text-red-600 hover:text-red-700"
          title="Unlink this pipeline"
        >
          Unlink
        </button>
      </div>

      <div className="space-y-4 px-6 py-4">
        <div>
          <Input
            label="Pipeline Name in CRM"
            value={config.pipeline_name}
            onChange={(e) => onPipelineNameChange(e.target.value)}
            placeholder={
              formType === 'creative' ? 'Designers and Editors' : 'e.g. Sales content'
            }
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={onFetchStages}
              disabled={fetching || !config.pipeline_name?.trim()}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {fetching ? 'Refreshing...' : hasStages ? 'Refresh stages from CRM' : 'Fetch stages from CRM'}
            </button>
            {hasStages && (
              <span className="text-xs text-gray-500">
                {stages.length} live stage{stages.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Candidate stage &rarr; CRM stage
          </label>
          {!hasStages && (
            <p className="mb-2 text-xs text-amber-600">
              No live stages loaded yet — set the pipeline name and Refresh to pull the current
              stages from the CRM.
            </p>
          )}
          <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
            {SQUADHIRE_STATUSES.map((s) => {
              const selected = stageForValue(config.mappings[s.value], stages);
              return (
                <div
                  key={s.value}
                  className="flex items-center gap-4 px-4 py-2.5 hover:bg-gray-50"
                >
                  <div className="w-1/3 shrink-0">
                    <span className="text-sm font-medium text-gray-900">{s.label}</span>
                  </div>
                  <span className="text-gray-400">&rarr;</span>
                  <div className="flex-1">
                    {hasStages ? (
                      <select
                        value={selected?.id ?? ''}
                        onChange={(e) => onMappingChange(s.value, e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">— skip —</option>
                        {stages.map((stage) => (
                          <option key={stage.id} value={stage.id}>
                            {stage.name.trim() || '(blank)'}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-gray-400">
                        {config.mappings[s.value] || '—'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
