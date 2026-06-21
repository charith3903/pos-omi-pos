'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import DateRangePicker, { type DateRange } from '@/components/DateRangePicker';
import ExportButton from '@/components/ExportButton';
import { useI18n, fmtCurrency, fmtNum } from '@/lib/i18n';
import { reportApi, thisMonthRange, type TopProductRow, type SlowMoverRow } from '@/lib/reports';

const TopProductsChart = dynamic(() => import('@/components/TopProductsChart'), { ssr: false });

type Metric = 'revenue' | 'qty' | 'profit';

export default function ProductReportPage() {
  const { t } = useI18n();
  const [range,    setRange]    = useState<DateRange>(thisMonthRange());
  const [metric,   setMetric]   = useState<Metric>('revenue');
  const [topData,  setTopData]  = useState<TopProductRow[]>([]);
  const [slowData, setSlowData] = useState<SlowMoverRow[]>([]);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      reportApi.getTopProducts(range.from, range.to, metric, 20),
      reportApi.getSlowMovers(30, 20),
    ])
      .then(([top, slow]) => { setTopData(top); setSlowData(slow); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [range, metric]);

  const metricValue = (r: TopProductRow) =>
    metric === 'qty' ? fmtNum(r.qtySold, 1) : fmtCurrency(metric === 'profit' ? r.profit : r.revenue);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 print:p-2">
      {/* Header */}
      <div className="flex flex-col gap-3 print:hidden">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">{t('nav.productRpt')}</h1>
          <ExportButton type="products" from={range.from} to={range.to} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker value={range} onChange={setRange} />
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
            {(['revenue', 'qty', 'profit'] as Metric[]).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  metric === m ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-blue-600'
                }`}
              >
                {t(`product.${m === 'qty' ? 'qty' : m === 'profit' ? 'profit' : 'revenue'}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Print title */}
      <div className="hidden print:block">
        <h1 className="text-lg font-bold">{t('nav.productRpt')} — {range.from} to {range.to}</h1>
      </div>

      {/* Top products chart + table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">{t('product.top')}</h2>
          {loading
            ? <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
            : <TopProductsChart data={topData.slice(0, 10)} metric={metric} />
          }
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden self-start">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">{t('product.top')} — Detail</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm animate-pulse">{t('report.loading')}</div>
          ) : topData.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">{t('report.noData')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">{t('product.name')}</th>
                    <th className="px-4 py-3 text-right">{t('product.qty')}</th>
                    <th className="px-4 py-3 text-right">{t('product.revenue')}</th>
                    <th className="px-4 py-3 text-right">{t('product.profit')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {topData.slice(0, 20).map((r, i) => (
                    <tr key={r.productId} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-gray-800 text-sm">{r.productName}</p>
                        {r.sku && <p className="text-xs text-gray-400">{r.sku}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{fmtNum(r.qtySold, 1)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{fmtCurrency(r.revenue)}</td>
                      <td className="px-4 py-2.5 text-right text-green-600 font-medium">{fmtCurrency(r.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Slow movers */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">{t('product.slow')} <span className="text-gray-400 font-normal">(no sales in 30 days)</span></h2>
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
            {slowData.length} products
          </span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm animate-pulse">{t('report.loading')}</div>
        ) : slowData.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">All products moved in the last 30 days 🎉</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 text-left">{t('product.name')}</th>
                  <th className="px-4 py-3 text-left">SKU</th>
                  <th className="px-4 py-3 text-right">{t('product.stock')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {slowData.map((r) => (
                  <tr key={r.productId} className="hover:bg-amber-50/30">
                    <td className="px-5 py-2.5 font-medium text-gray-800">{r.productName}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs font-mono">{r.sku ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-amber-600 font-semibold">{fmtNum(r.currentStock, 1)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
