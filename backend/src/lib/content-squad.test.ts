import assert from 'node:assert/strict';
import test from 'node:test';
import { CONTENT_ROLES } from '../../../shared/src/contentRoles.js';
import { formTypeFromSignupHint, parseSignupCategory } from './signup-category.js';
import { validStatusesForFormType } from '../services/crm-stage-mapping.js';
import { supabaseAdmin } from '../config/supabase.js';
import { getCategoryBySlug } from '../services/talent.service.js';
import { createLeadSchema } from '../validators/lead.validators.js';
import { connectBriefSchema } from '../validators/connect-brief.validators.js';

const applicant = {
  name: 'Test Talent', phone: '+919000000099', email: 'test@example.test', age: 25,
  gender: 'other', country: 'India', state: 'Kerala', current_district: 'Ernakulam',
  work_type_seeking: ['Job', 'UpSquad Partner Program'], experience_years: '3',
  portfolio_link: 'https://example.test/work',
  professional_summary: 'I create carefully researched and finished work for businesses and brands.',
};

test('role signups retain their category instead of falling into Designer / Editor', () => {
  for (const role of CONTENT_ROLES) {
    assert.equal(formTypeFromSignupHint(`/partner-program/${role.slug}`), role.formType);
    assert.equal(parseSignupCategory(role.formType), role.formType);
    if (role.slug === 'social-media-manager') {
      assert.ok(!validStatusesForFormType(role.formType)?.has('portfolio_updation'));
    } else {
      assert.ok(validStatusesForFormType(role.formType)?.has('portfolio_updation'));
    }
    assert.ok(!validStatusesForFormType(role.formType)?.has('onboard_completed'));
  }
  assert.equal(formTypeFromSignupHint('ads-specialist'), 'ads_specialist');
  assert.equal(formTypeFromSignupHint('unknown-role'), null);
});

test('each new application accepts both onboarding tracks and requires professional context', () => {
  for (const role of CONTENT_ROLES) {
    assert.equal(createLeadSchema.safeParse({ ...applicant, form_type: role.formType }).success, true);
    assert.equal(createLeadSchema.safeParse({ ...applicant, form_type: role.formType, professional_summary: '' }).success, false);
  }
  assert.equal(createLeadSchema.safeParse({ ...applicant, form_type: 'unconfigured_role' }).success, false);
});

test('business briefs retain role details and reject missing shoot/output/volume requirements', () => {
  for (const role of CONTENT_ROLES) {
    const additional = Object.fromEntries(role.briefFields.map((f) => [f.key, ['A detailed requirement. '.repeat(10)]]));
    const brief = {
      service_types: [role.serviceSlug], brand_name: 'Test Brand', business_nature: 'Services',
      business_note: 'We serve business customers.', languages: ['English'], working_days: ['Mon'],
      role_requirements: { [role.serviceSlug]: { note: 'Produce the agreed work.', additional_requirements: additional } },
    };
    assert.equal(connectBriefSchema.safeParse(brief).success, true);
    assert.equal(connectBriefSchema.safeParse({ ...brief, card_type: 'assignment', working_days: [] }).success, true);
    assert.equal(connectBriefSchema.safeParse({ ...brief, working_days: [] }).success, false);
    for (const field of role.briefFields.filter((f) => f.required)) {
      assert.equal(connectBriefSchema.safeParse({ ...brief, role_requirements: { [role.serviceSlug]: { note: 'Work', additional_requirements: { ...additional, [field.key]: [] } } } }).success, false);
    }
  }
});

test('the category API exposes required fields and active options in the web builder contract', async () => {
  const original = supabaseAdmin.from;
  const query: any = {
    select() { return this; }, eq() { return this; },
    async single() { return { data: { slug: 'copy-content-writer', category_fields: [
      { field_key: 'hidden', is_active: false, sort_order: 0, field_options: [] },
      { field_key: 'professional_summary', is_required: true, is_active: true, sort_order: 20, field_options: [] },
      { field_key: 'specialism', is_required: true, is_active: true, sort_order: 10, field_options: [
        { label: 'Hidden', is_active: false, sort_order: 0 },
        { label: 'Website copy', is_active: true, sort_order: 1 },
      ] },
    ] }, error: null }; },
  };
  try {
    supabaseAdmin.from = (() => query) as typeof supabaseAdmin.from;
    const category = await getCategoryBySlug('copy-content-writer');
    assert.deepEqual(category.fields.map((f: any) => f.field_key), ['specialism', 'professional_summary']);
    assert.deepEqual(category.fields[0].options.map((o: any) => o.label), ['Website copy']);
    assert.equal(category.min_portfolio_items, 3);
    assert.equal(category.portfolio_required, true);

    const videoCat = await getCategoryBySlug('videographer');
    assert.equal(videoCat.min_portfolio_items, 10);
    assert.equal(videoCat.portfolio_required, true);

    const photoCat = await getCategoryBySlug('photographer');
    assert.equal(photoCat.min_portfolio_items, 10);
    assert.equal(photoCat.portfolio_required, true);

    const aiCreatorCat = await getCategoryBySlug('ai-video-image-creator');
    assert.equal(aiCreatorCat.min_portfolio_items, 10);
    assert.equal(aiCreatorCat.portfolio_required, true);
  } finally { supabaseAdmin.from = original; }
});

test('profiles keep validating after an admin turns off an option the talent picked', async () => {
  const { validateFieldData } = await import('../services/talent.service.js');
  const original = supabaseAdmin.from;
  const query: any = {
    select() { return this; },
    eq() { return this; },
    then(resolve: any) {
      return resolve({ data: [
        { field_key: 'specialism', field_label: 'Specialism', field_type: 'select', is_required: true, field_options: [
          { value: 'website', is_active: true }, { value: 'retired', is_active: false },
        ] },
        { field_key: 'formats', field_label: 'Formats', field_type: 'multi_select', is_required: false, field_options: [
          { value: 'blog', is_active: true }, { value: 'press', is_active: false },
        ] },
      ], error: null });
    },
  };
  try {
    supabaseAdmin.from = (() => query) as typeof supabaseAdmin.from;
    const base = { _experience: { years: 2, months: 0 } };
    assert.deepEqual(await validateFieldData('cat', { ...base, specialism: 'retired', formats: ['blog', 'press'] }), []);
    assert.equal((await validateFieldData('cat', { ...base, specialism: 'made-up' })).length, 1);
    assert.equal((await validateFieldData('cat', { ...base, specialism: 'website', formats: ['nope'] })).length, 1);
  } finally { supabaseAdmin.from = original; }
});
