import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as integrationsService from '../services/integrations.service.js';
import * as talentAccessService from '../services/talent-access.service.js';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

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
    const talents = await integrationsService.searchActiveTalents(q);
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
