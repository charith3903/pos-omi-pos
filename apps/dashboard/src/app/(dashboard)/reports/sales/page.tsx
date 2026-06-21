'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import DateRangePicker, { type DateRange } from '@/components/DateRangePicker';
import ExportButton from '@/components/ExportButton';
import OutletSwitcher from '@/components/OutletSwitcher';
import { useI18n, fmtCurrency, fmtNum, fmtDate } from '@/lib/i18n';
import { reportApi, thisMonthRange, type SalesDayRow, type CashierRow } from '@/lib/reports';

const SalesChart = dynamic(() => import('@/components/SalesChart'), { ssr: false });

type GroupBy = 'day' | 'week' | 'month';

export default function SalesReportPage() {
  const { t } = useI18n();
  const [range,    setRange]    = useState<DateRange>(thisMonthRange());
  const [outletId, setOutletId] = useState<string | undefined>();
  const [groupBy,  setGroupBy]  = useState<GroupBy>('day');
  const [sales,    setSales]    = useState<SalesDayRow[]>([]);
  const [cashier,  setCashier]  = useState<CashierRow[]>([]);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      reportApi.getSales(range.from, range.to, outletId, groupBy),
      reportApi.getCashier(range.from, range.to, outletId),
    ])
      .then(([s, c]) => { setSales(s); setCashier(c); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [range, outletId, groupBy]);

  const totals = sales.reduce(
    (acc, r) => ({
      sales:    acc.sales    + Number(r.totalSales),
      tax:      acc.tax      + Number(r.totalTax),
      profit:   acc.profit   + Number(r.totalProfit),
      items:    acc.items    + Number(r.itemsSold),
      invoices: acc.invoices + Number(r.invoiceCount),
    }),
    { sales: 0, tax: 0, profit: 0, items: 0, invoices: 0 },
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 print:p-2">
      {/* Header */}
      <div className="flex flex-col gap-3 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-900">{t('nav.sales')}</h1>
          <ExportButton type="sales" from={range.from} to={range.to} outletId={outletId} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker value={range} onChange={setRange} />
          <OutletSwitcher value={outletId} onChange={setOutletId} />
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
            {(['day', 'week', 'month'] as GroupBy[]).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  groupBy === g ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-blue-600'
                }`}
              >
                {t(`report.${g}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Print title */}
      <div className="hidden print:block">
        <h1 className="text-lg font-bold">{t('nav.sales')} — {range.from} to {range.to}</h1>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: t('sales.revenue'),  value: fmtCurrency(totals.sales) },
          { label: t('sales.tax'),      value: fmtCurrency(totals.tax) },
          { label: t('sales.profit'),   value: fmtCurrency(totals.profit) },
          { label: t('kpi.itemsSold'),  value: fmtNum(totals.items, 1) },
          { label: t('sales.invoices'), value: fmtNum(totals.invoices) },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{k.label}</p>
            <p className="text-xl font-bold text-gray-800 mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">{t('sales.trend')}</h2>
        {loading
          ? <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
          : <SalesChart data={sales} showProfit />
        }
      </div>

      {/* Data table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">{t('period.custom')} — Detail</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm animate-pulse">{t('report.loading')}</div>
        ) : sales.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">{t('report.noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 text-left">Date / Period</th>
                  <th className="px-4 py-3 text-right">{t('sales.revenue')}</th>
                  <th className="px-4 py-3 text-right">{t('sales.tax')}</th>
                  <th className="px-4 py-3 text-right">{t('sales.profit')}</th>
                  <th className="px-4 py-3 text-right">{t('kpi.itemsSold')}</th>
                  <th className="px-4 py-3 text-right">{t('sales.invoices')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sales.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-medium text-gray-800">
                      {r.date ? fmtDate(r.date) : r.period}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtCurrency(Number(r.totalSales))}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{fmtCurrency(Number(r.totalTax))}</td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium">{fmtCurrency(Number(r.totalProfit))}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtNum(Number(r.itemsSold), 1)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtNum(Number(r.invoiceCount))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-blue-50 font-semibold text-blue-800">
                <tr>
                  <td className="px-5 py-3">Total</td>
                  <td className="px-4 py-3 text-right">{fmtCurrency(totals.sales)}</td>
                  <td className="px-4 py-3 text-right">{fmtCurrency(totals.tax)}</td>
                  <td className="px-4 py-3 text-right">{fmtCurrency(totals.profit)}</td>
                  <td className="px-4 py-3 text-right">{fmtNum(totals.items, 1)}</td>
                  <td className="px-4 py-3 text-right">{fmtNum(totals.invoices)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Cashier breakdown */}
      {cashier.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">{t('sales.cashier')}</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-5 py-3 text-left">Device / Cashier</th>
                <th className="px-4 py-3 text-right">{t('sales.revenue')}</th>
                <th className="px-4 py-3 text-right">{t('sales.invoices')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {cashier.map((c, i) => (
                <tr key={i} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-medium text-gray-800">{c.deviceName}</td>
                  <td className="px-4 py-3 text-right">{fmtCurrency(c.totalSales)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{c.invoiceCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
