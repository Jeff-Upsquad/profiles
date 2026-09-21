'use client';

import Input from '@/components/ui/Input';

export default function SignupCredentials({
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
}: {
  password: string;
  confirmPassword: string;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
}) {
  const passwordError = password.length > 0 && password.length < 8
    ? 'Password must be at least 8 characters.'
    : undefined;
  const confirmPasswordError = confirmPassword.length > 0 && password !== confirmPassword
    ? 'Passwords do not match.'
    : undefined;

  return (
    <div id="field-password" className="card-saas mt-5 px-6 py-9 sm:mt-6 sm:px-10 sm:py-11">
      <div className="grid grid-cols-1 gap-x-12 gap-y-7 lg:grid-cols-[260px_1fr]">
        <div>
          <p className="font-mono-editorial text-[11px] uppercase tracking-[0.16em] text-canvas-400">Final step</p>
          <h2 className="font-display-saas mt-3 text-2xl font-bold text-canvas-900">Create your SquadHire account</h2>
          <p className="mt-3 text-sm text-canvas-500">Use this password to continue your training and profile after signup.</p>
        </div>
        <div className="space-y-5">
          <Input
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            error={passwordError}
            aria-invalid={!!passwordError}
          />
          <Input
            label="Confirm password"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => onConfirmPasswordChange(e.target.value)}
            error={confirmPasswordError}
            aria-invalid={!!confirmPasswordError}
          />
          <p className="text-xs text-canvas-500">At least 8 characters. You may select both Job and UpSquad Partner Program.</p>
        </div>
      </div>
    </div>
  );
}
