import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
process.env.SUPABASE_URL = 'https://creator-routing.test';
process.env.SUPABASE_ANON_KEY = 'test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
const originalFetch = globalThis.fetch;
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json', 'content-range': '*/0' } });
const queries: URL[] = [];
let admin: typeof import('./admin.service.js');
let hub: typeof import('./onboarding-hub.service.js');
const profiles = ['creator', 'legacy', 'ordinary'].map(talent_user_id => ({ id: talent_user_id, talent_user_id, category_id: 'cat', status: 'approved' }));
before(async () => {
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input)); queries.push(url);
    assert.equal(url.hostname, 'creator-routing.test', 'No production requests');
    const table = url.pathname.split('/').pop();
    if (init.method === 'HEAD') return new Response(null, { headers: { 'content-range': '*/0' } });
    if (table === 'categories') return json([{ id: 'cat', slug: 'social-media-creator', name: 'Creators' }]);
    if (table === 'talent_profiles_basic') return json([{ talent_user_id: 'ordinary', employment_type: ['salary'] }]);
    if (table === 'talent_profiles') {
      if (url.searchParams.get('categories.slug')) return json([profiles[1]]);
      if (url.searchParams.get('select') === 'category_id,status,talent_user_id') {
        const filter = url.searchParams.get('talent_user_id') ?? '';
        return json(profiles.filter(p => filter.includes(p.talent_user_id)));
      }
      return json([]);
    }
    if (table === 'talent_users') {
      if (url.searchParams.get('or')?.includes('signup_form_type')) return json([{ id: 'creator' }]);
      if (url.searchParams.get('select') === 'id' &&
        (url.searchParams.get('pipeline_stage') === 'eq.live' || url.searchParams.get('jobs_pipeline_stage') === 'eq.live')) {
        return json(['creator','legacy','ordinary'].map(id => ({ id })));
      }
      return json([]);
    }
    if (['admin_settings','partner_app_installs','notification_recipients','lead_submissions'].includes(table ?? '')) return json([]);
    throw new Error(`Unexpected fixture URL ${url}`);
  };
  admin = await import('./admin.service.js');
  hub = await import('./onboarding-hub.service.js');
});
after(() => { globalThis.fetch = originalFetch; });

test('Partner category counts include creators with missing optional basic profiles', async () => {
  const categories = await admin.getTalentCategories('partner_program');
  assert.equal(categories[0].profile_count, 2);
  assert.equal(categories[0].both_count, 2);
});
test('Jobs category counts exclude both current and legacy creator accounts', async () => {
  const categories = await admin.getTalentCategories('salary');
  assert.equal(categories[0].profile_count, 1);
});
test('both onboarding lists exclude creators before pagination', async () => {
  for (const track of ['partner','jobs'] as const) {
    queries.length = 0;
    await hub.listHub({ track });
    const list = queries.find(q => q.pathname.endsWith('/talent_users') && q.searchParams.get('select')?.includes('full_name') && q.searchParams.getAll('id').join().includes('not.in'));
    assert.ok(list, 'list query was issued');
    const excluded = list.searchParams.getAll('id').join();
    assert.ok(excluded.includes('creator') && excluded.includes('legacy'), 'both creator identities excluded');
  }
});
test('onboarding counters use the same creator exclusion', async () => {
  queries.length = 0; await hub.hubStats(undefined, 'partner');
  const stats = queries.find(q => q.pathname.endsWith('/talent_users') && q.searchParams.get('select')?.includes('track_inactivity'));
  assert.ok(stats?.searchParams.getAll('id').join().includes('legacy'));
});
