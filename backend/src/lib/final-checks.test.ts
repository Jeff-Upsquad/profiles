import assert from 'node:assert/strict';
import { test } from 'node:test';
import { finalChecksState, FINAL_CHECKS_DELAY_MS } from './final-checks.js';

const entered = '2026-10-27T00:00:00Z';
const due = Date.parse(entered) + FINAL_CHECKS_DELAY_MS;
const talent = { pipeline_stage: 'live', jobs_pipeline_stage: 'live', partner_stage_changed_at: entered,
  jobs_stage_changed_at: '2026-10-27T12:00:00Z', onboarding_webinar_attended_at: null as string | null };

test('Live lasts the full 24 hours, even when both checks are already done', () => {
  const done = { ...talent, onboarding_webinar_attended_at: entered };
  assert.equal(finalChecksState(done, 'partner', true, due - 1), 'live');
  assert.equal(finalChecksState(done, 'partner', true, due), 'completed');
});
test('both app sign-in and attendance are required; registration alone does not count', () => {
  assert.equal(finalChecksState(talent, 'partner', false, due), 'final_checks');
  assert.equal(finalChecksState(talent, 'partner', true, due), 'final_checks');
  assert.equal(finalChecksState({ ...talent, onboarding_webinar_attended_at: entered }, 'partner', false, due), 'final_checks');
  assert.equal(finalChecksState({ ...talent, onboarding_webinar_attended_at: entered }, 'partner', true, due), 'completed');
});
test('each program uses its own Live clock', () => {
  assert.equal(finalChecksState(talent, 'partner', true, due), 'final_checks');
  assert.equal(finalChecksState(talent, 'jobs', true, due), 'live');
});
test('earlier, rejected and legacy No Response stages never become final checks', () => {
  for (const stage of ['application_approved', 'rejected', 'no_response', null]) {
    assert.equal(finalChecksState({ ...talent, pipeline_stage: stage }, 'partner', true, due), null);
  }
});
test('legacy Live rows use approval/creation time, and unknown timestamps do not clear applicants', () => {
  assert.equal(finalChecksState({ pipeline_stage: 'live', approved_at: entered }, 'partner', false, due), 'final_checks');
  assert.equal(finalChecksState({ pipeline_stage: 'live', created_at: entered }, 'partner', false, due), 'final_checks');
  assert.equal(finalChecksState({ pipeline_stage: 'live' }, 'partner', true, due), 'live');
});
