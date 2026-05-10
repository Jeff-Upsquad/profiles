'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';

interface AutomationConfig {
  auto_shortlist_on_approve: boolean;
  auto_onboarding_on_signup: boolean;
  auto_invite_on_shortlist: boolean;
}

interface TemplateConfig {
  enabled: boolean;
  channel: string;
  template_name: string;
  template_body: string;
  crm_webhook_url: string;
  pipeline_stage?: string;
}

type TemplatesMap = Record<string, TemplateConfig>;

interface AutomationEvent {
  id: string;
  event_type: string;
  lead_id: string | null;
  talent_user_id: string | null;
  triggered_by: string;
  metadata: Record<string, unknown>;
  created_at: string;
  lead?: { name: string } | null;
}

const TOGGLE_ITEMS: { key: keyof AutomationConfig; label: string; description: string }[] = [
  {
    key: 'auto_shortlist_on_approve',
    label: 'Auto-shortlist on auto-approval',
    description: 'When a candidate is auto-approved via form rules, automatically move their status to "Shortlisted."',
  },
  {
    key: 'auto_onboarding_on_signup',
    label: 'Auto-set onboarding on signup',
    description: 'When a candidate signs up (auto-approved or manual), move linked leads to "Onboarding."',
  },
  {
    key: 'auto_invite_on_shortlist',
    label: 'Auto-invite on shortlist',
    description: 'When a candidate is shortlisted, automatically create a talent invitation if one doesn\'t exist.',
  },
];

const TEMPLATE_EVENTS: { key: string; label: string; description?: string }[] = [
  {
    key: 'lead_received',
    label: 'Lead Received',
    description: 'Fires for every new candidate form submission (all form types). Pushes the candidate\'s name, email, phone, and form type to the CRM and sets the initial pipeline stage.',
  },
  {
    key: 'shortlisted',
    label: 'Shortlisted',
    description: 'Fires when a candidate is shortlisted (auto-approved or manually). Updates the CRM pipeline stage.',
  },
  {
    key: 'signed_up',
    label: 'Signed Up',
    description: 'Fires when a candidate signs up to create their talent profile. Updates the CRM pipeline stage.',
  },
];

const EVENT_TYPE_LABELS: Record<string, string> = {
  lead_auto_shortlisted: 'Auto-shortlisted',
  lead_signup_onboarding: 'Signup → Onboarding',
  shortlist_invite_sent: 'Invitation created',
  crm_message_sent: 'CRM message sent',
  crm_message_failed: 'CRM message failed',
  crm_message_queued: 'CRM message queued',
  leads_crm_backfill: 'CRM backfill',
  creative_crm_backfill: 'CRM backfill (legacy)',
};

const DEFAULT_CONFIG: AutomationConfig = {
  auto_shortlist_on_approve: true,
  auto_onboarding_on_signup: true,
  auto_invite_on_shortlist: true,
};

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        checked ? 'bg-indigo-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export default function SystemAutomation() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<{
    config: AutomationConfig;
    templates: TemplatesMap;
  }>({
    queryKey: ['automationSettings'],
    queryFn: async () => {
      const { data } = await api.get('/admin/settings/automation');
      return data;
    },
  });

  const config = settings?.config ?? DEFAULT_CONFIG;
  const templates = settings?.templates ?? {};

  const configMutation = useMutation({
    mutationFn: async (patch: Partial<AutomationConfig>) => {
      const { data } = await api.patch('/admin/settings/automation', patch);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automationSettings'] });
      toast.success('Automation setting updated');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update'),
  });

  const toggleConfig = (key: keyof AutomationConfig) => {
    if (configMutation.isPending) return;
    configMutation.mutate({ [key]: !config[key] });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Automation</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure automated actions for candidate lifecycle events.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Automation Rules</h2>
            <div className="space-y-3">
              {TOGGLE_ITEMS.map((item) => (
                <Card key={item.key}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">{item.label}</h3>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            config[item.key]
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {config[item.key] ? 'On' : 'Off'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">{item.description}</p>
                    </div>
                    <Toggle
                      checked={config[item.key]}
                      onChange={() => toggleConfig(item.key)}
                      disabled={configMutation.isPending}
                    />
                  </div>
                </Card>
              ))}
            </div>
          </section>

          <TemplateSection templates={templates} />
          <CrmBackfillSection />
          <EventLog />
        </>
      )}
    </div>
  );
}

function TemplateSection({ templates }: { templates: TemplatesMap }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">CRM Events & Templates</h2>
      <p className="text-sm text-gray-500">
        Configure CRM pipeline updates and template messages per automation event.
        Use {'{{name}}'}, {'{{first_name}}'}, {'{{tier}}'}, {'{{signup_url}}'} as placeholders.
      </p>
      <div className="space-y-4">
        {TEMPLATE_EVENTS.map((evt) => (
          <TemplateCard
            key={evt.key}
            eventKey={evt.key}
            label={evt.label}
            description={evt.description}
            initial={templates[evt.key]}
          />
        ))}
      </div>
    </section>
  );
}

