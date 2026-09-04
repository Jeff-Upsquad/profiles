import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as integrationsService from '../services/integrations.service.js';
import * as talentAccessService from '../services/talent-access.service.js';
import * as businessProvisionService from '../services/business-provision.service.js';
import * as businessAuthService from '../services/business-auth.service.js';
import * as authService from '../services/auth.service.js';
import * as squadhubBusinessSsoService from '../services/squadhub-business-sso.service.js';
import * as squadhubTalentSsoService from '../services/squadhub-talent-sso.service.js';
import * as subscriptionService from '../services/subscription.service.js';
import * as jobsService from '../services/jobs.service.js';
import * as assignmentOffersService from '../services/assignment-offers.service.js';
import {
  ingestPendingBriefSchema,
  squadcrmRoomGetSchema,
  squadcrmRoomSendSchema,
  squadcrmRoomsListSchema,
} from '../validators/subscription.validators.js';
import * as squadcrmRooms from '../services/squadcrm-rooms.service.js';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

const provisionBusinessSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().trim().min(3).optional(),
    company_name: z.string().max(300).optional(),
    contact_person_name: z.string().max(200).optional(),
    expires_at: z.string().datetime().optional(),
  })
  .refine((v) => !!v.email || !!v.phone, {
    message: 'Email or phone is required',
    path: ['email'],
  });

// Squad CRM → provision (or refresh) a business user when a deal enters the
// "Give SQUADHire Access" stage. Idempotent; sends no notification.
export async function provisionBusinessUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = provisionBusinessSchema.parse(req.body);
    const result = await businessProvisionService.provisionBusinessUser(body);
    res.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.errors[0]?.message ?? 'Invalid request'));
      return;
    }
    next(err);
  }
}

// Squad CRM → ingest a pending brief so the business portal shows the card
// as "Submitted / Awaiting team review" before SquadHub publishes it.
// No talent fan-out. Same provision secret as /business/provision.
export async function ingestPendingBrief(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = ingestPendingBriefSchema.parse(req.body);
    const result = await subscriptionService.ingestPendingBrief(body);
    res.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.errors[0]?.message ?? 'Invalid request'));
      return;
    }
    next(err);
  }
}

export async function getCategories(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const categories = await integrationsService.listActiveCategories();
    res.json({ categories });
  } catch (err) {
    next(err);
  }
}

export async function searchTalents(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    // Optional card context (comma-separated) so hits come back tagged with
    // their tier and whether it matches the card the admin is assigning for.
    const csv = (v: unknown): string[] =>
      typeof v === 'string' && v.length > 0
        ? v.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
    const talents = await integrationsService.searchActiveTalents(q, {
      categoryIds: csv(req.query.category_ids),
      targetTiers: csv(req.query.target_tiers),
    });
    res.json({ talents });
  } catch (err) {
    next(err);
  }
}

const lookupUsersSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(50),
});

export async function lookupUsersByEmail(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = lookupUsersSchema.parse(req.body);
    const results = await integrationsService.lookupUsersByEmail(body.emails);
    const byEmail: Record<string, { talent_user_id: string; name: string }> = {};
    for (const r of results) {
      byEmail[r.email] = { talent_user_id: r.talent_user_id, name: r.name };
    }
    res.json({ success: true, data: byEmail });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.errors[0].message));
      return;
    }
    next(err);
  }
}

const talentWorkspaceCardsQuerySchema = z.object({
  email: z.string().email(),
  status: z.enum(['pending', 'accepted', 'rejected', 'all']).default('pending'),
  card_type: z.enum(['subscription', 'assignment', 'hiring']).default('subscription'),
});

const talentWorkspaceRespondSchema = z.object({
  email: z.string().email(),
  action: z.enum(['accept', 'reject']),
});

const talentWorkspaceOfferSchema = z.object({
  email: z.string().email(),
  amount: z.record(z.unknown()),
  terms: z.record(z.unknown()).optional(),
  note: z.string().trim().max(2000).optional(),
});

const talentWorkspaceOfferRespondSchema = z.object({
  email: z.string().email(),
  action: z.enum(['accept', 'decline', 'withdraw']),
  note: z.string().trim().max(2000).optional(),
});

