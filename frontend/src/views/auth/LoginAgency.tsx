'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import toast from 'react-hot-toast';

export default function LoginAgency() {
  const { agencyLogin } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const handle = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try { await agencyLogin(form.email.trim(), form.password); toast.success('Welcome back!'); } catch (err: any) { toast.error(err.message || 'Login failed'); } finally { setSubmitting(false); }
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F5F5F6] via-white to-[#F5F5F6] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0a0a0a] text-lg font-bold text-white">S</div>
            <span className="text-2xl font-bold text-gray-900">UpSquad</span>
          </Link>
          <p className="mt-2 text-sm text-gray-500">Agency sign in</p>
        </div>
        <Card className="p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-gray-900">Agency Login</h2>
          <p className="mt-1 text-sm text-gray-500">Sign in to manage your squad</p>
          <form onSubmit={handle} className="mt-6 space-y-4">
            <Input label="Email" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="agency@example.com" required />
            <Input label="Password" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" required />
            <Button type="submit" loading={submitting} className="w-full">Sign In</Button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-500">No account? <Link href="/signup/agency" className="font-medium text-[#0a0a0a] underline">Create agency</Link></p>
        </Card>
      </div>
    </div>
  );
}
