'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import toast from 'react-hot-toast';

export default function SignupAgency() {
  const { signupAgency } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ agency_name: '', email: '', password: '', confirm: '', contact_person: '', phone: '', website: '', location: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [k]: e.target.value }));
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.agency_name.trim()) { toast.error('Agency name required'); return; }
    if (!form.email.trim()) { toast.error('Email required'); return; }
    if (form.password.length < 6) { toast.error('Password min 6 chars'); return; }
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return; }
    setSubmitting(true);
    try {
      await signupAgency({ email: form.email.trim(), password: form.password, agency_name: form.agency_name.trim(), contact_person: form.contact_person || undefined, phone: form.phone || undefined, website: form.website || undefined, location: form.location || undefined });
      toast.success('Agency account created!');
    } catch (err: any) { toast.error(err.response?.data?.message || err.message || 'Signup failed'); }
    finally { setSubmitting(false); }
  };
  return (
    <div className="flex min-h-screen items-start justify-center bg-gradient-to-br from-[#F5F5F6] via-white to-[#F5F5F6] px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0a0a0a] text-lg font-bold text-white">S</div>
            <span className="text-2xl font-bold text-gray-900">UpSquad</span>
          </Link>
          <p className="mt-2 text-sm text-gray-500">Agency signup — create your squad</p>
        </div>
        <Card className="p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-gray-900">Create Agency Account</h2>
          <p className="mt-1 text-sm text-gray-500">Agencies manage squad members, job profiles and a general portfolio.</p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Input label="Agency Name *" value={form.agency_name} onChange={set('agency_name')} placeholder="e.g. Bright Studio" required />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Email *" type="email" value={form.email} onChange={set('email')} placeholder="agency@example.com" required />
              <Input label="Phone" value={form.phone} onChange={set('phone')} placeholder="+91 9..." />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Contact Person" value={form.contact_person} onChange={set('contact_person')} placeholder="Your name" />
              <Input label="Location" value={form.location} onChange={set('location')} placeholder="City, State" />
            </div>
            <Input label="Website" value={form.website} onChange={set('website')} placeholder="https://..." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Password *" type="password" value={form.password} onChange={set('password')} placeholder="Min 6 chars" required />
              <Input label="Confirm Password *" type="password" value={form.confirm} onChange={set('confirm')} placeholder="Re-enter" required />
            </div>
            <Button type="submit" loading={submitting} className="w-full">Create Agency Account</Button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-500">Already have an account? <Link href="/login/agency" className="font-medium text-[#0a0a0a] underline">Sign in</Link></p>
          <p className="mt-2 text-center text-sm text-gray-500">Are you a talent? <Link href="/signup/talent" className="font-medium text-[#0a0a0a] underline">Sign up as Talent</Link></p>
        </Card>
      </div>
    </div>
  );
}
