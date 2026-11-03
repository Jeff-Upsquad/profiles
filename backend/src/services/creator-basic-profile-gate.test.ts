import assert from 'node:assert/strict';
import test from 'node:test';

// Use the real query builder against an isolated fetch fixture.
process.env.SUPABASE_URL = 'https://creator-gate.test';
process.env.SUPABASE_ANON_KEY = 'fixture';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture';

const creator = {
  full_name: 'Creator Channel',
  languages_spoken: [{ language: 'Hindi', proficiency: 'native' }],
  signup_form_type: 'social_media_creator',
};
const completeBasic = {
  permanent_country: 'India', permanent_state: 'Kerala',
  permanent_district: 'Ernakulam', permanent_city: 'Kochi',
  availability: ['full_time'], job_type: ['remote'], employment_type: ['salary'],
  education_courses: [{ course_name: 'B.Tech', institution: 'Cochin University' }],
  experience: [{ company_name: 'Acme', designation: 'Intern' }],
  profile_picture_url: 'https://cdn.example.test/pic.jpg',
  resume_url: 'https://cdn.example.test/resume.pdf',
};

test('creator basic-profile gate', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  let profileCount = 1;
  let talent: Record<string, unknown> | null = creator;
  let basic: Record<string, unknown> | null = null;
  let failingTable: string | null = null;
  let profileRows: { is_ghost: boolean; deleted_at: string | null }[] | null = null;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, 'creator-gate.test', 'Tests never contact production');
    const table = url.pathname.split('/').pop();
    if (table === failingTable) {
      return new Response(JSON.stringify({ message: 'Fixture query failed', code: 'XX000' }), {
        status: 400, headers: { 'content-type': 'application/json' },
      });
    }
    if (table === 'talent_profiles') {
      assert.equal(init?.method, 'HEAD');
      assert.equal(url.searchParams.get('talent_user_id'), 'eq.u1');
      assert.equal(url.searchParams.get('deleted_at'), 'is.null');
      assert.equal(url.searchParams.get('is_ghost'), 'eq.false');
      const count = profileRows
        ? profileRows.filter((row) => !row.is_ghost && !row.deleted_at).length
        : profileCount;
      return new Response(null, { headers: { 'content-range': `*/${count}` } });
    }
    assert.ok(table === 'talent_users' || table === 'talent_profiles_basic');
    const row = table === 'talent_users' ? talent : basic;
    return new Response(JSON.stringify(row ? [row] : []), {
      headers: { 'content-type': 'application/json' },
    });
  };
  console.error = () => {};
  try {
    const { enforceSecondProfileBasicProfileGate: gate } = await import('./talent.service.js');
    await t.test('first profile needs no basic profile', async () => {
      profileCount = 0;
      assert.equal(await gate('u1'), null);
      profileCount = 1;
    });
    await t.test('ghost and deleted profiles do not trigger the gate', async () => {
      profileRows = [
        { is_ghost: true, deleted_at: null },
        { is_ghost: false, deleted_at: '2026-01-01' },
      ];
      assert.equal(await gate('u1'), null);
      profileRows = null;
    });
    await t.test('missing basic profile blocks a second profile', async () => {
      const error = await gate('u1');
      assert.equal(error?.statusCode, 403);
      assert.match(error!.message, /Complete your Basic Profile/);
    });
    await t.test('mixed-category creators also require completion', async () => {
      talent = { ...creator, signup_form_type: 'creative', signup_categories: ['designer', 'social-media-creator'] };
      assert.equal((await gate('u1'))?.statusCode, 403);
      talent = creator;
    });
    await t.test('completed required sections allow creation without ID or bank details', async () => {
      basic = completeBasic;
      assert.equal(await gate('u1'), null);
    });
    await t.test('incomplete required sections block creation', async () => {
      for (const missing of ['education_courses', 'experience', 'profile_picture_url', 'resume_url']) {
        basic = { ...completeBasic, [missing]: null };
        assert.equal((await gate('u1'))?.statusCode, 403, missing);
      }
      basic = { ...completeBasic, education_courses: [{ course_name: ' ', institution: ' ' }] };
      assert.equal((await gate('u1'))?.statusCode, 403);
      basic = completeBasic;
    });
    await t.test('resume remains optional outside salary and partner work', async () => {
      basic = { ...completeBasic, employment_type: ['freelance'], freelance_available: true, resume_url: null };
      assert.equal(await gate('u1'), null);
      basic = completeBasic;
    });
    await t.test('ordinary talent keeps existing rules', async () => {
      talent = { ...creator, signup_form_type: 'creative' };
      basic = null;
      assert.equal(await gate('u1'), null);
      talent = creator;
    });
    await t.test('query failures never bypass the gate', async () => {
      for (const table of ['talent_profiles', 'talent_users', 'talent_profiles_basic']) {
        failingTable = table;
        assert.equal((await gate('u1'))?.statusCode, 503, table);
      }
      failingTable = null;
    });
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});
