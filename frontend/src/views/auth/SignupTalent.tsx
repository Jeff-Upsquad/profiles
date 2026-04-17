import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import LanguagePicker, { type LanguageEntry } from '@/components/forms/LanguagePicker';
import toast from 'react-hot-toast';

export default function SignupTalent() {
  const { signupTalent } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    age: '',
    gender: '',
    native_place: '',
    current_location: '',
  });
  const [languages, setLanguages] = useState<LanguageEntry[]>([]);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signupTalent({
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        phone: form.phone || undefined,
        age: form.age ? Number(form.age) : undefined,
        gender: form.gender || undefined,
        native_place: form.native_place || undefined,
        current_location: form.current_location || undefined,
        languages_spoken: languages.filter((e) => e.language).length > 0
          ? languages.filter((e) => e.language)
          : undefined,
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
              S
            </div>
            <span className="text-2xl font-bold text-gray-900">SquadHire</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
          <h2 className="mb-1 text-2xl font-bold text-gray-900">Create Talent Account</h2>
          <p className="mb-4 text-sm text-gray-500">
            Showcase your skills and get discovered by businesses
          </p>
          <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-sm text-amber-800">
              Signup is by invitation only. Use the email address your invitation was sent to.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Full Name"
                value={form.full_name}
                onChange={set('full_name')}
                placeholder="Your full name"
                required
              />
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="you@example.com"
                required
              />
            </div>

            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={set('password')}
              placeholder="Minimum 8 characters"
              required
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Phone"
                type="tel"
                value={form.phone}
                onChange={set('phone')}
                placeholder="+91 XXXXX XXXXX"
              />
              <Input
                label="Age"
                type="number"
                value={form.age}
                onChange={set('age')}
                placeholder="25"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Gender"
                value={form.gender}
                onChange={set('gender')}
                placeholder="Select gender"
                options={[
                  { label: 'Male', value: 'male' },
                  { label: 'Female', value: 'female' },
                  { label: 'Other', value: 'other' },
                ]}
              />
              <Input
                label="Native Place"
                value={form.native_place}
                onChange={set('native_place')}
                placeholder="Your hometown"
              />
            </div>

            <Input
              label="Current Location"
              value={form.current_location}
              onChange={set('current_location')}
              placeholder="City, State"
            />

            <LanguagePicker value={languages} onChange={setLanguages} />

            <Button type="submit" loading={loading} className="w-full">
              Create Account
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/login/talent" className="font-medium text-indigo-600 hover:text-indigo-800">
              Sign in
            </Link>
          </div>
          <div className="mt-2 text-center text-sm text-gray-500">
            Are you a business?{' '}
            <Link href="/signup/business" className="font-medium text-indigo-600 hover:text-indigo-800">
              Sign up as Business
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
