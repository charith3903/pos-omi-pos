'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Clock, DollarSign, Play, Square, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';

export default function ShiftPage() {
  const [current, setCurrent] = useState<any | null>(null);
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [openForm, setOpenForm] = useState({ openingCash: '', notes: '' });
  const [closeForm, setCloseForm] = useState({ closingCash: '', notes: '' });
  const [acting, setActing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cur, list] = await Promise.all([
        api.getCurrentShift().catch(() => null),
        api.getShifts(),
      ]);
      setCurrent(cur);
      setShifts(list as any[]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleOpen(e: React.FormEvent) {
    e.preventDefault();
    setActing(true);
    try {
      await api.openShift({ openingCash: Number(openForm.openingCash || 0), notes: openForm.notes || undefined });
      setOpenModal(false);
      setOpenForm({ openingCash: '', notes: '' });
      fetchData();
    } finally { setActing(false); }
  }

  async function handleClose(e: React.FormEvent) {
    e.preventDefault();
    if (!current) return;
    setActing(true);
    try {
      await api.closeShift(current.id, { closingCash: Number(closeForm.closingCash || 0), notes: closeForm.notes || undefined });
      setCloseModal(false);
      setCloseForm({ closingCash: '', notes: '' });
      fetchData();
    } finally { setActing(false); }
  }

  function duration(start: string, end?: string) {
    const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shift Management</h1>
          <p className="text-sm text-gray-500 mt-1">Open and close shifts, track cash</p>
        </div>
        {!loading && (
          !current ? (
            <button onClick={() => setOpenModal(true)}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
              <Play className="w-4 h-4" /> Open Shift
            </button>
          ) : (
            <button onClick={() => setCloseModal(true)}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
              <Square className="w-4 h-4" /> Close Shift
            </button>
          )
        )}
      </div>

      {/* Current Shift Banner */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        </div>
      ) : current ? (
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-emerald-700 text-lg">Shift In Progress</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Opened At', value: new Date(current.openedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) },
              { label: 'Duration', value: duration(current.openedAt) },
              { label: 'Opening Cash', value: `Rs ${Number(current.openingCash ?? 0).toLocaleString()}` },
              { label: 'Opened By', value: current.openedByName ?? current.openedBy ?? '—' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl p-3">
                <div className="text-xs text-gray-500">{s.label}</div>
                <div className="text-base font-bold text-gray-900 mt-0.5">{s.value}</div>
              </div>
            ))}
          </div>
          {current.notes && <div className="mt-3 text-sm text-emerald-700 bg-emerald-100 rounded-xl px-3 py-2">📝 {current.notes}</div>}
        </div>
      ) : (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 flex items-center gap-4">
          <AlertCircle className="w-8 h-8 text-red-400 flex-shrink-0" />
          <div>
            <div className="font-bold text-red-700">No Shift Open</div>
            <div className="text-sm text-red-500 mt-0.5">Open a shift before taking orders to track sales accurately.</div>
          </div>
          <button onClick={() => setOpenModal(true)}
            className="ml-auto flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0">
            <Play className="w-4 h-4" /> Open Now
          </button>
        </div>
      )}

      {/* Shift History */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Shift History</h2>
        </div>
        {shifts.filter(s => s.status === 'CLOSED').length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No closed shifts yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Opened At', 'Closed At', 'Duration', 'Opening Cash', 'Closing Cash', 'Opened By'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {shifts.filter(s => s.status === 'CLOSED').map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{new Date(s.openedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-4 py-3 text-gray-700">{s.closedAt ? new Date(s.closedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{s.closedAt ? duration(s.openedAt, s.closedAt) : '—'}</td>
                  <td className="px-4 py-3 font-medium">Rs {Number(s.openingCash ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium">Rs {Number(s.closingCash ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-500">{s.openedByName ?? s.openedBy ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Open Shift Modal */}
      {openModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-900">Open Shift</h2>
              <button onClick={() => setOpenModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleOpen} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Opening Cash (Rs)</label>
                <input type="number" min={0} value={openForm.openingCash} onChange={e => setOpenForm(f => ({ ...f, openingCash: e.target.value }))}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (optional)</label>
                <input value={openForm.notes} onChange={e => setOpenForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Special instructions…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setOpenModal(false)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-semibold text-gray-700">Cancel</button>
                <button type="submit" disabled={acting}
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                  {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Open Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {closeModal && current && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-900">Close Shift</h2>
              <button onClick={() => setCloseModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 mb-4 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Opened at</span><span className="font-medium">{new Date(current.openedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Duration</span><span className="font-medium">{duration(current.openedAt)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Opening cash</span><span className="font-medium">Rs {Number(current.openingCash ?? 0).toLocaleString()}</span></div>
            </div>
            <form onSubmit={handleClose} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Closing Cash (Rs)</label>
                <input required type="number" min={0} value={closeForm.closingCash} onChange={e => setCloseForm(f => ({ ...f, closingCash: e.target.value }))}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                <input value={closeForm.notes} onChange={e => setCloseForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="End of day notes…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setCloseModal(false)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-semibold text-gray-700">Cancel</button>
                <button type="submit" disabled={acting}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                  {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />} Close Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
