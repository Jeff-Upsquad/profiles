import assert from 'node:assert/strict';
import test from 'node:test';
import { BRIDGE_OPERATIONS, nonceStore, signBridge, verifyBridge } from './squad-bots-admin-bridge.js';

const secret = 'x'.repeat(40);
const now = 1_800_000_000_000;
const base = { time: String(now), nonce: '6f1c2c3e-1111-4222-8333-444455556666', actor: 'Admin@Upsquad.in', method: 'POST', path: '/talents/abc/actions', body: { op: 'approve_partner' } };

test('accepts a request signed exactly as Squad Bots signs it', () => {
  const signature = signBridge(secret, base);
  assert.deepEqual(verifyBridge(secret, { ...base, signature }, now), { actor: 'admin@upsquad.in' });
});

test('rejects tampered bodies, paths, stale timestamps and missing headers', () => {
  const signature = signBridge(secret, base);
  assert.ok('error' in verifyBridge(secret, { ...base, signature, body: { op: 'reject_partner' } }, now));
  assert.ok('error' in verifyBridge(secret, { ...base, signature, path: '/talents/other/actions' }, now));
  assert.ok('error' in verifyBridge(secret, { ...base, signature }, now + 6 * 60 * 1000));
  assert.ok('error' in verifyBridge(secret, { ...base, signature: undefined }, now));
  assert.ok('error' in verifyBridge('y'.repeat(40), { ...base, signature }, now));
});

test('GET requests sign a null body', () => {
  const get = { ...base, method: 'GET', path: '/queue?track=jobs', body: null };
  assert.ok('actor' in verifyBridge(secret, { ...get, signature: signBridge(secret, get) }, now));
});

test('nonces cannot be replayed inside the window', () => {
  const fresh = nonceStore(1000);
  assert.equal(fresh('a', 0), true);
  assert.equal(fresh('a', 10), false);
  assert.equal(fresh('a', 2000), true);
});

test('writes need edit access in the module that owns them', () => {
  assert.deepEqual(BRIDGE_OPERATIONS.approve_partner, { module: 'approvals', level: 'edit' });
  assert.deepEqual(BRIDGE_OPERATIONS.unblock_user, { module: 'talents', level: 'edit' });
  assert.equal(BRIDGE_OPERATIONS.queue.level, 'view');
});
