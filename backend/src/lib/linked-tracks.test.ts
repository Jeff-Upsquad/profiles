import assert from 'node:assert/strict';
import test from 'node:test';
import { isCatchUp, isJobsKey, isLinked, JOBS_STAGE_ORDER, nextStageToward } from './linked-tracks.js';

const both = {
  wants_jobs: true, jobs_pipeline_stage: 'basic_profile',
  partner_approval_status: 'approved', pipeline_stage: 'basic_profile',
};

test('applied together at signup is linked; a later second track catches up', () => {
  assert.equal(isLinked({ ...both, tracks_linked: true }), true);
  assert.equal(isCatchUp({ ...both, tracks_linked: true }), false);
  assert.equal(isLinked({ ...both, tracks_linked: false }), false);
  assert.equal(isCatchUp({ ...both, tracks_linked: false }), true);
});

test('linked tracks move together even while Partner approval is pending', () => {
  assert.equal(isLinked({ ...both, tracks_linked: true, partner_approval_status: 'pending' }), true);
});

test('a rejection on either track unlinks them', () => {
  assert.equal(isLinked({ ...both, tracks_linked: true, jobs_pipeline_stage: 'rejected' }), false);
  assert.equal(isLinked({ ...both, tracks_linked: true, partner_approval_status: 'rejected' }), false);
  assert.equal(isLinked({ ...both, tracks_linked: true, pipeline_stage: 'rejected' }), false);
  assert.equal(isCatchUp({ ...both, tracks_linked: false, jobs_pipeline_stage: 'rejected' }), false);
});

test('one track only is neither linked nor catching up', () => {
  assert.equal(isLinked({ ...both, tracks_linked: true, wants_jobs: false }), false);
  assert.equal(isCatchUp({ ...both, partner_approval_status: null }), false);
});

test('catch-up moves exactly one stage toward the finished step', () => {
  assert.equal(nextStageToward(JOBS_STAGE_ORDER, 'application_approved', 'live'), 'onboarding_course');
  assert.equal(nextStageToward(JOBS_STAGE_ORDER, 'final_review', 'live'), 'live');
  assert.equal(nextStageToward(JOBS_STAGE_ORDER, 'live', 'basic_profile'), null);
  assert.equal(nextStageToward(JOBS_STAGE_ORDER, 'basic_profile', 'basic_profile'), null);
  assert.equal(nextStageToward(JOBS_STAGE_ORDER, 'no_response', 'live'), null);
});

test('recognises Jobs board mapping keys', () => {
  assert.equal(isJobsKey('jobs'), true);
  assert.equal(isJobsKey('jobs_creative'), true);
  assert.equal(isJobsKey('creative'), false);
});
