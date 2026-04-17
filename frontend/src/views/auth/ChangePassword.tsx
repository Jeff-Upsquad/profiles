import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';

export default function ChangePassword() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const mustReset = user?.must_reset_password === true;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/change-password', { new_password: newPassword });
      toast.success('Password updated. Please sign in with your new password.');
      logout();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
          <h2 className="mb-1 text-2xl font-bold text-gray-900">
            {mustReset ? 'Set a new password' : 'Change password'}
          </h2>
          <p className="mb-6 text-sm text-gray-500">
            {mustReset
              ? 'An admin reset your password. Choose a new one to continue.'
              : 'Choose a new password for your account.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="New password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              minLength={6}
              autoComplete="new-password"
            />
            <Input
              label="Confirm new password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              required
              minLength={6}
              autoComplete="new-password"
            />
            <Button type="submit" loading={loading} className="w-full">
              Update password
            </Button>
          </form>

          {!mustReset && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => router.back()}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
