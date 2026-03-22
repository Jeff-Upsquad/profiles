import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';

export default function SignupBusiness() {
  const { signupBusiness } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    company_name: '',
    company_website: '',
    industry: '',
    company_size: '',
    contact_person_name: '',
    contact_email: '',
    contact_phone: '',
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signupBusiness({
        email: form.email,
        password: form.password,
        company_name: form.company_name,
        company_website: form.company_website || undefined,
        industry: form.industry || undefined,
        company_size: form.company_size || undefined,
        contact_person_name: form.contact_person_name,
        contact_email: form.contact_email,
        contact_phone: form.contact_phone || undefined,
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
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
              S
            </div>
            <span className="text-2xl font-bold text-gray-900">SquadHire</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
          <h2 className="mb-1 text-2xl font-bold text-gray-900">Create Business Account</h2>
          <p className="mb-6 text-sm text-gray-500">
            Discover and connect with talented professionals
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Company Name"
                value={form.company_name}
                onChange={set('company_name')}
                placeholder="Acme Inc."
                required
              />
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="you@company.com"
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
                label="Company Website"
                value={form.company_website}
                onChange={set('company_website')}
                placeholder="https://company.com"
              />
              <Input
                label="Industry"
                value={form.industry}
                onChange={set('industry')}
                placeholder="Film, Advertising..."
              />
            </div>

            <Select
              label="Company Size"
              value={form.company_size}
              onChange={set('company_size')}
              placeholder="Select company size"
              options={[
                { label: '1-10 employees', value: '1-10' },
                { label: '11-50 employees', value: '11-50' },
                { label: '51-200 employees', value: '51-200' },
                { label: '201-500 employees', value: '201-500' },
                { label: '500+ employees', value: '500+' },
              ]}
            />

            <div className="border-t border-gray-200 pt-4">
              <p className="mb-3 text-sm font-medium text-gray-700">Contact Person</p>
              <div className="space-y-4">
                <Input
                  label="Contact Person Name"
                  value={form.contact_person_name}
                  onChange={set('contact_person_name')}
                  placeholder="John Doe"
                  required
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Contact Email"
                    type="email"
                    value={form.contact_email}
                    onChange={set('contact_email')}
                    placeholder="john@company.com"
                    required
                  />
                  <Input
                    label="Contact Phone"
                    type="tel"
                    value={form.contact_phone}
                    onChange={set('contact_phone')}
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>
              </div>
            </div>

            <Button type="submit" loading={loading} className="w-full">
              Create Account
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-800">
              Sign in
            </Link>
          </div>
          <div className="mt-2 text-center text-sm text-gray-500">
            Are you a professional?{' '}
            <Link to="/signup/talent" className="font-medium text-indigo-600 hover:text-indigo-800">
              Sign up as Talent
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
