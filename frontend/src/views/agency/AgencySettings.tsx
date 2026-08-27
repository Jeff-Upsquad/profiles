'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { agencyApi } from '@/services/agency-api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import toast from 'react-hot-toast';

export default function AgencySettings(){
  const { user } = useAuth();
  const [form,setForm]=useState({ agency_name:'', contact_email:'', whatsapp_number:'' });
  const [loading,setLoading]=useState(false);
  useEffect(()=>{ agencyApi.me().then((me:any)=> setForm({ agency_name: me.agency_name||'', contact_email: me.contact_email||me.email||'', whatsapp_number: me.whatsapp_number||me.phone||'' })).catch(()=>{}); },[]);
  const save=async(e:React.FormEvent)=>{ e.preventDefault(); setLoading(true); try{ await agencyApi.updateMe({ agency_name: form.agency_name, contact_email: form.contact_email||null, whatsapp_number: form.whatsapp_number||null, phone: form.whatsapp_number||null }); toast.success('Settings saved'); }catch(err:any){ toast.error(err.response?.data?.message||'Failed'); } finally{ setLoading(false); } };
  return (
    <div className="space-y-6">
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="hero-content">
          <div className="mb-2"><span className="eyebrow-rainbow">Settings</span></div>
          <h1 className="font-[family-name:var(--font-jakarta)] text-[24px] sm:text-[28px] font-semibold tracking-[-0.025em] text-[#0a0a0a]">Settings</h1>
          <p className="mt-1.5 text-sm text-[#525252]">Notification settings + account — mirrors talent&apos;s Settings.</p>
        </div>
      </section>
      <Card className="p-6 sm:p-8">
        <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">Account</h3>
        <form onSubmit={save} className="mt-4 space-y-4">
          <Input label="Agency Name" value={form.agency_name} onChange={e=>setForm(p=>({...p, agency_name:e.target.value}))} />
          <Input label="Email" value={user?.email||''} disabled helperText="Email cannot be changed" />
          <Input label="Contact Email" value={form.contact_email} onChange={e=>setForm(p=>({...p, contact_email:e.target.value}))} placeholder="contact@agency.com" />
          <Input label="WhatsApp Number" value={form.whatsapp_number} onChange={e=>setForm(p=>({...p, whatsapp_number:e.target.value}))} placeholder="+91 9..." helperText="For notifications" />
          <div className="flex justify-end"><Button type="submit" loading={loading}>Save Changes</Button></div>
        </form>
      </Card>
      <Card className="p-6">
        <h3 className="font-semibold text-[#0a0a0a]">Notification Settings</h3>
        <p className="mt-1 text-sm text-[#737373]">Same as talent — choose what you&apos;re notified about.</p>
        <div className="mt-3 space-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> New interest from businesses</label>
          <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Assignment updates</label>
          <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Chat messages</label>
        </div>
      </Card>
    </div>
  );
}
