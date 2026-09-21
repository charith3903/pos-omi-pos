'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { getSession, clearSession } from '@/lib/auth';
import { Receipt } from '@/components/Receipt';
import {
  Modal,
  EditLineModal,
  ItemDiscountModal,
  MiscItemModal,
  LoadTransModal,
  QuotationModal,
  SalesReturnModal,
  CreditCustomerModal,
  SalesmanPickerModal,
  CashMovementModal,
  CloseShiftModal,
  LockScreenOverlay,
  LookupModal,
  BillReprintModal,
} from './BillingModals';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Variant {
  id: string;
  attributes: Record<string, string>;
  price?: string | number | null;
  wholesalePrice?: string | number | null;
  effectivePrice?: number;
  barcode?: string | null;
  sku?: string | null;
}

interface Product {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  price: string | number;
  wholesalePrice?: string | number | null;
  effectivePrice?: number;
  taxRate: string | number;
  trackStock: boolean;
  category?: { name: string } | null;
  variants?: Variant[];
}

interface CartLine {
  productId: string;
  variantId?: string;
  name: string;
  barcode?: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
  discount: number; // item-wise discount (currency amount)
}

type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'CHEQUE' | 'CREDIT';
interface PaymentLine {
  method: PaymentMethod;
  amount: number;
}

function variantLabel(v: Variant): string {
  const a = v.attributes ?? {};
  return [a.size, a.color].filter(Boolean).join(' / ') || v.sku || v.id;
}

// ─── Cart calculations ────────────────────────────────────────────────────────

function calcLine(l: CartLine) {
  const sub = l.qty * l.unitPrice - l.discount;
  return { sub: Math.max(0, sub) };
}

function calcTotals(lines: CartLine[], billDiscount: number) {
  const itemsGross = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const itemDiscounts = lines.reduce((s, l) => s + l.discount, 0);
  const subtotal = itemsGross - itemDiscounts;
  const discount = Math.min(billDiscount, subtotal);
  const tax = lines.reduce((s, l) => s + calcLine(l).sub * Number(l.taxRate), 0);
  const total = subtotal - discount + tax;
  return { itemsGross, subtotal, discount, tax, total };
}

const DEVICE_ID_KEY = 'omnipos_device_id';

/**
 * Resolves this browser's till to a real `Device` row (the same model the
 * Flutter app registers against) instead of a purely cosmetic local label.
 * That means sales made here now carry a real `deviceId`, so stock
 * movements and shift/cash reports can actually attribute them to a till.
 *
 * Re-registers if the cached id is missing or no longer valid (e.g. it
 * belonged to a different tenant's browser profile, or was deleted).
 */
async function ensureDevice(outletId?: string): Promise<{ id: string; name: string }> {
  const cachedId = localStorage.getItem(DEVICE_ID_KEY);
  if (cachedId) {
    try {
      const device = await api.getDevice(cachedId);
      return device;
    } catch {
      // Fall through to register a new one.
    }
  }
  const device = await api.registerDevice({ outletId });
  localStorage.setItem(DEVICE_ID_KEY, device.id);
  return device;
}

// ─── Product search (barcode/name — feeds the item table, not a browse grid) ──

