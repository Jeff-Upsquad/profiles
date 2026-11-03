'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export interface TalentSignupOtpState {
  identity: string;
  challenge_id: string;
  code: string;
  expiresAt: number;
  resendAt: number;
}
const identity = (phone: string, email: string) => JSON.stringify([
  phone.trim().replace(/[\s()-]/g, ''), email.trim().toLowerCase(),
]);
export function signupOtpValue(value: TalentSignupOtpState | null, phone: string, email: string) {
  if (!value || value.identity !== identity(phone, email) || value.expiresAt <= Date.now() || !/^\d{6}$/.test(value.code)) return undefined;
  return { challenge_id: value.challenge_id, code: value.code };
}

export default function TalentSignupOtp({ phone, email, name, value, onChange, disabled = false }: {
  phone: string; email: string; name: string;
  value: TalentSignupOtpState | null; onChange: (value: TalentSignupOtpState | null) => void;
  disabled?: boolean;
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(0);
  const current = value?.identity === identity(phone, email) ? value : null;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = Math.max(0, Math.ceil(((value?.resendAt ?? 0) - now) / 1000));

  async function send() {
    setSending(true);
    setError('');
    // An unsuccessful resend must not leave an invalidated old code in use.
    onChange(null);
    try {
      const { data } = await axios.post('/api/auth/signup/talent/send-code', { phone, email, full_name: name });
      const sentAt = Date.now();
      setNow(sentAt);
      onChange({ identity: identity(phone, email), challenge_id: data.challenge_id, code: '',
        expiresAt: sentAt + data.expires_in * 1000, resendAt: sentAt + data.resend_after * 1000 });
    } catch (err) {
      setError(axios.isAxiosError(err) ? err.response?.data?.message || 'Could not send your WhatsApp code. Try again.' : 'Could not send your WhatsApp code. Try again.');
    } finally { setSending(false); }
  }

  return <section className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4" aria-label="WhatsApp verification">
    <p className="text-sm font-semibold text-gray-900">Verify your WhatsApp number</p>
    <p className="text-sm text-gray-600">We’ll send a 6-digit code to your WhatsApp number. Enter it below to create your account.</p>
    <Button type="button" variant="outline" loading={sending} disabled={disabled || remaining > 0}
      onClick={send}>{remaining > 0 ? `Resend in ${remaining}s` : current ? 'Resend WhatsApp code' : 'Send WhatsApp code'}</Button>
    {current && <>
      <p role="status" className="text-sm text-gray-600">Code sent to {phone}. It expires in 10 minutes.</p>
      <Input label="WhatsApp code" id="signup-whatsapp-code" inputMode="numeric" autoComplete="one-time-code"
        maxLength={6} value={current.code} disabled={disabled || sending}
        onChange={(event) => onChange({ ...current, code: event.target.value.replace(/\D/g, '').slice(0, 6) })}
        placeholder="6-digit code" />
      {now >= current.expiresAt && <p role="alert" className="text-sm text-red-600">Your code has expired. Request a new code.</p>}
    </>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </section>;
}
