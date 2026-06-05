export type ProfileStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'inactive'
  | 'deleted';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface TalentUser {
  id: string;
  full_name: string;
  phone?: string;
  age?: number;
  gender?: string;
  native_place?: string;
  current_location?: string;
  languages_spoken?: { language: string; proficiency: string }[];
  profile_photo_url?: string;
  approval_status: ApprovalStatus;
  approved_at?: string;
  approved_by?: string;
  is_active: boolean;
  skip_onboarding?: boolean;
  skip_onboarding_at?: string | null;
  skip_onboarding_by?: string | null;
  skip_onboarding_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TalentProfile {
  id: string;
  talent_user_id: string;
  category_id: string;
  status: ProfileStatus;
  rejection_reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  field_data: Record<string, any>;
  resume_url?: string;
  is_active: boolean;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
  category?: import('./category').Category;
  talent_user?: TalentUser;
}
