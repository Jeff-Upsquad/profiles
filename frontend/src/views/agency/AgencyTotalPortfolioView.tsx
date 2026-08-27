'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agencyApi } from '@/services/agency-api';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import toast from 'react-hot-toast';

export default function AgencyTotalPortfolioView(){
  const qc=useQueryClient();
  const { data: squad=[] } = useQuery({queryKey:['agencySquad'], queryFn: agencyApi.listSquad});
  const { data: memberProfiles=[] } = useQuery({queryKey:['agencyMemberProfiles'], queryFn: agencyApi.listMemberProfiles});
  const { data: generalPortfolios=[] } = useQuery({queryKey:['agencyGeneral'], queryFn: agencyApi.listGeneral});
  const { data: total } = useQuery({queryKey:['agencyTotal'], queryFn: agencyApi.total});
  const [form,setForm]=useState({ title:'', file_url:'', target:'' });
  const add=useMutation({
    mutationFn:()=>{
      const isMember=form.target.startsWith('m:');
      const id=form.target.slice(2);
      return agencyApi.addPortfolio({ title: form.title, file_url: form.file_url||undefined, file_name: form.title||'portfolio', file_type:'video', member_profile_id: isMember? id:undefined, general_portfolio_id: !isMember? id:undefined });
    },
    onSuccess:()=>{ qc.invalidateQueries({queryKey:['agencyTotal']}); toast.success('Portfolio item added'); setForm({ title:'', file_url:'', target:'' }); },
    onError:(e:any)=>toast.error(e.response?.data?.message||'Failed')
  });

  const portfolioItems = (total as any)?.portfolio_items || [];
  return (
    <div className="space-y-6">
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="hero-content">
          <div className="mb-2"><span className="eyebrow-rainbow">{memberProfiles.length + generalPortfolios.length} profiles • {portfolioItems.length} items</span></div>
          <h1 className="font-[family-name:var(--font-jakarta)] text-[24px] sm:text-[28px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a]">Total <span className="text-rainbow">portfolio</span>.</h1>
          <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252]">Combined view businesses see: squad members&apos; job profiles + general portfolio. Add items to either.</p>
        </div>
      </section>

      <Card className="p-6 sm:p-8">
        <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">Add Portfolio Item</h2>
        <p className="mt-1 text-sm text-[#737373]">Same uploader talents use — video, image or link.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Input label="Title" value={form.title} onChange={e=>setForm(p=>({...p, title:e.target.value}))} placeholder="Project title" />
          <Input label="File URL or YouTube link" value={form.file_url} onChange={e=>setForm(p=>({...p, file_url:e.target.value}))} placeholder="https://..." />
          <Select label="Attach to" value={form.target} onChange={e=>setForm(p=>({...p, target:e.target.value}))} placeholder="Select profile" options={[...memberProfiles.map((m:any)=>({label:`Member: ${(squad.find((s:any)=>s.id===m.squad_member_id) as any)?.full_name || m.squad_member_id.slice(0,6)} / ${(m.category as any)?.name || ''}`, value:`m:${m.id}`})), ...generalPortfolios.map((g:any)=>({label:`General: ${(g.category as any)?.name || g.category_id.slice(0,6)}`, value:`g:${g.id}`}))]} />
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={()=>add.mutate()} loading={add.isPending} disabled={!form.target || !form.title}>Add Item</Button>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">Squad Members&apos; Profiles ({memberProfiles.length})</h3>
          <div className="mt-3 space-y-2">
            {memberProfiles.length===0 && <div className="text-sm text-[#737373]">No member profiles</div>}
            {memberProfiles.map((p:any)=>(
              <div key={p.id} className="rounded-lg border border-[#E7E7EA] bg-[#F5F5F6] p-3">
                <div className="text-sm font-medium text-[#0a0a0a]">{(squad.find((s:any)=>s.id===p.squad_member_id) as any)?.full_name} • {(p.category as any)?.name || p.category_id.slice(0,8)}</div>
                <div className="text-xs text-[#737373]">Status {p.status}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">General Portfolio ({generalPortfolios.length})</h3>
          <div className="mt-3 space-y-2">
            {generalPortfolios.length===0 && <div className="text-sm text-[#737373]">No general portfolios</div>}
            {generalPortfolios.map((p:any)=>(
              <div key={p.id} className="rounded-lg border border-[#E7E7EA] bg-[#F5F5F6] p-3">
                <div className="text-sm font-medium text-[#0a0a0a]">{(p.category as any)?.name || p.category_id.slice(0,8)}</div>
                <div className="text-xs text-[#737373]">Status {p.status}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">Portfolio Items ({portfolioItems.length})</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {portfolioItems.length===0 && <div className="text-sm text-[#737373]">No items yet — add one above.</div>}
          {portfolioItems.map((it:any)=>(
            <div key={it.id} className="rounded-lg border border-[#E7E7EA] p-3 bg-white">
              <div className="text-sm font-medium truncate text-[#0a0a0a]">{it.title || it.file_name || 'Untitled'}</div>
              <div className="text-xs text-[#737373] truncate">{it.file_url || it.external_url || '—'}</div>
              <div className="mt-1 text-[11px] text-[#a3a3a3]">{it.member_profile_id ? 'Member portfolio' : 'General portfolio'}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
