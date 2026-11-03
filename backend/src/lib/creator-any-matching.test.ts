import assert from 'node:assert/strict';
import test from 'node:test';
import { supabaseAdmin } from '../config/supabase.js';
import { findMatchingTalents, type MatchRules } from '../services/subscription-matcher.service.js';
import { connectBriefSchema } from '../validators/connect-brief.validators.js';

test('creator briefs accept Any for niches and formats in both products', () => {
  for (const card_type of ['subscription', 'assignment']) {
    const parsed = connectBriefSchema.parse({
      card_type, service_types: ['social_media_creator'],
      brand_name: 'Example', business_nature: 'Products', business_note: 'Consumer products.',
      languages: ['English'], working_days: card_type === 'subscription' ? ['Mon'] : [],
      role_requirements: { social_media_creator: {
        note: 'Create a campaign.', additional_requirements: {
          creator_niches: ['Any'], creator_formats: ['Any'],
          creator_audience: ['Creator niches: Any.'], deliverables: ['Content formats: Any.'],
          usage_rights: ['Not specified'],
        },
      } },
    });
    assert.deepEqual(parsed.role_requirements?.social_media_creator?.additional_requirements?.creator_niches, ['Any']);
    assert.deepEqual(parsed.role_requirements?.social_media_creator?.additional_requirements?.creator_formats, ['Any']);
  }
});

test('Any removes only its creator matching restriction for subscriptions and assignments', async () => {
  const original = supabaseAdmin.from;
  const profiles = [
    { id: 'education', talent_user_id: 'educator', creator_services: [{ service: 'Brand promotion' }], creator_platforms: [{ niches: ['Education'], formats: ['Stories'] }] },
    { id: 'travel', talent_user_id: 'traveller', creator_services: [{ service: 'Brand promotion' }], creator_platforms: [{ niches: ['Travel'], format: 'Long-form videos' }] },
    { id: 'missing', talent_user_id: 'unknown', creator_services: [], creator_platforms: null },
    { id: 'junior', talent_user_id: 'junior', creator_services: [{ service: 'Brand promotion' }], creator_platforms: [{ niches: ['Education'], formats: ['Stories'] }] },
  ];
  try {
    // No real database calls: exercise the matcher with deterministic query results.
    supabaseAdmin.from = ((table: string) => {
      let ids: string[] | undefined;
      const query = {
        select() { return this; },
        eq() { return this; },
        in(column: string, values: string[]) { if (column === 'id') ids = values; return this; },
        limit() { return this; },
        then(resolve: (value: unknown) => unknown) {
          assert.ok(['talent_profiles', 'v_talent_profile_tier', 'talent_users'].includes(table));
          const data = table === 'talent_profiles'
            ? profiles.filter((p) => !ids || ids.includes(p.id))
            : table === 'v_talent_profile_tier'
              ? profiles.map((p) => ({ talent_profile_id: p.id, tier: p.id === 'junior' ? 'Junior' : 'Pro' }))
              : [{ id: 'educator', languages_spoken: ['English'] }, { id: 'traveller', languages_spoken: ['Hindi'] }];
          return Promise.resolve(resolve({ data, error: null }));
        },
      };
      return query;
    }) as unknown as typeof supabaseAdmin.from;

    for (const cardType of ['subscription', 'assignment'] as const) {
      const match = (rules: Partial<MatchRules>) => findMatchingTalents({ category_ids: ['creator'], target_tiers: ['Pro'], ...rules }, { cardType });
      assert.deepEqual(await match({ target_creator_niches: ['Any'], target_creator_formats: ['Any'] }), ['educator', 'traveller', 'unknown']);
      assert.deepEqual(await match({ target_creator_niches: [' Any ', 'Education'], target_creator_formats: ['aNy', 'Stories'] }), ['educator', 'traveller', 'unknown']);
      assert.deepEqual(await match({ target_creator_niches: ['Any'], target_creator_formats: ['Stories'] }), ['educator']);
      assert.deepEqual(await match({ target_creator_niches: ['Travel'], target_creator_formats: ['Any'] }), ['traveller']);
      assert.deepEqual(await match({ target_creator_niches: ['Education'], target_creator_formats: ['Long-form videos'] }), []);
      assert.deepEqual(await match({ target_creator_niches: ['Any'], target_creator_formats: ['Any'], target_creator_services: ['Brand promotion'] }), ['educator', 'traveller']);
      assert.deepEqual(await match({ target_creator_niches: ['Any'], target_creator_formats: ['Any'], target_languages: ['English'] }), ['educator']);
    }
  } finally {
    supabaseAdmin.from = original;
  }
});
