'use client';
import { useState, useRef, type FormEvent, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { agencyApi } from '@/services/agency-api';
import { useUpload } from '@/hooks/useUpload';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import LanguagePicker, { type LanguageEntry } from '@/components/forms/LanguagePicker';
import EducationPicker, { type EducationEntry } from '@/components/forms/EducationPicker';
import ExperiencePicker, { type ExperienceEntry } from '@/components/forms/ExperiencePicker';
import PartnerProgramPreference from '@/components/forms/PartnerProgramPreference';
import { type DayHours, type DayAvailableHours } from '@/lib/workHours';
import toast from 'react-hot-toast';
import { GENDER_OPTIONS } from '@/constants/lead-form-options';

function ageFromDob(dob: string): number | null {
  if (!dob) return null;
  const b = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

type SectionId = 'basic_details' | 'language' | 'education' | 'experience' | 'working_days' | 'profile_picture';
interface SectionDef { id: SectionId; name: string; description: string; tint: string; icon: ReactNode; optional?: boolean; }
function SectionHeader({ section }: { section: SectionDef }) {
  return (
    <div className="mb-6 flex items-start gap-4">
      <div className={`${section.tint} flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl`} style={{ color: 'var(--tint-icon)' }}>{section.icon}</div>
      <div>
        <h2 className="font-[family-name:var(--font-jakarta)] text-xl font-semibold tracking-[-0.02em] text-[#0a0a0a]">{section.name}{section.optional ? <span className="ml-2 align-middle rounded-full bg-[#F5F5F6] px-2 py-0.5 text-[11px] font-medium text-[#737373]">Optional</span> : <span className="ml-1 text-red-500">*</span>}</h2>
        <p className="mt-0.5 text-sm text-[#737373]">{section.description}</p>
      </div>
    </div>
  );
}

export default function SquadDirectCreate(){
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { uploadFile, uploading } = useUpload();
  const role = (searchParams.get('role') as 'member'|'manager') || 'member';
  const [activeSection,setActiveSection]=useState(0);
  const [firstName,setFirstName]=useState('');
  const [lastName,setLastName]=useState('');
  const [email,setEmail]=useState('');
  const [dateOfBirth,setDateOfBirth]=useState('');
  const [gender,setGender]=useState('');
  const [languages,setLanguages]=useState<LanguageEntry[]>([]);
  const [educationCourses,setEducationCourses]=useState<EducationEntry[]>([]);
  const [experienceEntries,setExperienceEntries]=useState<ExperienceEntry[]>([]);
  const [form,setForm]=useState<any>({ profile_picture_url:'' });
  const [roleTitle,setRoleTitle]=useState('');
  const [bio,setBio]=useState('');
  const [skills,setSkills]=useState('');
  const [virtualOfficeHours,setVirtualOfficeHours]=useState<DayHours[]>([]);
  const [dailyAvailableHours,setDailyAvailableHours]=useState<DayAvailableHours[]>([]);

  const sections: SectionDef[] = [
    { id:'basic_details', name:'Basic Details', description:'Name, email and role', tint:'tint-purple', icon:<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
    { id:'language', name:'Language', description:'Languages they speak', tint:'tint-blue', icon:<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg> },
    { id:'education', name:'Education & Courses', description:'Educational background', tint:'tint-blue', icon:<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg> },
    { id:'experience', name:'Experience', description:'Work history', tint:'tint-rose', icon:<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" /></svg> },
    { id:'working_days', name:'Working Days and Time', description:'When they are available to work', tint:'tint-green', icon:<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { id:'profile_picture', name:'Profile Picture', description:'Clear photo for profile', tint:'tint-purple', icon:<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>, optional:true },
  ];

  const completion: Record<SectionId, boolean> = {
    basic_details: !!firstName && !!email,
    language: languages.length>0 && languages.some(l=>l.proficiency==='native'),
    education: educationCourses.length>0 && educationCourses.some(e=>!!e.course_name && !!e.institution),
    experience: experienceEntries.length>0 && experienceEntries.some(e=>!!e.company_name && !!e.designation),
    working_days: virtualOfficeHours.length>0 && dailyAvailableHours.some(d=>d.hours>0),
    profile_picture: !!form.profile_picture_url,
  };
  const countedSections = sections.filter(s=>!s.optional);
  const enabledSections = countedSections.length;
  const completedCount = countedSections.reduce((acc,s)=> acc + (completion[s.id]?1:0),0);
  const progressPct = enabledSections>0 ? Math.round((completedCount/enabledSections)*100) : 0;
  const activeId = sections[activeSection]?.id;

  const tabRefs = useRef<(HTMLButtonElement|null)[]>([]);
  // Keep active tab visible
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleScroll = () => { tabRefs.current[activeSection]?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'}); };
  // useEffect for scroll
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useState(()=>{ setTimeout(handleScroll,0); });

  const handleFileUpload = async()=>{
    const input=document.createElement('input'); input.type='file'; input.accept='image/*';
    input.onchange=async(e)=>{
      const file=(e.target as HTMLInputElement).files?.[0]; if(!file) return;
      try{ const url=await uploadFile(file,'agency-logos'); setForm((prev:any)=>({...prev, profile_picture_url:url})); toast.success('File uploaded'); }catch{ toast.error('Upload failed'); }
    };
    input.click();
  };

  const handleSave = async(e:FormEvent)=>{
    e.preventDefault();
    if(!firstName.trim()){ toast.error('First name required'); return; }
    if(!email.trim()){ toast.error('Email required'); return; }
    if(!/\S+@\S+\.\S+/.test(email)){ toast.error('Valid email required'); return; }
    const fullName=[firstName.trim(),lastName.trim()].filter(Boolean).join(' ');
    const payload:any={
      full_name: fullName,
      email: email.trim(),
      role_title: roleTitle||undefined,
      languages_spoken: languages.length? languages:undefined,
      skills: skills? skills.split(',').map((s:string)=>s.trim()).filter(Boolean):undefined,
      bio: bio||undefined,
      profile_photo_url: form.profile_picture_url||undefined,
      age: dateOfBirth? ageFromDob(dateOfBirth):undefined,
      gender: gender||undefined,
      role_type: role,
      education_courses: educationCourses.length? educationCourses:undefined,
      experience: experienceEntries.length? experienceEntries:undefined,
      // Working Days and Time — backend treats as partner program
      virtual_office_hours: virtualOfficeHours.length? virtualOfficeHours:undefined,
      daily_available_hours: dailyAvailableHours.length? dailyAvailableHours:undefined,
    };
    try{
      await agencyApi.createSquad(payload);
      toast.success(`${role==='manager'?'Manager':'Member'} created — basic profile saved`);
      qc.invalidateQueries({queryKey:['agencySquad']});
      router.push('/agency/squad');
    }catch(err:any){ toast.error(err.response?.data?.message||'Failed'); }
  };

  return (
    <div className="space-y-4 lg:space-y-8">
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="hero-content">
          <div className="mb-2"><span className="eyebrow-rainbow">{completedCount} of {enabledSections} sections complete</span></div>
          <h1 className="font-[family-name:var(--font-jakarta)] text-[24px] sm:text-[28px] font-semibold tracking-[-0.025em] text-[#0a0a0a]">Create <span className="text-rainbow">squad {role}</span> directly.</h1>
          <p className="mt-1.5 text-sm text-[#525252]">Same as Talent&apos;s basic profile — only basic profile is needed now. Email is the only required contact.</p>
        </div>
        <div className="absolute right-6 top-6 hidden lg:flex h-16 w-16 items-center justify-center">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#E7E7EA" strokeWidth="9" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="url(#grad)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(progressPct/100)*264} 264`} />
              <defs><linearGradient id="grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FFF27A" /><stop offset="100%" stopColor="#0A0A0A" /></linearGradient></defs>
            </svg>
            <span className="text-sm font-semibold">{progressPct}%</span>
          </div>
        </div>
      </section>

      <div className="scrollbar-hide -mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 lg:hidden">
        <nav className="flex min-w-max gap-1.5">
          {sections.map((section,i)=>{
            const isActive=activeSection===i;
            const isComplete=completion[section.id];
            return (
              <button key={section.id} ref={el=>{tabRefs.current[i]=el;}} type="button" onClick={()=>setActiveSection(i)} className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-[13px] font-semibold ${isActive?'bg-[#0a0a0a] text-white border-[#0a0a0a]': isComplete?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-white text-[#525252] border-[#E7E7EA]'}`}>
                {isComplete? <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : <span className="h-3 w-3 rounded-full border border-current" />}
                {section.name}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-6">
        <aside className="hidden lg:block lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-[#E7E7EA] bg-white p-3">
            <h3 className="mb-2 px-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-[#a3a3a3]">Sections</h3>
            <nav className="flex flex-col gap-0.5">
              {sections.map((section,i)=>{
                const isActive=activeSection===i;
                const isComplete=completion[section.id];
                return (
                  <button key={section.id} type="button" onClick={()=>setActiveSection(i)} className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-left ${isActive?'bg-[#F5F5F6]':'hover:bg-[#F5F5F6]'}`}>
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${isComplete?'bg-emerald-50 text-emerald-600': isActive? section.tint :'bg-[#f0f0f0] text-[#a3a3a3]'}`} style={isActive && !isComplete? {color:'var(--tint-icon)'}:undefined}>
                      {isComplete? <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : <span className="text-xs font-semibold">{i+1}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] font-semibold truncate ${isActive?'text-[#0a0a0a]':'text-[#525252]'}`}>{section.name}</p>
                      <p className="text-[11px] text-[#a3a3a3] truncate">{isComplete?'Complete': section.optional?'Optional':'Not started'}</p>
                    </div>
                  </button>
                );
              })}
            </nav>
            <div className="mt-3 px-2">
              <div className="rounded-lg bg-[#FFFAC2] border border-[#0a0a0a] px-3 py-2 text-xs font-medium text-center">{role==='manager'?'Squad Manager':'Squad Member'} — basic profile only</div>
            </div>
          </div>
        </aside>

        <form onSubmit={handleSave} className="min-w-0 space-y-6">
          <div className="rounded-2xl border border-[#E7E7EA] bg-white p-6 sm:p-8" key={activeSection}>
            <SectionHeader section={sections[activeSection]} />
            {activeId==='basic_details' && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="First Name *" value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="First name" required />
                  <Input label="Last Name" value={lastName} onChange={e=>setLastName(e.target.value)} placeholder="Last name" />
                </div>
                <Input label="Email *" value={email} onChange={e=>setEmail(e.target.value)} placeholder="member@agency.com" required helperText="Only email is required — phone not needed" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Role / Title" value={roleTitle} onChange={e=>setRoleTitle(e.target.value)} placeholder={role==='manager'?'Squad Manager':'Designer'} />
                  <Input label="Date of Birth" type="date" value={dateOfBirth} onChange={e=>setDateOfBirth(e.target.value)} helperText={dateOfBirth && ageFromDob(dateOfBirth)!==null? `Age: ${ageFromDob(dateOfBirth)} years`:'We calculate age from this'} />
                </div>
                <Select label="Gender" value={gender} onChange={e=>setGender(e.target.value)} placeholder="Select" options={GENDER_OPTIONS} />
                <Input label="Skills (comma)" value={skills} onChange={e=>setSkills(e.target.value)} placeholder="Figma, Photoshop" helperText="Basic skills — full portfolio later" />
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium">Bio</label>
                  <textarea value={bio} onChange={e=>setBio(e.target.value)} placeholder="Short bio" rows={2} className="block w-full rounded-lg border border-[#E7E7EA] px-3 py-2.5 text-sm" />
                </div>
              </div>
            )}
            {activeId==='language' && (
              <LanguagePicker value={languages} onChange={setLanguages} />
            )}
            {activeId==='education' && (
              <EducationPicker value={educationCourses} onChange={setEducationCourses} />
            )}
            {activeId==='experience' && (
              <ExperiencePicker value={experienceEntries} onChange={setExperienceEntries} />
            )}
            {activeId==='working_days' && (
              <div>
                <p className="mb-4 text-sm text-[#737373]">Select working days and office hours — saved as <span className="font-medium text-[#0a0a0a]">partner program</span> in backend, shown here as <span className="font-medium text-[#0a0a0a]">Working Days and Time</span> for agency/business.</p>
                <PartnerProgramPreference officeHours={virtualOfficeHours} onOfficeHoursChange={setVirtualOfficeHours} dailyAvailable={dailyAvailableHours} onDailyAvailableChange={setDailyAvailableHours} />
                <p className="mt-3 text-xs text-[#737373]">Same details talent enters — backend treats this as partner program.</p>
              </div>
            )}
            {activeId==='profile_picture' && (
              <div className="text-center">
                <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-[#E7E7EA] bg-[#F5F5F6]">
                  {form.profile_picture_url ? <img src={form.profile_picture_url} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-[#a3a3a3]">No photo</span>}
                </div>
                <Button type="button" variant="outline" className="mt-4" onClick={handleFileUpload} disabled={uploading}>{uploading?'Uploading…':'Upload Photo'}</Button>
                {form.profile_picture_url && <Button type="button" variant="outline" className="mt-2 ml-2" onClick={()=>setForm((p:any)=>({...p, profile_picture_url:''}))}>Remove</Button>}
                <p className="mt-2 text-xs text-[#737373]">Optional — squad member can also upload later.</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" onClick={()=>setActiveSection(s=>Math.max(0,s-1))} disabled={activeSection===0}>Previous</Button>
            <div className="flex gap-2">
              {activeSection < sections.length-1 ? <Button type="button" onClick={()=>setActiveSection(s=>Math.min(sections.length-1,s+1))}>Next</Button> : <Button type="submit">Create {role==='manager'?'Manager':'Member'}</Button>}
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit">Create {role==='manager'?'Manager':'Member'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
