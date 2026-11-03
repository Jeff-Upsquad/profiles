import assert from 'node:assert/strict';
import test from 'node:test';
import { creatorMatchRules, matchesCreatorAudience } from './creator-matching.js';
import { CREATOR_ROLES } from '../../../shared/src/creatorRoles.js';
import { supabaseAdmin } from '../config/supabase.js';
import { findMatchingTalents, checkTalentTierEligibility } from '../services/subscription-matcher.service.js';
const rules = creatorMatchRules({ category_ids: [CREATOR_ROLES[0].id], target_tiers: ['Custom'], target_languages: ['English'] }, {
  additional_requirements: { channels: ['Instagram'], creator_levels: ['Below 5,000 (INR 500)', '5,000 to 10,000 (INR 1,000)'], creator_services: ['Brand promotion'], creator_niches: ['Any'], creator_formats: ['Any'] },
});
test('legacy creator content supplies follower and platform rules with exact boundaries', () => {
  assert.deepEqual(rules.target_creator_levels, ['Below 5,000', '5,000 to 10,000']);
  assert.deepEqual(rules.target_creator_platforms, ['Instagram']);
  assert.deepEqual(rules.target_creator_services, ['Brand promotion']);
  const field = (followers: unknown, platform = 'Instagram') => ({ creator_platforms: [{ followers, platform }] });
  for (const n of [0, 4999, 5000, 9999]) assert.equal(matchesCreatorAudience(field(n), rules), true);
  for (const n of [10000, '', null, -1, 'bad']) assert.equal(matchesCreatorAudience(field(n), rules), false);
  assert.equal(matchesCreatorAudience(field(500, 'YouTube'), rules), false);
  assert.equal(matchesCreatorAudience({ creator_platforms: [{ platform: 'Instagram', followers: 20000 }, { platform: 'YouTube', followers: 500 }] }, rules), false);
  assert.equal(matchesCreatorAudience(field(500), { ...rules, target_creator_levels: [] }), false);
  assert.equal(matchesCreatorAudience(field(500), { ...rules, target_creator_levels: ['unknown'] }), false);
  assert.equal(matchesCreatorAudience(field(500), { ...rules, target_tiers: ['Junior'] }), false);
  const other = { category_ids: ['designer'], target_tiers: ['Pro'] };
  assert.equal(creatorMatchRules(other), other);
});
test('untiered creators receive matching subscriptions and assignments and pass hand-pick eligibility', async () => {
  const original = supabaseAdmin.from;
  const profiles = [
    { id: 'matched', talent_user_id: 'creator', field_data: { creator_platforms: [{ platform: 'Instagram', followers: 500 }] }, creator_services: [{ service: 'Brand promotion' }] },
    { id: 'large', talent_user_id: 'large-creator', field_data: { creator_platforms: [{ platform: 'Instagram', followers: 20000 }] } },
  ];
  try {
    supabaseAdmin.from = ((table: string) => {
      assert.notEqual(table, 'v_talent_profile_tier');
      let ids: string[] | undefined; let user: string | undefined;
      const query = {
        select() { return this; }, eq(c: string, v: string) { if (c === 'talent_user_id') user = v; return this; },
        is() { return this; }, limit() { return this; },
        in(c: string, v: string[]) { if (c === 'id') ids = v; return this; },
        then(resolve: (value: unknown) => unknown) {
          const data = table === 'talent_users' ? [{ id: 'creator', languages_spoken: ['English'] }]
            : profiles.filter((p) => (!ids || ids.includes(p.id)) && (!user || p.talent_user_id === user));
          return Promise.resolve(resolve({ data, error: null }));
        },
      };
      return query;
    }) as unknown as typeof supabaseAdmin.from;
    for (const cardType of ['subscription', 'assignment'] as const) {
      assert.deepEqual(await findMatchingTalents(rules, { cardType }), ['creator']);
      assert.deepEqual(await findMatchingTalents({ ...rules, target_tiers: ['Pro'] }, { cardType }), []);
      assert.deepEqual(await findMatchingTalents({ ...rules, target_creator_levels: [] }, { cardType }), []);
    }
    assert.equal((await checkTalentTierEligibility(rules, 'creator')).eligible, true);
    assert.equal((await checkTalentTierEligibility(rules, 'large-creator')).eligible, false);
  } finally { supabaseAdmin.from = original; }
});

test('backfill recovers legacy creator selections and excludes manual and tier sibling cards', async () => {
  const { backfillCardsForTalent } = await import('../services/card-backfill.service.js');
  const original = supabaseAdmin.from;
  const inserted: unknown[] = [];
  const user = { id: 'creator', is_active: true, suspended: false, blacklisted: false, languages_spoken: [{ language: 'English' }] };
  const profile = { id: 'p', category_id: CREATOR_ROLES[0].id, talent_user_id: 'creator', field_data: { creator_platforms: [{ platform: 'Instagram', followers: 100 }] }, creator_services: [{ service: 'Brand promotion' }] };
  const content = { additional_requirements: { channels: ['Instagram'], creator_levels: ['Below 5,000 (INR 500)'], creator_services: ['Brand promotion'] } };
  const base = { status: 'active', archived_at: null, card_type: 'assignment', content, match_rules: { category_ids: [CREATOR_ROLES[0].id], target_tiers: ['Custom'], target_languages: ['English'] } };
  try {
    supabaseAdmin.from = ((table: string) => {
      let single = false; let writes: unknown[] | undefined;
      const query = {
        select() { return this; }, eq() { return this; }, is() { return this; }, in() { return this; }, limit() { return this; },
        maybeSingle() { single = true; return this; },
        insert(rows: unknown[]) { writes = rows; inserted.push(...rows); return this; },
        then(resolve: (v: unknown) => unknown) {
          const tables: Record<string, unknown[]> = {
            talent_users: [user], talent_profiles: [profile], v_talent_profile_tier: [{ talent_profile_id: 'p', tier: null }],
            talent_profiles_basic: [], talent_job_preferences: [], subscription_card_recipients: [],
            subscription_cards: [{ ...base, id: 'custom' }, { ...base, id: 'manual', distribution: 'manual' }, { ...base, id: 'pro', match_rules: { ...base.match_rules, target_tiers: ['Pro'] } }],
          };
          assert.ok(table in tables, table);
          const rows = tables[table];
          return Promise.resolve(resolve({ data: single ? rows[0] ?? null : rows, error: null, count: writes?.length }));
        },
      };
      return query;
    }) as unknown as typeof supabaseAdmin.from;
    assert.equal(await backfillCardsForTalent('creator'), 1);
    assert.deepEqual(inserted, [{ card_id: 'custom', talent_user_id: 'creator', status: 'pending' }]);
  } finally { supabaseAdmin.from = original; }
});