async function resolveWorkspaceTalentId(email: string): Promise<string> {
  const matches = await integrationsService.lookupUsersByEmail([email]);
  const match = matches.find((item) => item.email.toLowerCase() === email.toLowerCase());
  if (!match) throw new AppError(404, 'SquadHire talent account not found');
  return match.talent_user_id;
}

/** Canonical talent opportunity feed consumed by SquadHub's Discover surface. */
export async function listSquadhubTalentWorkspaceCards(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = talentWorkspaceCardsQuerySchema.parse(req.query);
    const talentUserId = await resolveWorkspaceTalentId(query.email);

    if (query.card_type !== 'hiring') {
      const items = await subscriptionService.listForTalent(talentUserId, {
        status: query.status,
        card_type: query.card_type,
      });
      res.json({ success: true, items });
      return;
    }

    if (query.status === 'pending') {
      const jobs = await jobsService.listJobsForTalent(talentUserId, 'new');
      res.json({ success: true, items: jobs.map((job) => workspaceJobItem(job, 'pending')) });
      return;
    }

    if (query.status === 'rejected') {
      const jobs = await jobsService.listJobsForTalent(talentUserId, 'rejected');
      res.json({ success: true, items: jobs.map((job) => workspaceJobItem(job, 'rejected')) });
      return;
    }

    const acceptedTabs: jobsService.TalentJobsTab[] = [
      'accepted',
      'shortlisted',
      'call_for_interview',
      'interview',
      'selected',
      'offer',
      'hired',
      'placed',
    ];
    const groups = await Promise.all(
      acceptedTabs.map((tab) => jobsService.listJobsForTalent(talentUserId, tab)),
    );
    const seen = new Set<string>();
    const items = groups
      .flat()
      .filter((job) => {
        const key = job.recipient_id || job.candidate_id || job.card?.id;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((job) => workspaceJobItem(job, 'accepted'));

    if (query.status === 'all') {
      const [pending, rejected] = await Promise.all([
        jobsService.listJobsForTalent(talentUserId, 'new'),
        jobsService.listJobsForTalent(talentUserId, 'rejected'),
      ]);
      res.json({
        success: true,
        items: [
          ...pending.map((job) => workspaceJobItem(job, 'pending')),
          ...items,
          ...rejected.map((job) => workspaceJobItem(job, 'rejected')),
        ],
      });
      return;
    }

    res.json({ success: true, items });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.errors[0]?.message ?? 'Invalid request'));
      return;
    }
    next(err);
  }
}

/** Apply an accept/decline from SquadHub to the canonical SquadHire recipient. */
export async function respondToSquadhubTalentWorkspaceCard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = talentWorkspaceRespondSchema.parse(req.body);
    const talentUserId = await resolveWorkspaceTalentId(body.email);
    const result = await subscriptionService.respond(
      talentUserId,
      req.params.recipientId as string,
      { action: body.action },
    );
    res.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.errors[0]?.message ?? 'Invalid request'));
      return;
    }
    next(err);
  }
}

/** Live bid / counter-offer state for one canonical SquadHire card recipient. */
export async function getSquadhubTalentWorkspaceOffer(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const email = z.string().email().parse(req.query.email);
    const talentUserId = await resolveWorkspaceTalentId(email);
    const data = await assignmentOffersService.getOfferForTalentRecipient(
      talentUserId,
      req.params.recipientId as string,
    );
    res.json({ success: true, ...data });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.errors[0]?.message ?? 'Invalid request'));
      return;
    }
    next(err);
  }
}

/** Submit a first bid, revise it, or counter a business offer from SquadHub. */
export async function submitSquadhubTalentWorkspaceOffer(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = talentWorkspaceOfferSchema.parse(req.body);
    const talentUserId = await resolveWorkspaceTalentId(body.email);
    const { assertTalentCanRespond } = await import('../services/respond-gate.js');
    await assertTalentCanRespond(talentUserId);
    const offer = await assignmentOffersService.talentSubmitOrCounter(
      talentUserId,
      req.params.recipientId as string,
      { amount: body.amount, terms: body.terms, note: body.note },
    );
    res.json({ success: true, offer });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.errors[0]?.message ?? 'Invalid request'));
      return;
    }
    next(err);
  }
}

