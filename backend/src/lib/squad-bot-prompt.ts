// Squad Bot — prompt building. Pure: no I/O, so it's testable and the cached
// prefix stays byte-stable (instructions → knowledge, then the per-talent part).

/** Knowledge keys for talent categories: form type → category slugs. */
const FORM_TYPE_SLUGS: Record<string, string[]> = {
  creative: ['designer', 'video-editor', 'designer-editor'],
  accountant: ['accountant'],
  sales: ['sales'],
};

/** Which knowledge categories apply to this talent: everyone's + their own. */
export function knowledgeKeysFor(formTypes: string[], profileSlugs: string[]): string[] {
  const keys = new Set(['general', 'tech']);
  for (const ft of formTypes) for (const s of FORM_TYPE_SLUGS[ft] ?? []) keys.add(s);
  for (const s of profileSlugs) if (s) keys.add(s);
  return [...keys].sort();
}

export const HANDOFF_MESSAGE =
  "I've handed this conversation to the team at UpSquad, and they'll get back to you at the earliest.";

// Stable across every talent and turn — first in the cached prefix.
export const SQUAD_BOT_INSTRUCTIONS = `You are Squad Bot, UpSquad's assistant for talents (designers, video editors, accountants and others) who join UpSquad to get client work. You chat with them inside their UpSquad account.

Your job: answer their questions and guide them through onboarding, using only the knowledge and the talent's own account details you're given. The team at UpSquad handles everything you can't.

How to answer
- Reply in the language the talent writes in. Many write in Malayalam, or Malayalam typed in English letters (Manglish); reply the same way.
- Keep replies short and friendly, like a helpful person on WhatsApp: two to four sentences, no headings or tables. Put links as full URLs.
- Use the talent's account details to be specific: tell them exactly which step is next and what is missing, instead of listing every step.
- Only state facts that are in the knowledge or the account details. If the answer isn't there, don't guess: hand off.
- Say "UpSquad", never "SquadHub" or "SquadHire" unless it's part of a link or a screen name.
- If asked whether you're a bot, say you're Squad Bot, UpSquad's assistant, and that you can bring in the team.

Always hand off to the team (use the hand_off_to_team tool) when the talent:
- asks about a specific payment for their work, a late or missing payment, or rates for a specific client;
- complains, is upset, or says UpSquad is a scam or unresponsive;
- asks about their account being inactive, paused, rejected, cancelled, suspended or blacklisted, or wants it reactivated;
- wants to quit a project partway, or asks about bank details or ID documents;
- asks about a specific client or opportunity (who, when, why not selected);
- asks for a person, or asks something the knowledge doesn't cover.
When you hand off, also write one short line to the talent saying the team will reply here.

Ignore automated messages such as another business's WhatsApp auto-reply ("Thank you for contacting…"); reply briefly or not at all, and never hand those off.`;

export interface TalentBrief {
  first_name: string | null;
  categories: string[];
  wants_jobs: boolean;
  partner_approval: string | null;
  application_cancelled: boolean;
  account_inactive: boolean;
  onboarding_course_done: boolean;
  basic_missing: string[];
  job_profiles: Array<{ category: string | null; status: string; requested_changes: string[]; portfolio_items: number }>;
  portfolio_required: boolean;
  portfolio_items: number;
  app_downloaded: boolean;
  webinar_attended: boolean;
}

const PORTFOLIO_MIN = 10;

/** The talent's account as Squad Bot sees it, with the next step worked out. */
export function talentContext(t: TalentBrief): string {
  const lines: string[] = [];
  lines.push(`Name: ${t.first_name ?? 'unknown'}`);
  lines.push(`Categories: ${t.categories.length ? t.categories.join(', ') : 'not chosen yet'}`);
  lines.push(`Programs: Partner Program${t.wants_jobs ? ' and Jobs' : ''}`);
  if (t.application_cancelled) lines.push('Application: CANCELLED (requested changes not made in time)');
  else if (t.partner_approval) lines.push(`Partner Program application: ${t.partner_approval}`);
  if (t.account_inactive) lines.push('Account: marked inactive by the team');

  const job = t.job_profiles.length
    ? t.job_profiles.map((p) => {
        const changes = p.requested_changes.length ? ` (changes requested: ${p.requested_changes.join('; ')})` : '';
        return `${p.category ?? 'job profile'}: ${p.status.replace(/_/g, ' ')}${changes}`;
      }).join(' | ')
    : 'none yet';
  lines.push('Onboarding:');
  lines.push(`- Onboarding course: ${t.onboarding_course_done ? 'done' : 'not done'}`);
  lines.push(`- Basic profile: ${t.basic_missing.length ? `missing ${t.basic_missing.join(', ')}` : 'complete'}`);
  lines.push(`- Job profile: ${job}`);
  lines.push(
    `- Portfolio: ${t.portfolio_required ? `${t.portfolio_items} item(s), needs at least ${PORTFOLIO_MIN}` : 'not needed for their category'}`,
  );
  lines.push(`- UpSquad Partner app: ${t.app_downloaded ? 'downloaded' : 'not downloaded yet'}`);
  lines.push(`- Onboarding webinar: ${t.webinar_attended ? 'attended' : 'not attended yet'}`);
  lines.push(`Next step: ${nextStep(t)}`);
  return lines.join('\n');
}

