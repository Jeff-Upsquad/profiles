'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import GlobalSearch from '@/components/GlobalSearch';
import { NAV_SECTIONS } from '@/config/modules';
import { IS_STAFF } from '@/lib/appMode';

/**
 * Resolve which module owns the current pathname (longest href prefix wins),
 * so the layout can gate the whole page centrally — covering every module
 * without per-page edits. Returns null for unmapped routes (left ungated).
 */
function moduleForPathname(pathname: string | null): string | null {
  if (!pathname) return null;
  if (pathname === '/' || pathname === '') return 'dashboard';
  let best: string | null = null;
  let bestLen = -1;
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      const base = item.href.split('?')[0];
      if (base === '/') continue;
      if ((pathname === base || pathname.startsWith(base + '/')) && base.length > bestLen) {
        best = item.module;
        bestLen = base.length;
      }
    }
  }
  return best;
}

function SidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { can, isFullAdmin } = useAuth();

  const isNavItemActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/') {
      return pathname === '/' || pathname === '';
    }
    const [hrefPath, hrefSearch] = href.split('?');
    if (!pathname.startsWith(hrefPath)) return false;
    if (!hrefSearch) {
      if (hrefPath === '/talents' && searchParams?.get('type')) return false;
      return true;
    }
    const expectedType = new URLSearchParams(hrefSearch).get('type');
    return searchParams?.get('type') === expectedType;
  };

  // Which modules the current user may see in the sidebar. Dashboard is always
  // visible; Team & Access is the full-admin management surface (v1).
  const isVisible = (moduleSlug: string) => {
    if (moduleSlug === 'dashboard') return true;
    if (moduleSlug === 'team-access') return isFullAdmin;
    return can(moduleSlug);
  };

  const sections = NAV_SECTIONS.map((section) => ({
    section: section.section,
    items: section.items.filter((item) => isVisible(item.module)),
  })).filter((section) => section.items.length > 0);

  return (
    <nav className="flex-1 px-3 py-4 overflow-y-auto">
      {sections.map((section, idx) => (
        <div key={section.section} className={idx === 0 ? '' : 'mt-4'}>
          <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            {section.section}
          </div>
          <div className="space-y-1">
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isNavItemActive(item.href)
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function AccessDenied() {
  return (
    <div className="flex h-full items-center justify-center p-10">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m0 0v.01M12 9v2m-7 8h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">No access to this module</h2>
        <p className="mt-1 text-sm text-gray-500">
          You don&apos;t have permission to view this section. Contact an administrator if you
          think this is a mistake.
        </p>
      </div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, logout, can, permissionFor, isFullAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return router.push('/login');
  }

  // Central per-module page guard (defense-in-depth alongside backend gating).
  const activeModule = moduleForPathname(pathname);
  const pageBlocked = !!activeModule && activeModule !== 'dashboard'
    && (activeModule === 'team-access' ? !isFullAdmin : !can(activeModule, 'view'));
  // View-only users get a banner so they know writes are disabled.
  const viewOnly = !isFullAdmin && !!activeModule && permissionFor(activeModule) === 'view';

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col flex-shrink-0">
        <div className="px-6 py-5 border-b border-gray-800">
          <h1 className="text-xl font-bold tracking-tight">SquadHire</h1>
          <p className="text-xs text-gray-400 mt-0.5">{IS_STAFF ? 'Staff Portal' : 'Admin Panel'}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Powered by UpSquad</p>
        </div>

        <Suspense fallback={<div className="flex-1" />}>
          <SidebarNav />
        </Suspense>

        <div className="px-3 py-4 border-t border-gray-800">
          <div className="px-3 py-2 text-xs text-gray-500">
            v1.0.0
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex-1 max-w-md">
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.email}</span>
            <button
              onClick={logout}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors font-medium"
            >
              Log out
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {pageBlocked ? (
            <AccessDenied />
          ) : (
            <>
              {viewOnly && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                  You have <span className="font-semibold">view-only</span> access to this module.
                  Editing actions are disabled.
                </div>
              )}
              {children}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
