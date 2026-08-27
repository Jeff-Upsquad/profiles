'use client';
import { Suspense } from 'react';
import LoginSquad from '@/views/auth/LoginSquad';
export default function Page(){ return <Suspense fallback={<div className="h-32 animate-pulse rounded-2xl bg-[#f0f0f0]" />}><LoginSquad /></Suspense>; }