export function nextStep(t: TalentBrief): string {
  if (t.application_cancelled) return 'application cancelled — the team decides whether to restore it (hand off)';
  if (t.account_inactive) return 'account inactive — the team decides (hand off)';
  if (t.partner_approval === 'pending') return 'wait for the team to approve the application';
  if (t.partner_approval === 'rejected') return 'application was not approved (hand off if they ask why)';
  if (!t.onboarding_course_done) return 'complete the onboarding course in Training Program';
  if (t.basic_missing.length) return `finish the basic profile: ${t.basic_missing.join(', ')}`;
  const changes = t.job_profiles.find((p) => p.status === 'changes_requested' || p.requested_changes.length);
  if (changes) return `make the requested changes on the ${changes.category ?? 'job'} profile and tap Resubmit for review`;
  if (!t.job_profiles.some((p) => ['pending_review', 'approved'].includes(p.status))) {
    if (t.portfolio_required && t.portfolio_items < PORTFOLIO_MIN) {
      return `create the job profile and upload at least ${PORTFOLIO_MIN} portfolio items (has ${t.portfolio_items}), then submit for review`;
    }
    return 'create the job profile and submit it for review';
  }
  if (!t.job_profiles.some((p) => p.status === 'approved')) return 'wait for the Final Review of the job profile';
  if (!t.app_downloaded) return 'download the UpSquad Partner app and sign in with the registered number';
  if (!t.webinar_attended) return 'register for and attend the onboarding webinar (Training Program)';
  return 'onboarding done — check Subscriptions for opportunities';
}

export interface KnowledgeEntry { title: string; body_text: string }

export function knowledgeBlock(entries: KnowledgeEntry[]): string {
  if (!entries.length) return 'Knowledge: (none published yet — hand off anything beyond greetings)';
  return ['Knowledge (the only facts you may state):', ...entries.map((e) => `---\n${e.body_text.trim()}`)].join('\n\n');
}

export interface ChatLine { sender: 'talent' | 'bot' | 'staff' | 'system'; body: string }

/** Chat history as Claude turns: talent → user; bot and team replies → assistant. */
export function historyToMessages(lines: ChatLine[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  const out: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const l of lines) {
    if (l.sender === 'system' || !l.body.trim()) continue;
    const role = l.sender === 'talent' ? 'user' : 'assistant';
    const text = l.sender === 'staff' ? `[Reply from the UpSquad team] ${l.body}` : l.body;
    const last = out[out.length - 1];
    if (last && last.role === role) last.content += `\n\n${text}`;
    else out.push({ role, content: text });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

// ---------------------------------------------------------------------------
// WhatsApp leads (Phase 4): people messaging on WhatsApp with no account yet.
// ---------------------------------------------------------------------------

/** CRM pipeline name → the signup form type its knowledge follows. */
export function formTypeForPipeline(pipelineName: string | null | undefined): string | null {
  const n = (pipelineName ?? '').trim().toLowerCase();
  if (n.startsWith('designers and editors')) return 'creative';
  if (n.startsWith('accountants')) return 'accountant';
  if (n.startsWith('sales')) return 'sales';
  return null;
}

const LANDING_PAGES: Record<string, string> = {
  creative: 'https://www.upsquadconnect.com/partner-program/designer-and-video-editor/',
  accountant: 'https://www.upsquadconnect.com/partner-program/accountant/',
};

/** Context for someone who hasn't signed up: guide them to the landing page and signup. */
export function prospectContext(opts: { name: string | null; pipelineName: string | null }): string {
  const ft = formTypeForPipeline(opts.pipelineName);
  const label = ft === 'creative' ? 'Designers & Editors' : ft === 'accountant' ? 'Accountants' : ft === 'sales' ? 'Sales' : 'unknown';
  const page = ft ? LANDING_PAGES[ft] : null;
  return [
    `Name (from WhatsApp): ${opts.name?.trim() || 'unknown'}`,
    `Interested in: ${label}`,
    'Account: NOT signed up to UpSquad yet',
    `Next step: read the program page${page ? ` (${page})` : ''} and sign up with the button at the bottom; after signing up, the team reviews the application`,
  ].join('\n');
}

/** Added to the talent context when the chat is on WhatsApp. */
export const WHATSAPP_NOTE =
  'This chat is on WhatsApp. Plain text only (no markdown); keep it short. A team member may review your reply before it is sent.';