/** Accept/decline a business counter-offer or withdraw the talent's own bid. */
export async function respondToSquadhubTalentWorkspaceOffer(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = talentWorkspaceOfferRespondSchema.parse(req.body);
    const talentUserId = await resolveWorkspaceTalentId(body.email);
    const { assertTalentCanRespond } = await import('../services/respond-gate.js');
    await assertTalentCanRespond(talentUserId);
    const offer = await assignmentOffersService.talentRespondToOffer(
      talentUserId,
      req.params.recipientId as string,
      { action: body.action, note: body.note },
    );
    res.json({ success: true, offer });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.errors[0]?.message ?? 'Invalid request'));
      return;
    }
    next(err);
  }
}

function workspaceJobItem(
  job: jobsService.TalentJobFeedItem,
  status: 'pending' | 'accepted' | 'rejected',
) {
  return {
    id: job.recipient_id || job.candidate_id || job.card?.id,
    status,
    responded_at: job.stage_changed_at,
    cancelled_at: null,
    selected_at: status === 'accepted' ? job.stage_changed_at : null,
    passed_over_at: null,
    card: job.card ? { ...job.card, card_type: 'hiring' as const } : null,
  };
}

const talentAvailabilitySchema = z.object({
  talent_user_ids: z.array(z.string().uuid()).min(1).max(50),
});

// SquadHub's Subscription Assignments view calls this to show each talent's
// self-declared "available hours" next to the hours it has committed them to.
// Returns a map keyed by talent_user_id; talents without a basic profile or
// without any virtual office hours are simply absent from the map.
export async function getTalentAvailability(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = talentAvailabilitySchema.parse(req.body);
    const results = await integrationsService.getTalentAvailability(body.talent_user_ids);
    const byId: Record<
      string,
      { virtual_office_hours: Array<{ day?: string; from?: string; to?: string }>; weekly_hours: number }
    > = {};
    for (const r of results) {
      byId[r.talent_user_id] = {
        virtual_office_hours: r.virtual_office_hours,
        weekly_hours: r.weekly_hours,
      };
    }
    res.json({ success: true, data: byId });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.errors[0].message));
      return;
    }
    next(err);
  }
}

const talentStatusSchema = z.object({
  talent_user_ids: z.array(z.string().uuid()).min(1).max(50),
});

// SquadHub calls this to tag former assignees on a subscription card with the
// talent's current SquadHire standing (active / inactive / suspended). Returns
// a map keyed by talent_user_id; unknown ids come back with status_tag
// 'not_found' (present, not omitted) so SquadHub can show "no longer on
// SquadHire" rather than a silent gap.
export async function getTalentStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = talentStatusSchema.parse(req.body);
    const results = await integrationsService.getTalentStatuses(body.talent_user_ids);
    const byId: Record<
      string,
      {
        exists: boolean;
        is_active: boolean;
        suspended: boolean;
        suspended_at: string | null;
        suspended_reason: string | null;
        blacklisted: boolean;
        blacklisted_at: string | null;
        blacklisted_reason: string | null;
        status_tag: integrationsService.TalentStatusTag;
      }
    > = {};
    for (const r of results) {
      byId[r.talent_user_id] = {
        exists: r.exists,
        is_active: r.is_active,
        suspended: r.suspended,
        suspended_at: r.suspended_at,
        suspended_reason: r.suspended_reason,
        blacklisted: r.blacklisted,
        blacklisted_at: r.blacklisted_at,
        blacklisted_reason: r.blacklisted_reason,
        status_tag: r.status_tag,
      };
    }
    res.json({ success: true, data: byId });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.errors[0].message));
      return;
    }
    next(err);
  }
}

const lookupTalentByPhoneSchema = z.object({
  phone_e164: z.string().regex(/^\+[1-9]\d{1,14}$/, 'phone_e164 must be E.164'),
});

