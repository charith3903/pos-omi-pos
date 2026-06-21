'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Package, TrendingDown, TrendingUp, Loader2, RefreshCw, X, AlertTriangle } from 'lucide-react';

interface StockItem { productId: string; productName: string; sku: string | null; qty: number }

export default function StockPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [adjustItem, setAdjustItem] = useState<StockItem | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('ADJUSTMENT');
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const REASONS = ['ADJUSTMENT', 'PURCHASE', 'RETURN', 'DAMAGE', 'TRANSFER'];

  const fetchStock = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getStockList();
      setItems(data as StockItem[]);
    } catch { setItems([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStock(); }, [fetchStock]);

  const filtered = items.filter(i => {
    const s = search.toLowerCase();
    return !s || i.productName.toLowerCase().includes(s) || (i.sku ?? '').toLowerCase().includes(s);
  });

  const low = items.filter(i => i.qty <= 5).length;
  const out = items.filter(i => i.qty <= 0).length;

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustItem) return;
    const qtyDelta = Number(adjustQty);
    if (isNaN(qtyDelta) || qtyDelta === 0) { setAdjustError('Enter a non-zero quantity'); return; }
    setAdjusting(true);
    setAdjustError(null);
    try {
      await api.adjustStock({ productId: adjustItem.productId, qtyDelta, reason: adjustReason });
      setAdjustItem(null);
      setAdjustQty('');
      fetchStock();
    } catch (err: any) { setAdjustError(err.message ?? 'Adjustment failed'); } finally { setAdjusting(false); }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Management</h1>
          <p className="text-sm text-gray-500 mt-1">View levels and adjust inventory</p>
        </div>
        <button onClick={fetchStock} className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600"><Package className="w-5 h-5" /></div>
          <div><div className="text-2xl font-bold text-gray-900">{items.length}</div><div className="text-xs text-gray-500">Products tracked</div></div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
          <div className="p-2 rounded-xl bg-amber-50 text-amber-600"><TrendingDown className="w-5 h-5" /></div>
          <div><div className="text-2xl font-bold text-gray-900">{low}</div><div className="text-xs text-gray-500">Low stock (≤5)</div></div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
          <div className="p-2 rounded-xl bg-red-50 text-red-600"><AlertTriangle className="w-5 h-5" /></div>
          <div><div className="text-2xl font-bold text-gray-900">{out}</div><div className="text-xs text-gray-500">Out of stock</div></div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <input
          placeholder="Search by product name or SKU…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No stock data</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Product', 'SKU', 'Stock Level', 'Status', 'Adjust'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(item => {
                const level = item.qty <= 0 ? 'out' : item.qty <= 5 ? 'low' : 'ok';
                return (
                  <tr key={item.productId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{item.productName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.sku || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${level === 'out' ? 'bg-red-500 w-0' : level === 'low' ? 'bg-amber-400 w-1/4' : 'bg-green-500 w-3/4'}`} />
                        </div>
                        <span className={`font-semibold ${level === 'out' ? 'text-red-600' : level === 'low' ? 'text-amber-600' : 'text-gray-900'}`}>{item.qty}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {level === 'out' && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Out of Stock</span>}
                      {level === 'low' && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Low Stock</span>}
                      {level === 'ok' && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">In Stock</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setAdjustItem(item); setAdjustQty(''); setAdjustError(null); }}
                        className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                        <TrendingUp className="w-3 h-3" /> Adjust
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Adjust Modal */}
      {adjustItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900">Adjust Stock</h2>
                <p className="text-xs text-gray-500 mt-0.5">{adjustItem.productName}</p>
              </div>
              <button onClick={() => setAdjustItem(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAdjust} className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 flex justify-between items-center text-sm">
                <span className="text-gray-500">Current stock</span>
                <span className="font-bold text-gray-900">{adjustItem.qty} units</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Qty Change * <span className="font-normal text-gray-400">(use negative to remove)</span></label>
                <input type="number" required value={adjustQty} onChange={e => setAdjustQty(e.target.value)}
                  placeholder="+10 or -5"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                {adjustQty && !isNaN(Number(adjustQty)) && (
                  <p className="text-xs text-gray-500 mt-1">New stock: <strong>{adjustItem.qty + Number(adjustQty)}</strong></p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Reason *</label>
                <select value={adjustReason} onChange={e => setAdjustReason(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                  {REASONS.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              {adjustError && <p className="text-sm text-red-600">{adjustError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setAdjustItem(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium">Cancel</button>
                <button type="submit" disabled={adjusting || !adjustQty}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-semibold">
                  {adjusting ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                  Apply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
