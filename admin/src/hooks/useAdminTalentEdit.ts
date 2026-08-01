import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';

export interface UpdateUserPayload {
  full_name?: string;
  phone?: string;
  age?: number | null;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
  native_place?: string | null;
  current_location?: string | null;
  languages_spoken?: { language: string; proficiency: string }[];
  profile_photo_url?: string | null;
}

export function useUpdateTalentUser(userId: string, profileId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateUserPayload) => {
      const { data } = await api.put(`/admin/talents/users/${userId}`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['talent-profile', profileId] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update talent');
    },
  });
}

interface UpdateProfilePayload {
  field_data?: Record<string, any>;
  resume_url?: string | null;
}

export function useUpdateTalentProfile(profileId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateProfilePayload) => {
      const { data } = await api.put(`/admin/talents/profiles/${profileId}`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['talent-profile', profileId] });
      qc.invalidateQueries({ queryKey: ['admin-portfolio', profileId] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update profile');
    },
  });
}

// Variants used by the admin user-detail page — invalidate the
// `admin-user-detail` query and surface success toasts.

export function useAdminUpdateTalentUser(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateUserPayload) => {
      const { data } = await api.put(`/admin/talents/users/${userId}`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-user-detail', userId] });
      toast.success('User updated');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update');
    },
  });
}

export interface UpdateBasicProfilePayload {
  permanent_address?: string | null;
  permanent_country?: string | null;
  permanent_state?: string | null;
  permanent_district?: string | null;
  permanent_city?: string | null;
  permanent_pin_code?: string | null;
  current_address?: string | null;
  country?: string | null;
  state?: string | null;
  current_district?: string | null;
  city?: string | null;
  pin_code?: string | null;
  availability?: ('full_time' | 'part_time')[] | null;
  job_type?: ('remote' | 'office' | 'hybrid' | 'field')[] | null;
  employment_type?: ('salary' | 'freelance' | 'partner_program')[] | null;
  virtual_office_hours?: { day: string; from: string; to: string }[] | null;
  // Partner Program: per-day committed hours ({day, hours}); office windows
  // reuse virtual_office_hours above.
  daily_available_hours?: { day: string; hours: number }[] | null;
  // Freelance Preference checkbox — "Available to take freelance work".
  freelance_available?: boolean | null;
  education_courses?: {
    from_year: number;
    from_month: number;
    to_year: number;
    to_month: number;
    course_name: string;
    institution: string;
  }[] | null;
  experience?: {
    from_year: number;
    from_month: number;
    to_year: number;
    to_month: number;
    company_name: string;
    designation: string;
  }[] | null;
  aadhaar_number?: string | null;
  aadhaar_file_url?: string | null;
  pan_number?: string | null;
  pan_file_url?: string | null;
  profile_picture_url?: string | null;
  bank_account_holder?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc_code?: string | null;
  bank_branch_name?: string | null;
  resume_url?: string | null;
  expected_salary_monthly?: number | null;
  expected_salary_full_time?: number | null;
  expected_salary_part_time?: number | null;
}

export function useAdminUpdateBasicProfile(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateBasicProfilePayload) => {
      const { data } = await api.put(`/admin/users/${userId}/basic-profile`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-user-detail', userId] });
      toast.success('Profile updated');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update profile');
    },
  });
}
