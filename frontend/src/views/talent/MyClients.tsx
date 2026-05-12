'use client';

import { useMemo, useState } from 'react';
import { useMyClients, type MyClientRow } from '@/hooks/useMyClients';
import { whatsappDeepLink } from '@/lib/whatsapp';

function formatCurrency(amount: number, currency: string): string {
  const symbol = currency === 'INR' ? '₹' : currency ? `${currency} ` : '';
  return `${symbol}${amount.toLocaleString()}/mo`;
}

function formatHours(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  // Trim trailing zeros from decimals like 2.50 → 2.5.
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

function clientTitle(c: MyClientRow): string {
  const left = c.brand_name || 'Untitled client';
  const right = c.plan_name || c.subscription_name;
  return right ? `${left} · ${right}` : left;
}

function clientSubtitle(c: MyClientRow): string | null {
  const parts: string[] = [];
  if (c.price_label) parts.push(c.price_label);
  else if (typeof c.monthly_price === 'number') parts.push(formatCurrency(c.monthly_price, c.currency || 'INR'));
  if (c.hours_label) parts.push(c.hours_label);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export default function MyClients() {
  const { data, isLoading, error } = useMyClients();
  const [quitOpen, setQuitOpen] = useState(false);

  // Assigned listed before Selected so the Quit dialog's default-selected
  // first option is an active client (the more common case).
  const allClients = useMemo(() => {
    if (!data) return [] as MyClientRow[];
    return [...data.assigned, ...data.selected];
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-2xl bg-[#f0f0f0]" />
        <div className="h-40 animate-pulse rounded-2xl bg-[#f0f0f0]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-[#E8E5DE] bg-white p-10 text-center">
        <p className="text-sm font-medium text-[#0a0a0a]">Couldn&rsquo;t load your clients.</p>
      </div>
    );
  }

  const { selected, assigned, earnings, commitment } = data;
  const hasAnyClients = selected.length > 0 || assigned.length > 0;

  return (
    <div className="space-y-5">
      {/* Earnings + commitment summary */}
      <section className="rounded-2xl border border-[#E8E5DE] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">
                Monthly earnings
              </p>
              <p className="mt-0.5 text-2xl font-semibold text-[#0a0a0a]">
                {formatCurrency(earnings.monthly_total, earnings.currency)}
              </p>
              <p className="mt-0.5 text-[11px] text-[#737373]">
                Across {assigned.length} active client{assigned.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <Stat label="Per day" value={`${formatHours(commitment.hours_per_day)} hrs`} />
              <Stat label="Per week" value={`${formatHours(commitment.hours_per_week)} hrs`} />
              <Stat label="Per month" value={`${formatHours(commitment.hours_per_month)} hrs`} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setQuitOpen(true)}
            disabled={!hasAnyClients}
            className="rounded-lg border border-[#E8E5DE] px-4 py-2 text-sm font-semibold text-[#525252] transition-colors hover:bg-[#F7F6F3] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Quit a client
          </button>
        </div>
      </section>

      {/* Assigned (shown first — these are the active, earning clients) */}
      <ClientSection
        title="Assigned"
        subtitle="Active clients counting toward your monthly earnings."
        pillVariant="green"
        pillLabel="Active"
        rows={assigned}
        emptyMessage="No active clients yet."
      />

      {/* Selected (waiting admin approval) */}
      <ClientSection
        title="Selected"
        subtitle="Waiting admin approval — not yet contributing to earnings."
        pillVariant="amber"
        pillLabel="Waiting admin approval"
        rows={selected}
        emptyMessage="No pending selections."
      />

      {quitOpen && (
        <QuitDialog
          clients={allClients}
          onClose={() => setQuitOpen(false)}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-[#a3a3a3]">{label}</p>
      <p className="text-sm font-semibold text-[#0a0a0a]">{value}</p>
    </div>
  );
}

function ClientSection({
  title,
  subtitle,
  pillVariant,
  pillLabel,
  rows,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  pillVariant: 'amber' | 'green';
  pillLabel: string;
  rows: MyClientRow[];
  emptyMessage: string;
}) {
  const pillClass = pillVariant === 'amber'
    ? 'bg-amber-50 text-amber-700'
    : 'bg-emerald-50 text-emerald-700';

  return (
    <section className="rounded-2xl border border-[#E8E5DE] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between border-b border-[#E8E5DE] px-5 py-4 sm:px-6">
        <div>
          <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-[#737373]">{subtitle}</p>
        </div>
        <span className="rounded-full bg-[#f0f0f0] px-2 py-0.5 text-[10px] font-semibold text-[#737373]">
          {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-[#737373]">{emptyMessage}</p>
        </div>
      ) : (
        <ul className="divide-y divide-[#E8E5DE]">
          {rows.map((r) => (
            <li key={r.recipient_id} className="px-5 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-[family-name:var(--font-jakarta)] text-[14px] font-semibold text-[#0a0a0a]">
                    {clientTitle(r)}
                  </p>
                  {clientSubtitle(r) && (
                    <p className="mt-0.5 truncate text-xs text-[#737373]">
                      {clientSubtitle(r)}
                    </p>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${pillClass}`}>
                  {pillLabel}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function QuitDialog({
  clients,
  onClose,
}: {
  clients: MyClientRow[];
  onClose: () => void;
}) {
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>(
    clients[0]?.recipient_id ?? '',
  );

  const selectedClient = clients.find((c) => c.recipient_id === selectedRecipientId) ?? null;

  function openWhatsApp() {
    if (!selectedClient) return;
    const message = `Hi SquadHire team, I'd like to discuss leaving the assignment for ${clientTitle(selectedClient)}.

Reason: `;
    window.open(whatsappDeepLink(message), '_blank', 'noopener,noreferrer');
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-4 w-full max-w-md rounded-2xl border border-[#E8E5DE] bg-white p-6 shadow-2xl">
        <h3 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">
          Quit a client
        </h3>
        <p className="mt-2 text-sm text-[#525252]">
          Pick a client you&rsquo;d like to leave. We&rsquo;ll open WhatsApp with a draft message
          to the SquadHire support team — you can edit the reason before sending.
        </p>

        <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
          {clients.map((c) => (
            <label
              key={c.recipient_id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                selectedRecipientId === c.recipient_id
                  ? 'border-[#0a0a0a] bg-[#F7F6F3]'
                  : 'border-[#E8E5DE] hover:bg-[#F7F6F3]'
              }`}
            >
              <input
                type="radio"
                name="quit-client"
                value={c.recipient_id}
                checked={selectedRecipientId === c.recipient_id}
                onChange={() => setSelectedRecipientId(c.recipient_id)}
                className="h-4 w-4 accent-[#0a0a0a]"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#0a0a0a]">{clientTitle(c)}</p>
                {clientSubtitle(c) && (
                  <p className="mt-0.5 truncate text-xs text-[#737373]">{clientSubtitle(c)}</p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  c.subscription_activated_at
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                {c.subscription_activated_at ? 'Active' : 'Waiting'}
              </span>
            </label>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#E8E5DE] px-4 py-2 text-sm font-semibold text-[#525252] transition-colors hover:bg-[#F7F6F3]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedClient}
            onClick={openWhatsApp}
            className="rounded-lg bg-[#0a0a0a] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Open WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
