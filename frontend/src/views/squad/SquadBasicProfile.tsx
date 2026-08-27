'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { squadApi } from '@/services/squad-api';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import toast from 'react-hot-toast';

const GENDER_OPTIONS = [{label:'Male',value:'male'},{label:'Female',value:'female'},{label:'Other',value:'other'},{label:'Prefer not to say',value:'prefer_not_to_say'}];

export default function SquadBasicProfile(){
  const qc=useQueryClient();
  const { data: me } = useQuery({ queryKey:['squadMe'], queryFn: squadApi.me });
  const [form,setForm]=useState({ full_name:'', role_title:'', phone:'', age:'', gender:'', current_location:'', languages:'', skills:'', bio:'', experience_years:'', experience_months:'' });
  useEffect(()=>{ if(me){ setForm({ full_name: (me as any).full_name||'', role_title: (me as any).role_title||'', phone: (me as any).phone||'', age: (me as any).age?String((me as any).age):'', gender: (me as any).gender||'', current_location: (me as any).current_location||'', languages: ((me as any).languages_spoken||[]).map((l:any)=>l.language).join(', '), skills: ((me as any).skills||[]).join(', '), bio: (me as any).bio||'', experience_years: (me as any).experience_years?String((me as any).experience_years):'', experience_months: (me as any).experience_months?String((me as any).experience_months):'' }); } },[me]);
  const save=useMutation({
    mutationFn:()=> squadApi.updateMe({
      full_name: form.full_name||undefined,
      role_title: form.role_title||null,
      phone: form.phone||null,
      age: form.age? Number(form.age):null,
      gender: form.gender||null,
      current_location: form.current_location||null,
      languages_spoken: form.languages? form.languages.split(',').map(s=>({language:s.trim(), proficiency:'native'})).filter(s=>s.language):null,
      skills: form.skills? form.skills.split(',').map((s:string)=>s.trim()).filter(Boolean):null,
      bio: form.bio||null,
      experience_years: form.experience_years? Number(form.experience_years):null,
      experience_months: form.experience_months? Number(form.experience_months):null,
    }),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:['squadMe']}); toast.success('Basic profile saved — agency can view it'); },
    onError:(e:any)=> toast.error(e.response?.data?.message||'Failed')
  });
  return (
    <div className="space-y-6">
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="hero-content">
          <div className="mb-2"><span className="eyebrow-rainbow">Basic Profile</span></div>
          <h1 className="font-[family-name:var(--font-jakarta)] text-[24px] sm:text-[28px] font-semibold tracking-[-0.025em] text-[#0a0a0a]">Your <span className="text-rainbow">basic profile</span>.</h1>
          <p className="mt-1.5 text-sm text-[#525252]">Same fields as talent — agency can view and edit this anytime.</p>
        </div>
      </section>
      <Card className="p-6 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full Name *" value={form.full_name} onChange={e=>setForm(p=>({...p, full_name:e.target.value}))} />
          <Input label="Role / Title" value={form.role_title} onChange={e=>setForm(p=>({...p, role_title:e.target.value}))} placeholder="Designer" />
          <Input label="Phone" value={form.phone} onChange={e=>setForm(p=>({...p, phone:e.target.value}))} />
          <Input label="Current Location" value={form.current_location} onChange={e=>setForm(p=>({...p, current_location:e.target.value}))} />
          <Input label="Age" type="number" value={form.age} onChange={e=>setForm(p=>({...p, age:e.target.value}))} />
          <Select label="Gender" value={form.gender} onChange={e=>setForm(p=>({...p, gender:e.target.value}))} placeholder="Select" options={GENDER_OPTIONS} />
          <Input label="Languages (comma)" value={form.languages} onChange={e=>setForm(p=>({...p, languages:e.target.value}))} placeholder="English, Hindi" />
          <Input label="Skills (comma)" value={form.skills} onChange={e=>setForm(p=>({...p, skills:e.target.value}))} placeholder="Figma, React" />
          <Input label="Exp Years" type="number" value={form.experience_years} onChange={e=>setForm(p=>({...p, experience_years:e.target.value}))} />
          <Input label="Exp Months" type="number" value={form.experience_months} onChange={e=>setForm(p=>({...p, experience_months:e.target.value}))} />
        </div>
        <div className="mt-4">
          <label className="mb-1.5 block text-[13px] font-medium">Bio</label>
          <textarea className="block w-full rounded-lg border border-[#E7E7EA] px-3 py-2.5 text-sm" rows={3} value={form.bio} onChange={e=>setForm(p=>({...p, bio:e.target.value}))} placeholder="Short bio" />
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={()=>save.mutate()} loading={save.isPending}>Save Basic Profile</Button>
        </div>
        <p className="mt-3 text-xs text-[#737373]">Agency can also edit this — changes sync both ways.</p>
      </Card>
    </div>
  );
}
