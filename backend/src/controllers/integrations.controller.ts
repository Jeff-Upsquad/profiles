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
