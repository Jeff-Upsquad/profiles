import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import type { SignupTalentInput, SignupBusinessInput, LoginInput } from '../validators/auth.validators.js';
import type { UserRole } from '../../../shared/src/types/auth.js';

export async function signupTalent(input: SignupTalentInput) {
  const { email, password, full_name, ...profileData } = input;

  // Create auth user with role metadata
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm for now; switch to false for email verification
    user_metadata: { role: 'talent' as UserRole, full_name },
  });

  if (authError) {
    if (authError.message.includes('already')) {
      throw new AppError(409, 'An account with this email already exists');
    }
    throw new AppError(400, authError.message);
  }

  const userId = authData.user.id;

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
      preferred_districts: profileData.preferred_districts ?? [],
      current_location: profileData.current_location ?? null,
      languages_spoken: profileData.languages_spoken ?? [],
    });

  if (profileError) {
    // Rollback: delete the auth user
    await supabaseAdmin.auth.admin.deleteUser(userId);
    throw new AppError(500, 'Failed to create talent profile');
  }

  // Sign in to get tokens
  const { data: session, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
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
    },
  };
}

export async function signupBusiness(input: SignupBusinessInput) {
  const { email, password, company_name, contact_person_name, contact_email, ...rest } = input;

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'business' as UserRole, company_name },
  });

  if (authError) {
    if (authError.message.includes('already')) {
      throw new AppError(409, 'An account with this email already exists');
    }
    throw new AppError(400, authError.message);
  }

  const userId = authData.user.id;

  const { error: profileError } = await supabaseAdmin
    .from('business_users')
    .insert({
      id: userId,
      company_name,
      company_website: rest.company_website || null,
      industry: rest.industry || null,
      company_size: rest.company_size || null,
      contact_person_name,
      contact_email,
      contact_phone: rest.contact_phone || null,
    });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    throw new AppError(500, 'Failed to create business profile');
  }

  const { data: session, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
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
      role: 'business' as UserRole,
    },
  };
}

export async function login(input: LoginInput) {
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({
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
  const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token });

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

export async function getMe(userId: string, role: UserRole) {
  if (role === 'talent') {
    const { data, error } = await supabaseAdmin
      .from('talent_users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) throw new AppError(404, 'Talent user not found');
    return { ...data, role };
  }

  if (role === 'business') {
    const { data, error } = await supabaseAdmin
      .from('business_users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) throw new AppError(404, 'Business user not found');
    return { ...data, role };
  }

  // Admin — return minimal info
  return { id: userId, role };
}
