export type UserRole = 'talent' | 'business' | 'admin';

export interface SignupTalentPayload {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  age?: number;
  gender?: Gender;
  native_place?: string;
  preferred_districts?: string[];
  current_location?: string;
  languages_spoken?: string[];
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

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type CompanySize = '1-10' | '11-50' | '51-200' | '201-500' | '500+';
