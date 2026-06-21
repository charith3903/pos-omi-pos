'use client';

import { useRef } from 'react';
import { getSession } from '@/lib/auth';
import type { VerticalPack } from '@/lib/vertical';

interface ReceiptItem {
  nameSnapshot: string;
  qty: number | string;
  unitPrice: number | string;
  discount: number | string;
  tax: number | string;
  lineTotal: number | string;
}

interface ReceiptData {
  number: string;
  createdAt: string;
  customer?: { name: string } | null;
  outlet?: { name: string } | null;
  items: ReceiptItem[];
  subtotal: number | string;
  discount: number | string;
  tax: number | string;
  total: number | string;
  payments: { method: string; amount: number | string }[];
}

function fmt(n: number | string) {
  return `LKR ${Number(n).toFixed(2)}`;
}

export function Receipt({
  data,
  pack,
  onClose,
}: {
  data: ReceiptData;
  pack?: VerticalPack;
  onClose: () => void;
}) {
  const session = getSession();
  const ref = useRef<HTMLDivElement>(null);

  function print() {
    const content = ref.current?.innerHTML ?? '';
    const w = window.open('', '_blank', 'width=400,height=700');
    if (!w) return;
    w.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt ${data.number}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0 auto; padding: 8px; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .row { display: flex; justify-content: space-between; margin: 2px 0; }
            .total { font-size: 14px; font-weight: bold; }
            h1 { font-size: 18px; }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 250);
  }

  const paid = data.payments.reduce((s, p) => s + Number(p.amount), 0);
  const change = paid - Number(data.total);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full max-h-[90vh] overflow-auto">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <span className="font-semibold text-gray-900">Receipt #{data.number}</span>
          <div className="flex gap-2">
            <button
              onClick={print}
              className="bg-primary-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-800"
            >
              🖨 Print
            </button>
            <button
              onClick={onClose}
              className="border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>

        {/* Receipt body — also used for print */}
        <div ref={ref} className="p-6 font-mono text-xs">
          <div className="center bold text-base mb-1">{session?.tenant?.name ?? 'OmniPOS'}</div>
          {data.outlet && <div className="center text-gray-600 mb-1">{data.outlet.name}</div>}
          {/* Pack-specific receipt title (e.g. "PARTS RECEIPT" for spare parts) */}
          {pack && pack.receiptTemplate !== 'standard' && (
            <div className="center bold mb-1" style={{ letterSpacing: '0.1em' }}>
              {pack.labels.receiptTitle}
            </div>
          )}
          <div className="center text-gray-500 mb-3">
            {new Date(data.createdAt).toLocaleString('en-LK', {
              dateStyle: 'short', timeStyle: 'short',
            })}
          </div>

          <div className="divider" />
          <div className="row bold mb-1">
            <span>{pack?.receiptTemplate === 'spare_parts' ? 'Parts Invoice' : 'Invoice'}</span>
            <span>{data.number}</span>
          </div>
          {data.customer && <div className="row"><span>Customer</span><span>{data.customer.name}</span></div>}
          <div className="divider" />

          {/* Items */}
          {data.items.map((item, i) => (
            <div key={i} className="mb-2">
              <div className="bold">{item.nameSnapshot}</div>
              <div className="row text-gray-600">
                <span>{Number(item.qty)} × {fmt(item.unitPrice)}</span>
                <span>{fmt(item.lineTotal)}</span>
              </div>
              {Number(item.discount) > 0 && (
                <div className="row text-green-700"><span>  Discount</span><span>-{fmt(item.discount)}</span></div>
              )}
            </div>
          ))}

          <div className="divider" />
          <div className="row"><span>Subtotal</span><span>{fmt(data.subtotal)}</span></div>
          {Number(data.discount) > 0 && (
            <div className="row text-green-700"><span>Discount</span><span>-{fmt(data.discount)}</span></div>
          )}
          {Number(data.tax) > 0 && (
            <div className="row"><span>Tax</span><span>{fmt(data.tax)}</span></div>
          )}
          <div className="divider" />
          <div className="row total"><span>TOTAL</span><span>{fmt(data.total)}</span></div>
          <div className="divider" />

          {/* Payments */}
          {data.payments.map((p, i) => (
            <div key={i} className="row">
              <span>{p.method}</span>
              <span>{fmt(p.amount)}</span>
            </div>
          ))}
          {change > 0 && (
            <div className="row bold text-primary-800"><span>Change</span><span>{fmt(change)}</span></div>
          )}

          <div className="divider" />
          <div className="center text-gray-500 mt-2">
            {pack?.receiptTemplate === 'spare_parts'
              ? 'Thank you — drive safe!'
              : pack?.receiptTemplate === 'restaurant'
              ? 'Thank you — enjoy your meal!'
              : 'Thank you for shopping!'}
          </div>
          <div className="center text-gray-400 text-xs mt-1">Powered by OmniPOS</div>
        </div>
      </div>
    </div>
  );
}
