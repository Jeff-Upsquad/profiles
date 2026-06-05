export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FieldOption {
  id: string;
  label: string;
  value: string;
  sort_order: number;
}

export interface ValidationRules {
  min?: number;
  max?: number;
  min_length?: number;
  max_length?: number;
  pattern?: string;
  allowed_types?: string[];
  max_file_size?: number;
}

export interface CategoryField {
  id: string;
  category_id: string;
  field_key: string;
  field_label: string;
  field_type: 'text' | 'textarea' | 'number' | 'currency' | 'email' | 'phone' | 'select' | 'multi_select' | 'file_upload' | 'date' | 'experience';
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  placeholder?: string;
  helper_text?: string;
  validation_rules?: ValidationRules;
  options?: FieldOption[];
}

export interface CategoryWithFields extends Category {
  fields: CategoryField[];
}

export type ProfileStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'inactive';

export interface Profile {
  id: string;
  user_id: string;
  category_id: string;
  category?: Category;
  status: ProfileStatus;
  field_data: Record<string, any>;
  rejection_reason?: string;
  submitted_at?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PortfolioItem {
  id: string;
  profile_id: string;
  skill_name: string;
  file_url: string;
  file_type: 'image' | 'pdf' | 'video';
  file_name: string;
  sort_order: number;
}
