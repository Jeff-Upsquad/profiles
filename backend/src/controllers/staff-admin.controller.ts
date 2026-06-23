import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { hashPassword } from '../services/staff-auth.service.js';
import type {
  CreateStaffInput,
  UpdateStaffInput,
  PutGrantsInput,
} from '../validators/staff-admin.validators.js';
import type { ModulePermission } from '../../../shared/src/types/access.js';

const STAFF_FIELDS = 'id, email, name, is_active, created_at, updated_at';

/** Full admins have req.user.role==='admin' and NO req.staff. */
function isFullAdmin(req: Request): boolean {
  return !req.staff;
}

/** Modules a module-admin actor may delegate (those they hold `admin` on). */
function actorAdminModules(req: Request): Set<string> {
  const grants = req.staff?.grants ?? {};
  return new Set(Object.keys(grants).filter((slug) => grants[slug] === 'admin'));
}

function requireFullAdmin(req: Request): void {
  if (!isFullAdmin(req)) {
    throw new AppError(403, 'Only a full admin can manage staff accounts');
  }
}

// ---------------------------------------------------------------------------
// Module registry
// ---------------------------------------------------------------------------

export async function listModules(_req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_modules')
      .select('slug, name, section, sort, is_active')
      .eq('is_active', true)
      .order('sort', { ascending: true });
    if (error) throw new AppError(500, error.message);
    res.json({ modules: data ?? [] });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Staff users
// ---------------------------------------------------------------------------

export async function listStaff(_req: Request, res: Response, next: NextFunction) {
  try {
    const { data: staff, error } = await supabaseAdmin
      .from('staff_users')
      .select(STAFF_FIELDS)
      .order('created_at', { ascending: false });
    if (error) throw new AppError(500, error.message);

    // Attach a compact grant summary so the list can show module counts.
    const { data: grants } = await supabaseAdmin
      .from('staff_module_grants')
      .select('staff_user_id, module_slug, permission, scope');

    const byUser: Record<
      string,
      { module_slug: string; permission: ModulePermission; scope: unknown }[]
    > = {};
    for (const g of grants ?? []) {
      const uid = (g as any).staff_user_id as string;
      (byUser[uid] ||= []).push({
        module_slug: (g as any).module_slug,
        permission: (g as any).permission,
        scope: (g as any).scope ?? null,
      });
    }

    res.json({
      staff: (staff ?? []).map((s: any) => ({ ...s, grants: byUser[s.id] ?? [] })),
    });
  } catch (err) {
    next(err);
  }
}

export async function getStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { data: staff, error } = await supabaseAdmin
      .from('staff_users')
      .select(STAFF_FIELDS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new AppError(500, error.message);
    if (!staff) throw new AppError(404, 'Staff user not found');

    const { data: grants } = await supabaseAdmin
      .from('staff_module_grants')
      .select('module_slug, permission, scope')
      .eq('staff_user_id', id);

    res.json({ staff, grants: grants ?? [] });
  } catch (err) {
    next(err);
  }
}

export async function createStaff(req: Request, res: Response, next: NextFunction) {
  try {
    requireFullAdmin(req);
    const { email, name, password } = req.body as CreateStaffInput;
    const normalizedEmail = email.trim().toLowerCase();

    const { data: existing } = await supabaseAdmin
      .from('staff_users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (existing) throw new AppError(409, 'A staff user with this email already exists');

    const password_hash = await hashPassword(password);
    const { data, error } = await supabaseAdmin
      .from('staff_users')
      .insert({
        email: normalizedEmail,
        name,
        password_hash,
        created_by: req.user?.id ?? null,
      })
      .select(STAFF_FIELDS)
      .single();
    if (error) throw new AppError(500, error.message);

    res.status(201).json({ staff: data });
  } catch (err) {
    next(err);
  }
}

export async function updateStaff(req: Request, res: Response, next: NextFunction) {
  try {
    requireFullAdmin(req);
    const id = req.params.id as string;
    const { name, is_active, password } = req.body as UpdateStaffInput;

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) update.name = name;
    if (is_active !== undefined) update.is_active = is_active;
    if (password !== undefined) update.password_hash = await hashPassword(password);

    const { data, error } = await supabaseAdmin
      .from('staff_users')
      .update(update)
      .eq('id', id)
      .select(STAFF_FIELDS)
      .maybeSingle();
    if (error) throw new AppError(500, error.message);
    if (!data) throw new AppError(404, 'Staff user not found');

    // Deactivating revokes all live sessions immediately.
    if (is_active === false) {
      await supabaseAdmin.from('staff_sessions').delete().eq('staff_user_id', id);
    }

    res.json({ staff: data });
  } catch (err) {
    next(err);
  }
}

