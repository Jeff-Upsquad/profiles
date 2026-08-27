'use client';
import { useQuery } from '@tanstack/react-query';
import { squadApi } from '@/services/squad-api';
import { useAuth } from '@/context/AuthContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Link from 'next/link';

export default function SquadDashboard(){
  const { user } = useAuth();
  const { data: me } = useQuery({ queryKey:['squadMe'], queryFn: squadApi.me });
  const { data: profiles=[] } = useQuery({ queryKey:['squadProfiles'], queryFn: squadApi.listProfiles });
  const isManager = user?.role==='squad_manager';
  return (
    <div className="space-y-6">
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="hero-content">
          <div className="mb-2"><span className="eyebrow-rainbow">{isManager? 'Squad Manager':'Squad Member'}</span></div>
          <h1 className="font-[family-name:var(--font-jakarta)] text-[24px] sm:text-[28px] font-semibold tracking-[-0.025em] text-[#0a0a0a]">Welcome, <span className="text-rainbow">{(me as any)?.full_name || user?.email?.split('@')[0]||'there'}</span>.</h1>
          <p className="mt-1.5 text-sm text-[#525252]">Manage your basic profile and job profiles — same as talent, but limited. Your agency can view and edit these.</p>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <div className="text-sm text-[#525252]">Basic Profile</div>
          <div className="mt-1 text-sm font-medium text-[#0a0a0a]">{(me as any)?.full_name || '—'} • {(me as any)?.role_title||'No role'}</div>
          <div className="mt-1 text-xs text-[#737373]">{(me as any)?.email||(me as any)?.invite_email||user?.email}</div>
          <Link href="/squad/profile"><Button size="sm" variant="outline" className="mt-3">Edit Basic Profile</Button></Link>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-[#525252]">Job Profiles</div>
          <div className="mt-1 text-3xl font-bold">{profiles.length}</div>
          <div className="text-xs text-[#737373]">Restricted to categories your agency offers</div>
          <Link href="/squad/profiles"><Button size="sm" className="mt-3">Manage Job Profiles</Button></Link>
        </Card>
      </div>
      <Card className="p-5">
        <h3 className="font-semibold text-[#0a0a0a]">How it works</h3>
        <ul className="mt-2 list-disc pl-5 text-sm text-[#525252] space-y-1">
          <li>Fill your basic profile (like talent) — agency can view it</li>
          <li>Create job profiles — only within agency&apos;s service categories</li>
          <li>Agency can edit your basic profile and job details anytime</li>
        </ul>
      </Card>
    </div>
  );
}
