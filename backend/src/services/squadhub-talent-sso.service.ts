import { randomBytes } from 'crypto';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

/**
 * "Open SquadHub" auto-login for talents — the twin of
 * squadhub-business-sso.service, with SquadHire again as the identity provider.
 *
 * Same one-time-code shape. What differs is who they become on the other side:
 * a business lands as a client, a talent lands as a partner, and the category
 * of the card they're assigned to picks their role there. So the code carries a
 * category slug alongside the identity.
 *
 * Unlike the business flow, SquadHub has nothing of its own that says a talent
 * may sign in — it never creates accounts for them. The assigned-card gate
 * below is therefore the whole entitlement, which is why it mirrors exactly
 * what the talent's own "My clients" screen counts as an active engagement.
 */

const CODE_TTL_MS = 120_000; // 2 minutes — long enough for one redirect.

export interface SquadhubTalentSsoIdentity {
  talent_user_id: string;
  email: string;
  name: string | null;
  phone: string | null;
  category_slug: string | null;
}

/**
 * The talent's live assigned card, if any, newest first — the server-side twin
 * of listMyClients' `assigned` bucket. Returns the card's category ids so the
 * caller can resolve a role for it.
 */
async function newestAssignedCard(
  talentUserId: string,
): Promise<{ categoryIds: string[] } | null> {
  const { data, error } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select(
      'selected_at, subscription_cards!inner(match_rules, archived_at, subscription_activated_at)',
    )
    .eq('talent_user_id', talentUserId)
    .not('selected_at', 'is', null)
    // A cancelled row is a retired round (recall / fresh broadcast), never a
    // live engagement — same exclusion listMyClients makes.
    .is('cancelled_at', null)
    .is('subscription_cards.archived_at', null)
    .not('subscription_cards.subscription_activated_at', 'is', null)
    .order('selected_at', { ascending: false })
    .limit(1);

  if (error) throw new AppError(500, error.message);

  const row = (data ?? [])[0] as any;
  if (!row) return null;

  const matchRules = row.subscription_cards?.match_rules;
  const raw =
    matchRules && typeof matchRules === 'object'
      ? (matchRules as Record<string, unknown>).category_ids
      : null;
  const categoryIds = Array.isArray(raw)
    ? raw.filter((v): v is string => typeof v === 'string' && v.length > 0)
    : [];

  return { categoryIds };
}

/** First category slug on the card — what SquadHub maps to a role. */
export async function resolveCategorySlug(categoryIds: string[]): Promise<string | null> {
  if (categoryIds.length === 0) return null;
  const { data } = await supabaseAdmin
    .from('categories')
    .select('id, slug')
    .in('id', categoryIds);
  const bySlug = new Map((data ?? []).map((c: any) => [c.id as string, c.slug as string]));
  for (const id of categoryIds) {
    const slug = bySlug.get(id);
    if (slug) return slug;
  }
  return null;
}

/**
 * Mint a one-time code and return the SquadHub URL to send the browser to.
 * Throws 403 when the talent has no assigned card — the same condition that
 * hides the SquadHub tab.
 */
export async function createSquadhubLoginCode(talentUserId: string): Promise<{ redirect: string }> {
  const assigned = await newestAssignedCard(talentUserId);
  if (!assigned) {
    throw new AppError(403, 'SquadHub opens once you are assigned to a client.');
  }

  const [{ data: talent, error }, { data: authUser }] = await Promise.all([
    supabaseAdmin
      .from('talent_users')
      .select('id, full_name, phone')
      .eq('id', talentUserId)
      .maybeSingle(),
    supabaseAdmin.auth.admin.getUserById(talentUserId),
  ]);

  if (error) throw new AppError(500, error.message);
  if (!talent) throw new AppError(404, 'Talent account not found');

  // SquadHub keys the account off the email, and a talent's lives in auth.
  const email = (authUser?.user?.email ?? '').trim().toLowerCase();
  if (!email) {
    throw new AppError(400, 'Add an email address to your account to open SquadHub.');
  }

  const code = randomBytes(32).toString('base64url');
  const { error: insErr } = await supabaseAdmin.from('squadhub_talent_sso_codes').insert({
    code,
    talent_user_id: talentUserId,
    email,
    name: (talent.full_name as string | null) ?? null,
    phone: (talent.phone as string | null) ?? null,
    category_slug: await resolveCategorySlug(assigned.categoryIds),
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  if (insErr) throw new AppError(500, insErr.message);

  // Spent and expired codes are dead weight. Best-effort, off the response path.
  void supabaseAdmin
    .from('squadhub_talent_sso_codes')
    .delete()
    .lt('expires_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .then(({ error: sweepErr }) => {
      if (sweepErr) console.error('[squadhub-talent-sso] sweep failed', sweepErr);
    });

  const base = env.SQUADHUB_WEB_URL.replace(/\/$/, '');
  return { redirect: `${base}/signin/squadhire?as=talent&code=${encodeURIComponent(code)}` };
}

/**
 * Redeem a code for the talent's identity. Single use: the update only matches
 * an unconsumed, unexpired row, so a replay finds nothing.
 */
export async function consumeSquadhubLoginCode(
  code: string,
): Promise<SquadhubTalentSsoIdentity | null> {
  const { data: row, error } = await supabaseAdmin
    .from('squadhub_talent_sso_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('code', code)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('talent_user_id, email, name, phone, category_slug')
    .maybeSingle();

  if (error) throw new AppError(500, error.message);
  if (!row) return null;

  return {
    talent_user_id: row.talent_user_id as string,
    email: row.email as string,
    name: (row.name as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    category_slug: (row.category_slug as string | null) ?? null,
  };
}
