import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import api from '@/services/api';
import toast from 'react-hot-toast';

type LoginMode = 'talent' | 'business';
type BusinessIdentifier = 'email' | 'phone';

export default function Login() {
  const { login, businessLogin } = useAuth();
  const [mode, setMode] = useState<LoginMode>('talent');
  const [bizIdentifier, setBizIdentifier] = useState<BusinessIdentifier>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [accessExpired, setAccessExpired] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'business') {
        await businessLogin(bizIdentifier === 'email' ? { email } : { phone });
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      if (mode === 'business' && err.response?.status === 403) {
        setAccessExpired(true);
      } else {
        toast.error(err.response?.data?.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAccess = async () => {
    setRequestLoading(true);
    try {
      await api.post(
        '/auth/request-access',
        bizIdentifier === 'email' ? { email } : { phone }
      );
      setRequestSent(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send request');
    } finally {
      setRequestLoading(false);
    }
  };

  const resetExpiredState = () => {
    setAccessExpired(false);
    setRequestSent(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
              S
            </div>
            <span className="text-2xl font-bold text-gray-900">SquadHire</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
          <h2 className="mb-1 text-2xl font-bold text-gray-900">Welcome back</h2>
          <p className="mb-6 text-sm text-gray-500">
            Sign in to your account to continue
          </p>

          {/* Mode Toggle */}
          <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => { setMode('talent'); resetExpiredState(); }}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                mode === 'talent'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Talent Login
            </button>
            <button
              type="button"
              onClick={() => { setMode('business'); resetExpiredState(); }}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                mode === 'business'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Business Login
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'business' && (
              <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => { setBizIdentifier('email'); resetExpiredState(); }}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    bizIdentifier === 'email'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => { setBizIdentifier('phone'); resetExpiredState(); }}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    bizIdentifier === 'phone'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Phone
                </button>
              </div>
            )}

            {mode === 'business' && bizIdentifier === 'phone' ? (
              <Input
                label="Phone"
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); resetExpiredState(); }}
                placeholder="+91 98765 43210"
                required
              />
            ) : (
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); resetExpiredState(); }}
                placeholder="you@example.com"
                required
              />
            )}

            {mode === 'talent' && (
              <>
                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
                <div className="flex items-center justify-end">
                  <Link
                    href="/forgot-password"
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    Forgot password?
                  </Link>
                </div>
              </>
            )}

            {mode === 'business' && (
              <p className="text-xs text-gray-500">
                Business users log in with the email or phone they were invited with. No password required.
              </p>
            )}

            <Button type="submit" loading={loading} className="w-full">
              {mode === 'business' ? 'Log In' : 'Sign In'}
            </Button>
          </form>

          {accessExpired && mode === 'business' && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
              {requestSent ? (
                <p className="text-sm text-green-700">
                  Your request has been sent to the administrator. You will be contacted when access is restored.
                </p>
              ) : (
                <>
                  <p className="mb-3 text-sm text-red-700">
                    Your access has expired. Please contact the administrator or request access renewal below.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRequestAccess}
                    loading={requestLoading}
                  >
                    Request Access
                  </Button>
                </>
              )}
            </div>
          )}

          {mode === 'talent' && (
            <div className="mt-6 text-center text-sm text-gray-500">
              Have an invitation?{' '}
              <Link href="/signup/talent" className="font-medium text-indigo-600 hover:text-indigo-800">
                Sign up as Talent
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
