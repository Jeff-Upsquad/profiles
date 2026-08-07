'use client';

import { useRef, useState, type ClipboardEvent, type FormEvent } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { AuthShell } from './LoginTalent';
import { COUNTRY_CODES } from '@/constants/country-codes';

type Step = 'phone' | 'confirm' | 'code' | 'newpass';

interface LookupResult {
  role: 'talent' | 'business';
  masked_name?: string;
  masked_business?: string | null;
  reset_ticket: string;
}

interface ResetSession {
  access_token?: string;
  token?: string;
  refresh_token?: string | null;
  user: { id: string; email: string; role: 'talent' | 'business' };
}

export default function ForgotPassword() {
  const { applyResetSession } = useAuth();

  const [step, setStep] = useState<Step>('phone');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('+91');
  const [loading, setLoading] = useState(false);

  const [lookup, setLookup] = useState<LookupResult | null>(null);

  // Two-word temp password, one word per box.
  const [word1, setWord1] = useState('');
  const [word2, setWord2] = useState('');
  const word2Ref = useRef<HTMLInputElement>(null);

  // Session established once the temp password is verified — held locally (not
  // yet stored globally) so the wizard can collect the new password without the
  // must-reset redirect firing mid-flow.
  const [session, setSession] = useState<ResetSession | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const nationalDigits = phone.replace(countryCode, '');

  const handleLookup = async (e: FormEvent) => {
    e.preventDefault();
    if (!nationalDigits.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.post('/auth/password-reset/lookup', { phone });
      if (!data.found) {
        toast.error("We couldn't find an account with that WhatsApp number.");
        return;
      }
      setLookup({
        role: data.role,
        masked_name: data.masked_name,
        masked_business: data.masked_business,
        reset_ticket: data.reset_ticket,
      });
      setStep('confirm');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendTempPassword = async () => {
    if (!lookup) return;
    setLoading(true);
    try {
      await api.post('/auth/password-reset/send', { reset_ticket: lookup.reset_ticket });
      toast.success('Temporary password sent to your WhatsApp.');
      setStep('code');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not send the temporary password.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (!lookup) return;
    const temp_password = `${word1.trim()}-${word2.trim()}`.toLowerCase();
    if (!word1.trim() || !word2.trim()) {
      toast.error('Enter both words of your temporary password.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/password-reset/verify', {
        reset_ticket: lookup.reset_ticket,
        temp_password,
      });
      // Temp password accepted — hold the session and collect the new password
      // in the next step (don't sign in globally yet).
      setSession(data);
      setStep('newpass');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Incorrect temporary password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    const token = session.access_token || session.token || '';
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    setLoading(true);
    try {
      if (session.user.role === 'business') {
        // The business change endpoint verifies the current password — that's
        // the temp password the user just entered, so pass it transparently.
        const temp_password = `${word1.trim()}-${word2.trim()}`.toLowerCase();
        await api.post(
          '/auth/business/change-password',
          { current_password: temp_password, new_password: newPassword },
          authHeader,
        );
      } else {
        await api.post('/auth/change-password', { new_password: newPassword }, authHeader);
      }
      // New password set and the forced-reset flag cleared — now sign in and
      // land in the portal.
      applyResetSession(session);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not set your new password.');
    } finally {
      setLoading(false);
    }
  };

  const resetToPhone = () => {
    setStep('phone');
    setLookup(null);
    setWord1('');
    setWord2('');
  };

  // Pasting the whole "word-word" temp password (e.g. from the WhatsApp "Copy
  // code" button) should fill both boxes, not dump everything into one. Split on
  // any non-letter separator; a single pasted word fills just the target box.
  const handleWordPaste = (target: 1 | 2) => (e: ClipboardEvent<HTMLInputElement>) => {
    const words = e.clipboardData.getData('text').toLowerCase().match(/[a-z]+/g);
    if (!words || words.length === 0) return;
    e.preventDefault();
    if (words.length >= 2) {
      setWord1(words[0].slice(0, 6));
      setWord2(words[1].slice(0, 6));
      word2Ref.current?.focus();
    } else if (target === 1) {
      setWord1(words[0].slice(0, 6));
      word2Ref.current?.focus();
    } else {
      setWord2(words[0].slice(0, 6));
    }
  };

  return (
    <AuthShell switchHref="/login/talent" switchLabel="Back to login" accent="talent">
      <div className="stagger-1">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-[var(--cu-radius)] bg-brand-purple border-2 border-cu-900 shadow-brutal-sm">
          <svg className="h-5 w-5 text-cu-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <h1 className="font-display text-[1.625rem] font-bold text-cu-900">
          {step === 'code' && 'Enter temporary password'}
          {step === 'newpass' && 'Set a new password'}
          {(step === 'phone' || step === 'confirm') && 'Reset your password'}
        </h1>
        <p className="mt-1 font-ui text-sm text-cu-500">
          {step === 'phone' && 'Enter your registered WhatsApp number to get started.'}
          {step === 'confirm' && 'Confirm this is your account.'}
          {step === 'code' && 'We sent a two-word temporary password to your WhatsApp.'}
          {step === 'newpass' && 'Choose a new password to finish signing in.'}
        </p>
      </div>

      {/* Step 1 — phone */}
      {step === 'phone' && (
        <form onSubmit={handleLookup} className="stagger-2 mt-7 space-y-4">
          <div>
            <label className="font-ui mb-1.5 block text-[13px] font-medium text-cu-700">
              WhatsApp number
            </label>
            <div className="flex items-stretch gap-2">
              <select
                value={countryCode}
                onChange={(e) => {
                  const newCode = e.target.value;
                  const digits = phone.replace(countryCode, '');
                  setCountryCode(newCode);
                  setPhone(newCode + digits);
                }}
                aria-label="Country code"
                className="input-v5"
                style={{ width: 'auto', flex: '0 0 auto' }}
              >
                {COUNTRY_CODES.map((cc) => (
                  <option key={cc.code} value={cc.code}>
                    {cc.label}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={15}
                value={nationalDigits}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 15);
                  setPhone(countryCode + digits);
                }}
                placeholder="98765 43210"
                required
                autoFocus
                className="input-v5 flex-1"
              />
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-v5 btn-v5-primary btn-v5-lg w-full">
            {loading ? 'Checking…' : 'Continue'}
          </button>
        </form>
      )}

      {/* Step 2 — confirm masked identity */}
      {step === 'confirm' && lookup && (
        <div className="stagger-2 mt-7 space-y-4">
          <div className="surface-v5 space-y-2 px-4 py-4">
            <div>
              <span className="font-ui block text-[11px] uppercase tracking-wide text-cu-400">
                {lookup.role === 'business' ? 'Contact name' : 'Name'}
              </span>
              <span className="font-ui text-sm font-semibold text-cu-900">
                {lookup.masked_name || '—'}
              </span>
            </div>
            {lookup.role === 'business' && (
              <div>
                <span className="font-ui block text-[11px] uppercase tracking-wide text-cu-400">
                  Business
                </span>
                <span className="font-ui text-sm font-semibold text-cu-900">
                  {lookup.masked_business || '—'}
                </span>
              </div>
            )}
          </div>
          <p className="font-ui text-xs text-cu-500">
            Names are partly hidden for your security. If this looks like your account, continue and
            we&apos;ll send a temporary password to your WhatsApp.
          </p>
          <button
            type="button"
            onClick={sendTempPassword}
            disabled={loading}
            className="btn-v5 btn-v5-primary btn-v5-lg w-full"
          >
            {loading ? 'Sending…' : 'Yes, this is me — send password'}
          </button>
          <button
            type="button"
            onClick={resetToPhone}
            className="font-ui block w-full text-center text-xs font-medium text-cu-500 underline underline-offset-4 hover:text-cu-900"
          >
            Not you? Use a different number
          </button>
        </div>
      )}

      {/* Step 3 — two-word temp password */}
      {step === 'code' && (
        <form onSubmit={handleVerify} className="stagger-2 mt-7 space-y-4">
          <div>
            <label className="font-ui mb-1.5 block text-[13px] font-medium text-cu-700">
              Temporary password
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={word1}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^a-zA-Z]/g, '').toLowerCase().slice(0, 6);
                  setWord1(v);
                  if (v.length >= 4) word2Ref.current?.focus();
                }}
                onPaste={handleWordPaste(1)}
                placeholder="word"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                className="input-v5 flex-1 text-center tracking-wide"
              />
              <span className="font-display text-lg font-bold text-cu-400">-</span>
              <input
                ref={word2Ref}
                type="text"
                value={word2}
                onChange={(e) =>
                  setWord2(e.target.value.replace(/[^a-zA-Z]/g, '').toLowerCase().slice(0, 6))
                }
                onPaste={handleWordPaste(2)}
                placeholder="word"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="input-v5 flex-1 text-center tracking-wide"
              />
            </div>
            <p className="font-ui mt-2 text-xs text-cu-500">
              Two words, e.g. <span className="font-medium text-cu-700">fish-lamp</span>.
            </p>
          </div>
          <button type="submit" disabled={loading} className="btn-v5 btn-v5-primary btn-v5-lg w-full">
            {loading ? 'Verifying…' : 'Continue'}
          </button>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={sendTempPassword}
              disabled={loading}
              className="font-ui text-xs font-medium text-cu-500 underline underline-offset-4 hover:text-cu-900"
            >
              Resend password
            </button>
            <button
              type="button"
              onClick={resetToPhone}
              className="font-ui text-xs font-medium text-cu-500 underline underline-offset-4 hover:text-cu-900"
            >
              Change number
            </button>
          </div>
        </form>
      )}

      {/* Step 4 — set a new password (in-wizard, no re-entering the temp password) */}
      {step === 'newpass' && (
        <form onSubmit={handleSetNewPassword} className="stagger-2 mt-7 space-y-4">
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
              autoComplete="new-password"
              autoFocus
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
              autoComplete="new-password"
              className="input-v5"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-v5 btn-v5-primary btn-v5-lg w-full">
            {loading ? 'Saving…' : 'Save & sign in'}
          </button>
        </form>
      )}

      <div className="stagger-3 mt-6 border-t border-cu-200 pt-4 text-center font-ui text-xs text-cu-500">
        Remembered it?{' '}
        <Link
          href="/login/talent"
          className="font-medium text-cu-900 underline underline-offset-4 hover:opacity-70"
        >
          Back to login
        </Link>
      </div>
    </AuthShell>
  );
}
