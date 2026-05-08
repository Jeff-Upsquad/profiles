'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';

interface MappingConfig {
  pipeline_name: string;
  form_types: string[];
  crm_webhook_url: string;
  mappings: Record<string, string>;
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

const DEFAULT_MAPPING: MappingConfig = {
  pipeline_name: 'Designers and Editors',
  form_types: ['creative'],
  crm_webhook_url: '',
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
};

export default function CrmStatusMapping() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['crm-status-mapping'],
    queryFn: async () => {
      const res = await api.get('/admin/settings/crm-status-mapping');
      return res.data.mapping as MappingConfig | null;
    },
  });

  const [config, setConfig] = useState<MappingConfig>(DEFAULT_MAPPING);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setConfig(data);
      setDirty(false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: MappingConfig) => {
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

  const updateField = <K extends keyof MappingConfig>(key: K, value: MappingConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const updateMapping = (statusKey: string, crmStage: string) => {
    setConfig((prev) => ({
      ...prev,
      mappings: { ...prev.mappings, [statusKey]: crmStage },
    }));
    setDirty(true);
  };

  const toggleFormType = (ft: string) => {
    setConfig((prev) => {
      const current = prev.form_types;
      const next = current.includes(ft)
        ? current.filter((t) => t !== ft)
        : [...current, ft];
      return { ...prev, form_types: next };
    });
    setDirty(true);
  };

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
            Map SquadHire candidate statuses to Squad CRM pipeline stages. When a status changes, the mapped CRM stage is sent via webhook.
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

      {/* Pipeline config */}
      <Card>
        <div className="space-y-4">
          <Input
            label="Pipeline Name"
            value={config.pipeline_name}
            onChange={(e) => updateField('pipeline_name', e.target.value)}
            placeholder="e.g. Designers and Editors"
          />

          <Input
            label="CRM Webhook URL"
            value={config.crm_webhook_url}
            onChange={(e) => updateField('crm_webhook_url', e.target.value)}
            placeholder="https://shcrm.squadhub.in/api/webhooks/status"
            helperText="POST endpoint that receives status_changed events"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Applies to form types
            </label>
            <div className="flex gap-4">
              {FORM_TYPE_OPTIONS.map((ft) => (
                <label key={ft.value} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={config.form_types.includes(ft.value)}
                    onChange={() => toggleFormType(ft.value)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  {ft.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Mapping table */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Status Mappings</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Left column is the SquadHire status. Right column is the CRM pipeline stage name sent in the webhook.
          </p>
        </div>
        <div className="divide-y divide-gray-100">
          {SQUADHIRE_STATUSES.map((s) => (
            <div
              key={s.value}
              className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50"
            >
              <div className="w-1/3 shrink-0">
                <span className="text-sm font-medium text-gray-900">{s.label}</span>
                <span className="ml-2 text-xs text-gray-400">{s.value}</span>
              </div>
              <div className="flex-1">
                <span className="mr-2 text-gray-400">&rarr;</span>
              </div>
              <div className="w-1/2">
                <input
                  type="text"
                  value={config.mappings[s.value] ?? ''}
                  onChange={(e) => updateMapping(s.value, e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0"
                  placeholder="CRM pipeline stage"
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
