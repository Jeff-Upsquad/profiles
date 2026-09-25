// Squad Bot learning loop — turning a handed-off chat into a knowledge draft.
// Pure: prompt, schema and transcript formatting; the Claude call lives in
// knowledge-learning.service.

export const DRAFT_INSTRUCTIONS = `You help maintain the Knowledge Center that Squad Bot, UpSquad's assistant for talents, answers from.

You'll see a talent chat that Squad Bot handed to the UpSquad team, and how the team answered. Decide whether the team's answer teaches something every talent in these categories could be told next time, and if so draft it as one knowledge entry.

Save it only when it's a general fact or instruction: a policy, a process, where something is in the app, a rule about payments or fees. Don't save it when the answer is about this talent only (their payment, their account, a specific client or opportunity, a date for them), is small talk, or is already covered by an existing entry with the same facts.

When you save it:
- question: how talents would naturally ask it, in English, one line.
- answer: what Squad Bot should say, in English, short and friendly, using only facts the team stated. No names of team members or of this talent.
- categories: 'general' if it applies to every talent, 'tech' for app or website help, otherwise the talent category keys it applies to. Use only keys from the allowed list.`;

export function draftSchema(allowedKeys: string[]) {
  return {
    type: 'object',
    properties: {
      worth_saving: { type: 'boolean' },
      why: { type: 'string', description: 'One short sentence: why it is or is not worth saving.' },
      question: { type: 'string' },
      answer: { type: 'string' },
      categories: { type: 'array', items: { type: 'string', enum: allowedKeys } },
    },
    required: ['worth_saving', 'why', 'question', 'answer', 'categories'],
    additionalProperties: false,
  } as const;
}

export interface DraftResult {
  worth_saving: boolean;
  why: string;
  question: string;
  answer: string;
  categories: string[];
}

export interface TranscriptLine { sender: 'talent' | 'bot' | 'staff' | 'system'; body: string }

const WHO: Record<TranscriptLine['sender'], string> = {
  talent: 'Talent',
  bot: 'Squad Bot',
  staff: 'UpSquad team',
  system: 'Note',
};

export function transcript(lines: TranscriptLine[]): string {
  return lines.map((l) => `${WHO[l.sender]}: ${l.body.trim()}`).join('\n');
}

/** The user turn for the drafting call. */
export function draftRequest(opts: {
  lines: TranscriptLine[];
  categories: Array<{ key: string; label: string }>;
  existingTitles: string[];
}): string {
  return [
    'Allowed category keys:',
    ...opts.categories.map((c) => `- ${c.key} (${c.label})`),
    '',
    'Existing knowledge entries (titles):',
    ...(opts.existingTitles.length ? opts.existingTitles.map((t) => `- ${t}`) : ['(none)']),
    '',
    'The chat:',
    transcript(opts.lines),
  ].join('\n');
}

/** Sanity-check the model's draft before it reaches the approval queue. */
export function cleanDraft(d: DraftResult, allowedKeys: string[]): DraftResult | null {
  if (!d?.worth_saving) return null;
  const question = d.question?.trim() ?? '';
  const answer = d.answer?.trim() ?? '';
  const categories = [...new Set((d.categories ?? []).filter((k) => allowedKeys.includes(k)))];
  if (question.length < 3 || !answer || !categories.length) return null;
  return { ...d, question: question.slice(0, 200), answer: answer.slice(0, 8000), categories };
}
