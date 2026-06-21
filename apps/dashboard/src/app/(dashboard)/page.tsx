'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import KpiCard from '@/components/KpiCard';
import OutletSwitcher from '@/components/OutletSwitcher';
import { useI18n, fmtDate } from '@/lib/i18n';
import { reportApi, thisWeekRange, type KpiToday, type SalesDayRow, type TopProductRow } from '@/lib/reports';

// Load charts client-side only (recharts uses browser APIs)
const SalesChart      = dynamic(() => import('@/components/SalesChart'),      { ssr: false });
const TopProductsChart = dynamic(() => import('@/components/TopProductsChart'), { ssr: false });

export default function HomePage() {
  const { t } = useI18n();
  const [outletId, setOutletId] = useState<string | undefined>();
  const [kpi,      setKpi]      = useState<KpiToday | null>(null);
  const [trend,    setTrend]    = useState<SalesDayRow[]>([]);
  const [topProds, setTopProds] = useState<TopProductRow[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const week = thisWeekRange();
    setLoading(true);
    Promise.all([
      reportApi.getTodayKpi(outletId),
      reportApi.getSales(week.from, week.to, outletId, 'day'),
      reportApi.getTopProducts(week.from, week.to, 'revenue', 5, outletId),
    ])
      .then(([k, t, p]) => { setKpi(k); setTrend(t); setTopProds(p); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [outletId]);

  const session = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('omnipos_session') ?? '{}')
    : {};
  const tenantName = session?.tenant?.name ?? 'OmniPOS';

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tenantName}</h1>
          <p className="text-sm text-gray-400">{fmtDate(new Date())}</p>
        </div>
        <OutletSwitcher value={outletId} onChange={setOutletId} />
      </div>

      {/* KPI cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label={t('kpi.todaySales')}
            value={kpi?.totalSales ?? 0}
            format="currency"
            icon="💰"
            color="blue"
            sub={`${kpi?.invoiceCount ?? 0} ${t('kpi.invoices')}`}
          />
          <KpiCard
            label={t('kpi.itemsSold')}
            value={kpi?.itemsSold ?? 0}
            format="number"
            icon="🛒"
            color="purple"
          />
          <KpiCard
            label={t('kpi.profit')}
            value={kpi?.totalProfit ?? 0}
            format="currency"
            icon="📊"
            color="green"
          />
          <KpiCard
            label={t('kpi.taxCollected')}
            value={kpi?.totalTax ?? 0}
            format="currency"
            icon="🏛"
            color="amber"
          />
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Sales trend — wider */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">{t('sales.trend')} — {t('period.week')}</h2>
          {loading
            ? <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
            : <SalesChart data={trend} showProfit />
          }
        </div>

        {/* Top 5 products */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">{t('product.top')} — {t('period.week')}</h2>
          {loading
            ? <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
            : <TopProductsChart data={topProds} metric="revenue" />
          }
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: '/reports/sales',     icon: '📈', label: t('nav.sales') },
          { href: '/reports/products',  icon: '🏷', label: t('nav.productRpt') },
          { href: '/reports/stock',     icon: '📦', label: t('nav.stock') },
          { href: '/reports/customers', icon: '👥', label: t('nav.customers') },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-blue-200 hover:shadow-md transition-all group"
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">{item.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
