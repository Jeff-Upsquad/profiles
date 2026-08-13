'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import api from '@/services/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export type LoginField = 'email' | 'phone' | 'password';

const COUNTRY_CODES = [
  { code: '+91', flag: '🇮🇳' },
  { code: '+1', flag: '🇺🇸' },
  { code: '+44', flag: '🇬🇧' },
  { code: '+971', flag: '🇦🇪' },
  { code: '+65', flag: '🇸🇬' },
  { code: '+61', flag: '🇦🇺' },
  { code: '+49', flag: '🇩🇪' },
  { code: '+33', flag: '🇫🇷' },
  { code: '+81', flag: '🇯🇵' },
  { code: '+86', flag: '🇨🇳' },
];

const FIELD_LABEL: Record<LoginField, string> = {
  email: 'login email',
  phone: 'login phone',
  password: 'password',
};

interface Props {
  field: LoginField;
  /** Current login email — shown as the "from" value for the email flow. */
  currentEmail?: string;
  onClose: () => void;
  /** Called after the change is applied so the parent can refetch + toast. */
  onDone: () => void;
}

export default function LoginDetailsModal({ field, currentEmail, onClose, onDone }: Props) {
  const [step, setStep] = useState<'request' | 'code'>('request');
  const [loading, setLoading] = useState(false);

  const [ticket, setTicket] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [delivered, setDelivered] = useState(true);

  const [code, setCode] = useState('');

  // New-value inputs (only the relevant ones are used per field).
  const [newEmail, setNewEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const codeRef = useRef<HTMLInputElement>(null);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sendCode = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/business/login-update/send', { field });
      setTicket(data.ticket);
      setMaskedPhone(data.masked_phone);
      setDelivered(data.delivered);
      setStep('code');
      if (data.delivered) {
        toast.success('Verification code sent to your WhatsApp.');
      }
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not send the verification code.');
    } finally {
      setLoading(false);
    }
  };

  const buildNewValue = (): string | null => {
    if (field === 'email') {
      const v = newEmail.trim();
      if (!v) {
        toast.error('Enter your new login email.');
        return null;
      }
      return v;
    }
    if (field === 'phone') {
      const digits = newPhone.replace(/\D/g, '');
      if (!digits) {
        toast.error('Enter your new phone number.');
        return null;
      }
      return `${countryCode} ${digits}`;
    }
    // password
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return null;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return null;
    }
    return newPassword;
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error('Enter the code we sent to your WhatsApp.');
      return;
    }
    const new_value = buildNewValue();
    if (new_value === null) return;

    setLoading(true);
    try {
      await api.post('/auth/business/login-update/verify', {
        ticket,
        code: code.trim(),
        new_value,
      });
      toast.success(`Your ${FIELD_LABEL[field]} has been updated.`);
      onDone();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not apply the change.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-[#E7E7EA] bg-white p-6 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#0a0a0a]">
              Change {FIELD_LABEL[field]}
            </h2>
            <p className="mt-0.5 text-sm text-[#737373]">
              {step === 'request'
                ? 'For your security, we’ll send a verification code to your registered WhatsApp before making this change.'
                : `Enter the 6-digit code we sent to your WhatsApp${
                    maskedPhone ? ` (${maskedPhone})` : ''
                  }, then choose your new ${FIELD_LABEL[field]}.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-[#737373] hover:bg-[#f0f0f0]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === 'request' && (
          <div className="space-y-4">
            <Button onClick={sendCode} loading={loading} className="w-full" size="lg">
              Send verification code
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="block w-full text-center text-sm font-medium text-[#737373] hover:text-[#0a0a0a]"
            >
              Cancel
            </button>
          </div>
        )}

        {step === 'code' && (
          <form onSubmit={handleVerify} className="space-y-4">
            {!delivered && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                We couldn’t confirm WhatsApp delivery. If the code doesn’t arrive shortly, please
                contact support.
              </p>
            )}

            <Input
              ref={codeRef}
              label="Verification code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              className="tracking-[0.3em]"
            />

            {field === 'email' && (
              <Input
                label="New login email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="you@company.com"
                helperText={currentEmail ? `Current: ${currentEmail}` : undefined}
              />
            )}

            {field === 'phone' && (
              <div className="w-full">
                <label className="mb-1.5 block text-[13px] font-medium text-[#3F3F46]">
                  New login phone
                </label>
                <div className="flex overflow-hidden rounded-lg border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] focus-within:border-[#0a0a0a] focus-within:ring-2 focus-within:ring-[#0a0a0a]/12">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="shrink-0 border-0 bg-transparent py-2.5 pl-3 pr-1 text-sm text-[#0a0a0a] focus:outline-none"
                    aria-label="Country code"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>
                  <span className="my-2 w-px self-stretch bg-[#E7E7EA]" />
                  <input
                    type="tel"
                    inputMode="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="Phone number"
                    className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm text-[#0a0a0a] placeholder:text-[#a3a3a3] focus:outline-none"
                  />
                </div>
              </div>
            )}

            {field === 'password' && (
              <>
                <Input
                  label="New password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
                <Input
                  label="Confirm new password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
                />
              </>
            )}

            <Button type="submit" loading={loading} className="w-full" size="lg">
              Verify & save
            </Button>
            <button
              type="button"
              onClick={sendCode}
              disabled={loading}
              className="block w-full text-center text-xs font-medium text-[#737373] underline underline-offset-4 hover:text-[#0a0a0a]"
            >
              Resend code
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
