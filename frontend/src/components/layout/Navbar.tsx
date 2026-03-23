import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 bg-[#F7F6F3]/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-xs font-bold text-white">
              SH
            </div>
            <span className="text-lg font-semibold text-neutral-900 tracking-tight">SquadHire</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-8 md:flex">
            <Link
              href="#how-it-works"
              className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              How it Works
            </Link>
            <Link
              href="#categories"
              className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              Categories
            </Link>
            {user ? (
              <>
                <span className="text-sm text-neutral-500">{user.email}</span>
                <Badge variant="indigo">{user.role}</Badge>
                <Button variant="ghost" size="sm" onClick={logout}>
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  Login
                </Link>
                <Link href="/signup/talent">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden rounded-lg p-2 text-neutral-600 hover:bg-neutral-200/50"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-neutral-200/60 py-3 md:hidden">
            {user ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-sm text-neutral-500">{user.email}</span>
                  <Badge variant="indigo">{user.role}</Badge>
                </div>
                <button
                  onClick={() => { logout(); setMobileOpen(false); }}
                  className="block w-full text-left text-sm text-neutral-600 hover:text-neutral-900"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block text-sm text-neutral-600 hover:text-neutral-900"
                >
                  Login
                </Link>
                <Link href="/signup/talent">
                  <Button size="sm" className="w-full" onClick={() => setMobileOpen(false)}>
                    Get Started
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
