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

  // SquadHire CRM (shcrm) → Profiles inbound: shared secret used to verify the
  // X-SquadCRM-Signature header when the CRM pushes lead-stage changes back
  // here. Optional — when unset, /webhooks/squadcrm/lead-stage returns 503.
  SQUADCRM_INBOUND_SECRET: z.string().min(32).optional(),

  // Profiles → SquadHire CRM: outbound URL for system-event notifications
  // (e.g. talent_subscription_card_received → CRM picks the WhatsApp template
  // and sends via Meta). Optional — when unset, the talent-WhatsApp pipeline
  // is silently disabled.
  SQUADHIRE_CRM_SYSTEM_EVENTS_URL: z.string().url().optional(),

  // upsquad website — admin API for subscription requests (optional)
  UPSQUAD_API_URL: z.string().url().optional(),
  UPSQUAD_API_TOKEN: z.string().optional(),

  // Firebase Cloud Messaging (push notifications for talent app)
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),

  // Talent app distribution
  TALENT_APP_MIN_VERSION: z.string().default('1.0.0'),
  TALENT_APP_DOWNLOAD_URL: z.string().optional(),
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
