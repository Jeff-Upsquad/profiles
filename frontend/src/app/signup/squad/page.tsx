'use client';
import { Suspense } from 'react';
import SignupSquad from '@/views/auth/SignupSquad';
export default function Page(){ return <Suspense fallback={<div className="h-32 animate-pulse rounded-2xl bg-[#f0f0f0]" />}><SignupSquad /></Suspense>; }
