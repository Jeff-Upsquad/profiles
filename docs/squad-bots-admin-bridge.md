# Squad Bots admin bridge

Squadbots (Squad Bots, `bots.squadhub.in`) can work in the admin onboarding and
exception modules for a signed-in administrator. Mounted at
`/api/integrations/squad-bots-admin` (`backend/src/routes/squad-bots-admin.routes.ts`).

- **Auth:** HMAC-SHA256 over `time\nnonce\nactor-email\nMETHOD\npath+query\nJSON body`
  with `SQUAD_BOTS_ADMIN_SECRET` (same value as Squad Bots' `SQUAD_HIRE_ADMIN_SECRET`).
  ±5 min clock window; nonces are single-use. Unset secret → 503.
- **Actor:** the signed email must be a full admin (`app_metadata.role = admin`) or an
  active staff user. Staff need the module grant: `approvals` (onboarding, rejected,
  cancelled, stages) or `talents` (blocked users); `view` to read, `edit` to act.
  Actions are recorded as that admin, exactly like the admin UI.
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
