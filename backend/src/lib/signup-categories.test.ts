import test from 'node:test';
import assert from 'node:assert/strict';
import { signupTalentSchema } from '../validators/auth.validators.js';
import { signupFormTypes } from '../../../shared/src/signupCategories.js';

const account = { email: 'talent@example.com', password: 'test-password', full_name: 'Test Talent' };
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
test('legacy application clients can still omit the new field', () => {
  assert.equal(signupTalentSchema.safeParse(account).success, true);
});
