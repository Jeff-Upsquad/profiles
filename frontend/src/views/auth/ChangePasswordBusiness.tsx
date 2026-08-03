'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { AuthShell } from './LoginTalent';

export default function ChangePasswordBusiness() {
  const router = useRouter();
  const { refetchUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/business/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success('Password updated');
      await refetchUser();
      router.push('/business/hire');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell switchHref="/business/hire" switchLabel="Find talent" accent="business">
      <div className="stagger-1">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-[var(--cu-radius)] bg-brand-pink border-2 border-cu-900 shadow-brutal-sm">
          <svg className="h-5 w-5 text-cu-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <h1 className="font-display text-[1.625rem] font-bold text-cu-900">
          Set a new password
        </h1>
        <p className="mt-1 font-ui text-sm text-cu-500">
          Your password was reset. Enter the temporary password we sent you, then
          choose a new one.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="stagger-2 mt-7 space-y-4">
        <div>
          <label className="font-ui mb-1.5 block text-[13px] font-medium text-cu-700">
            Temporary password
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="The password we sent you"
            required
            className="input-v5"
          />
        </div>

        <div>
          <label className="font-ui mb-1.5 block text-[13px] font-medium text-cu-700">
            New password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
            minLength={8}
            className="input-v5"
          />
        </div>

        <div>
          <label className="font-ui mb-1.5 block text-[13px] font-medium text-cu-700">
            Confirm new password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your new password"
            required
            minLength={8}
            className="input-v5"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-v5 btn-v5-primary btn-v5-lg w-full"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Updating…
            </span>
          ) : (
            'Update password'
          )}
        </button>
      </form>
    </AuthShell>
  );
}
