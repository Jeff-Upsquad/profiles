import assert from 'node:assert/strict';
import test from 'node:test';
import {
  requestChangesHelpPause, stagePauseTransition, cancelAtFor, defaultTrackSettings, normalizeTrackSettings, timedStageOf, timerStatus, timeLeftText, type TimerTalent,
} from './stage-timers.js';

const H = 60 * 60 * 1000;
const T0 = Date.parse('2026-10-01T00:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();

function talent(over: Partial<TimerTalent> = {}): TimerTalent {
  return {
    id: 't1', wants_jobs: true, partner_approval_status: null,
    pipeline_stage: 'applicants', jobs_pipeline_stage: 'application_approved',
    partner_stage_changed_at: null, jobs_stage_changed_at: iso(T0),
    ...over,
  };
}

function on(activatedAt: number) {
  return { ...defaultTrackSettings(), enabled: true, activated_at: iso(activatedAt) };
}

test('an applicant stage runs out after its limit', () => {
  const s = on(T0 - 10 * H);
  // application_approved: 24 hours, applicant.
  assert.equal(timerStatus(talent(), 'jobs', s, T0 + 23 * H)?.overdue, false);
  const st = timerStatus(talent(), 'jobs', s, T0 + 24 * H)!;
  assert.equal(st.overdue, true);
  assert.equal(st.actor, 'applicant');
  assert.equal(st.limit_text, '24 hours');
});

test('switching the module on never times out people already waiting', () => {
  const s = on(T0 + 100 * H);
  assert.equal(timerStatus(talent(), 'jobs', s, T0 + 101 * H)?.overdue, false);
  assert.equal(timerStatus(talent(), 'jobs', s, T0 + 124 * H)?.overdue, true);
});

test('reactivation restarts the clock', () => {
  const s = on(T0 - H);
  const t = talent({ stage_timer_state: { reset: { jobs: iso(T0 + 30 * H) } } });
  assert.equal(timerStatus(t, 'jobs', s, T0 + 40 * H)?.overdue, false);
});

test('disabled module, disabled stage, rejected or cancelled tracks are not timed', () => {
  assert.equal(timerStatus(talent(), 'jobs', defaultTrackSettings(), T0 + 99 * H), null);
  const s = on(T0 - H);
  s.stages.application_approved.enabled = false;
  assert.equal(timerStatus(talent(), 'jobs', s, T0 + 99 * H), null);
  assert.equal(timerStatus(talent({ jobs_pipeline_stage: 'rejected' }), 'jobs', on(T0), T0 + 99 * H), null);
  assert.equal(timerStatus(talent({ application_cancellations: { jobs: {} } }), 'jobs', on(T0), T0 + 99 * H), null);
  assert.equal(timerStatus(talent({ jobs_pipeline_stage: 'live' }), 'jobs', on(T0), T0 + 99 * H), null);
});

test('a pending Partner application waits on the admin whatever its linked stage', () => {
  const t = talent({ partner_approval_status: 'pending', pipeline_stage: 'basic_profile' });
  assert.equal(timedStageOf(t, 'partner'), 'applicants');
  assert.equal(timerStatus(t, 'partner', on(T0), T0 + 25 * H)?.actor, 'admin');
});

test('settings are clamped and filled from defaults', () => {
  const s = normalizeTrackSettings({ enabled: true, stages: { basic_profile: { amount: 999, unit: 'days', actor: 'nobody' } } });
  assert.equal(s.stages.basic_profile.amount, 90);
  assert.equal(s.stages.basic_profile.actor, 'applicant');
  assert.equal(s.stages.final_review.actor, 'admin');
});

test('cancel time follows the inactive stage and reads as time left', () => {
  const s = on(T0);
  s.stages.basic_profile.cancel_after_days = 5;
  assert.equal(cancelAtFor({ at: iso(T0), stage: 'basic_profile', by: 'system' }, s), iso(T0 + 120 * H));
  assert.equal(timeLeftText(iso(T0 + 30 * H), T0), '2 days');
  assert.equal(timeLeftText(iso(T0 + 90 * 60 * 1000), T0), '2 hours');
});

const help = [{ bot_name: 'Tina', reason: 'Please verify this document', since: iso(T0) }];
test('Needs You pauses both tracks including overdue applicant stages', () => {
  const result = stagePauseTransition({}, help, false, T0 + 100 * H);
  assert.equal(result.paused, true);
  assert.equal(result.needsYouCleared, false);
  const t = talent({ partner_approval_status: 'approved', pipeline_stage: 'basic_profile',
    stage_timer_state: result.state });
  assert.equal(timerStatus(t, 'jobs', on(T0), T0 + 100 * H), null);
  assert.equal(timerStatus(t, 'partner', on(T0), T0 + 100 * H), null);
});
test('clearing Needs You grants full current-stage time to both tracks', () => {
  const now = T0 + 100 * H;
  const result = stagePauseTransition({ needs_you: help, reset: { jobs: iso(T0) } }, [], false, now);
  assert.equal(result.paused, false);
  assert.equal(result.needsYouCleared, true);
  assert.deepEqual(result.state.reset, { jobs: iso(now), partner: iso(now) });
  const t = talent({ stage_timer_state: result.state });
  assert.equal(timerStatus(t, 'jobs', on(T0), now + 23 * H)?.overdue, false);
  assert.equal(timerStatus(t, 'jobs', on(T0), now + 24 * H)?.overdue, true);
});
test('another bot question keeps the pause, without repeatedly resetting clocks', () => {
  const remaining = [{ ...help[0], bot_name: 'John', reason: 'Please check their account' }];
  const result = stagePauseTransition({ needs_you: help }, remaining, false, T0);
  assert.equal(result.paused, true);
  assert.equal(result.needsYouCleared, false);
  assert.equal(result.state.reset, undefined);
  assert.equal(stagePauseTransition(result.state, remaining, false, T0 + H).changed, false);
});
test('clearing either pause does not bypass a remaining request-changes or Needs You pause', () => {
  const a = stagePauseTransition({ needs_you: help, rc_paused: true }, [], true, T0);
  assert.equal(a.paused, true);
  const b = stagePauseTransition(a.state, [], false, T0 + H);
  assert.equal(b.paused, false);
  assert.equal(b.state.reset?.jobs, iso(T0 + H));
  assert.equal(stagePauseTransition({ rc_paused: true }, help, false, T0).paused, true);
});

test('profile-change cancellation stays paused, then starts a fresh reminder sequence', () => {
  const original = { needs_you: help, reset: { partner: iso(T0) } };
  const paused = requestChangesHelpPause(original, true, iso(T0), T0 + 100 * H)!;
  assert.equal(paused.stage_timer_state.rc_needs_you_paused, true);
  assert.equal(paused.rc_last_sent_at, undefined);
  const cleared = requestChangesHelpPause(paused.stage_timer_state, false, iso(T0), T0 + 200 * H)!;
  assert.equal(cleared.rc_reminders_sent, 0);
  assert.equal(cleared.rc_last_sent_at, iso(T0 + 200 * H));
  assert.equal(cleared.stage_timer_state.reset?.partner, iso(T0));
  assert.equal(cleared.stage_timer_state.rc_needs_you_paused, false);
  assert.equal(requestChangesHelpPause(cleared.stage_timer_state, false, iso(T0), T0 + 201 * H), null);
});
