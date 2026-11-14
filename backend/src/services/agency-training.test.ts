import test from 'node:test';
import assert from 'node:assert/strict';

// No production credentials or network calls are needed for these gate tests.
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

test('only an explicit administrator exemption opens an agency without training', async (t) => {
  const { supabaseAdmin } = await import('../config/supabase.js');
  const { agencyTrainingStatus } = await import('./agency-training.service.js');
  let user: any = { app_metadata: {}, user_metadata: {} };
  let authError: any = null;
  t.mock.method(supabaseAdmin.auth.admin, 'getUserById', async () => ({
    data: { user }, error: authError,
  }));
  const query: any = {};
  for (const method of ['select', 'eq', 'is']) query[method] = () => query;
  query.order = async () => ({ data: [], error: null });
  const from = t.mock.method(supabaseAdmin, 'from', () => query);

  assert.equal((await agencyTrainingStatus('agency')).completed, false);
  user.user_metadata.agency_training_exempt = true;
  assert.equal((await agencyTrainingStatus('agency')).completed, false);
  user.app_metadata.agency_training_exempt = 'true';
  assert.equal((await agencyTrainingStatus('agency')).completed, false);
  const readsBeforeExemption = from.mock.callCount();
  user.app_metadata.agency_training_exempt = true;
  assert.deepEqual(await agencyTrainingStatus('agency'), { completed: true, required: [] });
  assert.equal(from.mock.callCount(), readsBeforeExemption);
  authError = new Error('Auth unavailable');
  await assert.rejects(agencyTrainingStatus('agency'), /Failed to check agency training access/);
});
