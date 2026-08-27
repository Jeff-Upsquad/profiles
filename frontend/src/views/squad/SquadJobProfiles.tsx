'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { squadApi } from '@/services/squad-api';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import toast from 'react-hot-toast';

export default function SquadJobProfiles(){
  const qc=useQueryClient();
  const { data: allowed=[] } = useQuery({ queryKey:['squadAllowedCats'], queryFn: squadApi.allowedCategories });
  const { data: profiles=[] } = useQuery({ queryKey:['squadProfiles'], queryFn: squadApi.listProfiles });
  const [cat,setCat]=useState('');
  const create=useMutation({
    mutationFn:()=> squadApi.createProfile({ category_id: cat }),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:['squadProfiles']}); toast.success('Job profile created'); setCat(''); },
    onError:(e:any)=> toast.error(e.response?.data?.message||'Failed — check agency categories')
  });
  const isRestricted = allowed.length>0;
  return (
    <div className="space-y-6">
      <section className="hero-container hero-glow-orange relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="hero-content">
          <div className="mb-2"><span className="eyebrow-rainbow">{profiles.length} profiles • {allowed.length||'all'} allowed</span></div>
          <h1 className="font-[family-name:var(--font-jakarta)] text-[24px] sm:text-[28px] font-semibold tracking-[-0.025em] text-[#0a0a0a]">Job <span className="text-rainbow">Profiles</span>.</h1>
          <p className="mt-1.5 text-sm text-[#525252]">{isRestricted? 'You can only create profiles for categories your agency offers — e.g. Designer/Editor if that’s what agency signed up for.':'Create profiles — your agency has no restriction yet.'} Agency can view and edit these.</p>
        </div>
      </section>

      <Card className="p-6 sm:p-8">
        <h2 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">Create Job Profile</h2>
        <p className="text-sm text-[#737373]">Restricted to agency&apos;s service categories.</p>
        <div className="mt-4 max-w-md">
          <Select label="Category" value={cat} onChange={e=>setCat(e.target.value)} placeholder={allowed.length? 'Select allowed category':'No allowed categories — ask agency to set services'} options={allowed.map((c:any)=>({label:c.name, value:c.id}))} />
        </div>
        <div className="mt-4 flex justify-end max-w-md">
          <Button onClick={()=>create.mutate()} loading={create.isPending} disabled={!cat}>Create Profile</Button>
        </div>
        {isRestricted && allowed.length===0 && <p className="mt-2 text-xs text-amber-600">Your agency hasn&apos;t set services yet — you can&apos;t create profiles until they do.</p>}
      </Card>

      <div className="space-y-3">
        {profiles.length===0 && <Card className="p-6 text-sm text-[#737373]">No job profiles yet.</Card>}
        {profiles.map((p:any)=>(
          <Card key={p.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-[#0a0a0a]">Category: {(p.category as any)?.name || p.category_id.slice(0,8)}</div>
              <div className="text-xs text-[#737373]">Status: {p.status} • {new Date(p.created_at).toLocaleDateString()}</div>
            </div>
            <Button variant="outline" size="sm" onClick={async()=>{ await squadApi.deleteProfile(p.id); qc.invalidateQueries({queryKey:['squadProfiles']}); toast.success('Deleted'); }}>Delete</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
