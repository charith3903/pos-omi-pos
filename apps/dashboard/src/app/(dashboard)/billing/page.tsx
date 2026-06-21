'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { Receipt } from '@/components/Receipt';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  price: string | number;
  taxRate: string | number;
  trackStock: boolean;
  category?: { name: string } | null;
}

interface CartLine {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
}

type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER';

// ─── Cart calculations ────────────────────────────────────────────────────────

function calcLine(l: CartLine) {
  const sub = l.qty * l.unitPrice;
  return { sub };
}

function calcTotals(lines: CartLine[], cartDiscount: number) {
  const subtotal = lines.reduce((s, l) => s + calcLine(l).sub, 0);
  const discount = Math.min(cartDiscount, subtotal);
  const tax = lines.reduce((s, l) => s + l.qty * l.unitPrice * Number(l.taxRate), 0);
  const total = subtotal - discount + tax;
  return { subtotal, discount, tax, total };
}

// ─── Product search ───────────────────────────────────────────────────────────

function ProductSearch({ onAdd }: { onAdd: (p: Product) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timer.current);
    if (!query.trim()) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.getProducts({ search: query, limit: 8 });
        setResults(res.items);
      } finally { setLoading(false); }
    }, 280);
    return () => clearTimeout(timer.current);
  }, [query]);

  // Barcode scan: hit Enter with a barcode value
  async function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const val = query.trim();
    if (!val) return;
    try {
      const p = await api.getProductByBarcode(val);
      onAdd(p);
      setQuery('');
      setResults([]);
    } catch {
      // not a barcode, treat as search
    }
  }

  return (
    <div className="relative">
      <input
        type="search"
        placeholder="Search product or scan barcode + Enter"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        autoFocus
      />
      {(loading || results.length > 0) && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-72 overflow-auto">
          {loading && <div className="px-4 py-3 text-sm text-gray-400">Searching…</div>}
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => { onAdd(p); setQuery(''); setResults([]); }}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-primary-50 text-left border-b last:border-0"
            >
              <div>
                <div className="font-medium text-sm text-gray-900">{p.name}</div>
                <div className="text-xs text-gray-400">{p.sku ?? p.barcode ?? p.category?.name ?? ''}</div>
              </div>
              <div className="text-primary-700 font-semibold text-sm">LKR {Number(p.price).toFixed(2)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [cartDiscount, setCartDiscount] = useState(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('CASH');
  const [cashGiven, setCashGiven] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [posting, setPosting] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [error, setError] = useState('');

  const session = getSession();
  const { subtotal, discount, tax, total } = calcTotals(lines, cartDiscount);
  const paid = payMethod === 'CASH' ? Number(cashGiven) || 0 : total;
  const change = paid - total;

  // ─── Cart manipulation ─────────────────────────────────────────────────

  function addProduct(p: Product) {
    setLines((prev) => {
      const existing = prev.findIndex((l) => l.productId === p.id);
      if (existing >= 0) {
        return prev.map((l, i) => i === existing ? { ...l, qty: l.qty + 1 } : l);
      }
      return [...prev, {
        productId: p.id,
        name: p.name,
        qty: 1,
        unitPrice: Number(p.price),
        taxRate: Number(p.taxRate),
      }];
    });
  }

  function updateQty(idx: number, delta: number) {
    setLines((prev) => {
      const updated = prev.map((l, i) =>
        i === idx ? { ...l, qty: Math.max(1, l.qty + delta) } : l,
      );
      return updated;
    });
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function clearCart() {
    setLines([]);
    setCartDiscount(0);
    setCashGiven('');
    setCustomerId('');
    setError('');
  }

  // ─── Checkout ──────────────────────────────────────────────────────────

  async function checkout() {
    if (lines.length === 0) return;
    if (payMethod === 'CASH' && paid < total) {
      setError('Cash given is less than total');
      return;
    }

    setPosting(true);
    setError('');

    const outletId = session?.user?.tenantId; // placeholder — real app: pick from session outlets
    const invoiceId = crypto.randomUUID();

    const dto = {
      id: invoiceId,
      outletId: outletId ?? 'unknown',
      customerId: customerId || undefined,
      subtotal,
      discount,
      tax,
      total,
      items: lines.map((l) => ({
        productId: l.productId,
        nameSnapshot: l.name,
        qty: l.qty,
        unitPrice: l.unitPrice,
        tax: l.qty * l.unitPrice * l.taxRate,
        lineTotal: l.qty * l.unitPrice,
      })),
      payments: [{ method: payMethod, amount: payMethod === 'CASH' ? paid : total }],
    };

    try {
      const invoice = await api.createInvoice(dto);
      setReceipt(invoice);
      clearCart();
    } catch (err: any) {
      setError(err.message ?? 'Failed to create invoice');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="flex h-full">
      {/* ── Left: Product search + (optional) quick-access grid ── */}
      <div className="flex-1 p-6 border-r border-gray-200">
        <h1 className="text-xl font-bold text-gray-900 mb-4">New Sale</h1>
        <ProductSearch onAdd={addProduct} />

        {lines.length === 0 && (
          <div className="mt-16 text-center text-gray-300 select-none">
            <div className="text-6xl mb-3">🧾</div>
            <p className="text-lg">Search a product or scan a barcode to begin</p>
          </div>
        )}
      </div>

      {/* ── Right: Cart ── */}
      <div className="w-96 flex flex-col bg-white">
        {/* Cart items */}
        <div className="flex-1 overflow-auto p-4 space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900 truncate">{line.name}</div>
                <div className="text-xs text-gray-500">LKR {line.unitPrice.toFixed(2)} each</div>
              </div>

              {/* Qty stepper */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateQty(i, -1)}
                  className="w-7 h-7 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold flex items-center justify-center"
                >−</button>
                <span className="w-8 text-center text-sm font-semibold">{line.qty}</span>
                <button
                  onClick={() => updateQty(i, +1)}
                  className="w-7 h-7 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold flex items-center justify-center"
                >+</button>
              </div>

              <div className="text-sm font-semibold text-gray-900 w-20 text-right">
                LKR {(line.qty * line.unitPrice).toFixed(2)}
              </div>
              <button onClick={() => removeLine(i)} className="text-gray-300 hover:text-red-500 ml-1">×</button>
            </div>
          ))}
        </div>

        {/* Totals + payment */}
        <div className="border-t border-gray-200 p-4 space-y-3">
          {/* Discount */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 w-24 shrink-0">Discount</label>
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">LKR</span>
              <input
                type="number"
                min="0"
                value={cartDiscount || ''}
                onChange={(e) => setCartDiscount(Math.max(0, Number(e.target.value)))}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Totals */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span><span>LKR {subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span><span>−LKR {discount.toFixed(2)}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Tax</span><span>LKR {tax.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1 border-t border-gray-200">
              <span>Total</span><span>LKR {total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment method */}
          <div className="flex gap-2">
            {(['CASH', 'CARD', 'TRANSFER'] as PaymentMethod[]).map((m) => (
              <button
                key={m}
                onClick={() => setPayMethod(m)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  payMethod === m
                    ? 'bg-primary-700 text-white border-primary-700'
                    : 'border-gray-300 text-gray-600 hover:border-primary-400'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Cash given (only for CASH) */}
          {payMethod === 'CASH' && (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">LKR</span>
              <input
                type="number"
                min={total}
                step="0.01"
                value={cashGiven}
                onChange={(e) => setCashGiven(e.target.value)}
                placeholder={total.toFixed(2)}
                className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {change > 0 && (
                <div className="mt-1 text-right text-sm font-semibold text-green-600">
                  Change: LKR {change.toFixed(2)}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && <p className="text-red-600 text-xs">{error}</p>}

          {/* Checkout button */}
          <button
            onClick={checkout}
            disabled={lines.length === 0 || posting}
            className="w-full bg-primary-700 text-white py-3 rounded-xl font-bold text-base hover:bg-primary-800 disabled:opacity-40 transition-colors"
          >
            {posting ? 'Processing…' : `Charge LKR ${total.toFixed(2)}`}
          </button>

          {lines.length > 0 && (
            <button
              onClick={clearCart}
              className="w-full text-gray-400 hover:text-gray-600 text-xs py-1"
            >
              Clear cart
            </button>
          )}
        </div>
      </div>

      {/* Receipt modal */}
      {receipt && (
        <Receipt
          data={receipt}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  );
}
