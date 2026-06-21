'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { FileText, Search, ChevronLeft, ChevronRight, Loader2, X, Package } from 'lucide-react';

export default function InvoicesPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: any[]; total: number; limit: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getInvoices(page);
      setData(res as any);
    } catch { setData(null); } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  async function viewInvoice(id: string) {
    setDetailLoading(true);
    try {
      const inv = await api.getInvoiceById(id);
      setSelected(inv);
    } catch { /* ignore */ } finally { setDetailLoading(false); }
  }

  const totalPages = data ? Math.ceil(data.total / (data.limit || 20)) : 1;

  const STATUS_COLOR: Record<string, string> = {
    PAID: 'bg-green-100 text-green-700',
    PENDING: 'bg-amber-100 text-amber-700',
    REFUNDED: 'bg-red-100 text-red-700',
    PARTIAL_REFUND: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Invoice History</h1>
        <p className="text-sm text-gray-500 mt-1">View and search past transactions</p>
      </div>

      {/* Summary */}
      {data && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-2 text-sm text-gray-600">
          <FileText className="w-4 h-4 text-blue-500" />
          <span><strong className="text-gray-900">{data.total.toLocaleString()}</strong> invoices total</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…</div>
        ) : !data?.items.length ? (
          <div className="text-center py-16 text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No invoices yet</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Invoice #', 'Date', 'Customer', 'Outlet', 'Total', 'Status', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.items.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-blue-700 text-xs">{inv.number}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {new Date(inv.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{inv.customer?.name ?? <span className="text-gray-300">Walk-in</span>}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{inv.outlet?.name ?? '—'}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">Rs {Number(inv.total).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[inv.status] ?? 'bg-gray-100 text-gray-600'}`}>{inv.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => viewInvoice(inv.id)} className="text-xs text-blue-600 hover:underline font-medium">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-white transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-white transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Invoice Detail Modal */}
      {(selected || detailLoading) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">{selected ? selected.number : 'Loading…'}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            {detailLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…</div>
            ) : selected && (
              <div className="overflow-y-auto p-5 space-y-5">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><div className="text-xs text-gray-500">Date</div><div className="font-medium">{new Date(selected.createdAt).toLocaleString('en-GB')}</div></div>
                  <div><div className="text-xs text-gray-500">Status</div><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[selected.status] ?? 'bg-gray-100 text-gray-600'}`}>{selected.status}</span></div>
                  {selected.customer && <div><div className="text-xs text-gray-500">Customer</div><div className="font-medium">{selected.customer.name}</div><div className="text-xs text-gray-500">{selected.customer.phone}</div></div>}
                  <div><div className="text-xs text-gray-500">Outlet</div><div className="font-medium">{selected.outlet?.name ?? '—'}</div></div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Items</div>
                  <div className="space-y-2">
                    {selected.items?.map((item: any) => (
                      <div key={item.id} className="flex justify-between items-center text-sm py-2 border-b border-gray-50">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-gray-300" />
                          <div>
                            <div className="font-medium text-gray-900">{item.nameSnapshot}</div>
                            <div className="text-xs text-gray-500">× {Number(item.qty)} @ Rs {Number(item.unitPrice).toLocaleString()}</div>
                          </div>
                        </div>
                        <div className="font-semibold text-gray-900">Rs {Number(item.lineTotal).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>Rs {Number(selected.subtotal).toLocaleString()}</span></div>
                  {Number(selected.discount) > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>- Rs {Number(selected.discount).toLocaleString()}</span></div>}
                  {Number(selected.tax) > 0 && <div className="flex justify-between text-gray-600"><span>Tax</span><span>Rs {Number(selected.tax).toLocaleString()}</span></div>}
                  <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-200"><span>Total</span><span>Rs {Number(selected.total).toLocaleString()}</span></div>
                </div>

                {selected.payments?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Payments</div>
                    {selected.payments.map((p: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm py-1">
                        <span className="text-gray-600 capitalize">{p.method?.toLowerCase()}</span>
                        <span className="font-medium">Rs {Number(p.amount).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
