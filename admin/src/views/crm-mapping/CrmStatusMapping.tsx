'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';

interface PipelineConfig {
  pipeline_name: string;
  mappings: Record<string, string>;
}

interface MultiPipelineConfig {
  crm_webhook_url: string;
  pipelines: Record<string, PipelineConfig>;
}

interface CrmStage {
  id: string;
  name: string;
  sort_order: number;
}

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
];

const EMPTY_PIPELINE: PipelineConfig = { pipeline_name: '', mappings: {} };

const DEFAULT_CONFIG: MultiPipelineConfig = {
  crm_webhook_url: '',
  pipelines: {
    creative: {
      pipeline_name: 'Designers and Editors',
      mappings: {
        new: 'New',
        share_form: 'Share form',
        form_filled: 'Form Filled / For Review',
        under_review: 'Form Filled / For Review',
        shortlisted: 'Shortlisted',
        signed_up: 'Signed Up',
        partner_onboarding: 'Onboarding Training',
        onboarding_training: 'Onboarding Training',
        basic_profile: 'Basic Profile',
        job_profile: 'Job Profile',
        portfolio_updation: 'Portfolio Updation',
        final_review: 'Final Review',
        onboard_completed: 'Live',
        live: 'Live',
        no_response: 'No Response / In Active',
        archived: 'No Response / In Active',
      },
    },
  },
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
  // Legacy shape
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
      },
    },
  };
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
  const [stagesByForm, setStagesByForm] = useState<Record<string, CrmStage[]>>({});
  const [fetchingFor, setFetchingFor] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setConfig(normalizeIncoming(data));
      setDirty(false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: MultiPipelineConfig) => {
      await api.put('/admin/settings/crm-status-mapping', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-status-mapping'] });
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

  const setMapping = (formType: string, statusKey: string, stage: string) => {
    setConfig((prev) => {
      const existing = prev.pipelines[formType] ?? EMPTY_PIPELINE;
      return {
        ...prev,
        pipelines: {
          ...prev.pipelines,
          [formType]: {
            ...existing,
            mappings: { ...existing.mappings, [statusKey]: stage },
          },
        },
      };
    });
    setDirty(true);
  };

  const addPipeline = (formType: string) => {
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
    setStagesByForm((prev) => {
      const next = { ...prev };
      delete next[formType];
      return next;
    });
    setDirty(true);
  };

  const fetchStages = async (formType: string) => {
    const pipelineName = config.pipelines[formType]?.pipeline_name?.trim();
    if (!pipelineName) {
      toast.error('Set the pipeline name first');
      return;
    }
    setFetchingFor(formType);
    try {
      const res = await api.get('/admin/settings/crm-status-mapping/stages', {
        params: { pipeline: pipelineName },
      });
      const stages = (res.data.stages as CrmStage[] | undefined) ?? [];
      setStagesByForm((prev) => ({ ...prev, [formType]: stages }));
      toast.success(`Fetched ${stages.length} stages from "${pipelineName}"`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to fetch stages');
    } finally {
      setFetchingFor(null);
    }
  };

  const configuredFormTypes = Object.keys(config.pipelines);
  const availableToAdd = useMemo(
    () => FORM_TYPE_OPTIONS.filter((ft) => !configuredFormTypes.includes(ft.value)),
    [configuredFormTypes],
  );

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
            Each candidate form type maps to its own CRM pipeline and per-status stages. The single webhook URL below is shared across all pipelines.
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
          helperText="POST endpoint that receives status_changed events"
        />
      </Card>

      {configuredFormTypes.map((ft) => (
        <PipelineCard
          key={ft}
          formType={ft}
          config={config.pipelines[ft]}
          stages={stagesByForm[ft]}
          fetching={fetchingFor === ft}
          onPipelineNameChange={(v) => setPipelineName(ft, v)}
          onMappingChange={(statusKey, value) => setMapping(ft, statusKey, value)}
          onFetchStages={() => fetchStages(ft)}
          onRemove={() => removePipeline(ft)}
        />
      ))}

      {availableToAdd.length > 0 && (
        <Card>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Add a pipeline for</span>
            {availableToAdd.map((ft) => (
              <button
                key={ft.value}
                onClick={() => addPipeline(ft.value)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                + {ft.label}
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function PipelineCard({
  formType,
  config,
  stages,
  fetching,
  onPipelineNameChange,
  onMappingChange,
  onFetchStages,
  onRemove,
}: {
  formType: string;
  config: PipelineConfig;
  stages: CrmStage[] | undefined;
  fetching: boolean;
  onPipelineNameChange: (value: string) => void;
  onMappingChange: (statusKey: string, value: string) => void;
  onFetchStages: () => void;
  onRemove: () => void;
}) {
  const formTypeLabel =
    FORM_TYPE_OPTIONS.find((ft) => ft.value === formType)?.label ?? formType;

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
          title="Remove this pipeline mapping"
        >
          Remove
        </button>
      </div>

      <div className="space-y-4 px-6 py-4">
        <div>
          <Input
            label="Pipeline Name in CRM"
            value={config.pipeline_name}
            onChange={(e) => onPipelineNameChange(e.target.value)}
            placeholder={
              formType === 'creative' ? 'Designers and Editors' : 'e.g. Accountants'
            }
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={onFetchStages}
              disabled={fetching || !config.pipeline_name?.trim()}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {fetching ? 'Fetching...' : 'Fetch stages from CRM'}
            </button>
            {stages !== undefined && (
              <span className="text-xs text-gray-500">
                {stages.length} stage{stages.length === 1 ? '' : 's'} fetched
              </span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status &rarr; CRM Stage
          </label>
          <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
            {SQUADHIRE_STATUSES.map((s) => (
              <div
                key={s.value}
                className="flex items-center gap-4 px-4 py-2.5 hover:bg-gray-50"
              >
                <div className="w-1/3 shrink-0">
                  <span className="text-sm font-medium text-gray-900">{s.label}</span>
                </div>
                <span className="text-gray-400">&rarr;</span>
                <div className="flex-1">
                  {stages && stages.length > 0 ? (
                    <select
                      value={config.mappings[s.value] ?? ''}
                      onChange={(e) => onMappingChange(s.value, e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">— skip —</option>
                      {stages.map((stage) => (
                        <option key={stage.id} value={stage.name}>
                          {stage.name.trim() || '(blank)'}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={config.mappings[s.value] ?? ''}
                      onChange={(e) => onMappingChange(s.value, e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="CRM stage name"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
