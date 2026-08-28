'use client';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import { agencyApi } from '@/services/agency-api';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import toast from 'react-hot-toast';

export default function AgencyJobProfilesView(){
  const qc=useQueryClient();
  const router=useRouter();
  const { data: squad=[] } = useQuery({queryKey:['agencySquad'], queryFn: agencyApi.listSquad});
  const { data: memberProfiles=[] } = useQuery({queryKey:['agencyMemberProfiles'], queryFn: agencyApi.listMemberProfiles});
  const { data: categories=[] } = useQuery({queryKey:['agencyCategories'], queryFn: async()=>{ const {data}=await api.get('/public/categories'); return data; }});
  const { data: me } = useQuery({queryKey:['agencyMe'], queryFn: agencyApi.me});
  const [form,setForm]=useState({ squad_member_id:'', category_id:'' });
  const [expanded, setExpanded]=useState<Record<string, boolean>>({});
  const create=useMutation({
    mutationFn:()=>agencyApi.createMemberProfile({ squad_member_id: form.squad_member_id, category_id: form.category_id }),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:['agencyMemberProfiles']}); toast.success('Job profile created'); setForm({ squad_member_id:'', category_id:'' }); },
    onError:(e:any)=>toast.error(e.response?.data?.message||'Failed — check you picked member & category')
  });

  const grouped = useMemo(()=>{
    const byCat: Record<string, { category: any; profiles: any[] }> = {};
    for(const p of memberProfiles as any[]){
      const catId = p.category_id;
      const cat = (p.category as any) || (categories as any[]).find((c:any)=>c.id===catId) || { id: catId, name: catId.slice(0,8) };
      if(!byCat[catId]) byCat[catId] = { category: cat, profiles: [] };
      byCat[catId].profiles.push(p);
    }
    return Object.values(byCat).sort((a,b)=> (a.category.name||'').localeCompare(b.category.name||''));
  },[memberProfiles, categories]);

  const totalProfiles = memberProfiles.length;
  const categoryCount = grouped.length;

  const handleViewPublic = (categoryId: string)=>{
    const agencyId = (me as any)?.id;
    if(!agencyId){
      toast.error('Agency ID not found');
      return;
    }
    router.push(`/agency/preview?category_id=${categoryId}&agencyId=${agencyId}`);
  };
  return (
    <div className="space-y-6">
      <section className="hero-container hero-glow-orange relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="hero-content">
          <div className="mb-2"><span className="eyebrow-rainbow">{totalProfiles} profiles • {categoryCount} {categoryCount===1?'category':'categories'}</span></div>
          <h1 className="font-[family-name:var(--font-jakarta)] text-[24px] sm:text-[28px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a]">Job profiles <span className="text-rainbow">per squad member</span>.</h1>
          <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252]">Same as talent job profiles — pick a squad member and a category. Each member can have multiple categories.</p>
        </div>
      </section>

      <Card className="p-6 sm:p-8">
        <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">Create Job Profile</h2>
        <p className="mt-1 text-sm text-[#737373]">Connects to any squad member — like talents do for themselves.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Select label="Squad Member" value={form.squad_member_id} onChange={e=>setForm(p=>({...p, squad_member_id:e.target.value}))} placeholder="Select member" options={squad.map((m:any)=>({label: m.full_name, value: m.id}))} />
          <Select label="Category" value={form.category_id} onChange={e=>setForm(p=>({...p, category_id:e.target.value}))} placeholder="Select category" options={(categories as any[]).map((c:any)=>({label:c.name, value:c.id}))} />
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={()=>create.mutate()} loading={create.isPending} disabled={!form.squad_member_id || !form.category_id}>Create Profile</Button>
        </div>
      </Card>

      {/* Grouped by category */}
      <div className="space-y-4">
        {grouped.length===0 && <Card className="p-6 text-sm text-[#737373]">No job profiles yet. Pick a member and category above to create your first profile — e.g. Designer, Video Editor, Accountant.</Card>}
        {grouped.map(({category, profiles}: any)=>{
          const isExpanded = expanded[category.id] ?? true;
          return (
            <Card key={category.id} className="overflow-hidden">
              <button
                type="button"
                onClick={()=>setExpanded(prev=>({ ...prev, [category.id]: !isExpanded }))}
                className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 hover:bg-[#F5F5F6] transition-colors text-left"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-[#FFFAC2] px-2.5 py-1 text-xs font-semibold text-[#0a0a0a]">{category.name}</span>
                    <span className="text-xs text-[#737373]">{profiles.length} {profiles.length===1?'member':'members'}</span>
                  </div>
                  <div className="mt-1 text-sm font-medium text-[#0a0a0a] truncate">{category.name} profile</div>
                  <div className="text-xs text-[#737373]">{profiles.length} squad {profiles.length===1?'member':'members'} added</div>
                </div>
                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#E7E7EA] bg-white text-[#525252] transition-transform ${isExpanded?'rotate-180':''}`}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </span>
              </button>

              <div className="px-4 sm:px-5 pb-3 flex justify-end border-t border-[#F5F5F6]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e)=>{ e.stopPropagation(); handleViewPublic(category.id); }}
                  className="mt-3"
                >
                  View Public Profile
                </Button>
              </div>

              {isExpanded && (
                <div className="border-t border-[#E7E7EA] bg-[#FAFAFA]">
                  <div className="divide-y divide-[#E7E7EA]">
                    {profiles.map((p:any)=>{
                      const member = (squad.find((m:any)=>m.id===p.squad_member_id) as any);
                      return (
                        <div key={p.id} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 bg-white hover:bg-[#F5F5F6] transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-[#F5F5F6] border border-[#E7E7EA] flex items-center justify-center">
                              {member?.profile_photo_url || member?.profile_picture_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={member.profile_photo_url || member.profile_picture_url} alt={member.full_name} className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-xs font-semibold text-[#0a0a0a]">{(member?.full_name || '?').slice(0,2).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-[#0a0a0a] truncate">{member?.full_name || p.squad_member_id.slice(0,8)}</div>
                              <div className="text-xs text-[#737373]">Status: {p.status} • {new Date(p.created_at).toLocaleDateString()}</div>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" onClick={async()=>{ await agencyApi.deleteMemberProfile(p.id); qc.invalidateQueries({queryKey:['agencyMemberProfiles']}); toast.success('Deleted'); }}>Delete</Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
