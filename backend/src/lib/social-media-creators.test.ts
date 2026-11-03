import assert from 'node:assert/strict';
import test from 'node:test';
import { CREATOR_ROLES, isSocialMediaCreator } from '../../../shared/src/creatorRoles.js';
import { signupFormTypes } from '../../../shared/src/signupCategories.js';
import { signupTalentSchema } from '../validators/auth.validators.js';
import { connectBriefSchema } from '../validators/connect-brief.validators.js';
import { categoryHasPortfolio } from '../../../shared/src/portfolio.js';
import { supabaseAdmin } from '../config/supabase.js';

test('creator signup works alone and alongside another talent category', () => {
  for (const categories of [['social-media-creator'], ['designer', 'social-media-creator']]) {
    const parsed = signupTalentSchema.parse({ email: 'creator@example.test', password: 'test-password', phone: '+919876543210', otp: { challenge_id: '12345678-1234-4234-8234-123456789012', code: '123456' }, full_name: 'Creator Channel', signup_categories: categories });
    assert.ok(signupFormTypes(parsed.signup_categories!).includes('social_media_creator'));
    assert.equal(isSocialMediaCreator({ signup_form_type: 'creative', signup_categories: parsed.signup_categories }), true);
  }
  assert.equal(isSocialMediaCreator({ signup_form_type: 'social_media_creator' }), true);
  assert.equal(isSocialMediaCreator({ signup_form_type: 'social_media_manager' }), false);
  assert.equal(isSocialMediaCreator(null), false);
  assert.equal(categoryHasPortfolio('social-media-creator'), false);
});

test('creator subscription and assignment briefs retain campaign scope and require deliverables and rights', () => {
  const role = CREATOR_ROLES[0];
  const details = Object.fromEntries(role.briefFields.map((f) => [f.key, [`Detailed ${f.label}`]]));
  for (const card_type of ['subscription', 'assignment']) {
    const brief = { card_type, service_types: ['social_media_creator'], brand_name: 'Example Brand', business_nature: 'Products', business_note: 'Consumer products.', languages: ['English'], working_days: card_type === 'subscription' ? ['Mon'] : [], role_requirements: { social_media_creator: { note: 'Create and publish a product campaign.', additional_requirements: details } } };
    assert.deepEqual(connectBriefSchema.parse(brief).role_requirements?.social_media_creator?.additional_requirements, details);
    for (const field of role.briefFields.filter((f) => f.required)) {
      assert.equal(connectBriefSchema.safeParse({ ...brief, role_requirements: { social_media_creator: { note: 'Campaign', additional_requirements: { ...details, [field.key]: [] } } } }).success, false, `${card_type}/${field.key}`);
    }
  }
});

test('creator job profiles skip the Experience pseudo-field, other categories keep it', async () => {
  const { validateFieldData, validateRequiredFields } = await import('../services/talent.service.js');
  const original = supabaseAdmin.from;
  const rows = (data: any) => ({
    select() { return this; },
    eq() { return this; },
    then(resolve: any) { return resolve({ data, error: null }); },
  });
  const tables: Record<string, any> = {
    categories: rows([{ slug: 'social-media-creator' }]),
    category_fields: rows([]),
  };
  try {
    supabaseAdmin.from = ((table: string) => tables[table] ?? rows([])) as typeof supabaseAdmin.from;
    assert.deepEqual(await validateFieldData('creator-cat', {}), []);
    assert.deepEqual(await validateRequiredFields('creator-cat', {}), []);
    tables.categories = rows([{ slug: 'designer' }]);
    assert.ok((await validateFieldData('cat', {})).includes('Experience is required'));
    assert.ok((await validateRequiredFields('cat', {})).includes('Experience is required'));
  } finally {
    supabaseAdmin.from = original;
  }
});
test('creator briefs carry follower levels with per-level budgets and shared catalog picks', () => {
  // Shape the CreatorBriefForm submits: follower-count levels ride as a
  // Custom tier with per-level tier_budgets, and niche/format/service picks
  // use the shared category_fields vocabulary for matching. The legacy brief
  // keys (creator_audience / deliverables / usage_rights) are synthesized from
  // the structured picks so the upstream card still renders.
  const brief = {
    card_type: 'subscription',
    service_types: ['social_media_creator'],
    brand_name: 'Example Brand',
    business_nature: 'Products',
    business_note: 'Consumer products.',
    languages: ['English'],
    working_days: ['Mon'],
    role_requirements: {
      social_media_creator: {
        note: 'Partner with creators to launch our product line.',
        tiers: ['Custom'],
        tier_budgets: { '10,000 to 25,000': 8000, '50,000 to 100k': 25000 },
        currency: 'INR',
        duration: '4 weeks',
        start_date: '2026-11-10',
        deadline: '2026-12-08',
        additional_requirements: {
          channels: ['Instagram', 'YouTube'],
          content_niches: ['Education', 'Technology'],
          content_formats: ['Reels / Shorts / TikToks'],
          collaboration_types: ['Sponsored posts'],
          service_count: ['Sponsored posts × 4'],
          creator_levels: ['10,000 to 25,000 (INR 8,000 / month)', '50,000 to 100k (INR 25,000 / month)'],
          desired_age: ['18-24', '25-34'],
          audience_location: ['India'],
          creator_audience: ['Creator niches: Education, Technology. Audience location: India. Desired age: 18-24, 25-34.'],
          deliverables: ['Content formats: Reels / Shorts / TikToks.'],
          usage_rights: ['Organic reuse on our channels for 6 months.'],
        },
      },
    },
  };
  const parsed = connectBriefSchema.parse(brief);
  const requirement = parsed.role_requirements?.social_media_creator;
  assert.deepEqual(requirement?.tiers, ['Custom']);
  assert.deepEqual(requirement?.tier_budgets, { '10,000 to 25,000': 8000, '50,000 to 100k': 25000 });
  assert.equal(requirement?.duration, '4 weeks');
  assert.deepEqual(requirement?.additional_requirements?.content_niches, ['Education', 'Technology']);
  assert.deepEqual(requirement?.additional_requirements?.content_formats, ['Reels / Shorts / TikToks']);
  assert.deepEqual(requirement?.additional_requirements?.collaboration_types, ['Sponsored posts']);
  assert.deepEqual(requirement?.additional_requirements?.service_count, ['Sponsored posts × 4']);
  // Timeline fields are accepted on subscriptions too — creator campaigns are
  // deliverable-based even inside a monthly plan.
  const assignment = connectBriefSchema.parse({ ...brief, card_type: 'assignment', working_days: [] });
  assert.equal(assignment.role_requirements?.social_media_creator?.deadline, '2026-12-08');
});
