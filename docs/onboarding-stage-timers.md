# Onboarding timers and Squadbot Needs You

Jobs and Partner Program timers pause together when any connected Squadbot's
conversation for the applicant appears in Needs You. The check uses the same
rule as Squad Bots web/mobile: status `needs_attention`, or an unanswered
backchannel ask while the conversation is not taken over. Taking over a chat
therefore clears Needs You only when its explicit attention status is cleared,
as in Squad Bots itself. Merely changing the bot's on/off switch is not a pause.

The onboarding list and applicant detail panel show each open question's text
and bot name. An explicit attention flag without an open question shows a
fallback explanation. App and WhatsApp chats are matched by their local talent
link; phone-only chats from before signup are also matched using the existing
last-ten-digit phone rule.

While paused, the stage sweep does not mark either application inactive or
cancel an already-inactive application. When the last Needs You is cleared,
both current-stage clocks restart with their full configured time and existing
inactivity is cleared. A remaining request-changes pause still applies. The
separate profile-change reminder/cancellation sequence also pauses during Needs
You and starts a fresh reminder sequence when cleared.

Detection and restart run on the existing sweeps (stage timers every five
minutes; profile-change reminders every ten minutes). Admin reads current
attention state when loading the queue or detail panel. A failed lookup aborts
automatic timeout processing instead of treating an unknown state as cleared;
admin falls back to the last saved reason. Already saved pauses are retained
if the integration configuration is removed.

Deployment: deploy Squad Bots' new authenticated
`POST /conversations/attention` endpoint before the Profiles backend and admin.
No new database migration is needed; pause state uses `stage_timer_state` from
the stage-timers migration. Until the endpoint is available, the Profiles sweeps
fail closed for applicants whose connected conversations need checking.
