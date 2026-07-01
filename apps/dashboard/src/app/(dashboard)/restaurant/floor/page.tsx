'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, RefreshCw, Users, Clock, X, Loader2, AlertCircle } from 'lucide-react';

const STATUS_META = {
  AVAILABLE: { label: 'Available', bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-800', dot: 'bg-green-500' },
  OCCUPIED:  { label: 'Occupied',  bg: 'bg-blue-100',  border: 'border-blue-300',  text: 'text-blue-800',  dot: 'bg-blue-500'  },
  RESERVED:  { label: 'Reserved',  bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-800', dot: 'bg-amber-500' },
  CLEANING:  { label: 'Cleaning',  bg: 'bg-gray-100',  border: 'border-gray-300',  text: 'text-gray-600',  dot: 'bg-gray-400'  },
};

export default function FloorPlanPage() {
  const router = useRouter();
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [selectedArea, setSelectedArea] = useState('ALL');
  const [actionTable, setActionTable] = useState<any | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', area: '', capacity: '4' });
  const [adding, setAdding] = useState(false);

  const fetchTables = useCallback(async () => {
    setLoading(true);
    try { setTables(await api.getTables()); } catch { setTables([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTables(); }, [fetchTables]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(fetchTables, 30000);
    return () => clearInterval(id);
  }, [fetchTables]);

  const areas = ['ALL', ...Array.from(new Set(tables.map(t => t.area || 'Main').filter(Boolean)))];
  const statuses = ['ALL', 'AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING'];

  const displayed = tables.filter(t => {
    const areaMatch = selectedArea === 'ALL' || (t.area || 'Main') === selectedArea;
    const statusMatch = filter === 'ALL' || t.status === filter;
    return areaMatch && statusMatch;
  });

  async function openNewOrder(table: any) {
    setUpdating(table.id);
    try {
      const order = await api.createOrder({ tableId: table.id, orderType: 'DINE_IN', guestCount: 1 });
      router.push(`/billing?orderId=${order.id}&tableId=${table.id}`);
    } catch { setUpdating(null); }
  }

  async function viewOrder(table: any) {
    const activeOrder = table.orders?.[0];
    if (activeOrder) {
      router.push(`/billing?orderId=${activeOrder.id}&tableId=${table.id}`);
    }
  }

  async function updateStatus(tableId: string, status: string) {
    setUpdating(tableId);
    try {
      await api.updateTableStatus(tableId, status);
      setActionTable(null);
      fetchTables();
    } finally { setUpdating(null); }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      await api.createTable({ name: addForm.name, area: addForm.area || undefined, capacity: parseInt(addForm.capacity) });
      setAddModal(false);
      setAddForm({ name: '', area: '', capacity: '4' });
      fetchTables();
    } finally { setAdding(false); }
  }

  const stats = { total: tables.length, occupied: tables.filter(t => t.status === 'OCCUPIED').length, available: tables.filter(t => t.status === 'AVAILABLE').length };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Floor Plan</h1>
          <p className="text-sm text-gray-500 mt-0.5">{stats.occupied}/{stats.total} tables occupied</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchTables} className="p-2 text-gray-400 hover:text-blue-600"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setAddModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold">
            <Plus className="w-4 h-4" /> Add Table
          </button>
        </div>
      </div>

      {/* Status legend + filter */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3">
        <div className="flex gap-1">
          {statuses.map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filter === s ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s === 'ALL' ? `All (${tables.length})` : `${STATUS_META[s as keyof typeof STATUS_META]?.label} (${tables.filter(t => t.status === s).length})`}
            </button>
          ))}
        </div>
        <div className="flex gap-1 border-l pl-3">
          {areas.map(a => (
            <button key={a} onClick={() => setSelectedArea(a)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${selectedArea === a ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Table Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading floor plan…
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No tables found. <button className="text-blue-600 underline" onClick={() => setAddModal(true)}>Add your first table</button></p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {displayed.map(table => {
            const meta = STATUS_META[table.status as keyof typeof STATUS_META] ?? STATUS_META.AVAILABLE;
            const activeOrder = table.orders?.[0];
            const minutesOpen = activeOrder ? Math.round((Date.now() - new Date(activeOrder.openedAt).getTime()) / 60000) : 0;
            return (
              <button
                key={table.id}
                onClick={() => setActionTable(table)}
                disabled={updating === table.id}
                className={`relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 aspect-square transition-all hover:scale-105 hover:shadow-lg ${meta.bg} ${meta.border} ${updating === table.id ? 'opacity-50' : ''}`}
              >
                {updating === table.id && <Loader2 className="absolute top-2 right-2 w-4 h-4 animate-spin text-gray-500" />}
                <div className={`w-2.5 h-2.5 rounded-full mb-2 ${meta.dot}`} />
                <div className={`font-bold text-base ${meta.text}`}>{table.name}</div>
                {table.area && <div className="text-xs opacity-60 mt-0.5">{table.area}</div>}
                <div className="flex items-center gap-1 mt-2 text-xs opacity-70">
                  <Users className="w-3 h-3" />
                  <span>{table.capacity}</span>
                </div>
                {activeOrder && (
                  <div className="mt-1.5 flex items-center gap-1 text-xs text-blue-700 font-medium">
                    <Clock className="w-3 h-3" />
                    <span>{minutesOpen}m</span>
                  </div>
                )}
                {activeOrder && (
                  <div className="absolute bottom-2 text-xs font-mono text-blue-600">{activeOrder.orderNumber}</div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Table Action Modal */}
      {actionTable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <div className="font-bold text-gray-900 text-lg">{actionTable.name}</div>
                <div className="text-xs text-gray-500">{actionTable.area} · {actionTable.capacity} seats</div>
              </div>
              <button onClick={() => setActionTable(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              {/* Status badge */}
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${STATUS_META[actionTable.status as keyof typeof STATUS_META]?.bg} ${STATUS_META[actionTable.status as keyof typeof STATUS_META]?.text}`}>
                <span className={`w-2 h-2 rounded-full ${STATUS_META[actionTable.status as keyof typeof STATUS_META]?.dot}`} />
                {STATUS_META[actionTable.status as keyof typeof STATUS_META]?.label}
              </div>

              {/* Actions */}
              {actionTable.status === 'AVAILABLE' && (
                <button onClick={() => openNewOrder(actionTable)}
                  className="w-full bg-green-600 hover:bg-green-500 text-white py-2.5 rounded-xl text-sm font-semibold">
                  Open New Order
                </button>
              )}
              {actionTable.status === 'OCCUPIED' && actionTable.orders?.[0] && (
                <button onClick={() => viewOrder(actionTable)}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-sm font-semibold">
                  View / Add to Order ({actionTable.orders[0].orderNumber})
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                {['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING'].filter(s => s !== actionTable.status).map(s => (
                  <button key={s} onClick={() => updateStatus(actionTable.id, s)}
                    className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${STATUS_META[s as keyof typeof STATUS_META]?.bg} ${STATUS_META[s as keyof typeof STATUS_META]?.text} ${STATUS_META[s as keyof typeof STATUS_META]?.border}`}>
                    → {STATUS_META[s as keyof typeof STATUS_META]?.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Table Modal */}
      {addModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Add Table</h2>
              <button onClick={() => setAddModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAdd} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Table Name / Number *</label>
                <input required value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})}
                  placeholder="Table 1, T-01, Bar 3…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Area / Section</label>
                  <input value={addForm.area} onChange={e => setAddForm({...addForm, area: e.target.value})}
                    placeholder="Indoor, Outdoor…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Seats</label>
                  <input type="number" min={1} max={20} value={addForm.capacity} onChange={e => setAddForm({...addForm, capacity: e.target.value})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setAddModal(false)} className="px-4 py-2 text-sm text-gray-600 font-medium">Cancel</button>
                <button type="submit" disabled={adding}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-semibold">
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
