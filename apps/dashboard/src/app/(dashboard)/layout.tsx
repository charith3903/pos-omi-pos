'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { I18nProvider, useI18n, type Locale } from '@/lib/i18n';
import { clearSession, getSession } from '@/lib/auth';
import { useBusinessType } from '@/hooks/useVerticalPack';
import { api } from '@/lib/api';
import {
  Home,
  Receipt,
  Package,
  Wrench,
  Car,
  Factory,
  TrendingUp,
  Tag,
  Box,
  Users,
  Utensils,
  ShoppingCart,
  Smartphone,
  Zap,
  Shirt,
  Store,
  Undo2,
  ShieldCheck,
  FileSpreadsheet,
  Truck,
  FileText,
  AlertTriangle,
  UserCircle,
  Table2,
  ChefHat,
  ShoppingBag,
  Star,
  Clock,
  LayoutGrid,
  Gift,
} from 'lucide-react';

const LOCALES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'si', label: 'සිං' },
  { code: 'ta', label: 'தமி' },
];

function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const businessType = useBusinessType();
  const [mounted, setMounted] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);

  useEffect(() => {
    setMounted(true);
    if (!getSession()) router.replace('/login');
  }, [router]);

  useEffect(() => {
    if (!mounted) return;
    api.getStockList()
      .then((items: any[]) => setLowStockCount(items.filter((i: any) => i.qty <= 5).length))
      .catch(() => { /* ignore if stock endpoint not yet seeded */ });
  }, [mounted]);

  function logout() {
    clearSession();
    router.replace('/login');
  }

  const EXACT_PATHS = ['/', '/restaurant'];
  const isActive = (href: string) =>
    EXACT_PATHS.includes(href) ? pathname === href : pathname.startsWith(href);

  const navItem = (href: string, label: string, icon: React.ReactNode, badge?: number) => (
    <Link
      key={href}
      href={href}
      className={`flex items-center gap-3 px-6 py-2.5 text-sm font-medium transition-colors rounded-lg mx-2 ${
        isActive(href)
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-slate-300 hover:bg-slate-700 hover:text-white'
      }`}
    >
      <div className="w-5 flex justify-center">{icon}</div>
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );

  const isSpareParts = businessType === 'SPARE_PARTS';
  const isRestaurant = businessType === 'RESTAURANT';

  let brandSub: React.ReactNode = 'Dashboard';
  if (isSpareParts) brandSub = <span className="flex items-center gap-1.5"><Wrench className="w-3.5 h-3.5" /> Spare Parts</span>;
  else if (businessType === 'RESTAURANT') brandSub = <span className="flex items-center gap-1.5"><Utensils className="w-3.5 h-3.5" /> Restaurant</span>;
  else if (businessType === 'SUPERMARKET') brandSub = <span className="flex items-center gap-1.5"><ShoppingCart className="w-3.5 h-3.5" /> Supermarket</span>;
  else if (businessType === 'MOBILE') brandSub = <span className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" /> Mobile</span>;
  else if (businessType === 'ELECTRICAL') brandSub = <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Electrical</span>;
  else if (businessType === 'TEXTILE') brandSub = <span className="flex items-center gap-1.5"><Shirt className="w-3.5 h-3.5" /> Textile</span>;
  else if (businessType === 'RENTAL') brandSub = <span className="flex items-center gap-1.5"><Store className="w-3.5 h-3.5" /> Rental</span>;

  if (!mounted) {
    return <aside className="w-64 bg-slate-900 flex flex-col flex-shrink-0" />;
  }

  return (
    <aside className="w-64 bg-slate-900 flex flex-col flex-shrink-0 border-r border-slate-800">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-slate-700/60">
        <span className="text-white font-bold text-xl tracking-tight">OmniPOS</span>
        <div className="text-slate-400 text-xs mt-1 font-medium">{brandSub}</div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 py-4 flex flex-col gap-1 overflow-y-auto">
        {navItem('/', t('nav.home'), <Home className="w-4 h-4" />)}
        {navItem('/billing', isSpareParts ? 'POS / Billing' : t('nav.billing'), <Receipt className="w-4 h-4" />)}
        {navItem('/products', isSpareParts ? 'Parts Catalogue' : t('nav.products'), <Package className="w-4 h-4" />)}

        {/* Stock & Customer management */}
        <p className="px-6 pt-5 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Management
        </p>
        {navItem('/stock', 'Stock', <Box className="w-4 h-4" />, lowStockCount)}
        {navItem('/customers', 'Customers', <UserCircle className="w-4 h-4" />)}
        {navItem('/invoices', 'Invoices', <FileText className="w-4 h-4" />)}

        {isRestaurant && (
          <>
            <p className="px-6 pt-5 pb-2 text-xs font-semibold text-orange-400 uppercase tracking-wider">
              Restaurant
            </p>
            {navItem('/restaurant', 'Overview', <LayoutGrid className="w-4 h-4" />)}
            {navItem('/restaurant/floor', 'Floor Plan', <Table2 className="w-4 h-4" />)}
            {navItem('/restaurant/pos', 'POS / Orders', <ShoppingBag className="w-4 h-4" />)}
            {navItem('/restaurant/kitchen', 'Kitchen (KDS)', <ChefHat className="w-4 h-4" />)}
            {navItem('/restaurant/menu', 'Menu', <Utensils className="w-4 h-4" />)}
            {navItem('/restaurant/promotions', 'Promotions', <Gift className="w-4 h-4" />)}
            {navItem('/restaurant/loyalty', 'Loyalty', <Star className="w-4 h-4" />)}
            {navItem('/restaurant/shift', 'Shift', <Clock className="w-4 h-4" />)}
          </>
        )}

        {isSpareParts && (
          <>
            <p className="px-6 pt-5 pb-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
              Service &amp; Garage
            </p>
            {navItem('/spare-parts/job-cards', 'Job Cards', <Wrench className="w-4 h-4" />)}
            {navItem('/spare-parts/vehicles', 'Vehicle Lookup', <Car className="w-4 h-4" />)}
            {navItem('/spare-parts/warranty', 'Warranty Claims', <ShieldCheck className="w-4 h-4" />)}
            {navItem('/spare-parts/refunds', 'Returns & Refunds', <Undo2 className="w-4 h-4" />)}

            <p className="px-6 pt-5 pb-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
              Procurement
            </p>
            {navItem('/spare-parts/suppliers', 'Suppliers', <Factory className="w-4 h-4" />)}
            {navItem('/spare-parts/purchase-orders', 'Purchase Orders', <FileSpreadsheet className="w-4 h-4" />)}
            {navItem('/spare-parts/grn', 'Goods Received (GRN)', <Truck className="w-4 h-4" />)}
          </>
        )}

        {/* Reports section */}
        <p className="px-6 pt-5 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {t('nav.reports')}
        </p>
        {navItem('/reports/sales',     t('nav.sales'),      <TrendingUp className="w-4 h-4" />)}
        {navItem('/reports/products',  t('nav.productRpt'), <Tag className="w-4 h-4" />)}
        {navItem('/reports/stock',     t('nav.stock'),      <AlertTriangle className="w-4 h-4" />, lowStockCount)}
        {navItem('/reports/customers', t('nav.customers'),  <Users className="w-4 h-4" />)}
      </nav>

      {/* Footer: locale + sign out */}
      <div className="px-4 py-4 border-t border-slate-700/60 space-y-3">
        <div className="flex items-center gap-1">
          {LOCALES.map((l) => (
            <button
              key={l.code}
              onClick={() => setLocale(l.code)}
              className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-colors ${
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
          className="text-slate-400 hover:text-white text-sm transition-colors w-full text-left px-2"
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
