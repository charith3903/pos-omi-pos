'use client';

import { useEffect, useState } from 'react';
import DateRangePicker, { type DateRange } from '@/components/DateRangePicker';
import ExportButton from '@/components/ExportButton';
import { useI18n, fmtCurrency, fmtNum, fmtDate } from '@/lib/i18n';
import { reportApi, thisMonthRange, type TopCustomerRow } from '@/lib/reports';

export default function CustomerReportPage() {
  const { t } = useI18n();
  const [range,    setRange]    = useState<DateRange>(thisMonthRange());
  const [limit,    setLimit]    = useState(20);
  const [data,     setData]     = useState<TopCustomerRow[]>([]);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    setLoading(true);
    reportApi.getTopCustomers(range.from, range.to, limit)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [range, limit]);

  const totalSpent    = data.reduce((s, r) => s + r.totalSpent, 0);
  const totalInvoices = data.reduce((s, r) => s + r.invoiceCount, 0);
  const avgSpend      = data.length ? totalSpent / data.length : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 print:p-2">
      {/* Header */}
      <div className="flex flex-col gap-3 print:hidden">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">{t('nav.customers')}</h1>
          <ExportButton type="customers" from={range.from} to={range.to} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker value={range} onChange={setRange} />
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Show top:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none"
            >
              {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="hidden print:block">
        <h1 className="text-lg font-bold">{t('nav.customers')} — {range.from} to {range.to}</h1>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Revenue (Top Customers)', value: fmtCurrency(totalSpent), icon: '💰', color: 'bg-blue-50 text-blue-700' },
          { label: 'Total Invoices',                value: fmtNum(totalInvoices),   icon: '🧾', color: 'bg-purple-50 text-purple-700' },
          { label: 'Avg Spend per Customer',        value: fmtCurrency(avgSpend),   icon: '📊', color: 'bg-green-50 text-green-700' },
        ].map((k) => (
          <div key={k.label} className={`${k.color.split(' ')[0]} rounded-2xl p-5 shadow-sm border border-white/60`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{k.icon}</span>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">{k.label}</p>
                <p className={`text-2xl font-bold ${k.color.split(' ')[1]}`}>{loading ? '—' : k.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Customer table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">{t('customer.top')}</h2>
          <span className="text-xs text-gray-400">{data.length} customers</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm animate-pulse">{t('report.loading')}</div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">{t('report.noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">{t('customer.name')}</th>
                  <th className="px-4 py-3 text-left">{t('customer.phone')}</th>
                  <th className="px-4 py-3 text-right">{t('customer.spent')}</th>
                  <th className="px-4 py-3 text-right">{t('customer.visits')}</th>
                  <th className="px-4 py-3 text-right">Avg / Visit</th>
                  <th className="px-4 py-3 text-right">{t('customer.last')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map((r, i) => (
                  <tr key={r.customerId} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 text-gray-400 font-mono text-xs">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold text-xs flex-shrink-0">
                          {r.customerName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-800">{r.customerName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">{r.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmtCurrency(r.totalSpent)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{r.invoiceCount}</td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {fmtCurrency(r.invoiceCount > 0 ? r.totalSpent / r.invoiceCount : 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">{fmtDate(r.lastPurchase)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-blue-50 font-semibold text-blue-800 text-sm">
                <tr>
                  <td className="px-5 py-3" colSpan={3}>Total ({data.length} customers)</td>
                  <td className="px-4 py-3 text-right">{fmtCurrency(totalSpent)}</td>
                  <td className="px-4 py-3 text-right">{totalInvoices}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Sparklines legend for print */}
      <div className="hidden print:block text-xs text-gray-400 mt-4">
        Generated by OmniPOS — {new Date().toLocaleString()}
      </div>
    </div>
  );
}
