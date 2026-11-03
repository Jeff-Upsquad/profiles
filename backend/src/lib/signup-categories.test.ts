import test from 'node:test';
import assert from 'node:assert/strict';
import { signupTalentSchema, checkCandidateStatusSchema } from '../validators/auth.validators.js';
import { signupFormTypes } from '../../../shared/src/signupCategories.js';

const account = { email: 'talent@example.com', password: 'test-password', phone: '+919876543210', otp: { challenge_id: '12345678-1234-4234-8234-123456789012', code: '123456' }, full_name: 'Test Talent' };
test('signup keeps distinct roles while mapping creative roles to the shared pipeline', () => {
  const selected = ['designer', 'video-editor', 'accountant'];
  assert.deepEqual(signupTalentSchema.parse({ ...account, signup_categories: selected }).signup_categories, selected);
  assert.deepEqual(signupFormTypes(selected), ['creative', 'accountant']);
});
test('signup rejects empty or unknown selections and removes duplicate roles', () => {
  for (const categories of [[], ['unknown'], ['designer', 'unknown']]) {
    assert.equal(signupTalentSchema.safeParse({ ...account, signup_categories: categories }).success, false);
  }
  assert.deepEqual(signupTalentSchema.parse({ ...account, signup_categories: ['accountant', 'accountant'] }).signup_categories, ['accountant']);
});
test('signup categories remain optional after WhatsApp verification', () => {
  assert.equal(signupTalentSchema.safeParse(account).success, true);
});

test('talent signup requires a phone and a six-digit WhatsApp challenge', () => {
  const { otp, phone, ...unverified } = account;
  assert.equal(signupTalentSchema.safeParse(unverified).success, false);
  assert.equal(signupTalentSchema.safeParse({ ...unverified, phone }).success, false);
  assert.equal(signupTalentSchema.safeParse({ ...account, otp: { ...otp, code: 'abc123' } }).success, false);
  assert.equal(signupTalentSchema.safeParse({ ...account, otp: { ...otp, challenge_id: 'invalid' } }).success, false);
});

test('candidate availability checks still accept email or phone without an OTP', () => {
  assert.equal(checkCandidateStatusSchema.safeParse({ email: 'talent@example.test' }).success, true);
  assert.equal(checkCandidateStatusSchema.safeParse({ phone: '+919876543210' }).success, true);
});
