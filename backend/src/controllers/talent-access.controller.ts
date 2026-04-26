import { Request, Response, NextFunction } from 'express';
import * as service from '../services/talent-access.service.js';
import {
  notifySquadhubGrantUpsert,
  notifySquadhubGrantDelete,
} from '../services/squadhub-grants-callback.service.js';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import type {
  CreateGrantInput,
  UpdateGrantInput,
  ExtendGrantInput,
  ListGrantsQuery,
  LoginInput,
  ProfilesQuery,
  FilterOptionsQuery,
} from '../validators/talent-access.validators.js';

/**
 * Build the SquadHub callback payload for a freshly-fetched grant. Returns
 * null when the grant was originated FROM SquadHub (i.e. it has a
 * squadhub_grant_id) — in that case the SquadHub side already knows about
 * the change and notifying back would echo a redundant write.
 *
 * Important: the SquadHub callback endpoint upserts on profiles_grant_id,
 * so we send the Profiles row id as `profiles_grant_id` regardless of how
 * the row was originated.
 */
async function buildSquadhubGrantPayload(
  profilesGrantId: string,
  action: 'create' | 'update' | 'revoke',
) {
  const { data: row } = await supabaseAdmin
    .from('talent_access_grants')
    .select(
      'id, email, expires_at, revoked_at, notes, squadhub_grant_id, created_by_squadhub_user_id',
    )
    .eq('id', profilesGrantId)
    .maybeSingle();
  if (!row) return null;
  // Skip the round-trip echo when SquadHub originated the change. SquadHub's
  // own outbound webhook is the canonical write path for these rows.
  if ((row as any).squadhub_grant_id) return null;

  const { data: cats } = await supabaseAdmin
    .from('talent_access_grant_categories')
    .select('category_id')
    .eq('grant_id', profilesGrantId);
  const categoryIds = (cats ?? []).map((c: any) => c.category_id as string);

  return {
    profiles_grant_id: (row as any).id as string,
    email: (row as any).email as string,
    category_ids: categoryIds,
    expires_at: (row as any).expires_at as string,
    revoked_at: ((row as any).revoked_at as string | null) ?? null,
    notes: ((row as any).notes as string | null) ?? null,
    created_by_squadhub_user_id:
      ((row as any).created_by_squadhub_user_id as string | null) ?? null,
    action,
  };
}

// ---------------------------------------------------------------------------
// Admin: grant management
// ---------------------------------------------------------------------------

export async function createGrant(req: Request, res: Response, next: NextFunction) {
  try {
    const adminId = req.user?.id;
    if (!adminId) throw new AppError(401, 'Unauthenticated');
    const result = await service.createGrant(req.body as CreateGrantInput, adminId);
    const payload = await buildSquadhubGrantPayload((result as any).id, 'create');
    if (payload) notifySquadhubGrantUpsert(payload).catch(() => {});
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listGrants(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listGrants(req.query as unknown as ListGrantsQuery);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getGrant(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getGrant(req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateGrant(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const result = await service.updateGrant(id, req.body as UpdateGrantInput);
    const payload = await buildSquadhubGrantPayload(id, 'update');
    if (payload) notifySquadhubGrantUpsert(payload).catch(() => {});
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function revokeGrant(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const result = await service.revokeGrant(id);
    const payload = await buildSquadhubGrantPayload(id, 'revoke');
    if (payload) notifySquadhubGrantUpsert(payload).catch(() => {});
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function extendGrant(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const result = await service.extendGrant(id, req.body as ExtendGrantInput);
    const payload = await buildSquadhubGrantPayload(id, 'update');
    if (payload) notifySquadhubGrantUpsert(payload).catch(() => {});
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteGrant(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    // Capture the squadhub_grant_id BEFORE deleting so we know whether to
    // notify (only when the row was NOT originated from SquadHub — that
    // side already knows about the delete via its own outbound path).
    const { data: row } = await supabaseAdmin
      .from('talent_access_grants')
      .select('squadhub_grant_id')
      .eq('id', id)
      .maybeSingle();
    await service.deleteGrant(id);
    if (row && !(row as any).squadhub_grant_id) {
      notifySquadhubGrantDelete(id).catch(() => {});
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Public: login + browse
// ---------------------------------------------------------------------------

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body as LoginInput;
    const result = await service.login(email);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.talentAccess) throw new AppError(401, 'Unauthenticated');
    const result = await service.getSessionInfo(req.talentAccess);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listProfiles(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.talentAccess) throw new AppError(401, 'Unauthenticated');
    const result = await service.listProfiles(
      req.talentAccess,
      req.query as unknown as ProfilesQuery,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.talentAccess) throw new AppError(401, 'Unauthenticated');
    const result = await service.getProfile(req.talentAccess, req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getFilterOptions(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.talentAccess) throw new AppError(401, 'Unauthenticated');
    const { category_id } = req.query as unknown as FilterOptionsQuery;
    const result = await service.getFilterOptions(req.talentAccess, category_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
