'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { agencyApi } from '@/services/agency-api';

export default function AgencyTopBar() {
  const { user, logout } = useAuth();
  const { data: me } = useQuery({ queryKey: ['agencyMe'], queryFn: agencyApi.me, enabled: !!user && user.role === 'agency' });
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const displayName = (me as any)?.agency_name || user?.agency_name || 'Agency';
  const displayEmail = user?.email || '';
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0,2).map((w:string)=>w[0]?.toUpperCase()).join('') || 'A';
  useEffect(()=>{ if(!open) return; const onDoc=(e:MouseEvent)=>{ const t=e.target as Node; if(menuRef.current?.contains(t)||btnRef.current?.contains(t)) return; setOpen(false);}; const onKey=(e:KeyboardEvent)=>{ if(e.key==='Escape') setOpen(false);}; document.addEventListener('mousedown',onDoc); document.addEventListener('keydown',onKey); return()=>{ document.removeEventListener('mousedown',onDoc); document.removeEventListener('keydown',onKey);};},[open]);
  if(!user) return null;
  if (/^\/agency\/messages\/[^/]+/.test(pathname)) return null;
  return (
    <header className={`sticky top-0 z-40 border-b border-[#E7E7EA] bg-white/95 px-4 py-2.5 backdrop-blur-sm md:hidden -mx-4 mb-4`}>
      <div className="flex items-center justify-between gap-3">
        <Link href="/agency/dashboard" className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0a0a0a] text-[11px] font-bold text-white">AG</div>
          <div className="min-w-0 leading-tight">
            <p className="truncate font-[family-name:var(--font-jakarta)] text-[14px] font-semibold tracking-[-0.02em] text-[#0a0a0a]">SquadHire <span className="font-normal text-[#a3a3a3]">Agency</span></p>
            <p className="truncate text-[10px] text-[#a3a3a3]">Powered by UpSquad</p>
          </div>
        </Link>
        <div className="relative">
          <button ref={btnRef} type="button" aria-label="Account menu" aria-expanded={open} aria-haspopup="menu" onClick={()=>setOpen(v=>!v)} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#0a0a0a] text-[12px] font-semibold text-white ring-2 ring-white shadow-sm">
            {initials}
          </button>
          {open && (
            <div ref={menuRef} role="menu" className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-[#E7E7EA] bg-white py-1 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.22)]">
              <div className="border-b border-[#E7E7EA] px-3.5 py-3">
                <p className="truncate text-sm font-semibold text-[#0a0a0a]">{displayName}</p>
                <p className="mt-0.5 truncate text-[12px] text-[#737373]">{displayEmail}</p>
              </div>
              <Link href="/agency/profile" role="menuitem" onClick={()=>setOpen(false)} className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-[#0a0a0a] hover:bg-[#F5F5F6]">Agency profile</Link>
              <button type="button" role="menuitem" onClick={()=>{ setOpen(false); logout(); }} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium text-[#0a0a0a] hover:bg-[#F5F5F6]">Logout</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