export async function deleteStaff(req: Request, res: Response, next: NextFunction) {
  try {
    requireFullAdmin(req);
    const id = req.params.id as string;
    const { error } = await supabaseAdmin.from('staff_users').delete().eq('id', id);
    if (error) throw new AppError(500, error.message);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Grants
// ---------------------------------------------------------------------------

export async function listGrants(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { data, error } = await supabaseAdmin
      .from('staff_module_grants')
      .select('module_slug, permission, scope')
      .eq('staff_user_id', id);
    if (error) throw new AppError(500, error.message);
    res.json({ grants: data ?? [] });
  } catch (err) {
    next(err);
  }
}

/**
 * Replace the staff user's grant set. Full admins set the complete set across
 * all modules. A module-admin may only set grants for modules they themselves
 * hold `admin` on, and their PUT leaves grants for other modules untouched.
 */
export async function putGrants(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { grants } = req.body as PutGrantsInput;

    const { data: target } = await supabaseAdmin
      .from('staff_users')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (!target) throw new AppError(404, 'Staff user not found');

    // Valid module slugs
    const { data: modulesRows } = await supabaseAdmin.from('admin_modules').select('slug');
    const validSlugs = new Set((modulesRows ?? []).map((m: any) => m.slug as string));

    const fullAdmin = isFullAdmin(req);
    const scope = fullAdmin ? null : actorAdminModules(req);

    // Validate every requested slug
    for (const g of grants) {
      if (!validSlugs.has(g.module_slug)) {
        throw new AppError(400, `Unknown module: ${g.module_slug}`);
      }
      if (scope && !scope.has(g.module_slug)) {
        throw new AppError(403, `You can only manage access for modules you administer: ${g.module_slug}`);
      }
    }

    const desired = new Map<string, { permission: ModulePermission; scope: unknown }>();
    for (const g of grants) {
      // Intra-module scope is only meaningful for the candidates module.
      const scopeVal = g.module_slug === 'candidates' ? ((g as any).scope ?? null) : null;
      desired.set(g.module_slug, { permission: g.permission, scope: scopeVal });
    }

    // Determine which existing rows to delete:
    //  - full admin: any module not in the desired set (complete replace)
    //  - module-admin: only modules within their scope that are not in desired
    const { data: existing } = await supabaseAdmin
      .from('staff_module_grants')
      .select('module_slug')
      .eq('staff_user_id', id);

    const toDelete: string[] = [];
    for (const row of existing ?? []) {
      const slug = (row as any).module_slug as string;
      if (desired.has(slug)) continue;
      if (fullAdmin || (scope && scope.has(slug))) toDelete.push(slug);
    }

    if (toDelete.length > 0) {
      const { error: delErr } = await supabaseAdmin
        .from('staff_module_grants')
        .delete()
        .eq('staff_user_id', id)
        .in('module_slug', toDelete);
      if (delErr) throw new AppError(500, delErr.message);
    }

    if (desired.size > 0) {
      const rows = Array.from(desired.entries()).map(([module_slug, v]) => ({
        staff_user_id: id,
        module_slug,
        permission: v.permission,
        scope: v.scope,
        updated_at: new Date().toISOString(),
      }));
      const { error: upErr } = await supabaseAdmin
        .from('staff_module_grants')
        .upsert(rows, { onConflict: 'staff_user_id,module_slug' });
      if (upErr) throw new AppError(500, upErr.message);
    }

    const { data: finalGrants } = await supabaseAdmin
      .from('staff_module_grants')
      .select('module_slug, permission')
      .eq('staff_user_id', id);

    res.json({ grants: finalGrants ?? [] });
  } catch (err) {
    next(err);
  }
}

export async function deleteGrant(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const slug = req.params.slug as string;

    if (!isFullAdmin(req) && !actorAdminModules(req).has(slug)) {
      throw new AppError(403, 'You can only manage access for modules you administer');
    }

    const { error } = await supabaseAdmin
      .from('staff_module_grants')
      .delete()
      .eq('staff_user_id', id)
      .eq('module_slug', slug);
    if (error) throw new AppError(500, error.message);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
