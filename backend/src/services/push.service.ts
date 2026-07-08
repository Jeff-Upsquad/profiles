import { getFirebaseApp } from '../config/firebase.js';
import { supabaseAdmin } from '../config/supabase.js';

// Jobs-module push types. Reuse the existing Android `subscription_offers`
// channel (high-importance, heads-up + sound) — no app-side channel change.
export type JobPushType =
  | 'job_new_card'
  | 'job_stage'
  | 'job_interview'
  | 'job_interview_confirm'
  | 'job_interview_start'
  | 'job_offer'
  | 'job_hired';

interface PushPayload {
  type: 'new_card' | 'selected' | 'cancelled' | 'unassigned' | JobPushType;
  title: string;
  body: string;
  card_id: string;
  route: string;
  [key: string]: string;
}

// notification_log.type is CHECK-constrained to the legacy card types
// (00041); anything else would fail the insert on every push, so the log
// write below is gated to these.
const LOGGABLE_PUSH_TYPES = new Set(['new_card', 'selected', 'cancelled']);

function buildCardBody(
  template: string,
  content: Record<string, unknown>,
): string {
  const brandName = typeof content.brand_name === 'string' ? content.brand_name : null;
  return brandName ? template.replace('{brand_name}', brandName) : template.replace(' from {brand_name}', '');
}

async function sendToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  const firebase = getFirebaseApp();
  if (!firebase) return;
  if (userIds.length === 0) return;

  const { data: tokens } = await supabaseAdmin
    .from('push_tokens')
    .select('id, token, user_id')
    .in('user_id', userIds);

  if (!tokens || tokens.length === 0) return;

  const dataStrings: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload)) {
    dataStrings[k] = v === null || v === undefined ? '' : String(v);
  }

  const tokenList = tokens.map((t) => t.token);

  // FCM supports up to 500 tokens per multicast call
  const BATCH_SIZE = 500;
  for (let i = 0; i < tokenList.length; i += BATCH_SIZE) {
    const batch = tokenList.slice(i, i + BATCH_SIZE);
    const batchTokens = tokens.slice(i, i + BATCH_SIZE);

    try {
      const res = await firebase.messaging().sendEachForMulticast({
        tokens: batch,
        // Send BOTH a notification block and data. The notification block lets
        // Android render the alert itself when the app is backgrounded or
        // killed (data-only messages can't reliably wake the app on OEMs like
        // Motorola/Xiaomi). `data` is still carried for tap-routing and the
        // foreground path. channelId must match the app's channel so it lands
        // on the high-importance "Offers & Updates" channel (heads-up + sound).
        notification: { title: payload.title, body: payload.body },
        data: dataStrings,
        android: {
          priority: 'high',
          notification: {
            channelId: 'subscription_offers',
            sound: 'default',
          },
        },
      });

      const idsToDelete: string[] = [];
      res.responses.forEach((r, idx) => {
        if (!r.success && r.error) {
          const code = r.error.code;
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            idsToDelete.push(batchTokens[idx].id);
          } else {
            console.error('[push] send error', code, r.error.message);
          }
        }
      });

      if (idsToDelete.length > 0) {
        await supabaseAdmin.from('push_tokens').delete().in('id', idsToDelete);
      }
    } catch (err) {
      console.error('[push] multicast failed:', err);
    }
  }

  // Log notifications (fire-and-forget, don't block on failure)
  if (!LOGGABLE_PUSH_TYPES.has(payload.type)) return;
  const logRows = userIds.map((uid) => ({
    user_id: uid,
    type: payload.type,
    ref_card_id: payload.card_id || null,
    payload: dataStrings,
    status: 'sent' as const,
  }));
  const { error: logErr } = await supabaseAdmin.from('notification_log').insert(logRows);
  if (logErr) console.error('[push] notification_log insert failed:', logErr);
}

export async function notifyNewCard(
  cardId: string,
  talentUserIds: string[],
  content: Record<string, unknown>,
): Promise<void> {
  await sendToUsers(talentUserIds, {
    type: 'new_card',
    title: 'New Opportunity Available',
    body: buildCardBody('A new opportunity from {brand_name} is waiting for your response', content),
    card_id: cardId,
    route: '/pending',
  });
}

export async function notifySelected(
  cardId: string,
  talentUserId: string,
  content: Record<string, unknown>,
): Promise<void> {
  await sendToUsers([talentUserId], {
    type: 'selected',
    title: "You've Been Selected!",
    body: buildCardBody("Congratulations! You were selected for {brand_name}'s opportunity", content),
    card_id: cardId,
    route: '/responded',
  });
}

export async function notifyUnassigned(
  cardId: string,
  talentUserId: string,
  content: Record<string, unknown>,
): Promise<void> {
  await sendToUsers([talentUserId], {
    type: 'unassigned',
    title: 'Assignment Update',
    body: buildCardBody("Your assignment for {brand_name}'s opportunity has been updated by the team", content),
    card_id: cardId,
    route: '/responded',
  });
}

/**
 * Generic jobs-module push. The notification matrix has too many distinct
 * events for one function each — callers pass the type + copy and this keeps
 * the FCM plumbing (channel, token cleanup, batching) in one place.
 */
export async function notifyJobEvent(
  talentUserIds: string[],
  input: {
    type: JobPushType;
    title: string;
    body: string;
    cardId: string;
    route?: string;
  },
): Promise<void> {
  await sendToUsers(talentUserIds, {
    type: input.type,
    title: input.title,
    body: input.body,
    card_id: input.cardId,
    route: input.route ?? '/jobs',
  });
}
