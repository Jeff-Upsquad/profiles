// Squad Hiring Bot's settings from SquadHub admin — pure rules, no I/O.
//
// SquadHub is the control room for every Squad Bot: its status there is a
// ceiling over what this app's own settings allow. It never makes the bot do
// more than SquadHire's own switches say; it can only hold it back:
//
//   SquadHub status   WhatsApp (local mode off / draft / auto)   In-app chat
//   off               off                                       straight to the team
//   practice          writes a note in the inbox, sends nothing straight to the team, note in the inbox
//   approval          draft at most (a recruiter sends)          straight to the team, note in the inbox
//   live              the local mode, unchanged                  answers as usual

export type HubStatus = 'off' | 'practice' | 'approval' | 'live';
export type LocalWhatsAppMode = 'off' | 'draft' | 'auto';
export type WhatsAppDelivery = 'off' | 'note' | 'draft' | 'auto';

export interface HubBotConfig {
  status: HubStatus;
  ai: { provider: string | null; provider_kind: 'anthropic' | 'openai_compatible' | null; model: string | null; error: string | null };
  instructions: string;
  /** Set when the settings were read for a Squadbot. */
  character?: { id: string; name: string } | null;
  jobs?: Array<{
    id: string;
    kind: 'conversation' | 'action';
    audience: 'any' | 'candidates' | 'customers';
    enabled: boolean;
    person_ids: string[];
    pipeline_id: string | null;
    stage_id: string | null;
  }>;
}

/** What to do with a WhatsApp reply, given the local mode and SquadHub's status. */
export function whatsappDelivery(local: LocalWhatsAppMode, hub: HubStatus | null): WhatsAppDelivery {
  if (local === 'off' || hub === 'off') return 'off';
  if (hub === 'practice') return 'note';
  if (hub === 'approval') return 'draft';
  return local;
}

/** In-app chat: answer as usual, or hold the reply for the team (practice / approval). */
export function appDelivery(hub: HubStatus | null): 'reply' | 'note' | 'off' {
  if (hub === 'off') return 'off';
  if (hub === 'practice' || hub === 'approval') return 'note';
  return 'reply';
}

/**
 * The Claude model to use. Squad Hiring Bot relies on Claude-only tools, so a
 * non-Claude provider chosen in SquadHub is ignored (with the local default).
 */
export function botModel(hub: HubBotConfig | null, fallback: string): string {
  if (hub?.ai.provider_kind === 'anthropic' && hub.ai.model) return hub.ai.model;
  return fallback;
}

/** Extra instructions set in SquadHub admin, as a system prompt section ('' when none). */
export function adminInstructions(hub: HubBotConfig | null): string {
  const text = hub?.instructions?.trim();
  return text ? `Extra instructions from the UpSquad admin (follow them):\n${text}` : '';
}

export interface Squadbot { id: string; name: string; active: boolean }

/** Who starts a chat: the pinned Squadbot when it's active, else the first active one. */
export function chooseSquadbot(list: Squadbot[], pinned?: string | null): Squadbot | null {
  const active = list.filter((s) => s.active);
  return (pinned ? active.find((s) => s.id === pinned) : undefined) ?? active[0] ?? null;
}

/** What a Squadbot reads for one reply, from Squad Bots. */
export interface SquadbotBriefing {
  memory: string;
  guideline: string;
  teammates: Array<{ id: string; name: string; job_role: string; covers: string[]; same_bot: boolean }>;
}

/** Teammates this app can answer for: same bot, never the speaker. */
export function transferTargets(briefing: SquadbotBriefing | null, speakerId: string | null) {
  return (briefing?.teammates ?? []).filter((t) => t.same_bot && t.id !== speakerId && t.covers.length);
}
