import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import type { ModuleGrants, ModulePermission } from '../../../shared/src/types/access.js';

const SESSION_DURATION_HOURS = 24;
const TOKEN_ROLE = 'staff' as const;
const BCRYPT_ROUNDS = 10;

interface StaffTokenPayload {
  sub: string;
  email: string;
  role: typeof TOKEN_ROLE;
}

export interface StaffSession {
  id: string;
  email: string;
  name: string;
  grants: ModuleGrants;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** Live per-module grant map for a staff user (slug -> tier). */
export async function getGrantsMap(staffUserId: string): Promise<ModuleGrants> {
  const { data, error } = await supabaseAdmin
    .from('staff_module_grants')
    .select('module_slug, permission')
    .eq('staff_user_id', staffUserId);
  if (error) throw new AppError(500, error.message);

  const grants: ModuleGrants = {};
  for (const row of data ?? []) {
    grants[(row as any).module_slug as string] = (row as any).permission as ModulePermission;
  }
  return grants;
}

export async function login(emailRaw: string, password: string) {
  const email = normalizeEmail(emailRaw);

  const { data: staff, error } = await supabaseAdmin
    .from('staff_users')
    .select('*')
    .eq('email', email)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);

  // Generic message — never leak whether the email exists.
  const invalid = () =>
    new AppError(401, 'Invalid email or password. Please contact the administrator.');

  if (!staff) throw invalid();
  if (!staff.is_active) throw new AppError(403, 'Your account is inactive. Please contact the administrator.');

  const ok = await bcrypt.compare(password, (staff as any).password_hash as string);
  if (!ok) throw invalid();

  const sessionExpiry = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
  const payload: StaffTokenPayload = {
    sub: (staff as any).id as string,
    email: (staff as any).email as string,
    role: TOKEN_ROLE,
  };
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: `${SESSION_DURATION_HOURS}h` });

  const { error: sessionError } = await supabaseAdmin.from('staff_sessions').insert({
    staff_user_id: (staff as any).id,
    token,
    expires_at: sessionExpiry.toISOString(),
  });
  if (sessionError) throw new AppError(500, 'Failed to create session');

  const grants = await getGrantsMap((staff as any).id as string);

  return {
    access_token: token,
    expires_at: sessionExpiry.toISOString(),
    user: {
      id: (staff as any).id as string,
      email: (staff as any).email as string,
      name: (staff as any).name as string,
      role: TOKEN_ROLE,
    },
    grants,
  };
}

/**
 * Validate a staff JWT and return the live session. Re-reads the session row,
 * the user's active flag, and the grant map on EVERY call, so deactivation and
 * grant edits from the admin app take effect on the very next request.
 */
export async function validateStaffToken(token: string): Promise<StaffSession> {
  let payload: StaffTokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as StaffTokenPayload;
  } catch {
    throw new AppError(401, 'Invalid or expired token');
  }
  if (payload.role !== TOKEN_ROLE) throw new AppError(401, 'Invalid token');

  const { data: session } = await supabaseAdmin
    .from('staff_sessions')
    .select('id, expires_at')
    .eq('token', token)
    .maybeSingle();
  if (!session) throw new AppError(401, 'Session not found');
  if (new Date((session as any).expires_at) < new Date()) {
    await supabaseAdmin.from('staff_sessions').delete().eq('id', (session as any).id);
    throw new AppError(401, 'Session expired');
  }

  const { data: staff } = await supabaseAdmin
    .from('staff_users')
    .select('id, email, name, is_active')
    .eq('id', payload.sub)
    .maybeSingle();
  if (!staff) throw new AppError(401, 'Account not found');
  if (!(staff as any).is_active) throw new AppError(403, 'Account is inactive');

  const grants = await getGrantsMap(payload.sub);

  return {
    id: (staff as any).id as string,
    email: (staff as any).email as string,
    name: (staff as any).name as string,
    grants,
  };
}

/** Best-effort: validate WITHOUT throwing (used by the combined admin/staff gate). */
export async function tryValidateStaffToken(token: string): Promise<StaffSession | null> {
  try {
    return await validateStaffToken(token);
  } catch {
    return null;
  }
}

export async function logout(token: string): Promise<void> {
  await supabaseAdmin.from('staff_sessions').delete().eq('token', token);
}
