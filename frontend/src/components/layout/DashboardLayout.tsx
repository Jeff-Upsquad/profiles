import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Navbar from './Navbar';

export interface SidebarItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
  tooltip?: string;
  /** When true, renders a divider above this item to start a new section. */
  groupStart?: boolean;
}

interface DashboardLayoutProps {
  sidebarItems?: SidebarItem[];
  sidebarContent?: React.ReactNode | ((opts: { onNavigate: () => void }) => React.ReactNode);
  hideMobileSidebar?: boolean;
  hideNavbar?: boolean;
  /** Keep the desktop top bar, hide it on mobile (talent uses TalentTopBar). */
  hideNavbarOnMobile?: boolean;
  children: React.ReactNode;
}

export default function DashboardLayout({ sidebarItems, sidebarContent, hideMobileSidebar, hideNavbar, hideNavbarOnMobile, children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(href + '/') === true;
  };

  return (
    <div className="flex h-screen flex-col bg-[#F5F5F6]">
      {!hideNavbar && (
        <div className={hideNavbarOnMobile ? 'hidden md:block' : undefined}>
          <Navbar />
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        {/* Overlay */}
        {sidebarOpen && !hideMobileSidebar && (
          <div
            className="fixed inset-0 z-20 bg-black/20 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        {sidebarContent ? (
          <div
            className={`${hideMobileSidebar ? 'hidden md:flex' : 'flex'} fixed inset-y-0 left-0 z-20 ${hideNavbar ? '' : 'mt-[60px]'} transform transition-transform md:relative md:mt-0 md:translate-x-0 ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            {typeof sidebarContent === 'function'
              ? sidebarContent({ onNavigate: () => setSidebarOpen(false) })
              : sidebarContent}
          </div>
        ) : sidebarItems && sidebarItems.length > 0 ? (
          <aside
            className={`fixed inset-y-0 left-0 z-20 ${hideNavbar ? '' : 'mt-[60px]'} w-60 transform border-r border-[#E7E7EA] bg-white transition-transform md:relative md:mt-0 md:translate-x-0 ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <nav className="flex flex-col gap-0.5 p-3">
              {sidebarItems.map((item, index) => {
                const divider =
                  item.groupStart && index > 0 ? (
                    <div key={`${item.to}-divider`} className="my-2 h-px bg-[#E7E7EA]" />
                  ) : null;
                const node = item.disabled ? (
                  <div
                    key={item.to}
                    title={item.tooltip}
                    className="font-[family-name:var(--font-inter)] flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-[#525252] opacity-40 cursor-not-allowed select-none"
                  >
                    {item.icon}
                    <span className="flex-1">{item.label}</span>
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                ) : (
                  <Link
                    key={item.to}
                    href={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={`font-[family-name:var(--font-inter)] flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200 ${
                      isActive(item.to)
                        ? 'bg-[#F5F5F6] text-[#0a0a0a] shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]'
                        : 'text-[#525252] hover:bg-[#F5F5F6] hover:text-[#0a0a0a]'
                    }`}
                  >
                    {item.icon}
                    <span className="flex-1">{item.label}</span>
                    {item.badge}
                  </Link>
                );
                return divider ? [divider, node] : node;
              })}
            </nav>
          </aside>
        ) : null}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-[#F5F5F6] p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-5xl">
            {/* Mobile menu trigger — only renders when the layout opted INTO
                a mobile drawer. Business pages use BusinessMobileNav for
                always-visible top-of-page navigation, so they pass
                hideMobileSidebar and skip this. Other roles that still rely
                on the drawer keep the labeled button (more discoverable
                than the corner FAB it replaced). */}
            {!hideMobileSidebar && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="mb-3 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 active:scale-[0.98] md:hidden"
                aria-label="Open navigation menu"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span>Menu</span>
              </button>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
