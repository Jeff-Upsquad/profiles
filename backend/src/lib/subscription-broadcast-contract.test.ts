import assert from 'node:assert/strict';
import test from 'node:test';
import { ingestSubscriptionCardSchema } from '../validators/subscription.validators.js';

test('signed broadcast deliveries opt into talent notifications without enabling ordinary edit notifications', () => {
  const payload = { external_id: 'business-brief', content: {}, match_rules: {} };
  assert.equal(ingestSubscriptionCardSchema.parse(payload).notify_talents, false);
  assert.equal(ingestSubscriptionCardSchema.parse({ ...payload, notify_talents: true }).notify_talents, true);
  assert.equal(ingestSubscriptionCardSchema.safeParse({ ...payload, notify_talents: 'true' }).success, false);
});
