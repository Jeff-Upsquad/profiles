import { supabaseAdmin, supabaseAnon } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { checkInvitation, markInvitationAccepted } from './invite.service.js';
import { getAdminSetting } from './admin.service.js';
import type { SignupTalentInput, SignupAgencyInput, LoginInput } from '../validators/auth.validators.js';
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

  // Ops review flag only. Pending talent can sign in and use the app immediately.
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

  // Best-effort: the signup form doesn't ask for age/gender, but the /apply
  // lead forms do. Now that the originating lead is linked, pull those into the
  // talent profile so admins/businesses see them without re-asking the talent.
  try {
    await backfillDemographicsFromLeads(userId);
  } catch (e) {
    console.error('Demographics backfill from leads failed (non-fatal):', e);
  }

  try {
    const { onCandidateSignedUp, notifyCrmTalentSignedUp } = await import('./automation.service.js');
    await onCandidateSignedUp(userId, email, profileData.phone ?? null);
    // Always tell SquadHire CRM — landing-page signups often have no
    // lead_submission, so onCandidateSignedUp is a no-op for the kanban card.
    await notifyCrmTalentSignedUp({
      name: full_name,
      email,
      phone: profileData.phone ?? null,
      talentUserId: userId,
    });
  } catch (e) {
    console.error('[automation] onCandidateSignedUp failed:', e);
  }

  try {
    const { pushShcrmIdentityNames } = await import('../lib/crm-identity-names.js');
    await pushShcrmIdentityNames({
      phone: profileData.phone ?? null,
      email,
      person_name: full_name,
    });
  } catch (e) {
    console.error('[shcrm-identity-names] talent signup sync failed:', e);
  }

  // Backfill existing cards matching this newly signed-up talent (fire-and-forget)
  try {
    const { backfillCardsForTalent } = await import('./card-backfill.service.js');
    backfillCardsForTalent(userId).catch((e) => console.error('[card-backfill] talent signup backfill failed', e));
  } catch (e) {
    console.error('[card-backfill] talent signup import failed', e);
  }

  return { message: 'Account created successfully. Please sign in to continue.' };
}

export async function signupAgency(input: SignupAgencyInput) {
  const { email, password, agency_name, contact_person, phone, website, location } = input;
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'agency' as UserRole, agency_name },
  });
  if (authError) {
    if (authError.message.includes('already')) throw new AppError(409, 'An account with this email already exists');
    throw new AppError(400, authError.message);
  }
  const userId = authData.user.id;
  const { error: profileError } = await supabaseAdmin.from('agency_users').insert({
    id: userId, agency_name, contact_person: contact_person ?? null, email, phone: phone ?? null, website: website ?? null, location: location ?? null,
  });
  if (profileError) {
    console.error('Agency profile insert error:', profileError);
    const msg = String(profileError.message || '').toLowerCase();
    const isMissing = msg.includes('does not exist') || msg.includes('could not find the table') || (profileError as any).code === 'PGRST205' || (profileError as any).code === '42P01';
    if (!isMissing) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new AppError(500, 'Failed to create agency profile');
    }
    // table missing – auth user already created, keep it (fallback in-memory)
  } else {
    // create empty agency_profiles row
    await supabaseAdmin.from('agency_profiles').insert({ agency_user_id: userId }).then(() => {}, () => {});
  }
  // Backfill existing cards for new agency (fire-and-forget)
  try {
    const { backfillCardsForAgency } = await import('./card-backfill.service.js');
    backfillCardsForAgency(userId).catch((e) => console.error('[card-backfill] agency signup backfill failed', e));
  } catch (e) {
    console.error('[card-backfill] agency signup import failed', e);
  }
  return { message: 'Agency account created successfully. Please sign in to continue.' };
}

const VALID_GENDERS = new Set(['male', 'female', 'other', 'prefer_not_to_say']);

