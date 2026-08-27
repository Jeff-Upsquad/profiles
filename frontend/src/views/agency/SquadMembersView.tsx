'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agencyApi } from '@/services/agency-api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import toast from 'react-hot-toast';

const GENDER_OPTIONS = [{label:'Male',value:'male'},{label:'Female',value:'female'},{label:'Other',value:'other'},{label:'Prefer not to say',value:'prefer_not_to_say'}];

function InviteSlider({ open, onClose, role, onSuccess }: { open: boolean; onClose: ()=>void; role: 'member'|'manager'; onSuccess: ()=>void }){
  const router = useRouter();
  const [form,setForm]=useState({ full_name:'', email:'' });
  const [created,setCreated]=useState<any>(null);
  const qc=useQueryClient();
  const { data: me } = useQuery({ queryKey:['agencyMe'], queryFn: agencyApi.me });
  const inviteMut = useMutation({
    mutationFn: ()=> agencyApi.createSquadInvite({ full_name: form.full_name, email: form.email, role_type: role }),
    onSuccess: (data)=>{
      setCreated(data);
      toast.success(`${role==='manager'?'Manager':'Member'} invite created`);
      qc.invalidateQueries({queryKey:['agencySquad']});
      onSuccess();
    },
    onError:(e:any)=> toast.error(e.response?.data?.message||'Failed to create invite')
  });

  const handleCopyInviteDetails = async()=>{
    if(!created) return;
    const email = created.invite_email || created.email;
    const name = created.full_name || form.full_name;
    const origin = window.location.origin;
    const link = `${origin}/signup/squad?email=${encodeURIComponent(email)}`;
    const agencyName = (me as any)?.agency_name || 'Your agency';
    const text = `You're invited to join ${agencyName} as ${role==='manager'?'Squad Manager':'Squad Member'}!\n\n`+
      `Name: ${name}\nEmail: ${email}\n\n`+
      `Steps to join:\n`+
      `1. Open this link: ${link}\n`+
      `2. Enter your invited email: ${email}\n`+
      `3. Create a password only — no other fields needed at signup\n`+
      `4. Sign in at ${origin}/login/squad with your email and new password\n\n`+
      `After signup you can manage your basic profile and job profiles. Your agency can view and edit these anytime.\n`+
      `Link: ${link}`;
    try{
      await navigator.clipboard.writeText(text);
      toast.success('Full invite details copied');
    }catch{
      // fallback
      const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); toast.success('Invite details copied');
    }
    // also try to share via Web Share API if available
    if((navigator as any).share){
      try{ await (navigator as any).share({ title: `Join ${agencyName}`, text }); }catch{}
    }
  };

  if(!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-[440px] flex-col bg-white shadow-[-8px_0_40px_rgba(0,0,0,0.12)] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-[#E7E7EA] px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">Add {role==='manager'?'Squad Manager':'Squad Member'}</h2>
            <p className="text-xs text-[#737373]">Invite via email — they sign up with password only</p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-[#E7E7EA] p-2 hover:bg-[#F5F5F6]">✕</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Invite form */}
          <div className="space-y-4">
            <Input label="Full Name *" value={form.full_name} onChange={e=>setForm(p=>({...p, full_name:e.target.value}))} placeholder="Jane Doe" />
            <Input label="Email ID *" type="email" value={form.email} onChange={e=>setForm(p=>({...p, email:e.target.value}))} placeholder="jane@example.com" helperText="They'll use this email to sign up" />
            <Button onClick={()=>inviteMut.mutate()} loading={inviteMut.isPending} disabled={!form.full_name.trim() || !form.email.trim()} className="w-full">Create Invite</Button>
            <p className="text-[11px] text-[#a3a3a3]">They will have a unique login page — enter invited email + create password only.</p>
          </div>

          {/* New section appears after invite — as per spec */}
          {created && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 animate-[fadeIn_0.3s]">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Invite sent to {created.invite_email || created.email}
              </div>
              <div className="mt-3 rounded-lg bg-white border border-emerald-200 p-3 text-xs">
                <div className="font-medium text-[#0a0a0a]">Share this with them:</div>
                <div className="mt-1 text-[#525252]">1. Go to <span className="font-mono bg-[#F5F5F6] px-1.5 py-0.5 rounded">/signup/squad</span></div>
                <div className="text-[#525252]">2. Enter email <span className="font-medium">{created.invite_email||created.email}</span></div>
                <div className="text-[#525252]">3. Create password only — no other fields needed</div>
                <div className="mt-3 rounded-lg bg-[#F5F5F6] border border-[#E7E7EA] p-2.5 text-[11px] text-[#525252] break-all">
                  <div className="font-medium text-[#0a0a0a] mb-1">Full invite details (copied):</div>
                  {`You're invited to join ${(me as any)?.agency_name || 'your agency'} as ${role==='manager'?'Squad Manager':'Squad Member'}! Email: ${created.invite_email||created.email} → ${window.location.origin}/signup/squad?email=${encodeURIComponent(created.invite_email||created.email)} → enter email + create password only → sign in at /login/squad`}
                </div>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={handleCopyInviteDetails}>Copy Invite Details</Button>
                  <Button size="sm" variant="outline" onClick={()=>{ setForm({full_name:'',email:''}); setCreated(null); }}>Invite Another</Button>
                </div>
              </div>
              <div className="mt-3 text-xs text-emerald-700">Status: <span className="font-medium">Invited — awaiting signup</span> • They’ll appear as Active after they set password.</div>
            </div>
          )}

          {/* Create directly — now opens full page, not part of three steps */}
          <div className="border-t border-[#E7E7EA] pt-5">
            <h3 className="text-sm font-semibold text-[#0a0a0a]">Or create directly</h3>
            <p className="mt-1 text-xs text-[#737373]">Agency can create squad {role} directly — only basic profile is needed, full details are optional.</p>
            <Button size="sm" variant="outline" className="mt-3 w-full" onClick={()=>{ onClose(); router.push(`/agency/squad/create?role=${role}`); }}>Create Directly — Full Page</Button>
            <p className="mt-1.5 text-[11px] text-[#a3a3a3]">Opens full basic-profile form (like Talent) — name, contact, location, skills. No need to fill full details.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SquadMembersView(){
  const router = useRouter();
  const qc=useQueryClient();
  const { data: squad=[] } = useQuery({ queryKey:['agencySquad'], queryFn: agencyApi.listSquad });
  const [sliderOpen,setSliderOpen]=useState(false);
  const [sliderRole,setSliderRole]=useState<'member'|'manager'>('member');
  const [editing,setEditing]=useState<any>(null);
  const [viewMember,setViewMember]=useState<any>(null);
  const [menuOpen,setMenuOpen]=useState<string|null>(null);
  const [editForm,setEditForm]=useState({ full_name:'', role_title:'', email:'', phone:'', current_location:'', bio:'', skills:'', experience_years:'', experience_months:'' });

  const openSlider = (role:'member'|'manager')=>{ setSliderRole(role); setSliderOpen(true); };

  const startEdit=(m:any)=>{ setEditing(m); setEditForm({ full_name:m.full_name||'', role_title:m.role_title||'', email:m.email||m.invite_email||'', phone:m.phone||'', current_location:m.current_location||'', bio:m.bio||'', skills:(m.skills||[]).join(', '), experience_years:m.experience_years?String(m.experience_years):'', experience_months:m.experience_months?String(m.experience_months):'' }); };
  const saveEdit=useMutation({
    mutationFn:()=> agencyApi.updateSquad(editing.id, { full_name: editForm.full_name, role_title: editForm.role_title||null, email: editForm.email||null, phone: editForm.phone||null, current_location: editForm.current_location||null, bio: editForm.bio||null, skills: editForm.skills? editForm.skills.split(',').map((s:string)=>s.trim()).filter(Boolean):null, experience_years: editForm.experience_years? Number(editForm.experience_years):null, experience_months: editForm.experience_months? Number(editForm.experience_months):null } as any),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:['agencySquad']}); setEditing(null); toast.success('Updated'); },
    onError:(e:any)=> toast.error(e.response?.data?.message||'Failed')
  });

  return (
    <div className="space-y-6">
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="hero-content">
          <div className="mb-2"><span className="eyebrow-rainbow">{squad.length} members</span></div>
          <h1 className="font-[family-name:var(--font-jakarta)] text-[24px] sm:text-[28px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a]">Your <span className="text-rainbow">squad</span>.</h1>
          <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252]">Invite members/managers or create directly. Squad members get a limited dashboard (basic profile + job profiles) restricted to your agency&apos;s categories.</p>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button onClick={()=>openSlider('member')}>Add New Squad Member</Button>
        <Button variant="outline" onClick={()=>openSlider('manager')}>Add Squad Manager</Button>
      </div>

      <InviteSlider open={sliderOpen} onClose={()=>setSliderOpen(false)} role={sliderRole} onSuccess={()=>qc.invalidateQueries({queryKey:['agencySquad']})} />

      {menuOpen && <div className="fixed inset-0 z-10" onClick={()=>setMenuOpen(null)} />}

      {/* Squad list */}
      <div className="grid gap-3 sm:grid-cols-2">
        {squad.length===0 && <Card className="p-6 text-sm text-[#737373]">No squad members yet. Invite or create your first.</Card>}
        {squad.map((m:any)=>(
          <Card key={m.id} className="p-4 flex gap-3 items-start relative">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5F5F6] border border-[#E7E7EA] font-semibold text-sm">{m.full_name?.slice(0,2).toUpperCase()}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-medium text-[#0a0a0a] truncate">{m.full_name}</div>
                {m.role_type==='manager' && <span className="rounded-full bg-[#FFFAC2] border border-[#0a0a0a] px-2 py-0.5 text-[10px] font-semibold">Manager</span>}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${m.status==='invited'?'bg-amber-50 border-amber-200 text-amber-700': m.status==='active'?'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-gray-50 border-[#E7E7EA] text-[#737373]'}`}>{m.status||'active'}</span>
              </div>
              <div className="text-xs text-[#737373] truncate">{m.role_title || '—'} {m.current_location? `• ${m.current_location}`:''} {m.email||m.invite_email? `• ${m.email||m.invite_email}`:''}</div>
              <div className="mt-1 text-xs text-[#737373]">{m.experience_years||0}y {m.experience_months||0}m experience</div>
              {m.skills?.length>0 && <div className="mt-2 flex flex-wrap gap-1">{m.skills.slice(0,6).map((s:string)=><span key={s} className="rounded-full bg-[#F5F5F6] border border-[#E7E7EA] px-2 py-0.5 text-[11px] font-medium">{s}</span>)}</div>}
              <div className="mt-2 flex gap-1.5 items-center">
                <Button size="sm" variant="outline" onClick={()=>router.push(`/agency/squad/${m.id}`)}>View</Button>
                <Button size="sm" onClick={()=>router.push(`/agency/squad/${m.id}/edit`)}>Edit Talent</Button>
                <div className="relative ml-auto">
                  <button onClick={()=>setMenuOpen(menuOpen===m.id?null:m.id)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E7E7EA] bg-white hover:bg-[#F5F5F6]">⋮</button>
                  {menuOpen===m.id && (
                    <div className="absolute right-0 top-9 z-20 w-44 rounded-xl border border-[#E7E7EA] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)] overflow-hidden">
                      <button onClick={async()=>{ setMenuOpen(null); if(!confirm('Remove this talent? This will delete their profile and job details.')) return; await agencyApi.deleteSquad(m.id); qc.invalidateQueries({queryKey:['agencySquad']}); toast.success('Talent removed'); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 text-left">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Remove Talent
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* View modal — agency can view squad member basic profile & job details */}
      {viewMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={()=>setViewMember(null)} />
          <Card className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-[#0a0a0a]">{viewMember.full_name} — Details</h3>
              <Button size="sm" variant="outline" onClick={()=>setViewMember(null)}>Close</Button>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div><span className="font-medium">Email:</span> {viewMember.email||viewMember.invite_email||'—'}</div>
              <div><span className="font-medium">Role:</span> {viewMember.role_title||'—'} {viewMember.role_type==='manager'?' (Manager)':''}</div>
              <div><span className="font-medium">Status:</span> {viewMember.status}</div>
              <div><span className="font-medium">Location:</span> {viewMember.current_location||'—'}</div>
              <div><span className="font-medium">Bio:</span> {viewMember.bio||'—'}</div>
              <div><span className="font-medium">Skills:</span> {(viewMember.skills||[]).join(', ')||'—'}</div>
              <div className="pt-3 border-t border-[#E7E7EA]">
                <div className="font-medium">Job Profiles</div>
                <p className="text-xs text-[#737373]">Agency can view squad member&apos;s job profiles here. They appear in Total Portfolio.</p>
                <ViewMemberProfiles memberId={viewMember.id} />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={()=>setEditing(null)} />
          <Card className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto p-6">
            <h3 className="font-semibold text-[#0a0a0a]">Edit Squad Member — {editing.full_name}</h3>
            <p className="text-xs text-[#737373]">Agency can edit basic profile and job details of each squad member.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Input label="Full Name" value={editForm.full_name} onChange={e=>setEditForm(p=>({...p, full_name:e.target.value}))} />
              <Input label="Role" value={editForm.role_title} onChange={e=>setEditForm(p=>({...p, role_title:e.target.value}))} />
              <Input label="Email" value={editForm.email} onChange={e=>setEditForm(p=>({...p, email:e.target.value}))} />
              <Input label="Phone" value={editForm.phone} onChange={e=>setEditForm(p=>({...p, phone:e.target.value}))} />
              <Input label="Location" value={editForm.current_location} onChange={e=>setEditForm(p=>({...p, current_location:e.target.value}))} />
              <Input label="Skills (comma)" value={editForm.skills} onChange={e=>setEditForm(p=>({...p, skills:e.target.value}))} />
              <div className="grid grid-cols-2 gap-2">
                <Input label="Exp Years" value={editForm.experience_years} onChange={e=>setEditForm(p=>({...p, experience_years:e.target.value}))} />
                <Input label="Exp Months" value={editForm.experience_months} onChange={e=>setEditForm(p=>({...p, experience_months:e.target.value}))} />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-[13px] font-medium">Bio</label>
                <textarea className="block w-full rounded-lg border border-[#E7E7EA] px-3 py-2.5 text-sm" rows={2} value={editForm.bio} onChange={e=>setEditForm(p=>({...p, bio:e.target.value}))} />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={()=>setEditing(null)}>Cancel</Button>
              <Button onClick={()=>saveEdit.mutate()} loading={saveEdit.isPending}>Save</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function ViewMemberProfiles({ memberId }: { memberId: string }){
  const { data: profiles=[] } = useQuery({ queryKey:['agencyMemberProfiles'], queryFn: async()=>{
    const { data } = await import('@/services/api').then(m=>m.default.get('/agency/member-profiles'));
    return (data as any[]).filter((p:any)=> p.squad_member_id===memberId);
  }});
  if(profiles.length===0) return <div className="mt-2 text-xs text-[#737373]">No job profiles yet.</div>;
  return <div className="mt-2 space-y-2">{profiles.map((p:any)=><div key={p.id} className="rounded-lg border border-[#E7E7EA] p-2 text-xs"><div className="font-medium">Category: {(p.category as any)?.name||p.category_id.slice(0,8)}</div><div className="text-[#737373]">Status: {p.status}</div></div>)}</div>;
}
