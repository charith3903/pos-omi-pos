'use client';

import { useEffect, useState } from 'react';
import ExportButton from '@/components/ExportButton';
import { useI18n, fmtCurrency, fmtNum } from '@/lib/i18n';
import { reportApi, type StockValue, type StockAlerts } from '@/lib/reports';

export default function StockReportPage() {
  const { t } = useI18n();
  const [value,   setValue]   = useState<StockValue | null>(null);
  const [alerts,  setAlerts]  = useState<StockAlerts | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<'value' | 'low' | 'dead'>('value');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      reportApi.getStockValue(),
      reportApi.getStockAlerts(),
    ])
      .then(([v, a]) => { setValue(v); setAlerts(a); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 print:p-2">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-bold text-gray-900">{t('nav.stock')}</h1>
        <ExportButton type="stock" from={today} to={today} />
      </div>

      <div className="hidden print:block">
        <h1 className="text-lg font-bold">{t('nav.stock')} — {today}</h1>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            label: t('stock.value'),
            value: fmtCurrency(value?.totalValue ?? 0),
            icon: '💎',
            color: 'bg-blue-50 text-blue-700',
          },
          {
            label: t('stock.totalQty'),
            value: fmtNum(value?.totalQty ?? 0, 1),
            icon: '📦',
            color: 'bg-purple-50 text-purple-700',
          },
          {
            label: t('stock.lowStock'),
            value: String(alerts?.lowStock.length ?? 0) + ' products',
            icon: '⚠️',
            color: 'bg-amber-50 text-amber-700',
          },
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

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit print:hidden">
        {([
          { key: 'value', label: t('stock.value') },
          { key: 'low',   label: t('stock.lowStock') },
          { key: 'dead',  label: t('stock.deadStock') },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
            {key === 'low' && alerts && alerts.lowStock.length > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {alerts.lowStock.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Stock value by category */}
      {(tab === 'value' || true) && tab === 'value' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">{t('stock.value')} — {t('stock.category')}</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm animate-pulse">{t('report.loading')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-5 py-3 text-left">{t('stock.category')}</th>
                    <th className="px-4 py-3 text-right">Products</th>
                    <th className="px-4 py-3 text-right">{t('stock.totalQty')}</th>
                    <th className="px-4 py-3 text-right">{t('stock.totalValue')}</th>
                    <th className="px-4 py-3 text-right">% of Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {value?.byCategory.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-medium text-gray-800">{r.categoryName}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{r.productCount}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{fmtNum(r.totalQty, 1)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmtCurrency(r.totalValue)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${Math.min(100, (r.totalValue / (value?.totalValue || 1)) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">
                            {((r.totalValue / (value?.totalValue || 1)) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-blue-50 font-semibold text-blue-800">
                  <tr>
                    <td className="px-5 py-3" colSpan={3}>Total</td>
                    <td className="px-4 py-3 text-right">{fmtCurrency(value?.totalValue ?? 0)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Low stock alerts */}
      {tab === 'low' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">{t('stock.lowStock')}</h2>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              {alerts?.lowStock.length ?? 0} items
            </span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm animate-pulse">{t('report.loading')}</div>
          ) : !alerts?.lowStock.length ? (
            <div className="p-8 text-center text-green-600 text-sm">All stock levels healthy ✓</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 text-left">{t('product.name')}</th>
                  <th className="px-4 py-3 text-left">SKU</th>
                  <th className="px-4 py-3 text-right">{t('product.stock')}</th>
                  <th className="px-4 py-3 text-right">{t('stock.threshold')}</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {alerts.lowStock.map((r) => (
                  <tr key={r.productId} className="hover:bg-amber-50/30">
                    <td className="px-5 py-2.5 font-medium text-gray-800">{r.productName}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs font-mono">{r.sku ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-bold ${r.currentStock <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        {fmtNum(r.currentStock, 1)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{fmtNum(r.threshold)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.currentStock <= 0
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {r.currentStock <= 0 ? 'Out of Stock' : 'Low Stock'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Dead stock */}
      {tab === 'dead' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              {t('stock.deadStock')} <span className="text-gray-400 font-normal">(no sales in 60 days)</span>
            </h2>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
              {alerts?.deadStock.length ?? 0} items
            </span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm animate-pulse">{t('report.loading')}</div>
          ) : !alerts?.deadStock.length ? (
            <div className="p-8 text-center text-green-600 text-sm">No dead stock detected ✓</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 text-left">{t('product.name')}</th>
                  <th className="px-4 py-3 text-left">SKU</th>
                  <th className="px-4 py-3 text-right">{t('product.stock')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {alerts.deadStock.map((r) => (
                  <tr key={r.productId} className="hover:bg-gray-50/50">
                    <td className="px-5 py-2.5 font-medium text-gray-700">{r.productName}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs font-mono">{r.sku ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-500">{fmtNum(r.currentStock, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
