import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { normalizePhoneDigits } from '../lib/phone.js';

type AccountType = 'talent' | 'business' | 'agency';

const ACCOUNT_PHONE_COLUMNS: { type: AccountType; table: string; column: string }[] = [
  { type: 'talent', table: 'talent_users', column: 'phone' },
  { type: 'business', table: 'business_users', column: 'contact_phone' },
  { type: 'agency', table: 'agency_users', column: 'phone' },
];

/** Returns whether this email and phone belong to the same registered account. */
export async function joinPartnerIosWaitlist(email: string, phone: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  const phoneDigits = normalizePhoneDigits(phone);
  const phoneSuffix = phoneDigits.slice(-10);

  const { data: authUsers, error: authError } = await supabaseAdmin.rpc(
    'get_auth_users_by_emails',
    { email_list: [normalizedEmail] },
  );
  if (authError) throw new AppError(500, 'Could not verify SquadHire account');

  const userId = (authUsers as { id: string }[] | null)?.[0]?.id;
  if (!userId) return false;

  let accountType: AccountType | null = null;
  for (const account of ACCOUNT_PHONE_COLUMNS) {
    const { data, error } = await supabaseAdmin
      .from(account.table)
      .select(account.column)
      .eq('id', userId)
      .maybeSingle();
    if (error) throw new AppError(500, 'Could not verify SquadHire account');

    const registeredDigits = normalizePhoneDigits((data as Record<string, string | null> | null)?.[account.column]);
    if (registeredDigits.length >= 10 && registeredDigits.slice(-10) === phoneSuffix) {
      accountType = account.type;
      break;
    }
  }
  if (!accountType) return false;

  const { error: insertError } = await supabaseAdmin
    .from('partner_ios_waitlist')
    .upsert(
      {
        squadhire_user_id: userId,
        email: normalizedEmail,
        phone: phoneDigits,
        account_type: accountType,
      },
      { onConflict: 'squadhire_user_id', ignoreDuplicates: true },
    );
  if (insertError) throw new AppError(500, 'Could not save iOS waitlist entry');
  return true;
}
