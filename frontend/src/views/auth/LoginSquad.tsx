'use client';
import { useState, type FormEvent, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import toast from 'react-hot-toast';

export default function LoginSquad(){
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [submitting,setSubmitting]=useState(false);
  useEffect(()=>{ const e=searchParams.get('email'); if(e) setEmail(e); },[searchParams]);
  const handle=async(e:FormEvent)=>{
    e.preventDefault();
    setSubmitting(true);
    try{
      await login(email.trim(), password);
      toast.success('Welcome');
    }catch(err:any){ toast.error(err.response?.data?.message||err.message||'Login failed'); }
    finally{ setSubmitting(false); }
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F5F5F6] via-white to-[#F5F5F6] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0a0a0a] text-lg font-bold text-white">S</div>
            <span className="text-2xl font-bold text-gray-900">UpSquad</span>
          </Link>
          <p className="mt-2 text-sm text-gray-500">Squad member sign in</p>
        </div>
        <Card className="p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-gray-900">Squad Login</h2>
          <p className="mt-1 text-sm text-gray-500">Use your invited email and password</p>
          <form onSubmit={handle} className="mt-6 space-y-4">
            <Input label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="invited@example.com" required />
            <Input label="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••" required />
            <Button type="submit" loading={submitting} className="w-full">Sign In</Button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-500">Invited? <Link href="/signup/squad" className="font-medium underline">Create password</Link></p>
        </Card>
      </div>
    </div>
  );
}
