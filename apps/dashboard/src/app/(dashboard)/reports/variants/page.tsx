'use client';

import { useEffect, useState } from 'react';
import DateRangePicker, { type DateRange } from '@/components/DateRangePicker';
import { useI18n, fmtCurrency, fmtNum } from '@/lib/i18n';
import { reportApi, thisMonthRange, type VariantPerformanceRow } from '@/lib/reports';

type Metric = 'revenue' | 'qty' | 'profit';

function attrLabel(attrs: Record<string, string>): string {
  return Object.values(attrs).filter(Boolean).join(' / ') || '—';
}

export default function VariantReportPage() {
  const { t } = useI18n();
  const [range, setRange] = useState<DateRange>(thisMonthRange());
  const [metric, setMetric] = useState<Metric>('qty');
  const [data, setData] = useState<VariantPerformanceRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    reportApi
      .getVariantPerformance(range.from, range.to, metric, 50)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [range, metric]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 print:p-2">
      <div className="flex flex-col gap-3 print:hidden">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">{t('nav.variantRpt')}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker value={range} onChange={setRange} />
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
            {(['qty', 'revenue', 'profit'] as Metric[]).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  metric === m ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-blue-600'
                }`}
              >
                {t(`product.${m}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="hidden print:block">
        <h1 className="text-lg font-bold">{t('nav.variantRpt')} — {range.from} to {range.to}</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">
            {t('nav.variantRpt')} — by {metric === 'qty' ? t('product.qty') : metric === 'profit' ? t('product.profit') : t('product.revenue')}
          </h2>
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
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">{t('product.name')}</th>
                  <th className="px-4 py-3 text-left">Size / Color</th>
                  <th className="px-4 py-3 text-left">Barcode</th>
                  <th className="px-4 py-3 text-right">{t('product.qty')}</th>
                  <th className="px-4 py-3 text-right">{t('product.revenue')}</th>
                  <th className="px-4 py-3 text-right">{t('product.profit')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map((r, i) => (
                  <tr key={r.variantId} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-800 text-sm">{r.productName}</p>
                      {r.sku && <p className="text-xs text-gray-400">{r.sku}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{attrLabel(r.attributes)}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs font-mono">{r.barcode ?? '—'}</td>
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
  );
}
