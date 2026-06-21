'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Search, RotateCcw, Package, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface InvoiceItem {
  id: string;
  productId: string;
  nameSnapshot: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

interface Invoice {
  id: string;
  number: string;
  total: number;
  createdAt: string;
  status: string;
  customer: { name: string; phone: string | null } | null;
  items: InvoiceItem[];
}

interface RefundLine {
  invoiceItemId: string;
  qtyToRefund: number;
  selected: boolean;
}

export default function RefundsPage() {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [lines, setLines] = useState<RefundLine[]>([]);
  const [restock, setRestock] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function findInvoice() {
    if (!query.trim()) return;
    setSearching(true);
    setNotFound(false);
    setInvoice(null);
    setSuccess(null);
    setError(null);
    try {
      const inv = await api.getInvoiceByNumber(query.trim().toUpperCase());
      setInvoice(inv as Invoice);
      setLines(
        (inv as Invoice).items.map((item: InvoiceItem) => ({
          invoiceItemId: item.id,
          qtyToRefund: Number(item.qty),
          selected: true,
        })),
      );
    } catch {
      setNotFound(true);
    } finally {
      setSearching(false);
    }
  }

  function toggleLine(id: string) {
    setLines((prev) =>
      prev.map((l) => (l.invoiceItemId === id ? { ...l, selected: !l.selected } : l)),
    );
  }

  function setQty(id: string, qty: number) {
    setLines((prev) => prev.map((l) => (l.invoiceItemId === id ? { ...l, qtyToRefund: qty } : l)));
  }

  async function processRefund() {
    if (!invoice) return;
    const selected = lines.filter((l) => l.selected && l.qtyToRefund > 0);
    if (!selected.length) { setError('Select at least one item to refund.'); return; }
    setProcessing(true);
    setError(null);
    try {
      const result = await api.processRefund({
        invoiceId: invoice.id,
        items: selected.map(({ invoiceItemId, qtyToRefund }) => ({ invoiceItemId, qtyToRefund })),
        restock,
      });
      setSuccess(`Refund processed — Ref: ${(result as any).number}`);
      setInvoice(null);
      setQuery('');
      setLines([]);
    } catch (e: any) {
      setError(e.message ?? 'Refund failed');
    } finally {
      setProcessing(false);
    }
  }

  const refundTotal = lines
    .filter((l) => l.selected)
    .reduce((sum, l) => {
      const item = invoice?.items.find((i) => i.id === l.invoiceItemId);
      return sum + (item ? Number(item.unitPrice) * l.qtyToRefund : 0);
    }, 0);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Returns &amp; Refunds</h1>
        <p className="text-sm text-gray-500 mt-1">Search an invoice by number to process a return</p>
      </div>

      {success && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{success}</span>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Invoice Number</label>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="INV-2024-000001"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setNotFound(false); }}
            onKeyDown={(e) => e.key === 'Enter' && findInvoice()}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
          />
          <button
            onClick={findInvoice}
            disabled={searching || !query.trim()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Find
          </button>
        </div>
        {notFound && (
          <p className="mt-2 text-sm text-red-600 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" /> Invoice not found
          </p>
        )}
      </div>

      {/* Invoice details */}
      {invoice && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-bold text-gray-900 text-lg">{invoice.number}</div>
              <div className="text-sm text-gray-500">
                {new Date(invoice.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                {invoice.customer && ` · ${invoice.customer.name}`}
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${invoice.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {invoice.status}
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Select items to return</p>
            {invoice.items.map((item) => {
              const line = lines.find((l) => l.invoiceItemId === item.id)!;
              return (
                <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${line?.selected ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
                  <input type="checkbox" checked={line?.selected ?? false} onChange={() => toggleLine(item.id)} className="w-4 h-4 accent-blue-600" />
                  <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{item.nameSnapshot}</div>
                    <div className="text-xs text-gray-500">Rs {Number(item.unitPrice).toLocaleString()} × {Number(item.qty)}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <label className="text-xs text-gray-500">Qty:</label>
                    <input
                      type="number" min={1} max={Number(item.qty)}
                      value={line?.qtyToRefund ?? Number(item.qty)}
                      disabled={!line?.selected}
                      onChange={(e) => setQty(item.id, Math.min(Number(item.qty), Math.max(1, +e.target.value)))}
                      className="w-16 border border-gray-200 rounded px-2 py-1 text-sm text-center disabled:opacity-40"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="w-4 h-4 accent-blue-600" />
            <div>
              <div className="text-sm font-medium text-gray-900">Return items to inventory</div>
              <div className="text-xs text-gray-500">Increases stock level for returned products</div>
            </div>
          </label>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <div>
              <div className="text-xs text-gray-500">Refund amount</div>
              <div className="text-xl font-bold text-gray-900">Rs {refundTotal.toLocaleString()}</div>
            </div>
            <button
              onClick={processRefund}
              disabled={processing || refundTotal === 0}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Process Refund
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
