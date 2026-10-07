// Pure helpers for the Squad Bots inbox mirror (see services/squad-bots-inbox.service.ts).

const ROLE: Record<string, 'user' | 'assistant' | 'human'> = { talent: 'user', bot: 'assistant', staff: 'human' };

export interface ChatRow {
  id: string;
  sender: string;
  body: string | null;
  staff_name?: string | null;
  created_at: string;
}

/** Chat lines as Squad Bots transcript messages, oldest first. Internal lines stay in SquadHire. */
export function inboxMessages(rows: ChatRow[]) {
  return rows
    .filter((m) => ROLE[m.sender] && m.body?.trim())
    .map((m) => ({
      external_id: m.id,
      role: ROLE[m.sender],
      content: m.body!,
      created_at: new Date(m.created_at).toISOString(),
      ...(m.sender === 'staff' && m.staff_name ? { sender_name: m.staff_name.slice(0, 120) } : {}),
    }));
}

export interface BackchannelEntry {
  role: 'bot' | 'team' | 'event';
  content: string;
  asks: boolean;
  answer: string | null;
}

/** The team's Backchannel answers and instructions as prompt text ('' when there are none). */
export function guidanceText(entries: BackchannelEntry[]): string {
  const lines = entries.flatMap((e) =>
    e.role === 'team'
      ? [`- Team: ${e.content}`]
      : e.asks && e.answer
        ? [`- You asked: ${e.content}\n  Team answered: ${e.answer}`]
        : [],
  );
  return lines.length
    ? 'Guidance from the UpSquad team for this chat (the talent cannot see this):\n' + lines.slice(-20).join('\n')
    : '';
}
