import assert from 'node:assert/strict';
import test from 'node:test';
import { adminInstructions, appDelivery, botModel, whatsappDelivery, type HubBotConfig } from './squadhub-bot.js';

const hub = (over: Partial<HubBotConfig> = {}): HubBotConfig => ({
  status: 'live',
  ai: { provider: 'claude', provider_kind: 'anthropic', model: 'claude-opus-5', error: null },
  instructions: '',
  ...over,
});

test('SquadHub status is a ceiling over the local WhatsApp mode', () => {
  assert.equal(whatsappDelivery('auto', null), 'auto'); // not connected: unchanged
  assert.equal(whatsappDelivery('draft', 'live'), 'draft'); // live never upgrades draft to auto
  assert.equal(whatsappDelivery('auto', 'live'), 'auto');
  assert.equal(whatsappDelivery('auto', 'approval'), 'draft');
  assert.equal(whatsappDelivery('draft', 'practice'), 'note');
  assert.equal(whatsappDelivery('auto', 'off'), 'off');
  assert.equal(whatsappDelivery('off', 'live'), 'off');
});

test('in-app chat follows SquadHub status', () => {
  assert.equal(appDelivery(null), 'reply');
  assert.equal(appDelivery('live'), 'reply');
  assert.equal(appDelivery('approval'), 'note');
  assert.equal(appDelivery('practice'), 'note');
  assert.equal(appDelivery('off'), 'off');
});

test('model comes from SquadHub only when it is a Claude model', () => {
  assert.equal(botModel(null, 'claude-opus-5'), 'claude-opus-5');
  assert.equal(botModel(hub({ ai: { provider: 'claude', provider_kind: 'anthropic', model: 'claude-sonnet-5', error: null } }), 'x'), 'claude-sonnet-5');
  assert.equal(botModel(hub({ ai: { provider: 'openrouter', provider_kind: 'openai_compatible', model: 'llama', error: null } }), 'claude-opus-5'), 'claude-opus-5');
});

test('admin instructions are added only when set', () => {
  assert.equal(adminInstructions(null), '');
  assert.equal(adminInstructions(hub({ instructions: '  ' })), '');
  assert.match(adminInstructions(hub({ instructions: 'Be brief.' })), /Be brief\./);
});