// SquadHire CRM (shcrm) calls this when an operator opens a chat / lead
// detail page, so the UI can deep-link into SquadHire admin or surface a
// "no SquadHire profile" badge. Phone-keyed; matches by last-10 digits to
// stay in sync with migration 00034_link_leads_to_talent_users.
export async function lookupTalentByPhone(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = lookupTalentByPhoneSchema.parse(req.body);
    const result = await integrationsService.lookupTalentByPhone(body.phone_e164);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.errors[0].message));
      return;
    }
    next(err);
  }
}

// ============================================================
// SquadHub-originated talent-access grants (webhook ingest).
// SquadHub stores grants locally and POSTs them here so the Profiles admin
// view stays the single source of truth for the talent-facing /talent-access
// flow. The same shared secret middleware that gates /squadhub/categories
// also gates these routes.
// ============================================================

const squadhubGrantCreateSchema = z.object({
  squadhub_grant_id: z.string().uuid(),
  email: z.string().email(),
  category_ids: z.array(z.string().uuid()).min(1),
  expires_at: z.string().datetime(),
  notes: z.string().nullable().optional(),
  created_by_squadhub_user_id: z.string().uuid().nullable().optional(),
});

const squadhubGrantUpdateSchema = z.object({
  squadhub_grant_id: z.string().uuid(),
  email: z.string().email(),
  category_ids: z.array(z.string().uuid()),
  expires_at: z.string().datetime(),
  revoked_at: z.string().datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
  created_by_squadhub_user_id: z.string().uuid().nullable().optional(),
});

export async function createSquadhubGrant(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = squadhubGrantCreateSchema.parse(req.body);
    const grant = await talentAccessService.createGrantFromSquadhub({
      squadhub_grant_id: body.squadhub_grant_id,
      email: body.email,
      category_ids: body.category_ids,
      expires_at: body.expires_at,
      notes: body.notes ?? null,
      created_by_squadhub_user_id: body.created_by_squadhub_user_id ?? null,
    });
    // Echo back the Profiles row id so SquadHub can store it as
    // profiles_grant_id and target it on subsequent PATCH/DELETE calls.
    res.json({ ...grant, profiles_grant_id: (grant as any).id });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.errors[0].message));
      return;
    }
    next(err);
  }
}

export async function updateSquadhubGrant(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const profilesGrantId = (req.params.id as string) ?? '';
    if (!profilesGrantId) {
      throw new AppError(400, 'Missing grant id');
    }
    const body = squadhubGrantUpdateSchema.parse(req.body);

    // Confirm the row belongs to the SquadHub-originated set so a leaked
    // SquadHub secret can only ever update SquadHub's own grants, never
    // overwrite a grant that originated on the Profiles admin side.
    const { data: existing } = await supabaseAdmin
      .from('talent_access_grants')
      .select('squadhub_grant_id')
      .eq('id', profilesGrantId)
      .maybeSingle();
    if (!existing || !(existing as any).squadhub_grant_id) {
      throw new AppError(404, 'Grant not found');
    }

    const grant = await talentAccessService.updateGrantFromSquadhub(profilesGrantId, {
      category_ids: body.category_ids,
      expires_at: body.expires_at,
      revoked_at: body.revoked_at ?? null,
      notes: body.notes ?? null,
      created_by_squadhub_user_id: body.created_by_squadhub_user_id ?? null,
    });
    res.json({ ...grant, profiles_grant_id: (grant as any).id });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.errors[0].message));
      return;
    }
    next(err);
  }
}

export async function deleteSquadhubGrant(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const profilesGrantId = (req.params.id as string) ?? '';
    if (!profilesGrantId) {
      throw new AppError(400, 'Missing grant id');
    }
    // Same guardrail as update: only SquadHub-originated rows may be
    // deleted via the SquadHub webhook.
    const { data: existing } = await supabaseAdmin
      .from('talent_access_grants')
      .select('squadhub_grant_id')
      .eq('id', profilesGrantId)
      .maybeSingle();
    if (!existing || !(existing as any).squadhub_grant_id) {
      // Idempotent — a deleted-on-both-sides row should still 200.
      res.json({ success: true, ignored: 'not_squadhub_originated' });
      return;
    }
    await talentAccessService.deleteGrant(profilesGrantId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

const lookupBusinessUserSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().trim().min(3).optional(),
}).refine((v) => !!v.email || !!v.phone, {
  message: 'Email or phone is required',
  path: ['email'],
});

const verifyBusinessCredentialsSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .strict();

// SquadHub first-login credential seeding — confirm an email + password pair
// really is this business's SquadHire login, so SquadHub can create their
// account with the same password. Returns identity only, never a token; every
// failure mode collapses into { valid: false }. See
// business-auth.service.verifyBusinessCredentials for the security notes.
export async function verifyBusinessCredentials(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = verifyBusinessCredentialsSchema.parse(req.body);
    const result = await businessAuthService.verifyBusinessCredentials(body);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.errors[0]?.message ?? 'Invalid request'));
      return;
    }
    next(err);
  }
}

// Talent twin of business credential verification. SquadHub uses this only
// when an assigned partner first types their SquadHire password in its app.
// The signed response contains identity, never a session or token.
export async function verifyTalentCredentials(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = verifyBusinessCredentialsSchema.parse(req.body);
    const result = await authService.verifyTalentCredentials(body);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.errors[0]?.message ?? 'Invalid request'));
      return;
    }
    next(err);
  }
}

const businessSsoTokenSchema = z.object({ code: z.string().min(1) }).strict();

// SquadHub auto-login — redeem the one-time code the business's browser carried
// over for their identity. Single use: a replayed or expired code is a 400, and
// nothing here is reachable without the shared secret. See
// squadhub-business-sso.service for the flow.
export async function redeemBusinessSsoCode(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = businessSsoTokenSchema.parse(req.body);
    const identity = await squadhubBusinessSsoService.consumeSquadhubLoginCode(body.code);
    if (!identity) {
      next(new AppError(400, 'Invalid, expired, or already-used code'));
      return;
    }
    res.json({ success: true, data: identity });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.errors[0]?.message ?? 'Invalid request'));
      return;
    }
    next(err);
  }
}

// Talent twin of redeemBusinessSsoCode. Separate endpoint, separate table: a
// code minted for a talent is not redeemable as a business and vice versa.
export async function redeemTalentSsoCode(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = businessSsoTokenSchema.parse(req.body);
    const identity = await squadhubTalentSsoService.consumeSquadhubLoginCode(body.code);
    if (!identity) {
      next(new AppError(400, 'Invalid, expired, or already-used code'));
      return;
    }
    res.json({ success: true, data: identity });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.errors[0]?.message ?? 'Invalid request'));
      return;
    }
    next(err);
  }
}

// SquadHub client Connections panel — resolve a business_users row by email
// and/or phone so admins can deep-link into the SquadHire business detail.
export async function lookupBusinessUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = lookupBusinessUserSchema.parse(req.body);
    const result = await integrationsService.lookupBusinessUser(body);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.errors[0]?.message ?? 'Invalid request'));
      return;
    }
    next(err);
  }
}

// ─── Squad CRM chat rooms ───────────────────────────────────────────────────
//
// CRM lists the SquadHire intro rooms that hang off the requirement cards its
// caller owns. It passes those card ids on every call, so scope is decided by
// the side that actually knows who owns a card.

export async function listSquadcrmRooms(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = squadcrmRoomsListSchema.parse(req.body);
    const result = await squadcrmRooms.listRooms(body);
    res.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.errors[0]?.message ?? 'Invalid request'));
      return;
    }
    next(err);
  }
}

export async function getSquadcrmRoom(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = squadcrmRoomGetSchema.parse(req.body);
    const result = await squadcrmRooms.getRoom(body);
    res.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.errors[0]?.message ?? 'Invalid request'));
      return;
    }
    next(err);
  }
}

export async function sendSquadcrmRoomMessage(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = squadcrmRoomSendSchema.parse(req.body);
    const result = await squadcrmRooms.sendRoomMessage(body);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.errors[0]?.message ?? 'Invalid request'));
      return;
    }
    next(err);
  }
}
