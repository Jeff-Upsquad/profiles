import { supabaseAdmin } from '../config/supabase.js';
import { deliverCrmSystemEvent } from '../lib/crm-system-event.js';
import { normalizePhoneDigits } from '../lib/phone.js';

const MAX_ATTEMPTS = 10;

async function crmAlreadySentLiveNotice(phone: string, since: string): Promise<boolean> {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return false;
  const { data: leads, error } = await supabaseAdmin.from('crm_leads')
    .select('id').in('phone_e164', [digits, `+${digits}`]);
  if (error) throw new Error(error.message);
  if (!leads?.length) return false;
  const { data: messages, error: messageError } = await supabaseAdmin.from('crm_messages')
    .select('id').in('lead_id', leads.map((lead) => lead.id))
    .eq('direction', 'outbound').eq('template_name', 'profile_live_notice')
    .in('status', ['sent', 'delivered', 'read']).gte('created_at', since).limit(1);
  if (messageError) throw new Error(messageError.message);
  return !!messages?.length;
}

// The database creates the inbox notification and queue entry atomically on a
// real Partner Live transition. This worker retries WhatsApp independently.
export async function deliverCreatorLiveNotices(): Promise<void> {
  const now = new Date().toISOString();
  const { data: rows, error } = await supabaseAdmin.from('creator_live_notice_outbox')
    .select('id, talent_user_id, attempts, created_at').is('delivered_at', null)
    .lt('attempts', MAX_ATTEMPTS).lte('next_attempt_at', now).order('created_at').limit(25);
  if (error) throw new Error(error.message);
  for (const row of rows ?? []) {
    const attempts = row.attempts + 1;
    // Compare-and-swap plus a lease prevents concurrent processes from sending
    // the same item. A crashed worker can be retried after the lease expires.
    const { data: claimed, error: claimError } = await supabaseAdmin.from('creator_live_notice_outbox')
      .update({ attempts, next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString() })
      .eq('id', row.id).eq('attempts', row.attempts).is('delivered_at', null)
      .lte('next_attempt_at', now).select('id').maybeSingle();
    if (claimError) throw new Error(claimError.message);
    if (!claimed) continue;
    let delivered = false;
    let failure: string | null = null;
    try {
      const { data: talent, error: talentError } = await supabaseAdmin.from('talent_users')
        .select('full_name, phone').eq('id', row.talent_user_id).single();
      if (talentError) throw new Error(talentError.message);
      // A CRM stage automation may already have sent the same template. The
      // queue waits 30s for it; a confirmed send since this transition suffices.
      delivered = !!talent.phone && (await crmAlreadySentLiveNotice(talent.phone, row.created_at)
        || await deliverCrmSystemEvent({
        audience: 'talent', event: 'talent_creator_profile_live', name: talent.full_name,
        phone: talent.phone, data: {}, bodyParams: [],
      }));
      if (!delivered) failure = talent.phone ? 'crm_not_delivered' : 'phone_missing';
    } catch (err) {
      failure = err instanceof Error ? err.message : String(err);
    }
    const { error: updateError } = await supabaseAdmin.from('creator_live_notice_outbox')
      .update({ delivered_at: delivered ? new Date().toISOString() : null, last_error: failure })
      .eq('id', row.id).eq('attempts', attempts);
    if (updateError) throw new Error(updateError.message);
    if (!delivered) console.warn('[creator-live-notice] WhatsApp pending', row.id, failure);
  }
}

export function startCreatorLiveNoticeSweeper(): NodeJS.Timeout {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await deliverCreatorLiveNotices(); }
    catch (err) { console.error('[creator-live-notice] sweep failed', err); }
    finally { running = false; }
  };
  const timer = setInterval(tick, 30_000);
  setTimeout(tick, 5_000);
  return timer;
}
