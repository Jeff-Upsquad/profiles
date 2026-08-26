import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z
    .string()
    .default('5000')
    .transform((val) => parseInt(val, 10)),

  // Supabase (required)
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  DB_HOST: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  DATABASE_URL: z.string().optional(),

  // Cloudflare R2 (optional — not everyone will have these initially)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default('squadhire'),
  R2_PUBLIC_URL: z.string().optional(),

  // JWT (for business passwordless auth)
  JWT_SECRET: z.string().default('squadhire-business-jwt-secret-change-in-production'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:5174'),

  // SquadHub integration (inbound webhook + outbound callback for subscription cards).
  // All three are optional at startup — if the inbound secret is unset the webhook
  // endpoint returns 503; if the callback URL is unset outbound deliveries are
  // skipped and logged. This keeps local dev zero-config.
  SQUADHUB_WEBHOOK_SECRET: z.string().min(32).optional(),
  SQUADHUB_CALLBACK_URL: z.string().url().optional(),
  SQUADHUB_CALLBACK_SECRET: z.string().min(32).optional(),

  // Base origin of the SquadHub server API, used for "Sign in with SquadHub" SSO
  // (one-time code exchange + staff directory). Optional — when unset we derive
  // it from SQUADHUB_CALLBACK_URL's origin, so most deploys need not set it.
  // The server-to-server calls reuse SQUADHUB_CALLBACK_SECRET for signing.
  SQUADHUB_API_URL: z.string().url().optional(),

  // Public origin of the SquadHub WEB app (not its API), used to build the
  // auto-login hand-off link the business tab sends the browser to. Defaults to
  // production; override for staging/local.
  SQUADHUB_WEB_URL: z.string().url().default('https://squadhub.in'),

  // Jobs module: SquadHub's SINGLE inbound events endpoint (cross-repo
  // contract) — every outbound job event (candidate applied, interview
  // lifecycle, offers, hire, Q&A) posts one envelope here, signed with
  // SQUADHUB_CALLBACK_SECRET. Optional — when unset, events queue up in
  // squadhub_event_outbox and the sweeper delivers them once configured.
  SQUADHUB_JOBS_EVENTS_URL: z.string().url().optional(),

  // Assignments module: SquadHub's inbound endpoint for assignment offer /
  // counter-offer events (separate from the jobs events URL so a card event can
  // never be delivered to the jobs endpoint). Posts one envelope per event,
  // signed with SQUADHUB_CALLBACK_SECRET. Optional — when unset, events queue in
  // card_event_outbox and the sweeper delivers them once configured. Points at
  // `${SquadHub}/integrations/squadhire/cards/offer-events`.
  SQUADHUB_CARD_EVENTS_URL: z.string().url().optional(),

  // Jobs module: explicit override for the offer-letter template pull
  // (templates are canonical on SquadHub). Optional — when unset we derive
  // `${SQUADHUB_API_URL | callback origin}/integrations/squadhire/jobs/offer-template`,
  // same fallback idiom as the SSO base URL.
  SQUADHUB_OFFER_TEMPLATE_URL: z.string().url().optional(),

  // Identity stamped as the author of candidate writes (status changes, notes)
  // that originate from SquadHub's Candidates mini app via the signed
  // /api/integrations/squadhub/candidates/* surface. lead_notes.created_by is
  // NOT NULL, so this must be a valid uuid for note writes to succeed — when
  // unset, candidate note/status writes return 503. The acting SquadHub user's
  // email arrives in the X-SquadHub-Actor header and is logged for traceability.
  SQUADHUB_SERVICE_USER_ID: z.string().uuid().optional(),

  // SquadHire CRM (shcrm) → Profiles inbound: shared secret used to verify the
  // X-SquadCRM-Signature header when the CRM pushes lead-stage changes back
  // here. Optional — when unset, /webhooks/squadcrm/lead-stage returns 503.
  SQUADCRM_INBOUND_SECRET: z.string().min(32).optional(),

  // Original Squad CRM (crm.squadhub.in) → Profiles inbound: shared secret for
  // POST /integrations/squadcrm/business/provision, called when a deal enters
  // the "Give SQUADHire Access" stage. Distinct from SQUADCRM_INBOUND_SECRET so
  // the two CRMs don't share a secret. Optional — unset → provision route 503s.
  // Same secret is sent as X-SquadCRM-Signature on the reverse email-backfill
  // call to Squad CRM after business signup.
  SQUADCRM_PROVISION_SECRET: z.string().min(32).optional(),

  // Original Squad CRM API origin (no trailing slash), e.g.
  // https://crm-api.squadhub.in. Used after business signup to backfill the
  // real email onto phone-only CRM contacts / Hub submissions. Optional —
  // when unset, signup still succeeds and only local Profiles rows update.
  SQUADCRM_API_URL: z.string().url().optional(),

  // Profiles → SquadHire CRM: outbound URL for system-event notifications
  // (e.g. talent_subscription_card_received → CRM picks the WhatsApp template
  // and sends via Meta). Optional — when unset, the talent-WhatsApp pipeline
  // is silently disabled.
  SQUADHIRE_CRM_SYSTEM_EVENTS_URL: z.string().url().optional(),

  // SquadHire CRM API origin (no trailing slash), e.g. https://shcrm-api.squadhub.in.
  // Used to stamp talent names onto matched CRM leads after signup / account
  // settings. When unset, derived from SQUADHIRE_CRM_SYSTEM_EVENTS_URL's origin.
  SQUADHIRE_CRM_API_URL: z.string().url().optional(),

  // Profiles → original Squad CRM: outbound URL for BUSINESS system-event
  // notifications (e.g. business login/password verification codes). Business
  // codes route here (talent codes stay on SQUADHIRE_CRM_SYSTEM_EVENTS_URL);
  // authenticated with SQUADCRM_PROVISION_SECRET via X-SquadCRM-Signature.
  // Optional — when unset, business events fall back to the SquadHire CRM URL.
  SQUADCRM_SYSTEM_EVENTS_URL: z.string().url().optional(),

  // Notify talents when a card is *ingested* (created/edited/synced via the
  // SquadHub webhook), not just when it's explicitly broadcast. Default false:
  // ingest silently syncs the card + reconciles recipient rows (so it still
  // appears in talent queues), but WhatsApp/push fire only on an explicit
  // broadcast (fanOutBroadcast / manual assignment). Set to 'true' to restore
  // the old "ingest also notifies" behaviour.
  NOTIFY_TALENT_ON_INGEST: z
    .string()
    .default('false')
    .transform((val) => val === 'true' || val === '1'),

  // Public origin of the SquadHire admin app (Next.js). Used to build
  // talent-profile / user URLs returned by /api/integrations/squadcrm/talents
  // /lookup-by-phone so the CRM can deep-link operators into admin. Should
  // NOT include a trailing slash. Optional — when unset, the lookup endpoint
  // omits admin_url so the CRM falls back to its "no profile" UI.
  SQUADHIRE_ADMIN_URL: z.string().url().optional(),

  // upsquad website — admin API for subscription requests (optional)
  UPSQUAD_API_URL: z.string().url().optional(),
  UPSQUAD_API_TOKEN: z.string().optional(),

  // ─── Card payments (business pays for the talent it selected) ──────────
  // Razorpay lives on THIS side: SquadHire mints the payment link, hosts the
  // webhook, and only once the money has landed does it ask SquadBooks to raise
  // the invoice. All optional — when the keys are unset the "Make Payment"
  // endpoints return 503 and the UI hides the section, so local dev is
  // zero-config. Use TEST keys everywhere except production.
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  // Must match the secret on the Razorpay dashboard webhook that points at
  // POST /api/webhooks/razorpay. Without it the webhook fails closed (401).
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // Cashfree Payment Links — the alternative gateway. Which one actually
  // collects a payment is NOT decided here: every mint asks SQUADbooks for the
  // org's Payment Gateway setting and routes Razorpay while that is enabled,
  // Cashfree otherwise. These keys (same account SQUADbooks uses) only need to
  // be present when that answer is Cashfree.
  CASHFREE_APP_ID: z.string().optional(),
  CASHFREE_SECRET_KEY: z.string().optional(),
  // 'live' (default) or 'sandbox'.
  CASHFREE_ENV: z.string().optional(),
  // Pins the Cashfree API version header; defaults to '2023-08-01'.
  CASHFREE_API_VERSION: z.string().optional(),

  // SquadBooks (books.squadhub.in) — where the invoice is raised once a card
  // payment succeeds. On the shared `squadhub` Docker network prefer the
  // internal container origin (http://squadbooks:3000). The key must equal
  // SQUADBOOKS_ADMIN_API_KEY in SquadBooks' own env.
  SQUADBOOKS_API_URL: z.string().url().optional(),
  SQUADBOOKS_ADMIN_API_KEY: z.string().optional(),
  // The SquadBooks workspace that issues these invoices (the UpSquad org).
  SQUADBOOKS_ORG_ID: z.string().uuid().optional(),
  // Letterhead name stamped on the generated invoice. Optional — SquadBooks
  // falls back to the org's own last-used name.
  SQUADBOOKS_ORG_NAME: z.string().optional(),

  // Public origin of the business web app, used to build the Razorpay
  // callback_url the client returns to after paying. Falls back to the first
  // CORS_ORIGIN entry when unset.
  BUSINESS_APP_URL: z.string().url().optional(),

  // Firebase Cloud Messaging (push notifications for talent app)
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),

  // Talent app distribution
  TALENT_APP_MIN_VERSION: z.string().default('1.0.0'),
  TALENT_APP_DOWNLOAD_URL: z.string().optional(),

  // In-app updater manifests (served by GET /api/talent-app/version and
  // /api/admin-lite/version). Optional path overrides — when unset the backend
  // reads the committed defaults in backend/ (talent-app-release-manifest.json,
  // admin-lite-release-manifest.json). In production point these at the host
  // files the release scripts write, e.g. /var/www/talent-app-downloads/version.json
  // and /var/www/admin-lite-downloads/version.json.
  TALENT_APP_MANIFEST_PATH: z.string().optional(),
  ADMIN_LITE_MANIFEST_PATH: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
