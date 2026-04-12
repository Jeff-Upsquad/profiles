import { queryPg, queryPgOne } from '../config/db.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import crypto from 'crypto';

export async function createInvitation(input: {
  email: string;
  role: 'talent' | 'business';
  expires_at?: string;
  company_name?: string;
  contact_person_name?: string;
  adminId: string;
}) {
  const { email, role, expires_at, company_name, contact_person_name, adminId } = input;

  // Check for existing pending invitation
  const existing = await queryPgOne(
    `SELECT id FROM invitations WHERE email = $1 AND status = 'pending'`,
    [email.toLowerCase()]
  );

  if (existing) {
    throw new AppError(409, 'A pending invitation already exists for this email');
  }

  // Create invitation
  const invitation = await queryPgOne(
    `INSERT INTO invitations (email, role, status, expires_at, company_name, contact_person_name, invited_by)
     VALUES ($1, $2, 'pending', $3, $4, $5, $6)
     RETURNING *`,
    [
      email.toLowerCase(),
      role,
      role === 'business' ? expires_at || null : null,
      role === 'business' ? company_name || null : null,
      role === 'business' ? contact_person_name || null : null,
      adminId,
    ]
  );

  if (!invitation) throw new AppError(500, 'Failed to create invitation');

  // For business invitations, also create the business_users row
  if (role === 'business') {
    const businessId = crypto.randomUUID();
    try {
      await queryPg(
        `INSERT INTO business_users (id, company_name, contact_person_name, contact_email, access_expires_at, invitation_id, is_active, verified)
         VALUES ($1, $2, $3, $4, $5, $6, true, true)`,
        [
          businessId,
          company_name || 'Unnamed Company',
          contact_person_name || '',
          email.toLowerCase(),
          expires_at || null,
          invitation.id,
        ]
      );
    } catch (bizErr: any) {
      // Rollback invitation
      await queryPg(`DELETE FROM invitations WHERE id = $1`, [invitation.id]);
      throw new AppError(400, bizErr.message || 'Failed to create business user');
    }
  }

  return invitation;
}

export async function getInvitations(filters?: { role?: string; status?: string }) {
  let sql = `SELECT * FROM invitations`;
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters?.role) {
    params.push(filters.role);
    conditions.push(`role = $${params.length}`);
  }
  if (filters?.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }
  sql += ` ORDER BY created_at DESC`;

  return queryPg(sql, params);
}

export async function revokeInvitation(invitationId: string) {
  const row = await queryPgOne(
    `UPDATE invitations SET status = 'revoked' WHERE id = $1 AND status = 'pending' RETURNING *`,
    [invitationId]
  );
  if (!row) throw new AppError(404, 'Invitation not found or already used');
  return row;
}

export async function checkInvitation(email: string, role: 'talent' | 'business') {
  const row = await queryPgOne(
    `SELECT * FROM invitations WHERE email = $1 AND role = $2 AND status = 'pending'`,
    [email.toLowerCase(), role]
  );

  if (!row) return null;

  // For business, also check expiration on the invitation itself
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    await queryPg(`UPDATE invitations SET status = 'expired' WHERE id = $1`, [row.id]);
    return null;
  }

  return row;
}

export async function markInvitationAccepted(invitationId: string) {
  await queryPg(
    `UPDATE invitations SET status = 'accepted', accepted_at = NOW() WHERE id = $1`,
    [invitationId]
  );
}
