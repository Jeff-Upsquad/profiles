import { supabaseAdmin, supabaseAnon } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { checkInvitation, markInvitationAccepted } from './invite.service.js';
import { getAdminSetting } from './admin.service.js';
import type { SignupTalentInput, LoginInput } from '../validators/auth.validators.js';
import type { UserRole } from '../../../shared/src/types/auth.js';

export async function signupTalent(input: SignupTalentInput) {
  const { email, password, full_name, country, state, current_district, ...profileData } = input;

  // Gate: check for valid invitation
  const invitation = await checkInvitation(email, 'talent');
  if (!invitation) {
    throw new AppError(403, 'Signup requires an invitation. Please contact the administrator.');
  }

  // Create auth user with role metadata
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'talent' as UserRole, full_name },
  });

  if (authError) {
    if (authError.message.includes('already')) {
      throw new AppError(409, 'An account with this email already exists');
    }
    throw new AppError(400, authError.message);
  }

  const userId = authData.user.id;

  const autoApprove = (await getAdminSetting<boolean>('auto_approve_signups')) === true;

  // Insert into talent_users table
  const { error: profileError } = await supabaseAdmin
    .from('talent_users')
    .insert({
      id: userId,
      full_name,
      phone: profileData.phone ?? null,
      age: profileData.age ?? null,
      gender: profileData.gender ?? null,
      native_place: profileData.native_place ?? null,
      current_location: profileData.current_location ?? null,
      languages_spoken: profileData.languages_spoken ?? [],
      ...(autoApprove
        ? { approval_status: 'approved' as const, approved_at: new Date().toISOString() }
        : {}),
    });

  if (profileError) {
    console.error('Talent profile insert error:', profileError);
    await supabaseAdmin.auth.admin.deleteUser(userId);
    throw new AppError(500, 'Failed to create talent profile');
  }

  // Create basic profile with location data
  if (country || state || current_district) {
    const { error: basicError } = await supabaseAdmin
      .from('talent_profiles_basic')
      .insert({
        talent_user_id: userId,
        country: country || 'India',
        state: state || null,
        current_district: current_district || null,
      });
    if (basicError) {
      console.error('Basic profile insert error (non-fatal):', basicError);
    }
  }

  // Mark invitation as accepted
  await markInvitationAccepted(invitation.id);

  // Best-effort: link any pre-existing lead_submissions
  const phoneDigits = (profileData.phone ?? '').replace(/\D/g, '');
  const last10 = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : null;
  try {
    await supabaseAdmin.rpc('link_leads_for_talent_user', {
      p_user_id: userId,
      p_email: email,
      p_phone_last10: last10,
    });
  } catch (e) {
    console.error('Lead linking failed (non-fatal):', e);
  }

  try {
    const { onCandidateSignedUp } = await import('./automation.service.js');
    await onCandidateSignedUp(userId, email, profileData.phone ?? null);
  } catch (e) {
    console.error('[automation] onCandidateSignedUp failed:', e);
  }

  return { message: 'Account created successfully. Please sign in to continue.' };
}

