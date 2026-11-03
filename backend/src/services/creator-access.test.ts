import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, NextFunction } from 'express';
process.env.SUPABASE_URL = 'https://creator-fixture.test';
process.env.SUPABASE_ANON_KEY = 'fixture';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture';
const originalFetch = globalThis.fetch;
let creator = true;
let services: typeof import('./training-content.service.js');
let talent: typeof import('./talent.service.js');
let access: typeof import('../middleware/work-access.middleware.js');
before(async () => {
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, 'creator-fixture.test', 'Tests never contact production');
    const row = { skip_onboarding: false, signup_form_type: 'creative', signup_categories: creator ? ['designer', 'social-media-creator'] : ['designer'], wants_jobs: false, partner_approval_status: null };
    const object = new Headers(init?.headers).get('accept')?.includes('object+json');
    return new Response(JSON.stringify(object ? row : [row]), { headers: { 'content-type': 'application/json' } });
  };
  services = await import('./training-content.service.js');
  talent = await import('./talent.service.js');
  access = await import('../middleware/work-access.middleware.js');
});
after(() => { globalThis.fetch = originalFetch; });
test('creators bypass training, basic-profile completion and partner locks while ordinary accounts keep their gates', async () => {
  assert.equal((await services.getProfileGate('creator', 'category')).locked, false);
  const modules = await services.getModuleAccess('creator', []);
  assert.deepEqual(modules.locked, []);
  assert.ok(['profiles', 'subscriptions', 'assignments', 'jobs'].every((module) => modules.unlocked.includes(module)));
  const timers = await import('./stage-timers.service.js');
  assert.deepEqual(timers.inactivitySummary({ signup_categories: ['social-media-creator'] } as never, {} as never), []);
  assert.equal(talent.isBasicProfileMandatoryComplete(null, { full_name: 'Creator', languages_spoken: [], signup_categories: ['social-media-creator'] }), true);
  for (const middleware of [access.requireProfileAccess, access.requirePartnerAccess, access.requireJobsAccess]) {
    const error = await new Promise((resolve) => middleware({ user: { id: 'creator' } } as Request, {} as never, resolve as NextFunction));
    assert.equal(error, undefined);
  }
  creator = false;
  const error = await new Promise((resolve) => access.requirePartnerAccess({ user: { id: 'ordinary' } } as Request, {} as never, resolve as NextFunction));
  assert.equal((error as { statusCode: number }).statusCode, 403);
  assert.equal(talent.isBasicProfileMandatoryComplete(null, { full_name: 'Ordinary', languages_spoken: [] }), false);
});
