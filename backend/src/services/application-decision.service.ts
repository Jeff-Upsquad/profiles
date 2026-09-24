import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { deliverCrmSystemEvent } from '../lib/crm-system-event.js';
import { notifyTalentsInApp } from './jobs.service.js';

// Tells a talent their Partner Program / Jobs application was approved or
// rejected, on every channel they might be watching:
//   - SquadHire in-app notifications (/talent/notifications)
//   - the SquadHub partner app inbox (FCM'd by SquadHub's poller)
//   - WhatsApp via a SquadHire CRM system event (talent_application_approved /
//     talent_application_rejected → whichever template the CRM maps it to)
// Best-effort throughout: a failed channel is logged, never thrown, so the
// decision itself always stands.

export type ApplicationTrack = 'partner' | 'jobs';
export type ApplicationDecision = 'approved' | 'rejected';

const PROGRAM_LABEL: Record<ApplicationTrack, string> = {
  partner: 'UpSquad Partner Program',
  jobs: 'UpSquad Jobs',
};

function copyFor(track: ApplicationTrack, decision: ApplicationDecision, reason: string | null) {
  const program = PROGRAM_LABEL[track];
  if (decision === 'approved') {
    return {
      title: `Your ${program} application is approved`,
      body: 'Welcome aboard! Continue your onboarding to get started.',
    };
  }
  return {
    title: `Update on your ${program} application`,
    body: reason
      ? `We're unable to move forward with your application right now. Reason: ${reason}`
      : "We're unable to move forward with your application right now.",
  };
}

function squadHubApiBase(): string {
  if (env.SQUADHUB_API_URL) return env.SQUADHUB_API_URL.replace(/\/$/, '');
  if (env.SQUADHUB_CALLBACK_URL) return new URL(env.SQUADHUB_CALLBACK_URL).origin;
  return '';
}

async function notifySquadHubPartner(input: {
  email: string;
  kind: string;
  title: string;
  body: string;
}): Promise<void> {
  const base = squadHubApiBase();
  const secret = env.SQUADHUB_CALLBACK_SECRET;
  if (!base || !secret) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(`${base}/integrations/squadhire/talent/notice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-SquadHub-Signature': secret },
      body: JSON.stringify({
        kind: input.kind,
        title: input.title,
        body: input.body,
        route: '/notifications',
        emails: [input.email],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[application-decision] SquadHub notice HTTP ${res.status}`, text.slice(0, 300));
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function notifyApplicationDecision(input: {
  talentUserId: string;
  track: ApplicationTrack;
  decision: ApplicationDecision;
  reason?: string | null;
}): Promise<void> {
  const reason = input.reason?.trim() || null;
  const { title, body } = copyFor(input.track, input.decision, reason);
  const kind = `application_${input.decision}`;

  const [{ data: talent }, { data: authUser }] = await Promise.all([
    supabaseAdmin.from('talent_users').select('full_name, phone').eq('id', input.talentUserId).maybeSingle(),
    supabaseAdmin.auth.admin.getUserById(input.talentUserId),
  ]);
  const email = (authUser?.user?.email ?? '').trim().toLowerCase();

  await Promise.allSettled([
    notifyTalentsInApp(
      [input.talentUserId],
      kind,
      title,
      body,
      input.decision === 'approved' ? '/talent/dashboard' : null,
    ),
    email
      ? notifySquadHubPartner({ email, kind, title, body }).catch((err) =>
          console.error('[application-decision] SquadHub notice failed', err),
        )
      : Promise.resolve(),
    talent?.phone
      ? deliverCrmSystemEvent({
          audience: 'talent',
          event: `talent_application_${input.decision}`,
          name: talent.full_name ?? null,
          phone: talent.phone,
          data: { program: PROGRAM_LABEL[input.track], reason: reason ?? '' },
        })
      : Promise.resolve(false),
  ]);
}
