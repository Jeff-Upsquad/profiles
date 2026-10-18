import assert from 'node:assert/strict';
import test from 'node:test';
import { REMAINING_ROLES, TALENT_CATEGORY_OPTIONS } from '../../../shared/src/contentRoles.js';
import { categoryHasPortfolio, formTypeHasPortfolio } from '../../../shared/src/portfolio.js';
import { createLeadSchema } from '../validators/lead.validators.js';
import { connectBriefSchema } from '../validators/connect-brief.validators.js';
import { formTypeFromSignupHint, parseSignupCategory } from './signup-category.js';
import { validStatusesForFormType } from '../services/crm-stage-mapping.js';

const applicant = { name: 'Test Specialist', phone: '+919000000099', email: 'specialist@example.test', age: 30, gender: 'other', country: 'India', state: 'Kerala', current_district: 'Ernakulam', experience_years: '5', professional_summary: 'I deliver specialist services with documented processes and measurable outcomes.' };

test('all remaining website categories keep their role through signup and both work tracks', () => {
  assert.equal(REMAINING_ROLES.length, 20);
  assert.equal(new Set(REMAINING_ROLES.map((r) => r.id)).size, 20);
  for (const role of REMAINING_ROLES) {
    assert.equal(formTypeFromSignupHint(`/partner-program/${role.slug}`), role.formType);
    assert.equal(parseSignupCategory(role.formType), role.formType);
    assert.ok(TALENT_CATEGORY_OPTIONS.some((c) => c.value === role.formType));
    for (const track of ['Job', 'UpSquad Partner Program']) {
      const input = { ...applicant, form_type: role.formType, work_type_seeking: [track], ...(role.portfolio ? { portfolio_link: 'https://example.test/work' } : {}) };
      assert.equal(createLeadSchema.safeParse(input).success, true, role.slug);
      assert.equal(createLeadSchema.safeParse({ ...input, professional_summary: '' }).success, false, role.slug);
      assert.equal(createLeadSchema.safeParse({ ...input, portfolio_link: '' }).success, !role.portfolio, role.slug);
    }
    assert.equal(categoryHasPortfolio(role.slug), role.portfolio);
    assert.equal(formTypeHasPortfolio(role.formType), role.portfolio);
    assert.equal(validStatusesForFormType(role.formType)?.has('portfolio_updation'), role.portfolio);
  }
});

test('subscription and assignment briefs require each specialist scope and retain it', () => {
  for (const role of REMAINING_ROLES) {
    const details = Object.fromEntries(role.briefFields.map((f) => [f.key, [`Detailed ${f.label}`]]));
    for (const card_type of ['subscription', 'assignment']) {
      const brief = { card_type, service_types: [role.serviceSlug], brand_name: 'Example business', business_nature: 'Services', business_note: 'We serve business customers.', languages: ['English'], working_days: card_type === 'subscription' ? ['Mon'] : [], role_requirements: { [role.serviceSlug]: { note: 'Help us deliver these specialist outcomes.', additional_requirements: details } } };
      const parsed = connectBriefSchema.safeParse(brief);
      assert.equal(parsed.success, true, role.slug);
      if (parsed.success) assert.deepEqual(parsed.data.role_requirements?.[role.serviceSlug]?.additional_requirements, details);
      for (const field of role.briefFields) {
        assert.equal(connectBriefSchema.safeParse({ ...brief, role_requirements: { [role.serviceSlug]: { note: 'Scope', additional_requirements: { ...details, [field.key]: [] } } } }).success, false, `${role.slug}/${field.key}`);
      }
    }
  }
});
