import assert from 'node:assert/strict';
import test from 'node:test';
import { cancellationChoice, pendingCancellation } from './applicant-cancellation.js';
import { isLinked, isCatchUp } from './linked-tracks.js';

test('accepts the three explicit choices, including authenticated button payloads', () => {
  assert.equal(cancellationChoice('Partner Program'), 'partner');
  assert.equal(cancellationChoice('Jobs'), 'jobs');
  assert.equal(cancellationChoice('Both'), 'both');
  assert.equal(cancellationChoice('localized button label', 'cancel_application:jobs'), 'jobs');
});
test('ambiguous or unrelated replies never become a cancellation selection', () => {
  for (const text of ['yes', 'no', 'not interested', 'I want both opportunities', 'both?', 'stop', '']) assert.equal(cancellationChoice(text), null);
  assert.equal(cancellationChoice('Both', 'unrelated:both'), null);
});
test('a scope selection requires a recent pending question', () => {
  const now = Date.parse('2026-09-28T12:00:00Z');
  assert.equal(pendingCancellation(null, now), false);
  assert.equal(pendingCancellation('invalid', now), false);
  assert.equal(pendingCancellation('2026-09-29T00:00:00Z', now), false);
  assert.equal(pendingCancellation('2026-09-27T12:00:00Z', now), false);
  assert.equal(pendingCancellation('2026-09-28T11:59:00Z', now), true);
});
test('one cancelled track cannot be mirrored or caught up from the other track', () => {
  const t = { wants_jobs: true, partner_approval_status: 'approved', pipeline_stage: 'basic_profile', jobs_pipeline_stage: 'basic_profile' };
  for (const track of ['partner', 'jobs']) {
    const application_cancellations = { [track]: { reason: 'not_interested' } };
    assert.equal(isLinked({ ...t, tracks_linked: true, application_cancellations }), false);
    assert.equal(isCatchUp({ ...t, tracks_linked: false, application_cancellations }), false);
  }
});
