import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Navbar from './Navbar';

export interface SidebarItem {
  label: string;
  to: string;
  icon: React.ReactNode;
}

interface DashboardLayoutProps {
  sidebarItems?: SidebarItem[];
  sidebarContent?: React.ReactNode;
  children: React.ReactNode;
}

export default function DashboardLayout({ sidebarItems, sidebarContent, children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(href + '/') === true;
  };

  return (
    <div className="flex h-screen flex-col">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile sidebar toggle */}
        <button
          className="fixed bottom-4 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg md:hidden"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-20 mt-16 w-64 transform border-r border-gray-200 bg-white transition-transform md:relative md:mt-0 md:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {sidebarContent ? (
            <div className="h-full">{sidebarContent}</div>
          ) : (
            <nav className="flex flex-col gap-1 p-4">
              {(sidebarItems ?? []).map((item) => (
                <Link
                  key={item.to}
                  href={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive(item.to)
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
