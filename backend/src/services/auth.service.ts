import { supabaseAdmin, supabaseAnon } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { checkInvitation, markInvitationAccepted } from './invite.service.js';
import { getAdminSetting } from './admin.service.js';
import type { SignupTalentInput, LoginInput } from '../validators/auth.validators.js';
import type { UserRole } from '../../../shared/src/types/auth.js';

export async function signupTalent(input: SignupTalentInput) {
  const { email, password, full_name, ...profileData } = input;

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

  // Honor the auto-approve setting at signup time. Without this, brand-new
  // signups land in `pending` even when the toggle is on — only the
  // toggle-flip bulk approve and the profile-submission inline approve cover
  // that case, leaving fresh signups stuck until they submit a profile.
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

  // Mark invitation as accepted
  await markInvitationAccepted(invitation.id);

  // Sign in to get tokens
  const { data: session, error: signInError } = await supabaseAnon.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !session.session) {
    throw new AppError(500, 'Account created but failed to sign in');
  }

  return {
    access_token: session.session.access_token,
    refresh_token: session.session.refresh_token,
    user: {
      id: userId,
      email,
      role: 'talent' as UserRole,
      approval_status: autoApprove ? ('approved' as const) : ('pending' as const),
    },
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
