import type { UserRole } from '../../../shared/src/types/auth.js';

// Roles a Supabase-session user can hold. Business and staff users sign in with
// their own JWTs (business-auth / staff-auth), never with a Supabase session.
const SESSION_ROLES: ReadonlySet<string> = new Set<UserRole>([
  'talent', 'admin', 'agency', 'squad_member', 'squad_manager',
]);

/**
 * The SquadHire role of a Supabase auth user, read only from app_metadata.role.
 *
 * Never read the role from user_metadata. Users can write their own
 * user_metadata with a normal session (PUT /auth/v1/user {"data":{"role":"admin"}}),
 * so trusting it made any talent an admin. Only the service role can write
 * app_metadata.
 *
 * If app_metadata.role is missing or not a session role, the user is a talent,
 * the least-privileged role. That covers users created by the other apps on
 * this auth project, such as SquadHire CRM staff accounts.
 */
export function roleFromAuthUser(user: { app_metadata?: Record<string, unknown> | null } | null | undefined): UserRole {
  const role = user?.app_metadata?.role;
  return typeof role === 'string' && SESSION_ROLES.has(role) ? (role as UserRole) : 'talent';
}

