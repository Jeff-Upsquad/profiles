export interface User {
  id: string;
  email: string;
  role: 'talent' | 'business' | 'admin';
  full_name?: string;
  company_name?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

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
  field_type: 'text' | 'textarea' | 'number' | 'currency' | 'email' | 'phone' | 'select' | 'multi_select' | 'file_upload' | 'date';
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

export interface TalentSignupData {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  age?: number;
  gender?: string;
  native_place?: string;
  current_location?: string;
  languages_spoken?: string[];
  preferred_districts?: string[];
}

export interface BusinessSignupData {
  email: string;
  password: string;
  company_name: string;
  company_website?: string;
  industry?: string;
  company_size?: string;
  contact_person_name: string;
  contact_email: string;
  contact_phone?: string;
}

export interface PresignedUrlResponse {
  upload_url: string;
  file_url: string;
}
