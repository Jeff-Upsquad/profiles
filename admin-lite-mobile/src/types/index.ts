export interface AdminUser {
  id: string;
  email: string;
  role: string;
}

export interface Lead {
  id: string;
  form_type: string;
  status: string;
  name: string;
  email: string | null;
  phone: string;
  form_data: Record<string, any>;
  created_at: string;
}

export interface LeadFull extends Lead {
  resume_url?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  admin_notes?: string | null;
  archive_reason?: string | null;
  profile_type?: string | null;
  profile_type_custom?: string | null;
}

export interface LeadsResponse {
  leads: Lead[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface TalentUser {
  id: string;
  full_name: string;
  phone?: string;
  age?: number;
  gender?: string;
  approval_status: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  is_active?: boolean;
  sort_order?: number;
}

export interface CategoryField {
  id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  is_required?: boolean;
  sort_order?: number;
  options?: { id: string; label: string; value: string }[];
}

export type ProfileStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'inactive';

export interface ReviewProfile {
  id: string;
  talent_user_id: string;
  category_id: string;
  status: ProfileStatus;
  field_data: Record<string, any>;
  previous_field_data?: Record<string, any> | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
  talent_user?: TalentUser;
  category?: Category;
  portfolio_items?: PortfolioItem[];
}

export interface PortfolioItem {
  id: string;
  profile_id: string;
  skill_name?: string | null;
  file_url: string;
  file_type?: string | null;
  file_name?: string | null;
  sort_order?: number;
}

export interface InterviewInvitation {
  id: string;
  lead_id: string;
  token: string;
  expires_at: string;
  submitted_at?: string | null;
  responses?: Record<string, any> | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  created_at: string;
}
