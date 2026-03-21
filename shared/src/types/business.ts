export type InterestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface BusinessUser {
  id: string;
  company_name: string;
  company_website?: string;
  industry?: string;
  company_size?: string;
  contact_person_name: string;
  contact_email: string;
  contact_phone?: string;
  company_logo_url?: string;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Shortlist {
  id: string;
  business_user_id: string;
  talent_profile_id: string;
  created_at: string;
  talent_profile?: import('./talent').TalentProfile;
}

export interface InterestRequest {
  id: string;
  business_user_id: string;
  talent_profile_id: string;
  message?: string;
  status: InterestStatus;
  responded_at?: string;
  created_at: string;
  updated_at: string;
  talent_profile?: import('./talent').TalentProfile;
  business_user?: BusinessUser;
}
