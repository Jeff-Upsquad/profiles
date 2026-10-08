import assert from 'node:assert/strict';
import test from 'node:test';
import { guidanceText, inboxMessages } from './squad-bots-inbox.js';

test('mirrors talent, bot and team lines and keeps internal lines private', () => {
  const at = '2026-10-08T10:00:00Z';
  const messages = inboxMessages([
    { id: 'a', sender: 'talent', body: 'Hi', created_at: at },
    { id: 'b', sender: 'bot', body: 'Hello!', created_at: at },
    { id: 'c', sender: 'instruction', body: 'Check their portfolio', created_at: at },
    { id: 'd', sender: 'system', body: 'Handed to the team', created_at: at },
    { id: 'e', sender: 'staff', body: 'Jeff here', staff_name: 'Jeff', created_at: at },
    { id: 'f', sender: 'talent', body: '   ', created_at: at },
  ]);
  assert.deepEqual(messages.map((m) => [m.external_id, m.role]), [['a', 'user'], ['b', 'assistant'], ['e', 'human']]);
  assert.equal(messages[2].sender_name, 'Jeff');
  assert.equal(messages[0].created_at, '2026-10-08T10:00:00.000Z');
});

test('turns answers and instructions into guidance, ignoring unanswered questions and bot notes', () => {
  const text = guidanceText([
    { role: 'bot', content: 'Offer a call?', asks: true, answer: 'Yes, Thursday' },
    { role: 'bot', content: 'Still open?', asks: true, answer: null },
    { role: 'bot', content: 'Noted.', asks: false, answer: null },
    { role: 'team', content: 'Keep it short', asks: false, answer: null },
  ]);
  assert.match(text, /Team answered: Yes, Thursday/);
  assert.match(text, /- Team: Keep it short/);
  assert.doesNotMatch(text, /Still open/);
  assert.equal(guidanceText([]), '');
});

test('bot replies carry the Squadbot who wrote them', async () => {
  const { inboxMessages } = await import('./squad-bots-inbox.js');
  const [reply] = inboxMessages([{ id: 'm1', sender: 'bot', body: 'Hi', meta: { squadbot_name: 'Tina', usage: {} }, created_at: '2026-10-09T07:00:00Z' }]);
  assert.equal(reply.sender_name, 'Tina');
});
