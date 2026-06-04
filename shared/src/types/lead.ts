export type LeadFormType = 'creative' | 'accountant';
export type LeadStatus = 'new' | 'contacted' | 'converted' | 'rejected';

export interface CreativeFormData {
  role: 'Editor' | 'Designer' | 'Editor + Designer';
  portfolio_link: string;
}

export interface AccountantFormData {
  age: number;
  gender: string;
  native_place: string;
  district: string[];
  location: string;
  work_type: string;
  education: string;
  experience_years: string;
  accounting_software: string[];
  addon_skills: string[];
  current_salary: number;
  expected_salary: number;
  languages: string[];
  experience_details: string;
  resume_url: string;
}

export interface LeadSubmission {
  id: string;
  form_type: LeadFormType;
  status: LeadStatus;
  name: string;
  email: string | null;
  phone: string;
  form_data: CreativeFormData | AccountantFormData;
  resume_url: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  admin_notes: string | null;
  status_changed_by: string | null;
  status_changed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCreativeLeadPayload {
  form_type: 'creative';
  name: string;
  phone: string;
  email: string;
  role: string;
  portfolio_link: string;
}

export interface CreateAccountantLeadPayload {
  form_type: 'accountant';
  name: string;
  phone: string;
  email: string;
  age: number;
  gender: string;
  native_place: string;
  district: string[];
  location: string;
  work_type: string;
  education: string;
  experience_years: string;
  accounting_software: string[];
  addon_skills: string[];
  current_salary: number;
  expected_salary: number;
  languages: string[];
  experience_details: string;
  resume_url: string;
}

export type CreateLeadPayload = CreateCreativeLeadPayload | CreateAccountantLeadPayload;