export async function checkCandidateStatus(input: { email?: string; phone?: string }) {
  const normalizedEmail = input.email?.trim().toLowerCase() || null;
  const phoneDigits = input.phone ? input.phone.replace(/\D/g, '').slice(-10) : null;
  const normalizedPhone = phoneDigits && phoneDigits.length === 10 ? phoneDigits : null;

  if (!normalizedEmail && !normalizedPhone) {
    return { has_invitation: false, has_account: false, submissions: [] };
  }

  // Pending talent invitation lookup (email-only)
  let has_invitation = false;
  if (normalizedEmail) {
    try {
      const inv = await checkInvitation(normalizedEmail, 'talent');
      has_invitation = inv !== null;
    } catch {
      has_invitation = false;
    }
  }

  // Account-exists lookup via shared RPC (returns 'talent' | 'business' | 'lead')
  let has_account = false;
  try {
    const { data: contactData } = await supabaseAdmin.rpc('check_contact_exists', {
      p_email: normalizedEmail,
      p_phone_digits: normalizedPhone,
    });
    const source = (contactData ?? [])[0]?.source;
    has_account = source === 'talent' || source === 'business' || source === 'auth';
  } catch {
    has_account = false;
  }

  // Lead submissions match
  const conditions: string[] = [];
  if (normalizedEmail) conditions.push(`email.ilike.${normalizedEmail}`);
  if (normalizedPhone) conditions.push(`phone.like.%${normalizedPhone}`);

  const { data: leads, error } = await supabaseAdmin
    .from('lead_submissions')
    .select('name, email, phone, form_type, status, created_at, form_data')
    .or(conditions.join(','))
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Candidate status check error:', error);
    return { has_invitation, has_account, submissions: [], prefilled_location: null };
  }

  // Only expose location prefill to actually-invited, not-yet-signed-up candidates.
  // Gating prevents the unauthenticated endpoint from leaking lead form PII to
  // anyone guessing emails.
  let prefilled_location: {
    country: string | null;
    state: string | null;
    current_district: string | null;
  } | null = null;

  if (has_invitation && !has_account) {
    for (const row of leads ?? []) {
      const fd = ((row as any).form_data ?? {}) as Record<string, unknown>;
      const country = typeof fd.country === 'string' ? fd.country.trim() : '';
      if (!country) continue;
      prefilled_location = {
        country,
        state: typeof fd.state === 'string' && fd.state.trim() ? fd.state.trim() : null,
        current_district:
          typeof fd.current_district === 'string' && fd.current_district.trim()
            ? fd.current_district.trim()
            : null,
      };
      break;
    }
  }

  // Only expose candidate details to actually-invited, not-yet-signed-up candidates.
  let prefilled_candidate: {
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null = null;

  if (has_invitation && !has_account) {
    const first = (leads ?? [])[0];
    if (first) {
      prefilled_candidate = {
        name: first.name || null,
        email: (first as any).email || null,
        phone: (first as any).phone || null,
      };
    }
  }

  return {
    has_invitation,
    has_account,
    submissions: (leads ?? []).map(s => ({
      name: s.name,
      form_type: s.form_type,
      status: s.status,
      submitted_at: s.created_at,
    })),
    prefilled_location,
    prefilled_candidate,
  };
}

export async function login(input: LoginInput) {
  // Use anon client for user sign-in (service-role client doesn't support user sessions)
  const { data, error } = await supabaseAnon.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (error || !data.session) {
    throw new AppError(401, 'Invalid email or password');
  }

  const role = (data.user.user_metadata?.role as UserRole) ?? 'talent';

  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: {
      id: data.user.id,
      email: data.user.email!,
      role,
    },
  };
}

export async function refreshToken(refresh_token: string) {
  // Use anon client for session refresh
  const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token });

  if (error || !data.session) {
    throw new AppError(401, 'Invalid or expired refresh token');
  }

  const role = (data.user?.user_metadata?.role as UserRole) ?? 'talent';

  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: {
      id: data.user!.id,
      email: data.user!.email!,
      role,
    },
  };
}

export async function forgotPassword(email: string) {
  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password`,
  });

  if (error) {
    // Don't reveal whether the email exists
    console.error('Password reset error:', error.message);
  }

  // Always return success to prevent email enumeration
  return { message: 'If an account exists with this email, a password reset link has been sent.' };
}

export async function resetPassword(accessToken: string, newPassword: string) {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(
    // First get the user from the token
    (await supabaseAdmin.auth.getUser(accessToken)).data.user?.id ?? '',
    { password: newPassword }
  );

  if (error) {
    throw new AppError(400, 'Failed to reset password');
  }

  return { message: 'Password has been reset successfully.' };
}

export async function changePassword(userId: string, newPassword: string) {
  // Supabase's updateUserById merges user_metadata, so omitting a key doesn't
  // remove it — set must_reset_password to false explicitly to clear the flag.
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
    user_metadata: { must_reset_password: false },
  });

  if (error) throw new AppError(400, error.message);
  return { message: 'Password updated successfully.' };
}

export async function getMe(userId: string, role: UserRole) {
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
  const mustResetPassword = authUser?.user?.user_metadata?.must_reset_password === true;

  if (role === 'talent') {
    const { data, error } = await supabaseAdmin
      .from('talent_users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) throw new AppError(404, 'Talent user not found');

    const autoApproveSignups = (await getAdminSetting<boolean>('auto_approve_signups')) === true;

    return {
      ...data,
      role,
      must_reset_password: mustResetPassword,
      auto_approve_signups: autoApproveSignups,
    };
  }

  if (role === 'business') {
    const { data, error } = await supabaseAdmin
      .from('business_users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) throw new AppError(404, 'Business user not found');

    // Check if access has expired
    if (data.access_expires_at && new Date(data.access_expires_at) < new Date()) {
      throw new AppError(403, 'Your access has expired. Please contact the administrator.');
    }

    return { ...data, role, must_reset_password: mustResetPassword };
  }

  // Admin — return minimal info
  return { id: userId, role, must_reset_password: mustResetPassword };
}
