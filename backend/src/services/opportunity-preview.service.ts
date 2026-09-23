import crypto from 'node:crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { resolveCardMargin } from './assignment-offers.service.js';

/**
 * Read-only "shop window" of live opportunities for talents who are NOT in the
 * Partner Program yet (never applied, pending approval, or rejected).
 *
 * Two rules shape everything below:
 *  1. Scope is the whole broadcast pool, not the viewer's matched cards — a
 *     non-partner has no recipient rows at all, so the point is to show what
 *     the programme actually carries, not a personalised feed.
 *  2. Nothing identifying leaves the server. The payload is built from an
 *     explicit whitelist (never a delete-list), so a new SquadHub content key
 *     can't leak a client name into the preview by default.
 */

// Fields that describe the WORK. Everything else — brand_name, customer_location,
// notes, requirement_note, contact details, logos, free-text title/description —
// is dropped, because any of them can carry the client's identity.
const SAFE_CONTENT_KEYS = [
  'plan_name',
  'subscription_name',
  'hours_label',
  'capacity_label',
  'working_days',
  'currency',
  'pricing_mode',
  'request_quote',
  'business_nature',
  'target_country_names',
  'target_languages',
  'additional_requirements',
  'assignment_unit',
  'assignment_quantity',
  'assignment_period',
  'duration_label',
  'deadline',
  'start_date',
] as const;

/** Structured deliverables minus their free-text description (can name the client). */
function safeDeliverables(raw: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) return [];
  const out: Array<Record<string, unknown>> = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      out.push({ label: item });
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const label = [o.label, o.name, o.title].find((v) => typeof v === 'string' && v.trim());
    const entry: Record<string, unknown> = { label: (label as string) ?? '—' };
    for (const k of ['kind', 'per_day', 'per_week', 'per_month', 'unit', 'quantity']) {
      if (o[k] !== undefined) entry[k] = o[k];
    }
    out.push(entry);
  }
  return out;
}

/**
 * A stable, non-reversible handle so two cards from the same client look like
 * two cards, without ever naming them. Derived from the card id (a UUID the
 * viewer can't resolve to anything) — not from the brand, so it leaks nothing.
 */
function maskedRef(cardId: string): string {
  return crypto.createHash('sha256').update(cardId).digest('hex').slice(0, 4).toUpperCase();
}

export interface OpportunityPreviewItem {
  id: string;
  ref: string;
  card_type: 'subscription' | 'assignment';
  published_at: string;
  expires_at: string | null;
  content: Record<string, unknown>;
}

/**
 * Every live broadcast card of one product line, redacted.
 *
 * "Live" mirrors the Pending tab's definition in listForTalent: card status
 * 'active', never hard-archived, and not past its expiry. Manually-assigned
 * (distribution='manual') cards are hand-picked for one talent and are not part
 * of the open pool, so they stay out.
 */
export async function listBroadcastPreview(
  cardType: 'subscription' | 'assignment',
  limit = 60,
): Promise<OpportunityPreviewItem[]> {
  const { data, error } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, content, status, published_at, expires_at, archived_at, card_type, distribution')
    .eq('card_type', cardType)
    .eq('status', 'active')
    .eq('distribution', 'broadcast')
    .is('archived_at', null)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) throw new AppError(500, error.message);

  const now = Date.now();
  return (data ?? [])
    .filter((c: any) => !c.expires_at || new Date(c.expires_at).getTime() > now)
    .map((c: any) => {
      const raw = (c.content ?? {}) as Record<string, unknown>;
      const content: Record<string, unknown> = { redacted: true, card_type: cardType };

      for (const key of SAFE_CONTENT_KEYS) {
        if (raw[key] !== undefined && raw[key] !== null) content[key] = raw[key];
      }

      const deliverables = safeDeliverables(raw.custom_deliverables);
      if (deliverables.length > 0) content.custom_deliverables = deliverables;

      // Show the partner's take-home, computed the same way listForTalent does,
      // never the business-facing figure. price_label is dropped on purpose: it
      // is a pre-formatted *business* price string.
      const businessPrice =
        typeof raw.customer_monthly_price === 'number'
          ? raw.customer_monthly_price
          : typeof raw.proposed_price === 'number'
            ? raw.proposed_price
            : typeof raw.monthly_price === 'number'
              ? raw.monthly_price
              : null;
      if (businessPrice != null && businessPrice > 0) {
        const margin = resolveCardMargin(raw, businessPrice);
        content.monthly_price = Math.max(0, Math.round(businessPrice - margin));
      }

      return {
        id: c.id as string,
        ref: maskedRef(c.id as string),
        card_type: cardType,
        published_at: c.published_at as string,
        expires_at: (c.expires_at as string | null) ?? null,
        content,
      };
    });
}
