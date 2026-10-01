import assert from 'node:assert/strict';
import test from 'node:test';
import { roleFromAuthUser } from './auth-role.js';

test('the role comes from app_metadata', () => {
  assert.equal(roleFromAuthUser({ app_metadata: { role: 'admin' } }), 'admin');
  assert.equal(roleFromAuthUser({ app_metadata: { role: 'agency' } }), 'agency');
  assert.equal(roleFromAuthUser({ app_metadata: { role: 'squad_member' } }), 'squad_member');
  assert.equal(roleFromAuthUser({ app_metadata: { role: 'squad_manager' } }), 'squad_manager');
  assert.equal(roleFromAuthUser({ app_metadata: { role: 'talent' } }), 'talent');
});

test('a role the user wrote into their own user_metadata is ignored', () => {
  // What GoTrue returns after PUT /auth/v1/user {"data":{"role":"admin"}}.
  const selfPromoted = {
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { role: 'admin' },
  };
  assert.equal(roleFromAuthUser(selfPromoted), 'talent');
  assert.equal(roleFromAuthUser({ app_metadata: { role: 'talent' }, user_metadata: { role: 'admin' } } as any), 'talent');
  assert.equal(roleFromAuthUser({ user_metadata: { role: 'agency' } } as any), 'talent');
});

test('no or unknown app_metadata.role means talent', () => {
  assert.equal(roleFromAuthUser(null), 'talent');
  assert.equal(roleFromAuthUser(undefined), 'talent');
  assert.equal(roleFromAuthUser({}), 'talent');
  assert.equal(roleFromAuthUser({ app_metadata: null }), 'talent');
  // SquadHire CRM staff accounts share this auth project and carry only shcrm_* flags.
  assert.equal(roleFromAuthUser({ app_metadata: { provider: 'email', shcrm_pending_signup: true } }), 'talent');
  assert.equal(roleFromAuthUser({ app_metadata: { role: 'superuser' } }), 'talent');
  assert.equal(roleFromAuthUser({ app_metadata: { role: ['admin'] } }), 'talent');
});

test('business and staff never come from a Supabase session', () => {
  // Those roles are only issued by business-auth / staff-auth JWTs.
  assert.equal(roleFromAuthUser({ app_metadata: { role: 'business' } }), 'talent');
  assert.equal(roleFromAuthUser({ app_metadata: { role: 'staff' } }), 'talent');
});
