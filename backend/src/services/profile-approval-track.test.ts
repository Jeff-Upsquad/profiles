import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://approval-fixture.test';
process.env.SUPABASE_ANON_KEY = 'test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
const originalFetch = globalThis.fetch;
let admin: typeof import('./admin.service.js');
let automation: typeof import('./automation.service.js');
let linked = false;
let profileStatus = 'pending_review';
let hasPortfolio = false;
let jobsOnly = false;
let creator = false;
let legacyCreator = false;
let closedPartner = false;
let writes: Array<{ table: string; body: Record<string, unknown> }> = [];
let webhooks: Array<Record<string, unknown>> = [];
const talent = () => ({
  id: '11111111-1111-4111-8111-111111111111', full_name: 'Test Talent', phone: '+910000000000',
  wants_jobs: true, partner_approval_status: closedPartner ? 'rejected' : jobsOnly ? null : 'approved', tracks_linked: linked,
  pipeline_stage: 'onboarding_course', jobs_pipeline_stage: 'final_review',
  partner_stage_changed_at: null, jobs_stage_changed_at: null,
  onboarding_completed: true, application_cancellations: {}, signup_form_type: creator ? 'social_media_creator' : 'creative',
});
const profile = () => ({
  id: 'profile', talent_user_id: '11111111-1111-4111-8111-111111111111', category_id: 'design', status: profileStatus,
  created_at: '2026-09-26T00:00:00Z',
});
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
before(async () => {
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.hostname === 'crm-fixture.test') {
      webhooks.push(JSON.parse(String(init.body)));
      return json({ ok: true });
    }
    assert.equal(url.hostname, 'approval-fixture.test', 'No production calls');
    if (url.pathname.startsWith('/auth/v1/admin/users/')) return json({ id: '11111111-1111-4111-8111-111111111111', email: 'fixture@example.test' });
    const table = url.pathname.split('/').pop()!;
    if (init.method === 'HEAD') return new Response(null, { headers: { 'content-range': '0-0/1' } });
    if (init.method === 'PATCH' || init.method === 'POST') {
      const body = JSON.parse(String(init.body));
      writes.push({ table, body });
      if (table === 'talent_profiles') {
        profileStatus = body.status ?? profileStatus;
        return json(new Headers(init.headers).get('accept')?.includes('object+json') ? profile() : [profile()]);
      }
      return json(null);
    }
    if (table === 'admin_settings') {
      const key = url.searchParams.get('key');
      return json([{ value: key === 'eq.crm_status_mapping' ? {
        crm_webhook_url: 'https://crm-fixture.test/integrations/profiles/leads',
        pipelines: { creative: { pipeline_name: 'Partner Candidates', mappings: {} }, jobs: { pipeline_name: 'Jobs Candidates', mappings: {} } },
      } : {} }]);
    }
    if (table === 'talent_users') return json([talent()]);
    if (table === 'talent_profiles') {
      if (url.searchParams.has('categories.slug') && !creator && !legacyCreator) return json([]);
      if (url.searchParams.get('status') === 'eq.approved' && profileStatus !== 'approved') return json([]);
      return json([profile()]);
    }
    if (table === 'portfolio_items') return json(hasPortfolio ? [{ created_at: '2026-09-26T00:00:00Z' }] : []);
    if (table === 'lead_submissions') return json(hasPortfolio ? [{ id: 'lead', form_type: 'creative', status: 'portfolio_updation', form_data: {} }] : []);
    if (table === 'categories' || table === 'talent_profiles_basic') return json([]);
    throw new Error(`Unexpected fixture call: ${url.pathname}`);
  };
  admin = await import('./admin.service.js');
  automation = await import('./automation.service.js');
});
after(() => { globalThis.fetch = originalFetch; });
function reset(isLinked = false) {
  linked = isLinked;
  profileStatus = 'pending_review';
  hasPortfolio = false;
  jobsOnly = false;
  creator = false;
  legacyCreator = false;
  closedPartner = false;
  writes = [];
  webhooks = [];
}

test('Partner profile approval never advances Jobs or invokes its CRM automations', async () => {
  reset();
  await admin.approveProfile('profile', 'admin', 'partner');
  assert.equal(profileStatus, 'approved');
  assert.ok(writes.some(w => w.table === 'talent_users' && 'pipeline_stage' in w.body));
  assert.ok(!writes.some(w => w.table === 'talent_users' && 'jobs_pipeline_stage' in w.body));
  assert.ok(webhooks.length > 0);
  assert.ok(webhooks.every(w => w.event !== 'track_stage_changed'));
});

