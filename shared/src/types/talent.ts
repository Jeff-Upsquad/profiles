export type ProfileStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'inactive'
  | 'deleted';

export interface TalentUser {
  id: string;
  full_name: string;
  phone?: string;
  age?: number;
  gender?: string;
  native_place?: string;
  preferred_districts?: string[];
  current_location?: string;
  languages_spoken?: string[];
  profile_photo_url?: string;
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
