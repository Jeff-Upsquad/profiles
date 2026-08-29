'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agencyApi } from '@/services/agency-api';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import toast from 'react-hot-toast';
import { COUNTRIES, INDIAN_STATES, DISTRICTS_BY_STATE } from '@/constants/india-locations';
import { useUpload } from '@/hooks/useUpload';
import api from '@/services/api';

const AGENCY_LANGUAGES = [
  'English',
  'Hindi',
  'Malayalam',
  'Tamil',
  'Kannada',
  'Telugu',
  'Bengali',
  'Marathi',
  'Gujarati',
  'Urdu',
  'Odia',
  'Punjabi',
  'Assamese',
  'Arabic',
  'French',
  'German',
  'Spanish',
  'Portuguese',
];

export default function AgencyProfileForm(){
  const qc=useQueryClient();
  const { data: agencyProfile } = useQuery({ queryKey:['agencyProfile'], queryFn: agencyApi.getProfile });
  const { data: me } = useQuery({ queryKey:['agencyMe'], queryFn: agencyApi.me });
  const { data: categories=[] } = useQuery({ queryKey:['agencyCategories'], queryFn: async()=>{ const {data}=await api.get('/public/categories'); return data as any[]; }});
  const { uploadFile, uploading } = useUpload();
  const [languageSelect, setLanguageSelect] = useState('');
  const [form,setForm]=useState<any>({
    agency_name:'', agency_short_name:'', tagline:'', about:'', team_size:'', services:[] as string[],
    languages:[] as string[],
    location_country:'India', location_state:'', location_district:'', location_city:'', address:'', pincode:'',
    founded_year:'', logo_url:'',
    contact_person:'', contact_email:'', whatsapp_number:''
  });

  const normalizeLanguages = (val:any): string[]=>{
    if(!val) return [];
    if(Array.isArray(val)){
      return val.map((v:any)=> typeof v==='string'? v : v?.language).filter(Boolean);
    }
    return [];
  };

  useEffect(()=>{
    if(me || agencyProfile){
      setForm((prev:any)=>({
        ...prev,
        agency_name: (me as any)?.agency_name || prev.agency_name || '',
        agency_short_name: (me as any)?.agency_short_name || (me as any)?.short_form || (agencyProfile as any)?.agency_short_name || (agencyProfile as any)?.short_form || prev.agency_short_name || '',
        contact_person: (me as any)?.contact_person || prev.contact_person || '',
        contact_email: (me as any)?.contact_email || (me as any)?.email || prev.contact_email || '',
        whatsapp_number: (me as any)?.whatsapp_number || (me as any)?.phone || prev.whatsapp_number || '',
        tagline: (agencyProfile as any)?.tagline||prev.tagline||'',
        about: (agencyProfile as any)?.about||prev.about||'',
        team_size: (agencyProfile as any)?.team_size||prev.team_size||'',
        services: Array.isArray((agencyProfile as any)?.services)? (agencyProfile as any).services: prev.services||[],
        languages: normalizeLanguages((agencyProfile as any)?.languages ?? (agencyProfile as any)?.languages_spoken) .length ? normalizeLanguages((agencyProfile as any)?.languages ?? (agencyProfile as any)?.languages_spoken) : prev.languages||[],
        location_country: (agencyProfile as any)?.location_country||prev.location_country||'India',
        location_state: (agencyProfile as any)?.location_state||prev.location_state||'',
        location_district: (agencyProfile as any)?.location_district||prev.location_district||'',
        location_city: (agencyProfile as any)?.location_city||prev.location_city||'',
        address: (agencyProfile as any)?.address||prev.address||'',
        pincode: (agencyProfile as any)?.pincode||prev.pincode||'',
        founded_year: (agencyProfile as any)?.founded_year?String((agencyProfile as any).founded_year):prev.founded_year||'',
        logo_url: (agencyProfile as any)?.logo_url || (me as any)?.logo_url || prev.logo_url || ''
      }));
    }
  },[agencyProfile, me]);

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>)=>{
    const v=e.target.value;
    setForm((prev:any)=>({ ...prev, location_country: v, location_state:'', location_district:'', location_city:'' }));
  };
  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>)=>{
    const v=e.target.value;
    setForm((prev:any)=>({ ...prev, location_state: v, location_district:'', location_city:'' }));
  };

  const yearsSince = (()=>{ const y=Number(form.founded_year); if(!y || y<1900 || y> new Date().getFullYear()) return null; return new Date().getFullYear() - y; })();

  const toggleService = (val:string)=>{
    setForm((prev:any)=>{
      const cur:string[] = Array.isArray(prev.services)? prev.services: [];
      const next = cur.includes(val) ? cur.filter(s=>s!==val) : [...cur, val];
      return { ...prev, services: next };
    });
  };

  const handleLanguageSelect = (val:string)=>{
    if(!val) return;
    setForm((prev:any)=>{
      const cur:string[] = Array.isArray(prev.languages)? prev.languages: [];
      if(cur.includes(val)) return prev;
      return { ...prev, languages: [...cur, val] };
    });
    setLanguageSelect('');
  };

  const removeLanguage = (val:string)=>{
    setForm((prev:any)=>({ ...prev, languages: (prev.languages||[]).filter((l:string)=>l!==val) }));
  };

  const handleLogoUpload = async()=>{
    const input=document.createElement('input');
    input.type='file';
    input.accept='image/*';
    input.onchange=async(e)=>{
      const file=(e.target as HTMLInputElement).files?.[0];
      if(!file) return;
      try{ const url=await uploadFile(file,'agency-logos'); setForm((p:any)=>({...p, logo_url:url})); toast.success('Logo uploaded'); }catch{ toast.error('Upload failed'); }
    };
    input.click();
  };

  const save=useMutation({
    mutationFn: async()=>{
      if(!form.agency_name?.trim()) throw new Error('Agency name is required');
      if(form.pincode && !/^\d{6}$/.test(form.pincode)) throw new Error('Pincode must be 6 digits');
      if(form.whatsapp_number && !/^\+?\d{8,15}$/.test(form.whatsapp_number.replace(/[\s-]/g,''))) throw new Error('Enter a valid WhatsApp number');
      const profilePayload:any = {
        tagline: form.tagline||null,
        about: form.about||null,
        team_size: form.team_size||null,
        services: form.services?.length? form.services:null,
        languages: form.languages?.length? form.languages:null,
        location_country: form.location_country||null,
        location_state: form.location_state||null,
        location_district: form.location_district||null,
        location_city: form.location_city||null,
        address: form.address||null,
        pincode: form.pincode||null,
        founded_year: form.founded_year? Number(form.founded_year):null,
      };
      const userPayload:any = {
        agency_name: form.agency_name?.trim(),
        agency_short_name: form.agency_short_name?.trim()||null,
        short_form: form.agency_short_name?.trim()||null,
        contact_person: form.contact_person||null,
        contact_email: form.contact_email||null,
        whatsapp_number: form.whatsapp_number||null,
        phone: form.whatsapp_number||null,
        logo_url: form.logo_url||null,
      };
      await agencyApi.updateProfile(profilePayload);
      await agencyApi.updateMe(userPayload).catch(()=>{});
    },
    onSuccess:()=>{ qc.invalidateQueries({queryKey:['agencyProfile']}); qc.invalidateQueries({queryKey:['agencyMe']}); toast.success('Agency profile saved'); agencyApi.backfillCards().catch(()=>{}); },
    onError:(e:any)=>toast.error(e.message || e.response?.data?.message || 'Failed to save')
  });

  const districtOptions = form.location_state ? (DISTRICTS_BY_STATE[form.location_state] || []).map(d=>({label:d,value:d})) : [];
  const cityOptions = districtOptions;
  const liveCategories = (categories as any[]).filter((c:any)=>c.is_active!==false);

  return (
    <div className="space-y-6">
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="hero-content">
          <div className="mb-2"><span className="eyebrow-rainbow">Agency Profile</span></div>
          <h1 className="font-[family-name:var(--font-jakarta)] text-[24px] sm:text-[28px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a]">Complete your <span className="text-rainbow">agency</span> profile.</h1>
          <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252]">Country / State / District / City dropdowns, services from live categories, logo, founded year + experience, address & pincode, and primary contact.</p>
        </div>
      </section>

      <Card className="p-6 sm:p-8">
        <div className="mb-6 flex items-start gap-4">
          <div className="tint-purple flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl" style={{color:'var(--tint-icon)'}}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m0 0h12a2 2 0 002-2v-2a2 2 0 00-2-2H5a2 2 0 01-2 2v2a2 2 0 002 2z" /></svg>
          </div>
          <div>
            <h2 className="font-[family-name:var(--font-jakarta)] text-xl font-semibold tracking-[-0.02em] text-[#0a0a0a]">Agency Details <span className="ml-1 text-red-500">*</span></h2>
            <p className="mt-0.5 text-sm text-[#737373]">Required before squad and portfolios are visible to businesses.</p>
          </div>
        </div>

        {/* Agency name + short form */}
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Input label="Agency Name" required value={form.agency_name} onChange={e=>setForm((p:any)=>({...p, agency_name:e.target.value}))} placeholder="e.g. Bright Studio Pvt Ltd" />
          <Input label="Agency Short Form" value={form.agency_short_name} onChange={e=>setForm((p:any)=>({...p, agency_short_name:e.target.value.toUpperCase().slice(0,10)}))} placeholder="e.g. BSP" helperText="2–10 letters, used as badge" />
        </div>

        {/* Logo upload */}
        <div className="mt-4 rounded-xl border border-[#E7E7EA] bg-[#F5F5F6] p-4">
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E7E7EA] bg-white">
              {form.logo_url ? <img src={form.logo_url} alt="Logo" className="h-full w-full object-contain" /> : <span className="text-xs text-[#a3a3a3]">No logo</span>}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-[#0a0a0a]">Agency Logo</div>
              <div className="text-xs text-[#737373]">PNG, JPG or SVG — recommended 512×512. Same uploader talents use for profile picture.</div>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleLogoUpload} disabled={uploading}>{uploading? 'Uploading…':'Upload Logo'}</Button>
                {form.logo_url && <Button size="sm" variant="outline" onClick={()=>setForm((p:any)=>({...p, logo_url:''}))}>Remove</Button>}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input label="Tagline" value={form.tagline} onChange={e=>setForm((p:any)=>({...p, tagline:e.target.value}))} placeholder="We build brands that scale" />
          <Input label="Team Size" value={form.team_size} onChange={e=>setForm((p:any)=>({...p, team_size:e.target.value}))} placeholder="e.g. 2-10, 11-50" />
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-[13px] font-medium text-[#3F3F46]">Founded Year</label>
          <div className="flex items-center gap-3">
            <input type="number" value={form.founded_year} onChange={e=>setForm((p:any)=>({...p, founded_year:e.target.value}))} placeholder="2020" min={1900} max={new Date().getFullYear()} className="block w-full max-w-[200px] rounded-lg border border-[#E7E7EA] bg-white px-3 py-2.5 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.05)] placeholder:text-[#a3a3a3] focus:border-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/12" />
            {yearsSince!==null ? (
              <span className="inline-flex items-center rounded-full bg-[#F5F5F6] border border-[#E7E7EA] px-3 py-1.5 text-xs font-medium text-[#525252] whitespace-nowrap">
                {yearsSince===0 ? 'Founded this year' : `${yearsSince} ${yearsSince===1?'year':'years'} of experience`}
              </span>
            ) : (
              <span className="text-xs text-[#a3a3a3]">Helps clients gauge experience</span>
            )}
          </div>
          {yearsSince===null && form.founded_year && <p className="mt-1.5 text-xs text-amber-600">Enter a valid year (1900–{new Date().getFullYear()})</p>}
        </div>

        {/* Location — four dropdowns like Talent */}
        <div className="mt-6 border-t border-[#E7E7EA] pt-6">
          <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">Location</h3>
          <p className="text-sm text-[#737373]">Country / State / District / City — same dropdown pattern as talent basic profile.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Select label="Country" required value={form.location_country} onChange={handleCountryChange} placeholder="Select country" options={COUNTRIES} />
            {form.location_country==='India' ? (
              <Select label="State" required value={form.location_state} onChange={handleStateChange} placeholder="Select state" options={INDIAN_STATES} />
            ) : (
              <Input label="State / Region" required value={form.location_state} onChange={e=>setForm((p:any)=>({...p, location_state:e.target.value}))} placeholder="State or region" />
            )}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {form.location_country==='India' && form.location_state ? (
              <Select label="District" required value={form.location_district} onChange={e=>setForm((p:any)=>({...p, location_district:e.target.value}))} placeholder="Select district" options={districtOptions} />
            ) : (
              <Input label="District" required value={form.location_district} onChange={e=>setForm((p:any)=>({...p, location_district:e.target.value}))} placeholder={form.location_country==='India'?'Select a state first':'District'} disabled={form.location_country==='India' && !form.location_state} />
            )}
            {form.location_country==='India' && form.location_state ? (
              <Select label="City" required value={form.location_city} onChange={e=>setForm((p:any)=>({...p, location_city:e.target.value}))} placeholder="Select city" options={cityOptions.length? cityOptions : districtOptions} />
            ) : (
              <Input label="City" required value={form.location_city} onChange={e=>setForm((p:any)=>({...p, location_city:e.target.value}))} placeholder={form.location_country==='India'?'Select a state first':'City'} disabled={form.location_country==='India' && !form.location_state} />
            )}
          </div>
          <p className="mt-2 text-[11px] text-[#a3a3a3]">City dropdown reuses district list for India (no separate city dataset).</p>

          {/* Address + Pincode below location details — requested */}
          <div className="mt-4 grid gap-4 sm:grid-cols-[2fr_1fr]">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#3F3F46]">Agency Address <span className="text-[#a3a3a3] font-normal">(optional)</span></label>
              <textarea value={form.address} onChange={e=>setForm((p:any)=>({...p, address:e.target.value}))} placeholder="Street, landmark, area" rows={2} className="block w-full rounded-lg border border-[#E7E7EA] bg-white px-3 py-2.5 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.05)] placeholder:text-[#a3a3a3] focus:border-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/12" />
            </div>
            <Input label="Pincode" value={form.pincode} onChange={e=>setForm((p:any)=>({...p, pincode:e.target.value.replace(/\D/g,'').slice(0,6)}))} placeholder="6-digit PIN" helperText="6-digit Indian pincode" />
          </div>
        </div>

        {/* Services — multi-select chips from live categories */}
        <div className="mt-6 border-t border-[#E7E7EA] pt-6">
          <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">Services</h3>
          <p className="text-sm text-[#737373]">Multi-select from live job categories — same categories talents use.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {liveCategories.length===0 && <span className="text-sm text-[#737373]">No live categories found.</span>}
            {liveCategories.map((c:any)=>{
              const active=form.services.includes(c.name);
              return (
                <button key={c.id} type="button" onClick={()=>toggleService(c.name)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${active? 'bg-[#0a0a0a] text-white border-[#0a0a0a] shadow-[0_1px_3px_rgba(0,0,0,0.15)]':'bg-white text-[#525252] border-[#E7E7EA] hover:border-[#0a0a0a] hover:text-[#0a0a0a]'}`} title={c.description||c.name}>
                  {active && <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  {c.name}
                </button>
              );
            })}
          </div>
          {form.services.length>0 && <p className="mt-2 text-xs text-[#737373]">{form.services.length} selected: {form.services.join(', ')}</p>}
        </div>

        {/* Languages — dropdown + chips, used for requirement-card matching (category + language + location) */}
        <div className="mt-6 border-t border-[#E7E7EA] pt-6">
          <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">Languages</h3>
          <p className="text-sm text-[#737373]">Select languages your team can work in — agencies are matched to requirement cards by category, language and location.</p>
          <div className="mt-3 max-w-sm">
            <Select
              label="Add Language"
              value={languageSelect}
              onChange={e=>handleLanguageSelect(e.target.value)}
              placeholder="Select language"
              options={AGENCY_LANGUAGES.filter(l=>!(form.languages||[]).includes(l)).map(l=>({label:l,value:l}))}
            />
            {AGENCY_LANGUAGES.filter(l=>!(form.languages||[]).includes(l)).length===0 && (
              <p className="mt-1.5 text-xs text-[#a3a3a3]">All languages selected.</p>
            )}
          </div>
          {(form.languages||[]).length>0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {(form.languages as string[]).map((lang:string)=>(
                <span key={lang} className="inline-flex items-center gap-1.5 rounded-full border border-[#E7E7EA] bg-[#F5F5F6] px-3 py-1 text-sm font-medium text-[#0a0a0a]">
                  {lang}
                  <button type="button" onClick={()=>removeLanguage(lang)} className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-[#737373] hover:bg-white hover:text-red-600" aria-label={`Remove ${lang}`}>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </span>
              ))}
            </div>
          )}
          {(form.languages||[]).length>0 && <p className="mt-2 text-xs text-[#737373]">{(form.languages as string[]).length} selected: {(form.languages as string[]).join(', ')}</p>}
          {(form.languages||[]).length===0 && <p className="mt-2 text-xs text-[#a3a3a3]">No language selected yet — requirement cards filter by your languages.</p>}
        </div>

        {/* Primary Contact — requested */}
        <div className="mt-6 border-t border-[#E7E7EA] pt-6">
          <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">Primary Contact</h3>
          <p className="text-sm text-[#737373]">Person businesses will reach for this agency.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Input label="Contact Person" value={form.contact_person} onChange={e=>setForm((p:any)=>({...p, contact_person:e.target.value}))} placeholder="Full name" />
            <Input label="Contact Email" type="email" value={form.contact_email} onChange={e=>setForm((p:any)=>({...p, contact_email:e.target.value}))} placeholder="person@agency.com" />
            <Input label="WhatsApp Number" value={form.whatsapp_number} onChange={e=>setForm((p:any)=>({...p, whatsapp_number:e.target.value}))} placeholder="+91 9..." helperText="With country code" />
          </div>
        </div>

        <div className="mt-6">
          <label className="mb-1.5 block text-[13px] font-medium text-[#3F3F46]">About Agency</label>
          <textarea className="block w-full rounded-lg border border-[#E7E7EA] bg-white px-3 py-2.5 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.05)] placeholder:text-[#a3a3a3] focus:border-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/12" rows={4} value={form.about} onChange={e=>setForm((p:any)=>({...p, about:e.target.value}))} placeholder="Tell clients about your agency, strengths, and clients served..." />
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={()=>save.mutate()} loading={save.isPending}>Save Agency Profile</Button>
        </div>
      </Card>
    </div>
  );
}
