'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { agencyApi } from '@/services/agency-api';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import toast from 'react-hot-toast';

export default function AgencyGeneralPortfolioView(){
  const qc=useQueryClient();
  const { data: generalPortfolios=[] } = useQuery({queryKey:['agencyGeneral'], queryFn: agencyApi.listGeneral});
  const { data: categories=[] } = useQuery({queryKey:['agencyCategories'], queryFn: async()=>{ const {data}=await api.get('/public/categories'); return data; }});
  const [form,setForm]=useState({ category_id:'' });
  const create=useMutation({
    mutationFn:()=>agencyApi.createGeneral({ category_id: form.category_id }),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:['agencyGeneral']}); toast.success('General portfolio created'); },
    onError:(e:any)=>toast.error(e.response?.data?.message||'Failed')
  });
  return (
    <div className="space-y-6">
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="hero-content">
          <div className="mb-2"><span className="eyebrow-rainbow">{generalPortfolios.length} portfolios</span></div>
          <h1 className="font-[family-name:var(--font-jakarta)] text-[24px] sm:text-[28px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a]">General <span className="text-rainbow">portfolio</span>.</h1>
          <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252]">Like a talent&apos;s job profile, but for the whole agency — one per category, not tied to a single squad member.</p>
        </div>
      </section>

      <Card className="p-6 sm:p-8">
        <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">Create General Portfolio</h2>
        <p className="mt-1 text-sm text-[#737373]">Appears in your total portfolio alongside squad member profiles.</p>
        <div className="mt-5 max-w-md">
          <Select label="Category" value={form.category_id} onChange={e=>setForm({ category_id:e.target.value })} placeholder="Select category" options={(categories as any[]).map((c:any)=>({label:c.name, value:c.id}))} />
        </div>
        <div className="mt-5 flex justify-end max-w-md">
          <Button onClick={()=>create.mutate()} loading={create.isPending} disabled={!form.category_id}>Create General Portfolio</Button>
        </div>
      </Card>

      <div className="space-y-3">
        {generalPortfolios.length===0 && <Card className="p-6 text-sm text-[#737373]">No general portfolios yet. Create one above.</Card>}
        {generalPortfolios.map((p:any)=>(
          <Card key={p.id} className="p-4 flex items-center justify-between">
            <div><div className="text-sm font-medium text-[#0a0a0a]">Category: {(p.category as any)?.name || p.category_id.slice(0,8)}</div><div className="text-xs text-[#737373]">Status: {p.status}</div></div>
            <Button variant="outline" size="sm" onClick={async()=>{ await agencyApi.deleteGeneral(p.id); qc.invalidateQueries({queryKey:['agencyGeneral']}); toast.success('Deleted'); }}>Delete</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
