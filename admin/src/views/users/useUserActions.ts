import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';

export function useUserActions() {
  const queryClient = useQueryClient();

  const invalidateLists = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users-talent'] });
    queryClient.invalidateQueries({ queryKey: ['admin-users-business'] });
  };

  const suspendUser = useMutation({
    mutationFn: async ({ userId, suspend }: { userId: string; suspend: boolean }) => {
      await api.patch(`/admin/users/${userId}/suspend`, { suspend });
    },
    onSuccess: (_data, vars) => {
      invalidateLists();
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', vars.userId] });
      toast.success(vars.suspend ? 'User suspended' : 'User unsuspended');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update user');
    },
  });

  const setUserActive = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      await api.patch(`/admin/users/talent/${userId}/active`, { is_active: isActive });
    },
    onSuccess: (_data, vars) => {
      invalidateLists();
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', vars.userId] });
      toast.success(vars.isActive ? 'Talent marked active' : 'Talent marked inactive');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update visibility');
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/admin/users/${userId}`);
    },
    onSuccess: () => {
      invalidateLists();
      toast.success('User permanently deleted');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    },
  });

  return { suspendUser, setUserActive, deleteUser };
}