function CrmBackfillSection() {
  const [result, setResult] = useState<{
    total: number;
    sent: number;
    skipped: number;
    failed: number;
  } | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/admin/automation/sync-leads-crm');
      return data as { total: number; sent: number; skipped: number; failed: number };
    },
    onSuccess: (res) => {
      setResult(res);
      toast.success(`CRM sync done — ${res.sent} sent, ${res.skipped} skipped, ${res.failed} failed`);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Sync failed'),
  });

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">CRM Backfill</h2>
      <Card>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Sync existing leads</h3>
            <p className="mt-1 text-sm text-gray-500">
              Push every existing candidate (all form types) to the CRM with the most advanced
              applicable stage: leads with a linked signed-up talent use the &ldquo;Signed
              Up&rdquo; stage; <strong>Shortlisted</strong>/Onboarding/Completed use
              &ldquo;Shortlisted&rdquo;; everything else uses &ldquo;Lead Received&rdquo;. Archived
              leads are skipped.
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Each event must be enabled with a webhook URL configured. Leads where the
              corresponding event is disabled will be skipped.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (confirm('Push all existing leads to the CRM?')) {
                  mutation.mutate();
                }
              }}
              disabled={mutation.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Syncing...' : 'Sync Now'}
            </button>
            {result && (
              <span className="text-xs text-gray-500">
                Last run: {result.total} total · {result.sent} sent · {result.skipped} skipped ·{' '}
                {result.failed} failed
              </span>
            )}
          </div>
        </div>
      </Card>
    </section>
  );
}

function TemplateCard({
  eventKey,
  label,
  description,
  initial,
}: {
  eventKey: string;
  label: string;
  description?: string;
  initial?: TemplateConfig;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TemplateConfig>({
    enabled: initial?.enabled ?? false,
    channel: initial?.channel ?? 'whatsapp',
    template_name: initial?.template_name ?? '',
    template_body: initial?.template_body ?? '',
    crm_webhook_url: initial?.crm_webhook_url ?? '',
    pipeline_stage: initial?.pipeline_stage ?? '',
  });

  const mutation = useMutation({
    mutationFn: async (tpl: TemplateConfig) => {
      const { data } = await api.patch('/admin/settings/automation/templates', {
        [eventKey]: tpl,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automationSettings'] });
      toast.success(`Template for "${label}" saved`);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to save template'),
  });

  const update = (patch: Partial<TemplateConfig>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">On {label}</h3>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  form.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {form.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            {description && <p className="mt-1 text-xs text-gray-500">{description}</p>}
          </div>
          <Toggle
            checked={form.enabled}
            onChange={() => {
              // Persist immediately. The Save button below is only rendered
              // when enabled, so a pure-local toggle leaves the disabled state
              // unsaveable — it disappears on refresh.
              const next = { ...form, enabled: !form.enabled };
              setForm(next);
              mutation.mutate(next);
            }}
          />
        </div>

        {form.enabled && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">CRM Pipeline Stage</label>
              <input
                type="text"
                value={form.pipeline_stage ?? ''}
                onChange={(e) => update({ pipeline_stage: e.target.value })}
                placeholder="e.g. Form Filled / For Review"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Stage name to set in the CRM. Sent to the webhook as <code>pipeline_stage</code>.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Channel</label>
              <select
                value={form.channel}
                onChange={(e) => update({ channel: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="crm_pipeline">CRM Pipeline (CRM handles messaging)</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
                <option value="other">Other</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {form.channel === 'crm_pipeline'
                  ? 'SquadHire only updates the pipeline stage; your CRM sends the message.'
                  : 'SquadHire sends the template message via this channel through the webhook.'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">CRM Webhook URL</label>
              <input
                type="url"
                value={form.crm_webhook_url}
                onChange={(e) => update({ crm_webhook_url: e.target.value })}
                placeholder="https://your-crm.com/webhook/automation"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {form.channel !== 'crm_pipeline' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Template Name</label>
                  <input
                    type="text"
                    value={form.template_name}
                    onChange={(e) => update({ template_name: e.target.value })}
                    placeholder="e.g. shortlist_welcome"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Template Body</label>
                  <textarea
                    value={form.template_body}
                    onChange={(e) => update({ template_body: e.target.value })}
                    rows={4}
                    placeholder={'Hi {{first_name}},\n\nCongrats! You\'ve been shortlisted with UpSquad Partner Program...'}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => mutation.mutate(form)}
                disabled={mutation.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {mutation.isPending ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function EventLog() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{
    events: AutomationEvent[];
    total: number;
    total_pages: number;
  }>({
    queryKey: ['automationEvents', page],
    queryFn: async () => {
      const { data } = await api.get('/admin/automation/events', { params: { page, limit: 15 } });
      return data;
    },
  });

  const events = data?.events ?? [];
  const totalPages = data?.total_pages ?? 1;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">Event Log</h2>
      <p className="text-sm text-gray-500">Recent automated actions performed by the system.</p>

      <Card padding={false}>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        ) : events.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">No automation events yet.</div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Event</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Candidate</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Triggered By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                      {new Date(evt.created_at).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          evt.event_type.includes('failed')
                            ? 'bg-red-100 text-red-700'
                            : evt.event_type.includes('queued')
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {EVENT_TYPE_LABELS[evt.event_type] ?? evt.event_type}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {evt.lead?.name ?? '-'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                      {evt.triggered_by === 'system' ? 'System' : 'Admin'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </Card>
    </section>
  );
}
