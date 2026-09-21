'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// ─── Shared modal shell ────────────────────────────────────────────────────

export function Modal({
  title,
  onClose,
  children,
  width = 'max-w-lg',
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // A cashier operating the till has no mouse, so a modal must be fully
  // self-contained from the keyboard: Escape to leave, and Tab must stay
  // inside the dialog instead of wandering back into the till underneath it
  // (with no trap, Tab from a freshly-opened dialog resumes wherever page
  // focus last was, which could be dozens of elements away from anything in
  // the dialog at all).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Move focus into the dialog the moment it opens — otherwise focus is
  // still wherever it was on the till underneath, and the trap above has
  // nothing to cycle from. Whatever opened this modal (e.g. Enter on a
  // search result) still has a native keyup in flight, and if that keyup
  // lands on a newly-focused <button>, the browser synthesizes a click on
  // it and the modal closes/acts on itself instantly. Text fields don't
  // have that problem (a stray Enter keyup on an <input> does nothing), so
  // only those get focused directly — a content area that opens on a list
  // of buttons (e.g. the variant picker) instead parks focus on the inert
  // dialog container, leaving Tab to reach the first real button on purpose.
  useEffect(() => {
    const first = contentRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    if (first && ['INPUT', 'TEXTAREA', 'SELECT'].includes(first.tagName)) {
      first.focus();
    } else {
      dialogRef.current?.focus();
    }
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className={`bg-white rounded-2xl shadow-2xl w-full ${width} max-h-[85vh] overflow-auto outline-none`}>
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
          <span className="font-semibold text-gray-900">{title}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div ref={contentRef} className="p-6">{children}</div>
      </div>
    </div>
  );
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';
const btnPrimary = 'bg-primary-700 hover:bg-primary-800 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold';

// ─── Change Rate / Change Qty (edit selected line) ─────────────────────────

export function EditLineModal({
  mode,
  currentValue,
  onSave,
  onClose,
}: {
  mode: 'rate' | 'qty';
  currentValue: number;
  onSave: (value: number) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(String(currentValue));
  return (
    <Modal title={mode === 'rate' ? 'Change Rate (F1)' : 'Change Qty (F2)'} onClose={onClose} width="max-w-xs">
      <input
        type="number"
        autoFocus
        min="0"
        step={mode === 'rate' ? '0.01' : '1'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSave(Number(value) || 0); }}
        className={inputCls}
      />
      <button
        onClick={() => onSave(Number(value) || 0)}
        className={`${btnPrimary} w-full mt-4`}
      >
        Apply
      </button>
    </Modal>
  );
}

// ─── Item discount (per-line) ───────────────────────────────────────────────

export function ItemDiscountModal({
  currentDiscount,
  lineTotal,
  onSave,
  onClose,
}: {
  currentDiscount: number;
  lineTotal: number;
  onSave: (discount: number) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(String(currentDiscount || ''));
  return (
    <Modal title="Item Discount (F3)" onClose={onClose} width="max-w-xs">
      <p className="text-xs text-gray-500 mb-2">Line total before discount: LKR {lineTotal.toFixed(2)}</p>
      <input
        type="number"
        autoFocus
        min="0"
        max={lineTotal}
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSave(Math.min(lineTotal, Number(value) || 0)); }}
        className={inputCls}
        placeholder="0.00"
      />
      <button onClick={() => onSave(Math.min(lineTotal, Number(value) || 0))} className={`${btnPrimary} w-full mt-4`}>
        Apply
      </button>
    </Modal>
  );
}

// ─── Misc / non-catalog item (Product, F9) ─────────────────────────────────

export function MiscItemModal({
  onAdd,
  onClose,
}: {
  onAdd: (name: string, price: number) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  return (
    <Modal title="Add Misc. Item (F9)" onClose={onClose} width="max-w-sm">
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Item name</label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Custom repair charge" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Price</label>
          <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} />
        </div>
        <button
          disabled={!name.trim() || !price}
          onClick={() => onAdd(name.trim(), Number(price))}
          className={`${btnPrimary} w-full`}
        >
          Add to cart
        </button>
      </div>
    </Modal>
  );
}

// ─── Hold / Load transactions ───────────────────────────────────────────────

export function LoadTransModal({
  onLoad,
  onClose,
}: {
  onLoad: (heldSale: any) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getHeldSales().then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function remove(id: string) {
    await api.deleteHeldSale(id).catch(() => {});
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <Modal title="Load Transaction" onClose={onClose} width="max-w-md">
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400">No held transactions.</p>
      ) : (
        <div className="space-y-2">
          {items.map((h) => (
            <div key={h.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2">
              <div>
                <div className="text-sm font-medium text-gray-900">{h.note || `Held ${new Date(h.createdAt).toLocaleTimeString()}`}</div>
                <div className="text-xs text-gray-400">{h.customer?.name ?? 'No customer'} · {new Date(h.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onLoad(h)} className="text-primary-700 text-xs font-semibold hover:underline">Load</button>
                <button onClick={() => remove(h.id)} className="text-red-500 text-xs hover:underline">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ─── Quotations ──────────────────────────────────────────────────────────────

export function QuotationModal({
  onLoad,
  onCreateFromCart,
  onClose,
}: {
  onLoad: (quotation: any) => void;
  onCreateFromCart: () => Promise<void>;
  onClose: () => void;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    api.getQuotations().then(setItems).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleCreate() {
    setCreating(true);
    try {
      await onCreateFromCart();
      load();
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal title="Quotations" onClose={onClose} width="max-w-lg">
      <button onClick={handleCreate} disabled={creating} className={`${btnPrimary} w-full mb-4`}>
        {creating ? 'Saving…' : 'Save current cart as a new quotation'}
      </button>
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400">No quotations yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((q) => (
            <div key={q.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2">
              <div>
                <div className="text-sm font-medium text-gray-900">{q.number} — LKR {Number(q.total).toFixed(2)}</div>
                <div className="text-xs text-gray-400">
                  {q.customer?.name ?? 'No customer'} · {q.status}
                  {q.validUntil ? ` · valid until ${new Date(q.validUntil).toLocaleDateString()}` : ''}
                </div>
              </div>
              {q.status !== 'CONVERTED' && (
                <button onClick={() => onLoad(q)} className="text-primary-700 text-xs font-semibold hover:underline">Load into cart</button>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ─── Sales Return ────────────────────────────────────────────────────────────

export function SalesReturnModal({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [number, setNumber] = useState('');
  const [invoice, setInvoice] = useState<any>(null);
  const [qtyToRefund, setQtyToRefund] = useState<Record<string, number>>({});
  const [restock, setRestock] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function search() {
    setError('');
    setInvoice(null);
    try {
      const inv = await api.getInvoiceByNumber(number.trim());
      setInvoice(inv);
      setQtyToRefund({});
    } catch {
      setError('Invoice not found');
    }
  }

  async function submit() {
    const items = Object.entries(qtyToRefund)
      .filter(([, qty]) => qty > 0)
      .map(([invoiceItemId, qtyToRefund]) => ({ invoiceItemId, qtyToRefund }));
    if (items.length === 0) return;
    setSubmitting(true);
    setError('');
    try {
      await api.processRefund({ invoiceId: invoice.id, items, restock });
      onDone();
    } catch (err: any) {
      setError(err.message ?? 'Failed to process return');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Sales Return" onClose={onClose} width="max-w-lg">
      <div className="flex gap-2 mb-4">
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
          placeholder="Invoice number (e.g. INV-2026-000001)"
          className={inputCls}
          autoFocus
        />
        <button onClick={search} className={btnPrimary}>Find</button>
      </div>
      {error && <p className="text-red-600 text-xs mb-2">{error}</p>}
      {invoice && (
        <div className="space-y-3">
          {invoice.items.map((it: any) => {
            const remaining = Number(it.qty) - Number(it.refundedQty ?? 0);
            return (
              <div key={it.id} className="flex items-center justify-between border-b border-gray-100 pb-2">
                <div>
                  <div className="text-sm text-gray-900">{it.nameSnapshot}</div>
                  <div className="text-xs text-gray-400">{remaining} of {Number(it.qty)} returnable</div>
                </div>
                <input
                  type="number"
                  min={0}
                  max={remaining}
                  disabled={remaining <= 0}
                  value={qtyToRefund[it.id] ?? ''}
                  onChange={(e) =>
                    setQtyToRefund((prev) => ({ ...prev, [it.id]: Math.min(remaining, Number(e.target.value) || 0) }))
                  }
                  className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm text-right"
                  placeholder="0"
                />
              </div>
            );
          })}
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
            Return items to stock
          </label>
          <button onClick={submit} disabled={submitting} className={`${btnPrimary} w-full`}>
            {submitting ? 'Processing…' : 'Process Return'}
          </button>
        </div>
      )}
    </Modal>
  );
}

// ─── Credit customer ─────────────────────────────────────────────────────────

export function CreditCustomerModal({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [limitInput, setLimitInput] = useState('');
  const [paymentInput, setPaymentInput] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      api.getCustomers(search || undefined).then(setCustomers).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  function select(c: any) {
    setSelected(c);
    setLimitInput(c.creditLimit != null ? String(c.creditLimit) : '');
    setPaymentInput('');
    setMessage('');
  }

  async function saveLimit() {
    if (!selected) return;
    const updated = await api.setCustomerCreditLimit(selected.id, limitInput ? Number(limitInput) : null);
    setSelected(updated);
    setMessage('Credit limit updated.');
  }

  async function recordPayment() {
    if (!selected || !paymentInput) return;
    const updated = await api.recordCreditPayment(selected.id, Number(paymentInput));
    setSelected(updated);
    setPaymentInput('');
    setMessage('Payment recorded.');
  }

  return (
    <Modal title="Credit Customer" onClose={onClose} width="max-w-lg">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search customer…"
        className={`${inputCls} mb-3`}
        autoFocus
      />
      {!selected ? (
        <div className="max-h-64 overflow-auto divide-y divide-gray-100 border border-gray-200 rounded-lg">
          {customers.map((c) => (
            <button key={c.id} onClick={() => select(c)} className="w-full text-left px-3 py-2 hover:bg-primary-50 text-sm">
              <div className="font-medium text-gray-900">{c.name}</div>
              <div className="text-xs text-gray-400">
                {c.phone ?? ''} · balance LKR {Number(c.creditBalance).toFixed(2)} / limit {c.creditLimit != null ? `LKR ${Number(c.creditLimit).toFixed(2)}` : 'none'}
              </div>
            </button>
          ))}
          {customers.length === 0 && <p className="px-3 py-4 text-sm text-gray-400">No customers found.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <button onClick={() => setSelected(null)} className="text-xs text-primary-700 hover:underline">&larr; Back to search</button>
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="font-semibold text-gray-900">{selected.name}</div>
            <div className="text-sm text-gray-600 mt-1">Outstanding balance: LKR {Number(selected.creditBalance).toFixed(2)}</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Credit limit (blank = not approved for credit)</label>
            <div className="flex gap-2">
              <input type="number" min="0" value={limitInput} onChange={(e) => setLimitInput(e.target.value)} className={inputCls} />
              <button onClick={saveLimit} className={btnPrimary}>Save</button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Record a payment against balance</label>
            <div className="flex gap-2">
              <input type="number" min="0" value={paymentInput} onChange={(e) => setPaymentInput(e.target.value)} className={inputCls} />
              <button onClick={recordPayment} disabled={!paymentInput} className={btnPrimary}>Record</button>
            </div>
          </div>
          {message && <p className="text-green-600 text-xs">{message}</p>}
        </div>
      )}
    </Modal>
  );
}

// ─── Salesman picker ─────────────────────────────────────────────────────────

export function SalesmanPickerModal({
  onPick,
  onClose,
}: {
  onPick: (user: { id: string; name: string } | null) => void;
  onClose: () => void;
}) {
  const [users, setUsers] = useState<{ id: string; name: string; role: string }[]>([]);

  useEffect(() => {
    api.getUsers().then(setUsers).catch(() => {});
  }, []);

  return (
    <Modal title="Salesman" onClose={onClose} width="max-w-sm">
      <div className="space-y-1">
        <button onClick={() => onPick(null)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm text-gray-500">
          No salesman
        </button>
        {users.map((u) => (
          <button key={u.id} onClick={() => onPick(u)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-primary-50 text-sm">
            <span className="font-medium text-gray-900">{u.name}</span>
            <span className="text-xs text-gray-400 ml-2">{u.role}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

// ─── Cash movement (paid in/out, drawer open) ──────────────────────────────

export function CashMovementModal({
  type,
  onSave,
  onClose,
}: {
  type: 'PAID_IN' | 'PAID_OUT';
  onSave: (amount: number, reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!amount) return;
    setSaving(true);
    try {
      await onSave(Number(amount), reason);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={type === 'PAID_IN' ? 'Paid In' : 'Expense / Paid Out'} onClose={onClose} width="max-w-xs">
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Amount</label>
          <input autoFocus type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Reason</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} placeholder="e.g. Petty cash for supplies" />
        </div>
        <button onClick={submit} disabled={!amount || saving} className={`${btnPrimary} w-full`}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  );
}

// ─── Close Shift (with expected-vs-actual variance) ────────────────────────

export function CloseShiftModal({
  shiftId,
  onClosed,
  onClose,
}: {
  shiftId: string;
  onClosed: () => void;
  onClose: () => void;
}) {
  const [closingCash, setClosingCash] = useState('');
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await api.closeShift(shiftId, { closingCash: Number(closingCash) || 0, notes });
      setResult(res);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Close Shift" onClose={() => { onClose(); if (result) onClosed(); }} width="max-w-sm">
      {!result ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Counted cash in drawer</label>
            <input autoFocus type="number" min="0" step="0.01" value={closingCash} onChange={(e) => setClosingCash(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} rows={2} />
          </div>
          <button onClick={submit} disabled={!closingCash || submitting} className={`${btnPrimary} w-full`}>
            {submitting ? 'Closing…' : 'Close Shift'}
          </button>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Expected cash</span><span className="font-semibold">LKR {Number(result.expectedCash).toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Counted cash</span><span className="font-semibold">LKR {Number(result.closingCash).toFixed(2)}</span></div>
          <div className={`flex justify-between font-bold ${Math.abs(result.variance) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
            <span>Variance</span><span>LKR {Number(result.variance).toFixed(2)}</span>
          </div>
          <button onClick={() => { onClose(); onClosed(); }} className={`${btnPrimary} w-full mt-3`}>Done</button>
        </div>
      )}
    </Modal>
  );
}

// ─── Lock Screen ─────────────────────────────────────────────────────────────

export function LockScreenOverlay({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  async function unlock() {
    setChecking(true);
    setError('');
    try {
      const session = JSON.parse(localStorage.getItem('omnipos_session') ?? '{}');
      await api.login({ subdomain: session.tenant.subdomain, email: session.user.email, password });
      onUnlock();
    } catch {
      setError('Incorrect password');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center">
        <div className="text-4xl mb-3">🔒</div>
        <h2 className="font-bold text-gray-900 mb-4">Screen Locked</h2>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') unlock(); }}
          placeholder="Enter your password"
          className={`${inputCls} text-center`}
        />
        {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
        <button onClick={unlock} disabled={!password || checking} className={`${btnPrimary} w-full mt-4`}>
          {checking ? 'Checking…' : 'Unlock'}
        </button>
      </div>
    </div>
  );
}

// ─── Lookup: Stock Check / Cost Price / Product Prices ─────────────────────

export function LookupModal({
  mode,
  onClose,
}: {
  mode: 'stock' | 'cost' | 'prices';
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (mode === 'stock') api.getStock().then(setStockMap).catch(() => {});
  }, [mode]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!query.trim()) { setResults([]); return; }
      api.getProducts({ search: query, limit: 15 }).then((r) => setResults(r.items)).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const title = mode === 'stock' ? 'Stock Check' : mode === 'cost' ? 'Cost Price Check (F11)' : 'Product Prices';

  return (
    <Modal title={title} onClose={onClose} width="max-w-lg">
      <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search product…" className={`${inputCls} mb-3`} />
      <div className="divide-y divide-gray-100 max-h-80 overflow-auto">
        {results.map((p) => (
          <div key={p.id} className="flex items-center justify-between py-2 text-sm">
            <div>
              <div className="font-medium text-gray-900">{p.name}</div>
              <div className="text-xs text-gray-400">{p.sku ?? p.barcode ?? ''}</div>
            </div>
            {mode === 'stock' && <span className="font-semibold">{stockMap[p.id] ?? 0} in stock</span>}
            {mode === 'cost' && <span className="font-semibold">{p.cost != null ? `LKR ${Number(p.cost).toFixed(2)}` : '—'}</span>}
            {mode === 'prices' && (
              <span className="text-right">
                <div className="font-semibold">Retail LKR {Number(p.price).toFixed(2)}</div>
                {p.wholesalePrice != null && <div className="text-xs text-gray-500">Wholesale LKR {Number(p.wholesalePrice).toFixed(2)}</div>}
              </span>
            )}
          </div>
        ))}
        {query && results.length === 0 && <p className="py-4 text-sm text-gray-400">No matches.</p>}
      </div>
    </Modal>
  );
}

// ─── Bill Reprint ────────────────────────────────────────────────────────────

export function BillReprintModal({
  onSelect,
  onClose,
}: {
  onSelect: (invoice: any) => void;
  onClose: () => void;
}) {
  const [number, setNumber] = useState('');
  const [recent, setRecent] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getInvoices(1).then((r) => setRecent(r.items)).catch(() => {});
  }, []);

  async function find() {
    setError('');
    try {
      const inv = await api.getInvoiceByNumber(number.trim());
      onSelect(inv);
    } catch {
      setError('Invoice not found');
    }
  }

  return (
    <Modal title="Bill Reprint" onClose={onClose} width="max-w-md">
      <div className="flex gap-2 mb-4">
        <input
          autoFocus
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') find(); }}
          placeholder="Invoice number"
          className={inputCls}
        />
        <button onClick={find} className={btnPrimary}>Find</button>
      </div>
      {error && <p className="text-red-600 text-xs mb-2">{error}</p>}
      <p className="text-xs text-gray-400 mb-2">Recent invoices</p>
      <div className="divide-y divide-gray-100 max-h-64 overflow-auto">
        {recent.map((inv) => (
          <button key={inv.id} onClick={() => onSelect(inv)} className="w-full text-left py-2 text-sm hover:bg-primary-50 px-2 rounded">
            <span className="font-medium text-gray-900">{inv.number}</span>
            <span className="text-xs text-gray-400 ml-2">LKR {Number(inv.total).toFixed(2)} · {new Date(inv.createdAt).toLocaleString()}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