/**
 * Fill talent_users.age / gender from the talent's linked lead submissions.
 * Only ever fills blanks — never overwrites a value the talent already has —
 * and picks the most recent linked lead that carries each field. Mirrors the
 * 00112 one-time backfill so freshly signed-up accounts get the same treatment.
 */
async function backfillDemographicsFromLeads(userId: string): Promise<void> {
  const { data: cur } = await supabaseAdmin
    .from('talent_users')
    .select('age, gender')
    .eq('id', userId)
    .single();
  if (!cur) return;
  if (cur.age != null && cur.gender) return; // nothing to fill

  const { data: leads } = await supabaseAdmin
    .from('lead_submissions')
    .select('form_data, created_at')
    .eq('linked_talent_user_id', userId)
    .order('created_at', { ascending: false });

  let age: number | null = null;
  let gender: string | null = null;
  for (const l of leads ?? []) {
    const fd = ((l as any).form_data ?? {}) as Record<string, unknown>;
    if (age == null && fd.age != null && fd.age !== '') {
      const n = Number(fd.age);
      if (Number.isFinite(n) && n >= 16 && n <= 100) age = Math.trunc(n);
    }
    if (!gender && typeof fd.gender === 'string' && VALID_GENDERS.has(fd.gender)) {
      gender = fd.gender;
    }
    if (age != null && gender) break;
  }

  const patch: Record<string, unknown> = {};
  if (cur.age == null && age != null) patch.age = age;
  if (!cur.gender && gender) patch.gender = gender;
  if (Object.keys(patch).length === 0) return;

  await supabaseAdmin.from('talent_users').update(patch).eq('id', userId);
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

export async function checkAgencyContact(input: { email?: string; phone?: string }) {
  const normalizedEmail = input.email?.trim().toLowerCase() || null;
  const phoneDigits = input.phone ? input.phone.replace(/\D/g, '').slice(-10) : null;
  const normalizedPhone = phoneDigits && phoneDigits.length === 10 ? phoneDigits : null;
  if (!normalizedEmail && !normalizedPhone) {
    return { exists: false, duplicates: [], message: 'Email or phone required' };
  }
  try {
    const { data } = await supabaseAdmin.rpc('check_contact_exists_detailed', {
      p_email: normalizedEmail,
      p_phone_digits: normalizedPhone,
    });
    const dups = (data ?? []) as any[];
    const exists = dups.length > 0;
    // For agency signup we consider any duplicate as blocking (agency/talent/business/auth/lead)
    // Frontend can show specific source
    return {
      exists,
      duplicates: dups.map((d: any) => ({ source: d.source, field: d.matched_field, id: d.record_id, name: d.display_name })),
      sources: [...new Set(dups.map((d: any) => d.source))],
      email: normalizedEmail,
      phone: normalizedPhone,
    };
  } catch (e: any) {
    // fallback to simple check
    try {
      const { data } = await supabaseAdmin.rpc('check_contact_exists', { p_email: normalizedEmail, p_phone_digits: normalizedPhone });
      const exists = (data ?? []).length > 0;
      return { exists, duplicates: (data ?? []).map((d: any) => ({ source: d.source, field: 'unknown', id: '', name: '' })), sources: (data ?? []).map((d: any) => d.source), email: normalizedEmail, phone: normalizedPhone };
    } catch {
      return { exists: false, duplicates: [], sources: [], email: normalizedEmail, phone: normalizedPhone };
    }
  }
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

    return { ...data, role, must_reset_password: mustResetPassword };
  }

  if ((role as string) === 'agency') {
    const { data, error } = await supabaseAdmin.from('agency_users').select('*').eq('id', userId).single();
    if (error || !data) {
      // fallback when table missing – return minimal agency user
      return { id: userId, agency_name: authUser?.user?.user_metadata?.agency_name ?? 'Agency', role, must_reset_password: mustResetPassword };
    }
    return { ...data, role, must_reset_password: mustResetPassword };
  }

  // Admin — return minimal info
  return { id: userId, role, must_reset_password: mustResetPassword };
}
