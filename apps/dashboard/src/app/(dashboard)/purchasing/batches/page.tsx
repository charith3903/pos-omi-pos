'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Layers, Search } from 'lucide-react';

function variantLabel(v: any): string {
  if (!v) return '';
  const a = v.attributes ?? {};
  return [a.size, a.color].filter(Boolean).join(' / ') || v.sku || '';
}

function daysOld(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export default function BatchesPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getBatches().then((res) => setBatches(res || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = batches.filter(
    (b) => b.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
      b.batchNo?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-full bg-slate-900 text-slate-200 p-8 flex flex-col h-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Layers className="w-8 h-8 text-purple-400" /> Batch Stock
        </h1>
        <p className="text-slate-400 text-sm">Every unsold batch, oldest first (FIFO) — cost, selling price, and age at a glance.</p>
      </div>

      <div className="mb-6 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input type="text" placeholder="Search by product or batch no..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 transition-colors outline-none" />
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0">
            <tr className="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-wider">
              <th className="p-4 font-medium">Product</th>
              <th className="p-4 font-medium">Batch No.</th>
              <th className="p-4 font-medium">Qty Remaining</th>
              <th className="p-4 font-medium">Unit Cost</th>
              <th className="p-4 font-medium">Selling Price</th>
              <th className="p-4 font-medium">Received</th>
              <th className="p-4 font-medium">Expiry</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filtered.map((b) => (
              <tr key={b.id} className="hover:bg-slate-700/30 transition-colors">
                <td className="p-4 text-white font-medium">
                  {b.product?.name}
                  {b.variant && <span className="block text-xs text-slate-400">{variantLabel(b.variant)}</span>}
                </td>
                <td className="p-4 text-slate-300 font-mono text-sm">{b.batchNo}</td>
                <td className="p-4 text-slate-300">{Number(b.qtyRemaining)} / {Number(b.qty)}</td>
                <td className="p-4 text-slate-300">Rs. {Number(b.unitCost).toFixed(2)}</td>
                <td className="p-4 text-slate-300">{b.sellingPrice != null ? `Rs. ${Number(b.sellingPrice).toFixed(2)}` : '—'}</td>
                <td className="p-4 text-slate-400 text-sm">{new Date(b.grn.createdAt).toLocaleDateString()} · {daysOld(b.grn.createdAt)}d ago</td>
                <td className="p-4 text-slate-400 text-sm">{b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={7} className="p-8 text-center text-slate-500">No batches with remaining stock.</td></tr>
            )}
            {loading && <tr><td colSpan={7} className="p-8 text-center text-slate-500">Loading...</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
