'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { AlertTriangle, PackageX, Users } from 'lucide-react';
import KpiCard from '@/components/KpiCard';
import OutletSwitcher from '@/components/OutletSwitcher';
import { useI18n, fmtDate, fmtCurrency, fmtNum } from '@/lib/i18n';
import {
  reportApi,
  thisWeekRange,
  type KpiToday,
  type SalesDayRow,
  type TopProductRow,
  type StockAlerts,
  type StockValue,
  type TopCustomerRow,
} from '@/lib/reports';

// Load charts client-side only (recharts uses browser APIs)
const SalesChart      = dynamic(() => import('@/components/SalesChart'),      { ssr: false });
const TopProductsChart = dynamic(() => import('@/components/TopProductsChart'), { ssr: false });

export default function HomePage() {
  const { t } = useI18n();
  const [outletId, setOutletId] = useState<string | undefined>();
  const [kpi,      setKpi]      = useState<KpiToday | null>(null);
  const [trend,    setTrend]    = useState<SalesDayRow[]>([]);
  const [topProds, setTopProds] = useState<TopProductRow[]>([]);
  const [alerts,   setAlerts]   = useState<StockAlerts | null>(null);
  const [stockVal, setStockVal] = useState<StockValue | null>(null);
  const [topCust,  setTopCust]  = useState<TopCustomerRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  // 'OmniPOS' on both the server render and the client's first render pass
  // (matching), then swapped for the real tenant name once mounted — reading
  // localStorage directly during render would make server/client HTML disagree.
  const [tenantName, setTenantName] = useState('OmniPOS');

  useEffect(() => {
    try {
      const session = JSON.parse(localStorage.getItem('omnipos_session') ?? '{}');
      if (session?.tenant?.name) setTenantName(session.tenant.name);
    } catch {}
  }, []);

  useEffect(() => {
    const week = thisWeekRange();
    setLoading(true);
    Promise.all([
      reportApi.getTodayKpi(outletId),
      reportApi.getSales(week.from, week.to, outletId, 'day'),
      reportApi.getTopProducts(week.from, week.to, 'revenue', 5, outletId),
      reportApi.getStockAlerts(),
      reportApi.getStockValue(),
      reportApi.getTopCustomers(week.from, week.to, 5),
    ])
      .then(([k, t, p, a, sv, tc]) => {
        setKpi(k); setTrend(t); setTopProds(p); setAlerts(a); setStockVal(sv); setTopCust(tc);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [outletId]);

  const lowStockCount = alerts?.lowStock.length ?? 0;
  const deadStockCount = alerts?.deadStock.length ?? 0;

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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
          <KpiCard
            label="Stock Value"
            value={stockVal?.totalValue ?? 0}
            format="currency"
            icon="📦"
            color="rose"
            sub={`${fmtNum(stockVal?.totalQty ?? 0)} units`}
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

      {/* Stock alerts + Top customers */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Low stock / dead stock */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Low Stock
              {lowStockCount > 0 && (
                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">{lowStockCount}</span>
              )}
            </h2>
            <a href="/reports/stock" className="text-xs text-primary-700 hover:underline font-medium">View all</a>
          </div>
          {loading ? (
            <div className="h-40 bg-gray-50 animate-pulse mx-5 mb-5 rounded-xl" />
          ) : lowStockCount === 0 ? (
            <p className="px-5 pb-5 text-sm text-gray-400">Nothing running low — all stock is above threshold.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-gray-400 text-xs uppercase border-y border-gray-100">
                  <th className="px-5 py-2 font-medium">Product</th>
                  <th className="px-5 py-2 font-medium text-right">Stock</th>
                  <th className="px-5 py-2 font-medium text-right">Threshold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {alerts!.lowStock.slice(0, 8).map((row, i) => (
                  <tr key={i}>
                    <td className="px-5 py-2 text-gray-800">
                      {row.productName}
                      {row.variantLabel && <span className="text-gray-400"> · {row.variantLabel}</span>}
                    </td>
                    <td className="px-5 py-2 text-right font-semibold text-amber-600">{fmtNum(row.currentStock)}</td>
                    <td className="px-5 py-2 text-right text-gray-400">{fmtNum(row.threshold)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {deadStockCount > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center gap-2 text-xs text-gray-500">
              <PackageX className="w-3.5 h-3.5" /> {deadStockCount} product{deadStockCount !== 1 ? 's' : ''} with no sales in 90+ days —{' '}
              <a href="/reports/stock" className="text-primary-700 hover:underline font-medium">review dead stock</a>
            </div>
          )}
        </div>

        {/* Top customers */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-600" /> Top Customers — {t('period.week')}
            </h2>
            <a href="/reports/customers" className="text-xs text-primary-700 hover:underline font-medium">View all</a>
          </div>
          {loading ? (
            <div className="h-40 bg-gray-50 animate-pulse mx-5 mb-5 rounded-xl" />
          ) : topCust.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-gray-400">No customer sales yet this week.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {topCust.map((c) => (
                <li key={c.customerId} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <div>
                    <div className="text-gray-800 font-medium">{c.customerName}</div>
                    <div className="text-xs text-gray-400">{c.invoiceCount} orders</div>
                  </div>
                  <div className="font-semibold text-gray-900">{fmtCurrency(c.totalSpent)}</div>
                </li>
              ))}
            </ul>
          )}
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
