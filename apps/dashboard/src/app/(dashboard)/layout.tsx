'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { I18nProvider, useI18n, type Locale } from '@/lib/i18n';
import { clearSession, getSession } from '@/lib/auth';

const LOCALES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'si', label: 'සිං' },
  { code: 'ta', label: 'தமி' },
];

function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();

  useEffect(() => {
    if (!getSession()) router.replace('/login');
  }, [router]);

  function logout() {
    clearSession();
    router.replace('/login');
  }

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const navItem = (href: string, labelKey: string, icon: string) => (
    <Link
      key={href}
      href={href}
      className={`flex items-center gap-3 px-6 py-2.5 text-sm font-medium transition-colors rounded-lg mx-2 ${
        isActive(href)
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-slate-300 hover:bg-slate-700 hover:text-white'
      }`}
    >
      <span className="w-4 text-center">{icon}</span>
      {t(labelKey)}
    </Link>
  );

  return (
    <aside className="w-60 bg-slate-900 flex flex-col flex-shrink-0">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-slate-700/60">
        <span className="text-white font-bold text-lg tracking-tight">OmniPOS</span>
        <p className="text-slate-400 text-xs mt-0.5">Dashboard</p>
      </div>

      {/* Main nav */}
      <nav className="flex-1 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {navItem('/', 'nav.home', '⌂')}
        {navItem('/billing', 'nav.billing', '🧾')}
        {navItem('/products', 'nav.products', '📦')}

        {/* Reports section */}
        <p className="px-6 pt-5 pb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {t('nav.reports')}
        </p>
        {navItem('/reports/sales',     'nav.sales',      '📈')}
        {navItem('/reports/products',  'nav.productRpt', '🏷')}
        {navItem('/reports/stock',     'nav.stock',      '📦')}
        {navItem('/reports/customers', 'nav.customers',  '👥')}
      </nav>

      {/* Footer: locale + sign out */}
      <div className="px-4 py-4 border-t border-slate-700/60 space-y-3">
        {/* Language switcher */}
        <div className="flex items-center gap-1">
          {LOCALES.map((l) => (
            <button
              key={l.code}
              onClick={() => setLocale(l.code)}
              className={`flex-1 py-1 text-xs rounded-md font-medium transition-colors ${
                locale === l.code
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <button
          onClick={logout}
          className="text-slate-400 hover:text-white text-sm transition-colors"
        >
          {t('nav.signout')}
        </button>
      </div>
    </aside>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </I18nProvider>
  );
}
