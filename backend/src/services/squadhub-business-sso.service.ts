import { randomBytes } from 'crypto';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

/**
 * "Open SquadHub" auto-login — SquadHire is the identity provider.
 *
 * The mirror image of squadhub-sso.service.ts (where SquadHub is the IdP for
 * our /staff portal). Same OIDC-lite shape, one-time code with a
 * server-to-server exchange:
 *
 *   1. A signed-in business user opens the SquadHub tab and picks "Log in via
 *      website". The browser hits /api/business/squadhub/sso/authorize with
 *      their SquadHire session; we mint a short-lived, single-use code and hand
 *      back the SquadHub URL to send them to.
 *   2. SquadHub's landing page posts the code to its own server, which calls
 *      POST /api/integrations/squadhub/business/sso/token (shared secret) to
 *      redeem it for the business's identity, then starts their session.
 *
 * Nothing bearer-ish crosses the origin boundary: the code is opaque, useless
 * to anyone without the shared secret, and dies on first use or after two
 * minutes. The business's SquadHire password is never involved — which is the
 * point, since SquadHub already provisioned their account for them.
 */

const CODE_TTL_MS = 120_000; // 2 minutes — long enough for one redirect.

export interface SquadhubBusinessSsoIdentity {
  business_user_id: string;
  email: string;
  name: string | null;
  company_name: string | null;
  phone: string | null;
}

/**
 * Has this business got a live assigned card? Server-side twin of the
 * useHasAssignedCard gate that decides whether the SquadHub tab shows at all —
 * and of SquadHub's own rule, where the client invitation is raised at
 * assignment time. Before that moment there is no SquadHub account to land in.
 */
async function hasAssignedCard(
  businessUserId: string,
  contactEmail: string | null,
): Promise<boolean> {
  // Match the dashboard's ownership rule: owned by id, or carrying this
  // business's email (covers cards ingested before the account existed).
  const orFilter = contactEmail
    ? `business_user_id.eq.${businessUserId},business_email.ilike.${contactEmail}`
    : `business_user_id.eq.${businessUserId}`;

  const { data, error } = await supabaseAdmin
    .from('subscription_cards')
    .select('id')
    .or(orFilter)
    .eq('status', 'assigned')
    .not('subscription_activated_at', 'is', null)
    .is('cancelled_at', null)
    .is('archived_at', null)
    .limit(1);

  if (error) throw new AppError(500, error.message);
  return (data ?? []).length > 0;
}

/**
 * Mint a one-time code and return the SquadHub URL to send the browser to.
 * Throws 403 when the business has no assigned card yet — the same condition
 * that hides the SquadHub tab.
 */
export async function createSquadhubLoginCode(businessUserId: string): Promise<{ redirect: string }> {
  const { data: business, error } = await supabaseAdmin
    .from('business_users')
    .select('id, contact_email, contact_person_name, company_name, contact_phone')
    .eq('id', businessUserId)
    .maybeSingle();

  if (error) throw new AppError(500, error.message);
  if (!business) throw new AppError(404, 'Business account not found');

  const email = ((business.contact_email as string | null) ?? '').trim().toLowerCase();
  if (!email) {
    // SquadHub keys the account off the email; a phone-only business has
    // nothing to sign in as there.
    throw new AppError(400, 'Add an email address to your account to open SquadHub.');
  }

  if (!(await hasAssignedCard(businessUserId, email))) {
    throw new AppError(403, 'SquadHub opens once your first card is assigned.');
  }

  const code = randomBytes(32).toString('base64url');
  const { error: insErr } = await supabaseAdmin.from('squadhub_business_sso_codes').insert({
    code,
    business_user_id: businessUserId,
    email,
    name: (business.contact_person_name as string | null) ?? null,
    company_name: (business.company_name as string | null) ?? null,
    phone: (business.contact_phone as string | null) ?? null,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  if (insErr) throw new AppError(500, insErr.message);

  // Spent and expired codes are dead weight — nothing ever reads them again.
  // Best-effort, off the response path.
  void supabaseAdmin
    .from('squadhub_business_sso_codes')
    .delete()
    .lt('expires_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .then(({ error: sweepErr }) => {
      if (sweepErr) console.error('[squadhub-business-sso] sweep failed', sweepErr);
    });

  const base = env.SQUADHUB_WEB_URL.replace(/\/$/, '');
  return { redirect: `${base}/signin/squadhire?code=${encodeURIComponent(code)}` };
}

/**
 * Redeem a code for the business's identity. Single use: the update only
 * matches an unconsumed, unexpired row, so a replay finds nothing.
 */
export async function consumeSquadhubLoginCode(
  code: string,
): Promise<SquadhubBusinessSsoIdentity | null> {
  const { data: row, error } = await supabaseAdmin
    .from('squadhub_business_sso_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('code', code)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('business_user_id, email, name, company_name, phone')
    .maybeSingle();

  if (error) throw new AppError(500, error.message);
  if (!row) return null;

  return {
    business_user_id: row.business_user_id as string,
    email: row.email as string,
    name: (row.name as string | null) ?? null,
    company_name: (row.company_name as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
  };
}