test('Jobs profile approval advances Jobs only, without moving Partner', async () => {
  reset();
  await admin.approveProfile('profile', 'admin', 'jobs');
  assert.ok(writes.some(w => w.table === 'talent_users' && w.body.jobs_pipeline_stage === 'live'));
  assert.ok(!writes.some(w => w.table === 'talent_users' && 'pipeline_stage' in w.body));
  assert.equal(webhooks.length, 1);
  assert.equal(webhooks[0].event, 'track_stage_changed');
  assert.equal(webhooks[0].pipeline_name, 'Jobs Candidates');
});

test('older callers and bulk approvals default to Partner instead of auto-selecting Jobs', async () => {
  reset();
  await admin.bulkApproveProfiles(['profile'], 'admin');
  assert.equal(profileStatus, 'approved');
  assert.ok(!writes.some(w => w.table === 'talent_users' && 'jobs_pipeline_stage' in w.body));
  assert.ok(webhooks.every(w => w.event !== 'track_stage_changed'));
});

test('explicit Jobs review does not mirror into Partner even for linked applications', async () => {
  reset(true);
  await admin.approveProfile('profile', 'admin', 'jobs');
  assert.ok(!writes.some(w => w.table === 'talent_users' && 'pipeline_stage' in w.body));
  assert.equal(webhooks.length, 1);
  assert.equal(webhooks[0].event, 'track_stage_changed');
  assert.notEqual(webhooks[0].silent, true);
});

test('unscoped talent progress still automatically catches up Jobs', async () => {
  reset();
  profileStatus = 'approved';
  await automation.syncOnboardingStage('11111111-1111-4111-8111-111111111111');
  assert.ok(writes.some(w => w.table === 'talent_users' && w.body.jobs_pipeline_stage === 'live'));
  assert.equal(webhooks[0].event, 'track_stage_changed');
});


test('regression: approving a completed Designer portfolio in Partner leaves Jobs untouched', async () => {
  reset();
  hasPortfolio = true;
  await admin.approveProfile('profile', 'admin', 'partner');
  assert.equal(profileStatus, 'approved');
  assert.ok(!writes.some(w => w.table === 'talent_users' && 'jobs_pipeline_stage' in w.body));
  assert.equal(webhooks.length, 0);
});

test('Partner approval does not mirror into Jobs for linked applications either', async () => {
  reset(true);
  await admin.approveProfile('profile', 'admin', 'partner');
  assert.ok(!writes.some(w => w.table === 'talent_users' && 'jobs_pipeline_stage' in w.body));
  assert.ok(webhooks.every(w => w.event !== 'track_stage_changed'));
});

test('bulk Jobs approvals retain their Jobs context', async () => {
  reset();
  await admin.bulkApproveProfiles(['profile'], 'admin', 'jobs');
  assert.ok(writes.some(w => w.table === 'talent_users' && w.body.jobs_pipeline_stage === 'live'));
  assert.ok(!writes.some(w => w.table === 'talent_users' && 'pipeline_stage' in w.body));
});


test('generic review of a Jobs-only talent still advances Jobs', async () => {
  reset();
  jobsOnly = true;
  await admin.approveProfile('profile', 'admin');
  assert.ok(writes.some(w => w.table === 'talent_users' && w.body.jobs_pipeline_stage === 'live'));
  assert.equal(webhooks.length, 1);
  assert.equal(webhooks[0].event, 'track_stage_changed');
});


test('creator approval goes directly to Partner Live even when reviewed from Jobs', async () => {
  reset(); creator = true;
  await admin.approveProfile('profile', 'admin', 'jobs');
  assert.ok(writes.some(w => w.table === 'talent_users' && w.body.pipeline_stage === 'live'));
  assert.ok(!writes.some(w => w.table === 'talent_users' && 'jobs_pipeline_stage' in w.body));
  assert.equal(webhooks.length, 0, 'creator notice is independent of CRM stage automations');
});

test('legacy creator profile also goes directly to Partner Live', async () => {
  reset(); legacyCreator = true;
  await admin.approveProfile('profile', 'admin', 'partner');
  assert.ok(writes.some(w => w.table === 'talent_users' && w.body.pipeline_stage === 'live'));
});

test('creator drafts do not go Live through progress sync', async () => {
  reset(); creator = true; profileStatus = 'draft';
  await automation.syncOnboardingStage('11111111-1111-4111-8111-111111111111');
  assert.ok(!writes.some(w => w.table === 'talent_users' && w.body.pipeline_stage === 'live'));
});

test('creator progress cannot reinstate a rejected Partner application', async () => {
  reset(); creator = true; profileStatus = 'approved'; closedPartner = true;
  await automation.syncOnboardingStage('11111111-1111-4111-8111-111111111111');
  assert.ok(!writes.some(w => w.table === 'talent_users' && w.body.pipeline_stage === 'live'));
});
