import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from './errorHandler.middleware.js';
import { tryValidateStaffToken } from '../services/staff-auth.service.js';
import { resolveModule, levelForMethod } from '../config/moduleRouteMap.js';
import { meetsLevel } from '../../../shared/src/types/access.js';
import type { UserRole } from '../../../shared/src/types/auth.js';

/**
 * Authenticates either a full admin (Supabase user with role='admin') OR a
 * staff user (custom JWT). Talent/business tokens are rejected with 403/401.
 *
 * - Full admin  -> sets req.user (role 'admin'); req.staff stays undefined.
 * - Staff       -> sets req.user (role 'staff') AND req.staff (live grants).
 *
 * Pair with `enforceModuleAccess` to apply per-module gating to staff while
 * letting full admins through.
 */
export async function requireAdminOrStaff(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(401, 'Missing or invalid authorization header');
    }
    const token = authHeader.slice(7);

    // 1) Supabase-authenticated user (talent/business/admin live here)
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);
    if (!error && user) {
      const role = (user.user_metadata?.role as UserRole) ?? 'talent';
      if (role !== 'admin') {
        throw new AppError(403, 'Insufficient permissions');
      }
      req.user = { id: user.id, email: user.email!, role: 'admin' };
      return next();
    }

    // 2) Staff custom JWT
    const session = await tryValidateStaffToken(token);
    if (session) {
      req.staff = session;
      req.user = { id: session.id, email: session.email, role: 'staff' };
      return next();
    }

    throw new AppError(401, 'Invalid or expired token');
  } catch (err) {
    next(err);
  }
}

/**
 * Per-module gate. Resolves the module + required tier for the request and
 * checks the staff user's live grant map. Full admins (no req.staff) bypass.
 */
export function enforceModuleAccess(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  // Full admin — requireAdminOrStaff only reaches here for admin or staff, so
  // the absence of req.staff means a full admin.
  if (!req.staff) return next();

  const grants = req.staff.grants;
  // Normalize to the /api/admin-relative sub-path regardless of whether Express
  // hands us the mount-relative path or the full path.
  const subPath = req.path.replace(/^\/api\/admin/, '') || '/';
  const moduleSlug = resolveModule(subPath);

  // Dashboard is the shared landing — any authenticated staff may read it.
  if (moduleSlug === 'dashboard') return next();

  if (!moduleSlug) {
    return next(new AppError(403, 'Access denied for this resource'));
  }

  // Team & Access management: any user holding `admin` on at least one module
  // may enter; the controller restricts WHICH modules they can grant/revoke.
  if (moduleSlug === 'team-access') {
    const hasAnyAdmin = Object.values(grants).some((g) => g === 'admin');
    if (hasAnyAdmin) return next();
    return next(new AppError(403, 'Access denied: requires admin on a module'));
  }

  const required = levelForMethod(req.method);
  if (meetsLevel(grants[moduleSlug], required)) return next();

  return next(
    new AppError(403, `Access denied: requires '${required}' access on '${moduleSlug}'`),
  );
}
