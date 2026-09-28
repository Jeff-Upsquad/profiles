import test from 'node:test';
import assert from 'node:assert/strict';
import { handoffEventId, handoffSourceUrl, supportJobId, supportSourceUrl } from './squad-bot-channel.js';
import type { HubBotConfig } from './squadhub-bot.js';

test('a handoff retries with the same event and a later handoff gets a new one', () => {
  const id = '31648ec9-a74d-4a45-9316-0be5e8f49cec';
  const first = handoffEventId(id, '2026-09-28T00:00:00+00:00');
  assert.equal(first, handoffEventId(id, '2026-09-28T00:00:00.000Z'));
  assert.notEqual(first, handoffEventId(id, '2026-09-28T00:01:00Z'));
});

test('take over links to the exact SquadHire admin conversation', () => {
  assert.equal(
    handoffSourceUrl('https://squadhire.upsquadconnect.com/', 'a-b'),
    'https://squadhire.upsquadconnect.com/admin/squad-bot?chat=a-b',
  );
});

test('support doubts attach only a candidate conversation job in scope', () => {
  const config: HubBotConfig = {
    status: 'live', instructions: '', ai: { provider: null, provider_kind: null, model: null, error: null },
    jobs: [
      { id: 'action', kind: 'action', audience: 'candidates', enabled: true, person_ids: [], pipeline_id: null, stage_id: null },
      { id: 'other-person', kind: 'conversation', audience: 'candidates', enabled: true, person_ids: ['someone-else'], pipeline_id: null, stage_id: null },
      { id: 'support', kind: 'conversation', audience: 'candidates', enabled: true, person_ids: [], pipeline_id: null, stage_id: null },
    ],
  };
  assert.equal(supportJobId(config, 'talent-1'), 'support');
  assert.equal(supportJobId({ ...config, jobs: config.jobs?.slice(0, 2) }, 'talent-1'), undefined);
});

test('support handoffs link to the correct CRM channel', () => {
  assert.equal(supportSourceUrl('https://shcrm.squadhub.in', 'chat', 'app', 'lead'), 'https://shcrm.squadhub.in/app/support-chat?chat=chat');
  assert.equal(supportSourceUrl('https://shcrm.squadhub.in', 'chat', 'whatsapp', 'lead'), 'https://shcrm.squadhub.in/app/inbox?lead=lead');
});
