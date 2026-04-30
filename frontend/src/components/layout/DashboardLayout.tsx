import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Navbar from './Navbar';

export interface SidebarItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
}

interface DashboardLayoutProps {
  sidebarItems?: SidebarItem[];
  sidebarContent?: React.ReactNode | ((opts: { onNavigate: () => void }) => React.ReactNode);
  hideMobileSidebar?: boolean;
  children: React.ReactNode;
}

export default function DashboardLayout({ sidebarItems, sidebarContent, hideMobileSidebar, children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(href + '/') === true;
  };

  return (
    <div className="flex h-screen flex-col bg-[#F8F9FA]">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile sidebar toggle */}
        {!hideMobileSidebar && (
          <button
            className="fixed bottom-4 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-xl bg-[#202020] text-white shadow-lg md:hidden active:scale-95 transition-transform"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

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
            className={`${hideMobileSidebar ? 'hidden md:flex' : 'flex'} fixed inset-y-0 left-0 z-20 mt-[60px] transform transition-transform md:relative md:mt-0 md:translate-x-0 ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            {typeof sidebarContent === 'function'
              ? sidebarContent({ onNavigate: () => setSidebarOpen(false) })
              : sidebarContent}
          </div>
        ) : (
          <aside
            className={`fixed inset-y-0 left-0 z-20 mt-[60px] w-60 transform border-r border-[#ECECEF] bg-white transition-transform md:relative md:mt-0 md:translate-x-0 ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <nav className="flex flex-col gap-0.5 p-3">
              {(sidebarItems ?? []).map((item) => (
                <Link
                  key={item.to}
                  href={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={`font-[family-name:var(--font-inter)] flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200 ${
                    isActive(item.to)
                      ? 'bg-[#F8F9FA] text-[#202020] shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]'
                      : 'text-[#646464] hover:bg-[#F8F9FA] hover:text-[#202020]'
                  }`}
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  {item.badge}
                </Link>
              ))}
            </nav>
          </aside>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-[#F8F9FA] p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-5xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
