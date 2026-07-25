import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import crypto from 'crypto';

export async function createInvitation(input: {
  email?: string;
  role: 'talent' | 'business';
  expires_at?: string;
  company_name?: string;
  contact_person_name?: string;
  phone?: string;
  adminId: string;
}) {
  const { email, role, expires_at, company_name, contact_person_name, phone, adminId } = input;

  const normalizedEmail = email ? email.toLowerCase() : null;

  if (!normalizedEmail && !phone) {
    throw new AppError(400, 'Email or phone is required');
  }
  // Talent onboarding is email-based; a business invite may be phone-only.
  if (role === 'talent' && !normalizedEmail) {
    throw new AppError(400, 'Email is required for talent invitations');
  }

  // Check for existing pending invitation by email (only when an email is given)
  if (normalizedEmail) {
    const { data: existing } = await supabaseAdmin
      .from('invitations')
      .select('id')
      .eq('email', normalizedEmail)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      throw new AppError(409, 'A pending invitation already exists for this email');
    }
  }

  const trimmedPhone = role === 'business' && phone ? phone.trim() : null;

  if (trimmedPhone) {
    const normalized = trimmedPhone.replace(/\D/g, '');
    const { data: phoneDupe } = await supabaseAdmin
      .from('invitations')
      .select('id')
      .eq('phone_normalized', normalized)
      .eq('status', 'pending')
      .maybeSingle();
    if (phoneDupe) {
      throw new AppError(409, 'A pending invitation already exists for this phone number');
    }
  }

  // Create invitation
  const { data: invitation, error } = await supabaseAdmin
    .from('invitations')
    .insert({
      email: normalizedEmail,
      role,
      status: 'pending',
      expires_at: role === 'business' ? expires_at || null : null,
      company_name: role === 'business' ? company_name || null : null,
      contact_person_name: role === 'business' ? contact_person_name || null : null,
      phone: trimmedPhone,
      invited_by: adminId,
    })
    .select()
    .single();

  if (error) throw new AppError(400, error.message);

  // For business invitations, also create the business_users row
  if (role === 'business') {
    const businessId = crypto.randomUUID();
    const { error: bizError } = await supabaseAdmin
      .from('business_users')
      .insert({
        id: businessId,
        company_name: company_name || 'Unnamed Company',
        contact_person_name: contact_person_name || '',
        contact_email: normalizedEmail,
        contact_phone: trimmedPhone,
        access_expires_at: expires_at || null,
        invitation_id: invitation.id,
        is_active: true,
        verified: true,
      });

    if (bizError) {
      // Rollback invitation
      await supabaseAdmin.from('invitations').delete().eq('id', invitation.id);
      throw new AppError(400, bizError.message);
    }
  }

  return invitation;
}

export async function getInvitations(filters?: { role?: string; status?: string; email?: string }) {
  let qb = supabaseAdmin
    .from('invitations')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.role) {
    qb = qb.eq('role', filters.role);
  }
  if (filters?.status) {
    qb = qb.eq('status', filters.status);
  }
  if (filters?.email) {
    qb = qb.eq('email', filters.email.toLowerCase());
  }

  const { data, error } = await qb;
  if (error) throw new AppError(500, error.message);
  return data ?? [];
}

export async function revokeInvitation(invitationId: string) {
  const { data, error } = await supabaseAdmin
    .from('invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId)
    .eq('status', 'pending')
    .select()
    .single();

  if (error) throw new AppError(404, 'Invitation not found or already used');
  return data;
}

export async function checkInvitation(email: string, role: 'talent' | 'business') {
  const { data, error } = await supabaseAdmin
    .from('invitations')
    .select('*')
    .eq('email', email.toLowerCase())
    .eq('role', role)
    .eq('status', 'pending')
    .maybeSingle();

  if (error) throw new AppError(500, error.message);
  if (!data) return null;

  // For business, also check expiration on the invitation itself
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    // Mark as expired
    await supabaseAdmin
      .from('invitations')
      .update({ status: 'expired' })
      .eq('id', data.id);
    return null;
  }

  return data;
}

export async function markInvitationAccepted(invitationId: string) {
  const { error } = await supabaseAdmin
    .from('invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invitationId);

  if (error) throw new AppError(500, error.message);
}
