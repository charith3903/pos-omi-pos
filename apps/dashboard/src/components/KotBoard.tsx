'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Clock, RefreshCw, CheckCircle2, Loader2, Bell } from 'lucide-react';

const STATUS_ORDER = ['PENDING', 'COOKING', 'READY', 'DELIVERED'];
const STATUS_META: Record<string, { label: string; bg: string; text: string; border: string; next: string | null }> = {
  PENDING:   { label: 'Pending',   bg: 'bg-orange-50',  text: 'text-orange-700', border: 'border-orange-200', next: 'COOKING' },
  COOKING:   { label: 'Cooking',   bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200',  next: 'READY' },
  READY:     { label: 'Ready',     bg: 'bg-green-50',   text: 'text-green-700',  border: 'border-green-200',  next: 'DELIVERED' },
  DELIVERED: { label: 'Delivered', bg: 'bg-gray-50',    text: 'text-gray-500',   border: 'border-gray-200',   next: null },
};

interface Props {
  station: 'KITCHEN' | 'BAR';
  title: string;
  icon: React.ReactNode;
  accentColor: string; // tailwind text-color class for the header icon/alert
  emptyLabel: string;
  alertLabel: string;
}

export function KotBoard({ station, title, icon, accentColor, emptyLabel, alertLabel }: Props) {
  const [kots, setKots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string[]>(['PENDING', 'COOKING', 'READY']);
  const [bumping, setBumping] = useState<string | null>(null);
  const [lastCount, setLastCount] = useState(0);
  const [newAlert, setNewAlert] = useState(false);

  const fetchKots = useCallback(async () => {
    try {
      const data = await api.getKots({ station });
      const active = (data as any[]).filter(k => filter.includes(k.status));
      if (active.length > lastCount && lastCount > 0) setNewAlert(true);
      setLastCount(active.length);
      setKots(data as any[]);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [filter, lastCount, station]);

  useEffect(() => { fetchKots(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const id = setInterval(fetchKots, 15000);
    return () => clearInterval(id);
  }, [fetchKots]);

  async function bump(kotId: string, nextStatus: string) {
    setBumping(kotId);
    try { await api.updateKotStatus(kotId, nextStatus); fetchKots(); } finally { setBumping(null); }
  }

  const displayed = kots.filter(k => filter.includes(k.status))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  function elapsed(ts: string) {
    const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  function elapsedColor(ts: string) {
    const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (m >= 20) return 'text-red-600';
    if (m >= 10) return 'text-amber-600';
    return 'text-green-600';
  }

  return (
    <div className="min-h-full bg-gray-900 text-white p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={accentColor}>{icon}</div>
          <h1 className="text-xl font-bold">{title}</h1>
          {newAlert && (
            <div className="flex items-center gap-1 text-xs bg-red-500 px-2 py-1 rounded-full animate-pulse">
              <Bell className="w-3 h-3" /> {alertLabel}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Filter */}
          <div className="flex gap-1">
            {STATUS_ORDER.slice(0, 3).map(s => (
              <button key={s}
                onClick={() => setFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${filter.includes(s) ? `${STATUS_META[s].bg} ${STATUS_META[s].text}` : 'bg-gray-700 text-gray-400'}`}>
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
          <button onClick={() => { setNewAlert(false); fetchKots(); }} className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{emptyLabel}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayed.map(kot => {
            const meta = STATUS_META[kot.status];
            const items = (kot.items as any[]) ?? [];
            return (
              <div key={kot.id} className={`rounded-2xl border-2 overflow-hidden ${meta.border} ${meta.bg}`}>
                {/* Ticket Header */}
                <div className={`px-4 py-3 flex items-center justify-between border-b ${meta.border}`}>
                  <div>
                    <div className={`font-bold text-lg ${meta.text}`}>
                      {kot.tableId ? `Table ${kot.tableId.slice(-4).toUpperCase()}` : kot.orderType}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {new Date(kot.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${meta.bg} ${meta.text} border ${meta.border}`}>
                      {meta.label}
                    </span>
                    <div className={`text-sm font-bold mt-1 flex items-center gap-1 justify-end ${elapsedColor(kot.createdAt)}`}>
                      <Clock className="w-3 h-3" /> {elapsed(kot.createdAt)}
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="p-4 space-y-2 min-h-[120px]">
                  {items.map((item: any, i: number) => (
                    <div key={i} className={`flex justify-between items-start text-sm ${item.isComplementary ? 'opacity-50 line-through' : ''}`}>
                      <div>
                        <span className="font-semibold text-gray-900">{item.name}</span>
                        {item.portion && <span className="text-xs text-gray-500 ml-1">({item.portion})</span>}
                        {item.notes && <div className="text-xs text-orange-600 mt-0.5 italic">→ {item.notes}</div>}
                        {item.modifiers?.length > 0 && (
                          <div className="text-xs text-blue-600">+ {item.modifiers.join(', ')}</div>
                        )}
                      </div>
                      <span className={`font-bold text-lg ml-2 ${meta.text}`}>×{item.qty}</span>
                    </div>
                  ))}
                  {kot.kotNotes && (
                    <div className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-lg mt-2 border border-yellow-200">
                      📝 {kot.kotNotes}
                    </div>
                  )}
                </div>

                {/* Bump Button */}
                {meta.next && (
                  <div className="px-4 pb-4">
                    <button
                      onClick={() => bump(kot.id, meta.next!)}
                      disabled={bumping === kot.id}
                      className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${
                        meta.next === 'COOKING' ? 'bg-amber-500 hover:bg-amber-400 text-white' :
                        meta.next === 'READY'   ? 'bg-green-600 hover:bg-green-500 text-white' :
                                                   'bg-gray-600 hover:bg-gray-500 text-white'
                      }`}
                    >
                      {bumping === kot.id ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                        meta.next === 'COOKING' ? '▶ Start Preparing' :
                        meta.next === 'READY'   ? '✓ Mark Ready' :
                                                   '→ Delivered'}
                    </button>
                  </div>
                )}
                {!meta.next && (
                  <div className="px-4 pb-4">
                    <button onClick={async () => { await api.updateKotStatus(kot.id, 'CANCELLED'); fetchKots(); }}
                      className="w-full py-2 rounded-xl text-xs text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                      Archive
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
