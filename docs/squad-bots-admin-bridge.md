# Squad Bots admin bridge

Squadbots (Squad Bots, `bots.squadhub.in`) can work in the admin onboarding and
exception modules for a signed-in administrator. Mounted at
`/api/integrations/squad-bots-admin` (`backend/src/routes/squad-bots-admin.routes.ts`).

- **Auth:** HMAC-SHA256 over `time\nnonce\nactor-email\nMETHOD\npath+query\nJSON body`
  with `SQUAD_BOTS_ADMIN_SECRET` (same value as Squad Bots' `SQUAD_HIRE_ADMIN_SECRET`).
  ±5 min clock window; nonces are single-use. Unset secret → 503.
- **Actor:** any Squadbot with the module skill can act. If the signed-in person is a
  full admin or active staff with the module grant (`approvals` for onboarding,
  rejected, cancelled, stages; `talents` for blocked users; `view` to read, `edit` to
  act), the action is recorded as them. Otherwise it runs as the **Squad Bots** staff
  account (`squad-bots@squadhub.in`, approvals + talents edit, no usable password);
  the log line names the person too. Deactivate that staff row to require personal access.
- **Reads:** `GET /queue` (track, view active|rejected|cancelled, search, stage,
  attention, category, page), `GET /talents/:id?track=`, `GET /stages` (funnel,
  per-category portfolio rules, talent boards, rejection reasons), `GET /blocked`.
- **Actions:** `POST /talents/:id/actions` with `op`: approve_partner, reject_partner,
  set_partner_stage, reject_jobs, reinstate_jobs, set_jobs_stage, set_board_stage,
  set_webinar_attended, restore_rejected, restore_cancelled, block_user, unblock_user.
  They call the same `admin.service` / `onboarding-hub.service` functions as the
  admin buttons, so CRM sync and WhatsApp decisions behave identically.

Squad Bots additionally requires the Squadbot's SquadHire admin skill and an explicit
"Run action" from the administrator. Process notes: Squad Bots
`docs/squadhire-admin-modules.md`.
