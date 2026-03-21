export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'currency'
  | 'email'
  | 'phone'
  | 'select'
  | 'multi_select'
  | 'file_upload'
  | 'date';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon_url?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryField {
  id: string;
  category_id: string;
  field_key: string;
  field_label: string;
  field_type: FieldType;
  is_required: boolean;
  placeholder?: string;
  helper_text?: string;
  sort_order: number;
  is_active: boolean;
  validation_rules: ValidationRules;
  options?: FieldOption[];
  created_at: string;
  updated_at: string;
}

export interface FieldOption {
  id: string;
  field_id: string;
  label: string;
  value: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ValidationRules {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  maxFileSize?: number;
  allowedFileTypes?: string[];
}
