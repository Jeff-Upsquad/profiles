export type UserRole = 'talent' | 'business' | 'admin' | 'staff';

export interface SignupTalentPayload {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  age?: number;
  gender?: Gender;
  native_place?: string;
  current_location?: string;
  languages_spoken?: { language: string; proficiency: string }[];
}

export interface SignupBusinessPayload {
  email: string;
  password: string;
  company_name: string;
  company_website?: string;
  industry?: string;
  company_size?: CompanySize;
  contact_person_name: string;
  contact_email: string;
  contact_phone?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface BusinessLoginPayload {
  email?: string;
  phone?: string;
}

export interface BusinessAuthResponse {
  access_token: string;
  user: AuthUser & {
    company_name?: string;
    access_expires_at?: string;
  };
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

// ─── Self-serve password reset (phone → WhatsApp temp password) ──────────────

export interface PasswordResetLookupPayload {
  phone: string;
}

export interface PasswordResetLookupResponse {
  found: boolean;
  // Only present when found. `masked_name` is the masked contact/full name;
  // `masked_business` is the masked company name (business accounts only).
  role?: 'talent' | 'business';
  masked_name?: string;
  masked_business?: string | null;
  // Opaque signed ticket that authorizes the send/verify steps for this account.
  reset_ticket?: string;
}

export interface PasswordResetSendResponse {
  sent: boolean;
  // Whether the CRM actually dispatched the WhatsApp (false when no approved
  // template is mapped yet — the reset still works, delivery is just pending).
  delivered: boolean;
}

export interface PasswordResetVerifyPayload {
  reset_ticket: string;
  temp_password: string;
}

// ─── Authenticated login-detail change (WhatsApp code) ───────────────────────
// A signed-in business user changing their login email / phone / password.
// Mirrors the forgot-password flow: a one-time code is sent to the account's
// registered WhatsApp, then the change is applied once the code is verified.

export type LoginDetailField = 'email' | 'phone' | 'password';

export interface LoginUpdateSendPayload {
  field: LoginDetailField;
}

export interface LoginUpdateSendResponse {
  sent: boolean;
  // Whether the CRM actually dispatched the WhatsApp (false when no approved
  // template is mapped yet — the change still works, delivery is just pending).
  delivered: boolean;
  // Masked form of the WhatsApp number the code was sent to, e.g. "•••• ••3210".
  masked_phone: string;
  // Opaque signed ticket that authorizes the verify step for this account+field.
  ticket: string;
}

export interface LoginUpdateVerifyPayload {
  ticket: string;
  code: string;
  // New email / new phone / new password depending on the ticket's field.
  new_value: string;
}

export interface LoginUpdateVerifyResponse {
  success: boolean;
  field: LoginDetailField;
}

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type CompanySize = '1-10' | '11-50' | '51-200' | '201-500' | '500+';