function ProductSearch({
  categoryId,
  onAdd,
}: {
  categoryId: string | null;
  onAdd: (p: Product, matchedVariantId?: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  // -1 = nothing highlighted yet (still typing); Up/Down move this before
  // Enter picks it — the only way to add an item by name without a mouse.
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    clearTimeout(timer.current);
    setHighlightIdx(-1);
    if (!query.trim()) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.getProducts({ search: query, categoryId: categoryId ?? undefined, limit: 8 });
        setResults(res.items);
      } finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(timer.current);
  }, [query, categoryId]);

  function selectResult(p: Product) {
    onAdd(p);
    setQuery('');
    setResults([]);
    setHighlightIdx(-1);
  }

  async function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && results.length > 0) {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, results.length - 1));
      return;
    }
    if (e.key === 'ArrowUp' && results.length > 0) {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Escape') {
      setResults([]);
      setHighlightIdx(-1);
      return;
    }
    if (e.key !== 'Enter') return;

    // A highlighted result (arrowed-to, or the sole match) wins over the
    // barcode lookup — matches what the cashier sees on screen.
    if (highlightIdx >= 0 && results[highlightIdx]) {
      selectResult(results[highlightIdx]);
      return;
    }

    const val = query.trim();
    if (!val) return;
    try {
      const p = await api.getProductByBarcode(val);
      onAdd(p, p.matchedVariantId);
      setQuery('');
      setResults([]);
    } catch {
      // Not a barcode. Exactly one name match — Enter selects it directly,
      // same as pressing Down once then Enter.
      if (results.length === 1) selectResult(results[0]);
    }
  }

  return (
    <div className="relative flex-1">
      <input
        id="pos-search-input"
        ref={inputRef}
        type="search"
        placeholder="Barcode / Item Name (F10 to focus)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        autoFocus
      />
      {(loading || results.length > 0) && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-72 overflow-auto">
          {loading && <div className="px-4 py-3 text-sm text-gray-400">Searching…</div>}
          {results.map((p, i) => (
            <button
              key={p.id}
              onClick={() => selectResult(p)}
              onMouseEnter={() => setHighlightIdx(i)}
              className={`w-full flex items-center justify-between px-4 py-3 text-left border-b last:border-0 ${
                i === highlightIdx ? 'bg-primary-50' : 'hover:bg-primary-50'
              }`}
            >
              <div>
                <div className="font-medium text-sm text-gray-900">{p.name}</div>
                <div className="text-xs text-gray-400">{p.sku ?? p.barcode ?? p.category?.name ?? ''}</div>
              </div>
              <div className="text-primary-700 font-semibold text-sm">
                LKR {Number(p.effectivePrice ?? p.price).toFixed(2)}{p.variants?.length ? ` · ${p.variants.length} variant${p.variants.length > 1 ? 's' : ''}` : ''}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Variant picker ───────────────────────────────────────────────────────────

function VariantPicker({ product, onPick, onClose }: { product: Product; onPick: (v: Variant) => void; onClose: () => void }) {
  return (
    <Modal title={`${product.name} — choose variant`} onClose={onClose} width="max-w-sm">
      <div className="grid grid-cols-2 gap-2">
        {(product.variants ?? []).map((v) => (
          <button
            key={v.id}
            onClick={() => onPick(v)}
            className="border border-gray-300 rounded-xl px-3 py-3 text-left hover:border-primary-500 hover:bg-primary-50 transition-colors"
          >
            <div className="font-medium text-sm text-gray-900">{variantLabel(v)}</div>
            <div className="text-xs text-primary-700 font-semibold mt-1">
              LKR {Number(v.effectivePrice ?? v.price ?? product.price).toFixed(2)}
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

// ─── Category sidebar ────────────────────────────────────────────────────────

function CategorySidebar({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
  }, []);

  const roots = categories.filter((c) => !c.parentId);
  const children = categories.filter((c) => c.parentId === selected);

  return (
    <div className="w-40 shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        <button
          onClick={() => onSelect(null)}
          className={`w-full text-left px-3 py-2.5 text-xs font-semibold border-b border-gray-200 ${!selected ? 'bg-primary-700 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
        >
          All Items
        </button>
        {roots.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`w-full text-left px-3 py-2.5 text-xs font-semibold border-b border-gray-200 ${selected === c.id ? 'bg-primary-700 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            {c.name.toUpperCase()}
          </button>
        ))}
      </div>
      {children.length > 0 && (
        <div className="border-t border-gray-300 max-h-40 overflow-auto">
          {children.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-gray-100 border-b border-gray-100"
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Toolbar button ──────────────────────────────────────────────────────────

function ToolbarBtn({
  label,
  hotkey,
  onClick,
  tone = 'default',
}: {
  label: string;
  hotkey?: string;
  onClick: () => void;
  tone?: 'default' | 'warn' | 'danger';
}) {
  const toneCls =
    tone === 'danger' ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200' :
    tone === 'warn' ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200' :
    'bg-white hover:bg-primary-50 text-gray-700 border-gray-200';
  return (
    <button onClick={onClick} className={`flex-1 min-w-[84px] border rounded-lg px-2 py-2 text-center transition-colors ${toneCls}`}>
      <div className="text-[11px] font-semibold leading-tight">{label}</div>
      {hotkey && <div className="text-[9px] text-gray-400 mt-0.5">{hotkey}</div>}
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GenericBilling() {
  // Populated client-side only (useEffect below) — getSession() reads
  // localStorage, which doesn't exist during SSR, so rendering it directly
  // on first pass would make the server/client HTML disagree.
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [billDiscount, setBillDiscount] = useState(0);
  const [payments, setPayments] = useState<PaymentLine[]>([]);
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);
  const [salesman, setSalesman] = useState<{ id: string; name: string } | null>(null);
  const [billNote, setBillNote] = useState('');
  const [rateType, setRateType] = useState<'RETAIL' | 'WHOLESALE'>('RETAIL');
  const [outletId, setOutletId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [error, setError] = useState('');
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [darkTheme, setDarkTheme] = useState(false);
  const [locked, setLocked] = useState(false);
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [lastInvoice, setLastInvoice] = useState<{ number: string } | null>(null);
  // Both null on first (server) render so SSR/client markup matches exactly;
  // filled in after mount — see the effect below.
  const [clock, setClock] = useState<Date | null>(null);
  const [tillId, setTillId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  // Modal visibility
  const [modal, setModal] = useState<
    | null
    | 'editRate' | 'editQty' | 'itemDisc' | 'misc'
    | 'loadTrans' | 'quotation' | 'salesReturn' | 'creditCustomer' | 'salesman'
    | 'cashIn' | 'cashOut' | 'closeShift' | 'openShift'
    | 'stockCheck' | 'costCheck' | 'productPrices' | 'billReprint' | 'billNote'
  >(null);
  const [openingCashInput, setOpeningCashInput] = useState('');
  const [paymentAmountInput, setPaymentAmountInput] = useState('');

  const { itemsGross, subtotal, discount, tax, total } = calcTotals(lines, billDiscount);
  const paidSoFar = payments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, total - paidSoFar);
  const change = Math.max(0, paidSoFar - total);

  useEffect(() => {
    setSession(getSession());
    api.getOutlets().then((list) => {
      const def = list.find((o) => o.isDefault) ?? list[0];
      if (def) setOutletId(def.id);
      ensureDevice(def?.id)
        .then((device) => { setDeviceId(device.id); setTillId(device.name); })
        .catch(() => {});
    }).catch(() => {});
    refreshShift();
    setClock(new Date());
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  async function renameTill() {
    if (!deviceId) return;
    const next = window.prompt('Rename this till', tillId ?? '');
    if (!next || !next.trim()) return;
    try {
      const device = await api.renameDevice(deviceId, next.trim());
      setTillId(device.name);
    } catch (err: any) {
      alert(err.message ?? 'Failed to rename till');
    }
  }

  function refreshShift() {
    api.getCurrentShift().then(setCurrentShift).catch(() => setCurrentShift(null));
  }

  // ─── Keyboard shortcuts (F-keys, matching the reference till layout) ────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (locked) return;
      const map: Record<string, () => void> = {
        F1: () => selectedIdx != null && setModal('editRate'),
        F2: () => selectedIdx != null && setModal('editQty'),
        F3: () => selectedIdx != null && setModal('itemDisc'),
        F6: () => { if (!posting && lines.length) checkout(); },
        F9: () => setModal('misc'),
        F10: () => document.getElementById('pos-search-input')?.focus(),
        F11: () => setModal('costCheck'),
      };
      const handler = map[e.key];
      if (handler) {
        e.preventDefault();
        handler();
        return;
      }

      // Digit-key payment shortcuts (1 Cash / 2 Card / 3 Transfer / 4 Cheque
      // / 5 Credit) — a common till convention, but digits are also how a
      // cashier types a SKU or price into a text field, so these only fire
      // when no modal is open and focus isn't in any input/textarea. Adds
      // the full remaining balance for that method, same as clicking "+".
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      const typingInField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (!modal && !typingInField && lines.length > 0 && remaining > 0.005) {
        const payMap: Record<string, PaymentMethod> = {
          '1': 'CASH', '2': 'CARD', '3': 'TRANSFER', '4': 'CHEQUE', '5': 'CREDIT',
        };
        const method = payMap[e.key];
        if (method) {
          e.preventDefault();
          addPayment(method);
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIdx, lines, posting, locked, modal, remaining]);

  // ─── Cart manipulation ─────────────────────────────────────────────────

  function priceFor(p: Product, variant?: Variant): number {
    if (rateType === 'WHOLESALE') {
      const wp = variant?.wholesalePrice ?? p.wholesalePrice;
      if (wp != null) return Number(wp);
    }
    return variant ? Number(variant.effectivePrice ?? variant.price ?? p.price) : Number(p.effectivePrice ?? p.price);
  }

  function addLine(p: Product, variant?: Variant) {
    setLines((prev) => {
      const existing = prev.findIndex((l) => l.productId === p.id && l.variantId === variant?.id);
      if (existing >= 0) {
        return prev.map((l, i) => i === existing ? { ...l, qty: l.qty + 1 } : l);
      }
      setSelectedIdx(prev.length);
      return [...prev, {
        productId: p.id,
        variantId: variant?.id,
        name: variant ? `${p.name} (${variantLabel(variant)})` : p.name,
        barcode: variant?.barcode ?? p.barcode,
        qty: 1,
        unitPrice: priceFor(p, variant),
        taxRate: Number(p.taxRate),
        discount: 0,
      }];
    });
  }

  function addMiscLine(name: string, price: number) {
    setLines((prev) => {
      setSelectedIdx(prev.length);
      return [...prev, { productId: 'misc', name, qty: 1, unitPrice: price, taxRate: 0, discount: 0 }];
    });
    setModal(null);
  }

  function handleProductAdd(p: Product, matchedVariantId?: string) {
    if (matchedVariantId) {
      const variant = p.variants?.find((v) => v.id === matchedVariantId);
      addLine(p, variant);
    } else if (p.variants && p.variants.length > 0) {
      setPickerProduct(p);
    } else {
      addLine(p);
    }
  }

  function updateQty(idx: number, delta: number) {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, qty: Math.max(1, l.qty + delta) } : l));
  }

  function setLineRate(idx: number, value: number) {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, unitPrice: value } : l));
    setModal(null);
  }

  function setLineQty(idx: number, value: number) {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, qty: Math.max(0.001, value) } : l));
    setModal(null);
  }

  function setLineDiscount(idx: number, value: number) {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, discount: value } : l));
    setModal(null);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
    setSelectedIdx(null);
  }

  function clearCart() {
    setLines([]);
    setBillDiscount(0);
    setPayments([]);
    setCustomer(null);
    setSalesman(null);
    setBillNote('');
    setSelectedIdx(null);
    setError('');
  }

  // ─── Payments (mixed/split tender) ───────────────────────────────────────

  function addPayment(method: PaymentMethod, amount?: number) {
    const amt = amount ?? remaining;
    if (amt <= 0) return;
    setPayments((prev) => [...prev, { method, amount: Math.min(amt, remaining) }]);
    setPaymentAmountInput('');
  }

  function removePayment(idx: number) {
    setPayments((prev) => prev.filter((_, i) => i !== idx));
  }

  // ─── Hold / Load transaction ─────────────────────────────────────────────

  async function holdTransaction() {
    if (lines.length === 0) return;
    await api.holdSale({
      outletId: outletId ?? undefined,
      customerId: customer?.id,
      cartSnapshot: { lines, billDiscount, payments, salesman, billNote, rateType },
    });
    clearCart();
  }

  function loadHeldSale(h: any) {
    const snap = h.cartSnapshot ?? {};
    setLines(snap.lines ?? []);
    setBillDiscount(snap.billDiscount ?? 0);
    setPayments(snap.payments ?? []);
    setSalesman(snap.salesman ?? null);
    setBillNote(snap.billNote ?? '');
    setRateType(snap.rateType ?? 'RETAIL');
    if (h.customer) setCustomer(h.customer);
    setModal(null);
  }

  // ─── Quotation ────────────────────────────────────────────────────────────

  async function createQuotationFromCart() {
    await api.createQuotation({
      outletId: outletId ?? undefined,
      customerId: customer?.id,
      items: lines.filter((l) => l.productId !== 'misc').map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        qty: l.qty,
        unitPrice: l.unitPrice,
        discount: l.discount,
      })),
    });
  }

  function loadQuotation(q: any) {
    setLines(q.items.map((it: any) => ({
      productId: it.productId,
      variantId: it.variantId ?? undefined,
      name: it.product?.name ?? 'Item',
      qty: Number(it.qty),
      unitPrice: Number(it.unitPrice),
      taxRate: 0,
      discount: Number(it.discount ?? 0),
    })));
    if (q.customer) setCustomer(q.customer);
    setModal(null);
  }

  // ─── Checkout ──────────────────────────────────────────────────────────

  async function checkout() {
    if (lines.length === 0) return;
    if (!outletId) { setError('No outlet found for this tenant — cannot bill.'); return; }

    const finalPayments = [...payments];
    if (remaining > 0.005) {
      // Fast path: no split configured yet — charge the rest to CASH, same
      // one-click feel the old single-method flow had.
      finalPayments.push({ method: 'CASH', amount: remaining });
    }
    const totalPaid = finalPayments.reduce((s, p) => s + p.amount, 0);
    if (totalPaid < total - 0.005) {
      setError('Payment total is less than the bill total');
      return;
    }

    setPosting(true);
    setError('');

    const invoiceId = crypto.randomUUID();
    const dto = {
      id: invoiceId,
      outletId,
      deviceId: deviceId ?? undefined,
      customerId: customer?.id,
      salesmanId: salesman?.id,
      notes: billNote || undefined,
      subtotal,
      discount,
      tax,
      total,
      items: lines.map((l) => ({
        productId: l.productId === 'misc' ? l.productId : l.productId,
        variantId: l.variantId,
        nameSnapshot: l.name,
        qty: l.qty,
        unitPrice: l.unitPrice,
        discount: l.discount,
        tax: calcLine(l).sub * l.taxRate,
        lineTotal: calcLine(l).sub,
      })),
      payments: finalPayments,
    };

    try {
      const invoice = await api.createInvoice(dto);
      setReceipt(invoice);
      setLastInvoice({ number: invoice.number });
      clearCart();
    } catch (err: any) {
      setError(err.message ?? 'Failed to create invoice');
    } finally {
      setPosting(false);
    }
  }

  function quickSettle() {
    // One-tap exact cash for the full remaining amount, then charge.
    setPayments((prev) => [...prev, { method: 'CASH', amount: remaining }]);
    setTimeout(checkout, 0);
  }

  function logout() {
    clearSession();
    window.location.href = '/login';
  }

  const selectedLine = selectedIdx != null ? lines[selectedIdx] : null;

  return (
    <div className={`flex flex-col h-full ${darkTheme ? 'bg-slate-900 text-slate-100' : 'bg-gray-100'}`}>
      {locked && <LockScreenOverlay onUnlock={() => setLocked(false)} />}

      {/* ── Toolbar row 1 ── */}
      <div className="flex gap-1 p-1.5 border-b border-gray-300 bg-slate-800">
        <ToolbarBtn label="Change Rate" hotkey="F1" onClick={() => selectedIdx != null && setModal('editRate')} />
        <ToolbarBtn label="Change Qty" hotkey="F2" onClick={() => selectedIdx != null && setModal('editQty')} />
        <ToolbarBtn label="Item Disc" hotkey="F3" onClick={() => selectedIdx != null && setModal('itemDisc')} />
        <ToolbarBtn label="Bill Discount" onClick={() => document.getElementById('bill-discount-input')?.focus()} />
        <ToolbarBtn label="New Trans" onClick={clearCart} />
        <ToolbarBtn label="Scan Items" onClick={() => document.getElementById('pos-search-input')?.focus()} />
        <ToolbarBtn label="Product" hotkey="F9" onClick={() => setModal('misc')} />
        <ToolbarBtn label="Find Item" hotkey="F10" onClick={() => document.getElementById('pos-search-input')?.focus()} />
        <ToolbarBtn label="Hold Trans" onClick={holdTransaction} />
        <ToolbarBtn label="Load Trans" onClick={() => setModal('loadTrans')} />
        <ToolbarBtn label="Back Office" onClick={() => (window.location.href = '/dashboard')} />
      </div>

      {/* ── Toolbar row 2 ── */}
      <div className="flex gap-1 p-1.5 border-b border-gray-300 bg-slate-800">
        <ToolbarBtn label="Bill Reprint" onClick={() => setModal('billReprint')} />
        <ToolbarBtn label="Credit Customer" onClick={() => setModal('creditCustomer')} />
        <ToolbarBtn label="Salesman" onClick={() => setModal('salesman')} />
        <ToolbarBtn label="Quotation" onClick={() => setModal('quotation')} />
        <ToolbarBtn label="Sales Return" onClick={() => setModal('salesReturn')} />
        <ToolbarBtn label="Stock Update" onClick={() => (window.location.href = '/stock')} />
        <ToolbarBtn label="Open Cash Drawer" onClick={async () => {
          if (!currentShift) { setModal('openShift'); return; }
          await api.addCashMovement(currentShift.id, { type: 'DRAWER_OPEN', amount: 0 });
        }} />
        <ToolbarBtn label="Expense / Paid Out" onClick={() => currentShift ? setModal('cashOut') : setModal('openShift')} />
        <ToolbarBtn label="Close Shift" tone="warn" onClick={() => currentShift ? setModal('closeShift') : setModal('openShift')} />
        <ToolbarBtn label="Logout" tone="danger" onClick={logout} />
        <ToolbarBtn label="Lock Screen" onClick={() => setLocked(true)} />
      </div>

      {/* ── Info bar ── */}
      <div className="flex items-center gap-3 p-2 border-b border-gray-300 bg-white">
        <div className="text-xs text-gray-500 shrink-0">
          Last Invoice: <span className="font-semibold text-gray-800">{lastInvoice?.number ?? '—'}</span>
        </div>
        <div className="flex border border-gray-300 rounded-lg overflow-hidden shrink-0">
          {(['RETAIL', 'WHOLESALE'] as const).map((rt) => (
            <button
              key={rt}
              onClick={() => setRateType(rt)}
              className={`px-3 py-1.5 text-xs font-semibold ${rateType === rt ? 'bg-primary-700 text-white' : 'bg-white text-gray-600'}`}
            >
              {rt === 'RETAIL' ? 'Retail' : 'Wholesale'}
            </button>
          ))}
        </div>
        <input
          id="bill-discount-input"
          type="number"
          min="0"
          value={billDiscount || ''}
          onChange={(e) => setBillDiscount(Math.max(0, Number(e.target.value)))}
          placeholder="Bill Disc."
          className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-xs shrink-0"
        />
        <ProductSearch categoryId={categoryId} onAdd={handleProductAdd} />
        <button
          onClick={() => setModal('creditCustomer')}
          className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 shrink-0 hover:bg-gray-50"
        >
          {customer ? customer.name : 'Select Customer'}
        </button>
      </div>

      {/* ── Lookup row ── */}
      <div className="flex gap-4 px-3 py-1 border-b border-gray-200 bg-gray-50 text-xs">
        <button onClick={() => selectedIdx != null && setModal('editRate')} className="text-primary-700 hover:underline">Change Rate</button>
        <button onClick={() => selectedIdx != null && setModal('editQty')} className="text-primary-700 hover:underline">Change QTY</button>
        <button onClick={() => setModal('stockCheck')} className="text-primary-700 hover:underline">Stock Check</button>
        <button onClick={() => setModal('costCheck')} className="text-primary-700 hover:underline">Cost Price Check (F11)</button>
        <button onClick={() => setModal('productPrices')} className="text-primary-700 hover:underline">Product Prices</button>
      </div>

      {/* ── Main: category sidebar + item table ── */}
      <div className="flex flex-1 overflow-hidden">
        <CategorySidebar selected={categoryId} onSelect={setCategoryId} />

        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="sticky top-0 bg-gray-100 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-3 py-2">Item Name</th>
                <th className="px-3 py-2">Barcode</th>
                <th className="px-3 py-2 text-right">Qty.</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-right">Disc.</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr
                  key={i}
                  onClick={() => setSelectedIdx(i)}
                  className={`cursor-pointer border-b border-gray-100 ${selectedIdx === i ? 'bg-green-600 text-white' : 'hover:bg-gray-50'}`}
                >
                  <td className="px-3 py-2 font-medium">{l.name}</td>
                  <td className="px-3 py-2 font-mono text-xs opacity-80">{l.barcode ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <span className="inline-flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); updateQty(i, -1); }} className="w-5 h-5 rounded bg-black/10 hover:bg-black/20">−</button>
                      {l.qty}
                      <button onClick={(e) => { e.stopPropagation(); updateQty(i, 1); }} className="w-5 h-5 rounded bg-black/10 hover:bg-black/20">+</button>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">{l.unitPrice.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">{l.discount > 0 ? l.discount.toFixed(2) : '—'}</td>
                  <td className="px-3 py-2 text-right font-semibold">{calcLine(l).sub.toFixed(2)}</td>
                  <td className="px-3 py-2">
                    <button onClick={(e) => { e.stopPropagation(); removeLine(i); }} className="opacity-60 hover:opacity-100">×</button>
                  </td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-16 text-center text-gray-300">Scan or search an item to begin</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Payments (mixed/split tender) ── */}
      <div className="border-t border-gray-300 bg-white px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Payments:</span>
          {payments.map((p, i) => (
            <span key={i} className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-xs">
              {p.method} LKR {p.amount.toFixed(2)}
              <button onClick={() => removePayment(i)} className="text-gray-400 hover:text-red-500">×</button>
            </span>
          ))}
          <input
            type="number"
            min="0"
            step="0.01"
            value={paymentAmountInput}
            onChange={(e) => setPaymentAmountInput(e.target.value)}
            placeholder={remaining > 0 ? remaining.toFixed(2) : '0.00'}
            disabled={remaining <= 0}
            className="w-24 border border-gray-300 rounded-full px-3 py-1 text-xs disabled:opacity-30"
            title="Amount for the next payment — leave blank to pay the full remaining balance"
          />
          {(['CASH', 'CARD', 'TRANSFER', 'CHEQUE', 'CREDIT'] as PaymentMethod[]).map((m) => (
            <button
              key={m}
              onClick={() => addPayment(m, paymentAmountInput ? Number(paymentAmountInput) : undefined)}
              disabled={remaining <= 0}
              className="text-xs border border-gray-300 rounded-full px-3 py-1 hover:border-primary-500 disabled:opacity-30"
            >
              + {m}
            </button>
          ))}
          {remaining > 0 && <span className="text-xs text-amber-600 font-semibold ml-auto">Remaining: LKR {remaining.toFixed(2)}</span>}
          {change > 0 && <span className="text-xs text-green-600 font-semibold">Change: LKR {change.toFixed(2)}</span>}
        </div>
      </div>

      {/* ── Bottom bar: totals + actions ── */}
      <div className="border-t border-gray-300 bg-slate-800 text-white px-3 py-2 flex items-center gap-4">
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={darkTheme} onChange={(e) => setDarkTheme(e.target.checked)} />
          Dark Theme
        </label>
        <button onClick={() => setModal('billNote')} className="text-xs underline">
          Bill Note{billNote ? ' •' : ''}
        </button>
        <button onClick={quickSettle} disabled={lines.length === 0 || posting} className="text-xs bg-slate-600 hover:bg-slate-500 disabled:opacity-30 px-3 py-1.5 rounded-lg font-semibold">
          Quick Settle
        </button>
        <span className="text-xs text-slate-300">
          Items: {lines.length} · Qty: {lines.reduce((s, l) => s + l.qty, 0)}
        </span>
        {error && <span className="text-xs text-red-400">{error}</span>}
        <div className="ml-auto flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase">Total VAT: LKR {tax.toFixed(2)} · Gross {itemsGross.toFixed(2)} · Disc {discount.toFixed(2)}</div>
            <div className="text-2xl font-bold">LKR {total.toFixed(2)}</div>
          </div>
          <button
            onClick={checkout}
            disabled={lines.length === 0 || posting}
            className="bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-white px-8 py-3 rounded-xl font-bold text-lg"
          >
            {posting ? 'Processing…' : 'Pay'}
            <div className="text-[10px] font-normal opacity-75">F6</div>
          </button>
        </div>
      </div>

      {/* ── Status bar ── */}
      <div className="bg-black text-slate-300 text-[11px] px-3 py-1 flex items-center gap-4">
        <button onClick={renameTill} title="Click to rename this till" className="hover:underline">
          Till: {tillId ?? '—'}
        </button>
        <span>Invoice No: {lastInvoice?.number ?? '—'}</span>
        <span>User ID: {session?.user?.name}</span>
        <span>Salesman: {salesman?.name ?? '—'}</span>
        <span className="ml-auto">{clock ? clock.toLocaleString() : ''}</span>
      </div>

      {/* ── Modals ── */}
      {pickerProduct && (
        <VariantPicker
          product={pickerProduct}
          onPick={(v) => { addLine(pickerProduct, v); setPickerProduct(null); }}
          onClose={() => setPickerProduct(null)}
        />
      )}

      {modal === 'editRate' && selectedIdx != null && selectedLine && (
        <EditLineModal mode="rate" currentValue={selectedLine.unitPrice} onSave={(v) => setLineRate(selectedIdx, v)} onClose={() => setModal(null)} />
      )}
      {modal === 'editQty' && selectedIdx != null && selectedLine && (
        <EditLineModal mode="qty" currentValue={selectedLine.qty} onSave={(v) => setLineQty(selectedIdx, v)} onClose={() => setModal(null)} />
      )}
      {modal === 'itemDisc' && selectedIdx != null && selectedLine && (
        <ItemDiscountModal
          currentDiscount={selectedLine.discount}
          lineTotal={selectedLine.qty * selectedLine.unitPrice}
          onSave={(v) => setLineDiscount(selectedIdx, v)}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'misc' && <MiscItemModal onAdd={addMiscLine} onClose={() => setModal(null)} />}
      {modal === 'loadTrans' && <LoadTransModal onLoad={loadHeldSale} onClose={() => setModal(null)} />}
      {modal === 'quotation' && (
        <QuotationModal onLoad={loadQuotation} onCreateFromCart={createQuotationFromCart} onClose={() => setModal(null)} />
      )}
      {modal === 'salesReturn' && <SalesReturnModal onDone={() => setModal(null)} onClose={() => setModal(null)} />}
      {modal === 'creditCustomer' && <CreditCustomerModal onClose={() => setModal(null)} />}
      {modal === 'salesman' && (
        <SalesmanPickerModal onPick={(u) => { setSalesman(u); setModal(null); }} onClose={() => setModal(null)} />
      )}
      {modal === 'cashIn' && currentShift && (
        <CashMovementModal type="PAID_IN" onSave={async (amount, reason) => { await api.addCashMovement(currentShift.id, { type: 'PAID_IN', amount, reason }); }} onClose={() => setModal(null)} />
      )}
      {modal === 'cashOut' && currentShift && (
        <CashMovementModal type="PAID_OUT" onSave={async (amount, reason) => { await api.addCashMovement(currentShift.id, { type: 'PAID_OUT', amount, reason }); }} onClose={() => setModal(null)} />
      )}
      {modal === 'closeShift' && currentShift && (
        <CloseShiftModal shiftId={currentShift.id} onClosed={refreshShift} onClose={() => setModal(null)} />
      )}
      {modal === 'openShift' && (
        <Modal title="Open Shift" onClose={() => setModal(null)} width="max-w-xs">
          <p className="text-xs text-gray-500 mb-2">No shift is open — enter the opening float to start one.</p>
          <input
            type="number"
            min="0"
            autoFocus
            value={openingCashInput}
            onChange={(e) => setOpeningCashInput(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
            placeholder="Opening cash"
          />
          <button
            onClick={async () => {
              await api.openShift({ openingCash: Number(openingCashInput) || 0, outletId: outletId ?? undefined });
              setOpeningCashInput('');
              setModal(null);
              refreshShift();
            }}
            className="w-full bg-primary-700 hover:bg-primary-800 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Open Shift
          </button>
        </Modal>
      )}
      {modal === 'stockCheck' && <LookupModal mode="stock" onClose={() => setModal(null)} />}
      {modal === 'costCheck' && (
        session?.user?.role === 'OWNER' || session?.user?.role === 'MANAGER' ? (
          <LookupModal mode="cost" onClose={() => setModal(null)} />
        ) : (
          <Modal title="Cost Price Check (F11)" onClose={() => setModal(null)} width="max-w-xs">
            <p className="text-sm text-gray-500">Only an Owner or Manager can view cost prices. Ask a manager to check for you.</p>
          </Modal>
        )
      )}
      {modal === 'productPrices' && <LookupModal mode="prices" onClose={() => setModal(null)} />}
      {modal === 'billReprint' && (
        <BillReprintModal onSelect={(inv) => { setReceipt(inv); setModal(null); }} onClose={() => setModal(null)} />
      )}
      {modal === 'billNote' && (
        <Modal title="Bill Note" onClose={() => setModal(null)} width="max-w-sm">
          <textarea
            autoFocus
            value={billNote}
            onChange={(e) => setBillNote(e.target.value)}
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Note to keep with this bill…"
          />
          <button onClick={() => setModal(null)} className="w-full mt-3 bg-primary-700 hover:bg-primary-800 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            Save
          </button>
        </Modal>
      )}

      {receipt && <Receipt data={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
