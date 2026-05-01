import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface UpdateUserPayload {
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
