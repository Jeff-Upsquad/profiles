export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface Invitation {
  id: string;
  email: string;
  role: 'talent' | 'business';
  status: InvitationStatus;
  company_name?: string;
  contact_person_name?: string;
  expires_at?: string;
  invited_by: string;
  accepted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface BusinessCategorySubscription {
  id: string;
  business_user_id: string;
  category_id: string;
  assigned_by: string;
  created_at: string;
  category?: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    icon_url?: string;
  };
}

export interface BusinessSharedProfile {
  id: string;
  business_user_id: string;
  talent_profile_id: string;
  category_id: string;
  shared_by: string;
  created_at: string;
}
