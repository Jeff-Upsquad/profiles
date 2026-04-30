import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import Badge from '@/components/ui/Badge';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-[#ECECEF]">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
        <div className="flex h-[60px] items-center justify-between gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#202020] text-[11px] font-bold text-white">
              SH
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-[family-name:var(--font-jakarta)] text-[17px] font-semibold text-[#202020] tracking-[-0.02em]">SquadHire</span>
              <span className="text-[10px] text-[#838383]">Powered by UpSquad</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-1 md:flex">
            <Link
              href="#how-it-works"
              className="font-[family-name:var(--font-inter)] rounded-lg px-2.5 py-2 text-sm font-medium text-[#646464] transition-all duration-200 hover:bg-[#f0f0f0] hover:text-[#202020]"
            >
              How it Works
            </Link>
            <Link
              href="#categories"
              className="font-[family-name:var(--font-inter)] rounded-lg px-2.5 py-2 text-sm font-medium text-[#646464] transition-all duration-200 hover:bg-[#f0f0f0] hover:text-[#202020]"
            >
              Categories
            </Link>

            <div className="ml-4 flex items-center gap-3">
              {user ? (
                <>
                  <span className="font-[family-name:var(--font-inter)] text-sm text-[#838383]">{user.email}</span>
                  <Badge variant="indigo">{user.role}</Badge>
                  <button
                    onClick={() => logout()}
                    className="font-[family-name:var(--font-inter)] rounded-lg px-2.5 py-2 text-sm font-medium text-[#646464] transition-all duration-200 hover:bg-[#f0f0f0] hover:text-[#202020]"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="font-[family-name:var(--font-inter)] rounded-lg px-2.5 py-2 text-sm font-medium text-[#646464] transition-all duration-200 hover:bg-[#f0f0f0] hover:text-[#202020]"
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup/talent"
                    className="font-[family-name:var(--font-inter)] inline-flex items-center rounded-lg bg-[#202020] px-3 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#202020]/85 active:scale-[0.97]"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden rounded-lg p-2 text-[#646464] transition-colors hover:bg-[#f0f0f0]"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-[#ECECEF] py-3 md:hidden">
            {user ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-sm text-[#838383]">{user.email}</span>
                  <Badge variant="indigo">{user.role}</Badge>
                </div>
                <button
                  onClick={() => { logout(); setMobileOpen(false); }}
                  className="block w-full text-left rounded-lg px-2.5 py-2 text-sm font-medium text-[#646464] hover:bg-[#f0f0f0] hover:text-[#202020]"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-2.5 py-2 text-sm font-medium text-[#646464] hover:bg-[#f0f0f0] hover:text-[#202020]"
                >
                  Login
                </Link>
                <Link
                  href="/signup/talent"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg bg-[#202020] px-3 py-2 text-center text-sm font-semibold text-white hover:bg-[#202020]/85"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
