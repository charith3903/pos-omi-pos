'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { clearSession, getSession } from '@/lib/auth';

const NAV = [
  { href: '/billing', label: 'Billing', icon: '🧾' },
  { href: '/products', label: 'Products', icon: '📦' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!getSession()) router.replace('/login');
  }, [router]);

  function logout() {
    clearSession();
    router.replace('/login');
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-56 bg-primary-900 flex flex-col">
        <div className="px-6 py-5 border-b border-primary-800">
          <span className="text-white font-bold text-xl">OmniPOS</span>
        </div>
        <nav className="flex-1 py-4">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors ${
                pathname === item.href
                  ? 'bg-primary-700 text-white'
                  : 'text-primary-200 hover:bg-primary-800 hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-primary-800">
          <button
            onClick={logout}
            className="text-primary-300 hover:text-white text-sm transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
