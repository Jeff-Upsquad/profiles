import test from 'node:test';
import assert from 'node:assert/strict';
import { onboardingStage } from './onboarding-stage.js';

test('pending Partner approval stays in Applicants despite linked progress', () => {
  const talent = { partner_approval_status: 'pending', pipeline_stage: 'onboarding_course', jobs_pipeline_stage: 'onboarding_course' };
  assert.equal(onboardingStage(talent), 'applicants');
  assert.equal(onboardingStage(talent, 'partner', 'final_checks'), 'applicants');
  assert.equal(onboardingStage(talent, 'jobs'), 'onboarding_course');
  assert.equal(onboardingStage({ ...talent, partner_approval_status: 'approved' }), 'onboarding_course');
  assert.equal(talent.pipeline_stage, 'onboarding_course');
});

test('rejection and approved final checks retain their placement', () => {
  assert.equal(onboardingStage({ partner_approval_status: 'rejected', pipeline_stage: 'onboarding_course' }), 'rejected');
  assert.equal(onboardingStage({ partner_approval_status: 'approved', pipeline_stage: 'live' }, 'partner', 'final_checks'), 'final_checks');
});
