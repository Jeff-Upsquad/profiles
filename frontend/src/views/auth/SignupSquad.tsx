'use client';
import { useState, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { squadApi } from '@/services/squad-api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import toast from 'react-hot-toast';

export default function SignupSquad(){
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [submitting,setSubmitting]=useState(false);
  useEffect(()=>{ const e=searchParams.get('email'); if(e) setEmail(e); },[searchParams]);
  const handleSubmit=async(e:FormEvent)=>{
    e.preventDefault();
    if(!email.trim()){ toast.error('Email is required'); return; }
    if(password.length<6){ toast.error('Password min 6 chars'); return; }
    if(password!==confirm){ toast.error('Passwords do not match'); return; }
    setSubmitting(true);
    try{
      await squadApi.signup({ email: email.trim(), password });
      toast.success('Account created — please sign in');
      router.push(`/login/squad?email=${encodeURIComponent(email.trim())}`);
    }catch(err:any){ toast.error(err.response?.data?.message||'Signup failed — check invite'); }
    finally{ setSubmitting(false); }
  };
  return (
    <div className="flex min-h-screen items-start justify-center bg-gradient-to-br from-[#F5F5F6] via-white to-[#F5F5F6] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0a0a0a] text-lg font-bold text-white">S</div>
            <span className="text-2xl font-bold text-gray-900">UpSquad</span>
          </Link>
          <p className="mt-2 text-sm text-gray-500">Squad member signup — password only</p>
        </div>
        <Card className="p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-gray-900">Create Squad Account</h2>
          <p className="mt-1 text-sm text-gray-500">Enter your invited email and create a password. No other fields needed.</p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Input label="Invited Email *" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="invited@example.com" required />
            <Input label="Password *" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min 6 characters" required />
            <Input label="Confirm Password *" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Re-enter" required />
            <Button type="submit" loading={submitting} className="w-full">Create Account</Button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-500">Already have an account? <Link href="/login/squad" className="font-medium underline">Sign in</Link></p>
        </Card>
      </div>
    </div>
  );
}
