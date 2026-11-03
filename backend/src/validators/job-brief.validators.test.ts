import test from 'node:test';
import assert from 'node:assert/strict';
import { businessProfileDetailsSchema, locationDetailsSchema } from './job-brief.validators.js';

const business = {
  contact_name: 'Contact', contact_email: 'contact@example.com', contact_phone: '+919000000000',
  name: 'Business', about: 'About the business', industry: 'Design', company_size: '11–50',
  website: 'https://example.com', founded_year: 2020,
};
const location = { label: 'Office', address: 'Office address', city: 'Bengaluru', region: 'Karnataka', district: 'Bengaluru Urban' };

test('all contact and business details except the website are mandatory', () => {
  assert.equal(businessProfileDetailsSchema.safeParse(business).success, true);
  for (const key of Object.keys(business)) {
    if (key === 'website') continue;
    const missing: Record<string, unknown> = { ...business }; delete missing[key];
    assert.equal(businessProfileDetailsSchema.safeParse(missing).success, false, key);
    assert.equal(businessProfileDetailsSchema.safeParse({ ...business, [key]: '   ' }).success, false, key);
  }
  assert.equal(businessProfileDetailsSchema.safeParse({ ...business, contact_email: 'invalid' }).success, false);
  assert.equal(businessProfileDetailsSchema.safeParse({ ...business, founded_year: null }).success, false);
});

test('business website is optional but must be a valid URL when present', () => {
  for (const blank of ['', '   ', null, undefined]) {
    const parsed = businessProfileDetailsSchema.safeParse({ ...business, website: blank });
    assert.equal(parsed.success, true, `website ${String(blank)} should be allowed`);
  }
  assert.equal(businessProfileDetailsSchema.safeParse({ ...business, website: 'invalid' }).success, false);
  assert.equal(businessProfileDetailsSchema.parse({ ...business, website: '' }).website, null);
});

test('locations require city, state, and district and retain optional details', () => {
  for (const key of Object.keys(location)) {
    const missing: Record<string, unknown> = { ...location }; delete missing[key];
    assert.equal(locationDetailsSchema.safeParse(missing).success, false, key);
    assert.equal(locationDetailsSchema.safeParse({ ...location, [key]: '   ' }).success, false, key);
  }
  const payload = { ...location, city: ' Bengaluru ', postal_code: '560001', is_primary: true };
  assert.deepEqual(locationDetailsSchema.parse(payload), { ...payload, city: 'Bengaluru' });
  assert.equal(businessProfileDetailsSchema.parse({ ...business, socials: { linkedin: 'https://example.com' } }).socials !== undefined, true);
});
