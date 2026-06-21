'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Star, Plus, Loader2, Search, ChevronRight, X, TrendingUp, Award, Gift, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

const TIER_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  BRONZE:   { bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200',  icon: '🥉' },
  SILVER:   { bg: 'bg-gray-50',    text: 'text-gray-700',   border: 'border-gray-300',   icon: '🥈' },
  GOLD:     { bg: 'bg-yellow-50',  text: 'text-yellow-700', border: 'border-yellow-300', icon: '🥇' },
  PLATINUM: { bg: 'bg-purple-50',  text: 'text-purple-700', border: 'border-purple-300', icon: '💎' },
};

export default function LoyaltyPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [txns, setTxns] = useState<any[]>([]);
  const [txnLoading, setTxnLoading] = useState(false);
  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ points: '', reason: '', type: 'ADD' });
  const [adjusting, setAdjusting] = useState(false);
  const [enrollModal, setEnrollModal] = useState(false);
  const [custSearch, setCustSearch] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [enrolling, setEnrolling] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [accs, t] = await Promise.all([api.getLoyaltyAccounts(), api.getLoyaltyTiers()]);
      setAccounts(accs as any[]);
      setTiers(t);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function openAccount(acc: any) {
    setSelected(acc);
    setTxnLoading(true);
    try { setTxns(await api.getLoyaltyTransactions(acc.customerId)); } finally { setTxnLoading(false); }
  }

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setAdjusting(true);
    try {
      const pts = Number(adjustForm.points);
      await api.adjustPoints(selected.customerId, adjustForm.type === 'ADD' ? pts : -pts, adjustForm.reason);
      setAdjustModal(false);
      setAdjustForm({ points: '', reason: '', type: 'ADD' });
      openAccount(selected);
      fetchData();
    } finally { setAdjusting(false); }
  }

  useEffect(() => {
    if (!custSearch.trim()) { setCustomers([]); return; }
    const t = setTimeout(async () => {
      try { setCustomers(await api.getCustomers(custSearch)); } catch { setCustomers([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [custSearch]);

  async function enroll(customerId: string) {
    setEnrolling(customerId);
    try { await api.enrollLoyalty(customerId); setEnrollModal(false); setCustSearch(''); fetchData(); } finally { setEnrolling(null); }
  }

  const filtered = accounts.filter(a =>
    !search || a.customer?.name?.toLowerCase().includes(search.toLowerCase()) || a.customer?.phone?.includes(search)
  );

  const stats = {
    total: accounts.length,
    totalPts: accounts.reduce((s, a) => s + a.points, 0),
    gold: accounts.filter(a => a.tier === 'GOLD' || a.tier === 'PLATINUM').length,
  };

  return (
    <div className="p-6 flex gap-6 h-full">
      {/* Left panel */}
      <div className="flex flex-col w-[360px] flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Loyalty Program</h1>
            <p className="text-xs text-gray-500 mt-0.5">{stats.total} members · {stats.totalPts.toLocaleString()} pts total</p>
          </div>
          <button onClick={() => setEnrollModal(true)} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-white px-3 py-2 rounded-xl text-xs font-semibold">
            <Plus className="w-3.5 h-3.5" /> Enroll
          </button>
        </div>

        {/* Tier Summary */}
        {tiers && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            {Object.entries(tiers).map(([tier, info]: any) => {
              const meta = TIER_COLORS[tier] ?? TIER_COLORS.BRONZE;
              const count = accounts.filter(a => a.tier === tier).length;
              return (
                <div key={tier} className={`${meta.bg} ${meta.border} border rounded-xl p-3`}>
                  <div className="text-lg">{meta.icon}</div>
                  <div className={`text-xs font-bold ${meta.text}`}>{tier}</div>
                  <div className="text-xs text-gray-500">{count} members</div>
                  <div className="text-xs text-gray-400">{info.minPoints}+ pts</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input placeholder="Search members…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
        </div>

        {/* Members List */}
        <div className="flex-1 overflow-y-auto space-y-1">
          {loading ? (
            <div className="text-center py-10 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">No members found</div>
          ) : filtered.map(acc => {
            const meta = TIER_COLORS[acc.tier] ?? TIER_COLORS.BRONZE;
            return (
              <button key={acc.id} onClick={() => openAccount(acc)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all hover:shadow-sm ${selected?.id === acc.id ? `${meta.bg} ${meta.border} border` : 'bg-white border-gray-100 hover:border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{meta.icon}</span>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{acc.customer?.name ?? '—'}</div>
                      <div className="text-xs text-gray-500">{acc.customer?.phone ?? ''}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${meta.text}`}>{acc.points.toLocaleString()}</div>
                    <div className="text-xs text-gray-400">pts</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right panel - Account detail */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-300">
            <Star className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-sm">Select a member to view their account</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`text-4xl p-3 rounded-2xl ${TIER_COLORS[selected.tier]?.bg}`}>{TIER_COLORS[selected.tier]?.icon}</div>
                  <div>
                    <div className="text-xl font-bold text-gray-900">{selected.customer?.name}</div>
                    <div className="text-sm text-gray-500">{selected.customer?.phone} · {selected.customer?.email}</div>
                    <div className={`mt-1 inline-block text-xs font-bold px-2 py-0.5 rounded-full ${TIER_COLORS[selected.tier]?.bg} ${TIER_COLORS[selected.tier]?.text}`}>
                      {selected.tier} Member
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-4xl font-black ${TIER_COLORS[selected.tier]?.text}`}>{selected.points.toLocaleString()}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Available Points</div>
                  <div className="text-xs text-gray-400">Lifetime: {selected.lifetimePoints?.toLocaleString()} pts</div>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => { setAdjustForm({ points: '', reason: '', type: 'ADD' }); setAdjustModal(true); }}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-xl text-sm font-semibold">
                  <Award className="w-4 h-4" /> Adjust Points
                </button>
              </div>
            </div>

            {/* Transaction History */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Transaction History</h3>
              </div>
              {txnLoading ? (
                <div className="py-10 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
              ) : txns.length === 0 ? (
                <div className="py-10 text-center text-gray-400 text-sm">No transactions yet</div>
              ) : (
                <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                  {txns.map(txn => (
                    <div key={txn.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        {txn.points >= 0 ? (
                          <ArrowUpCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <ArrowDownCircle className="w-4 h-4 text-red-500" />
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {txn.type === 'EARN' ? 'Points Earned' : txn.type === 'REDEEM' ? 'Points Redeemed' : 'Manual Adjustment'}
                          </div>
                          {txn.note && <div className="text-xs text-gray-400">{txn.note}</div>}
                          <div className="text-xs text-gray-400">{new Date(txn.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>
                      <div className={`text-sm font-bold ${txn.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {txn.points >= 0 ? '+' : ''}{txn.points} pts
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Adjust Points Modal */}
      {adjustModal && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-900">Adjust Points — {selected.customer?.name}</h2>
              <button onClick={() => setAdjustModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAdjust} className="space-y-4">
              <div className="flex gap-2">
                {['ADD', 'REMOVE'].map(t => (
                  <button key={t} type="button" onClick={() => setAdjustForm(f => ({ ...f, type: t }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${adjustForm.type === t ? (t === 'ADD' ? 'bg-green-600 text-white' : 'bg-red-600 text-white') : 'bg-gray-100 text-gray-600'}`}>
                    {t === 'ADD' ? '+ Add' : '- Remove'}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Points</label>
                <input required type="number" min={1} value={adjustForm.points} onChange={e => setAdjustForm(f => ({ ...f, points: e.target.value }))}
                  placeholder="100"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Reason</label>
                <input required value={adjustForm.reason} onChange={e => setAdjustForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Birthday bonus, correction…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setAdjustModal(false)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-semibold text-gray-700">Cancel</button>
                <button type="submit" disabled={adjusting}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                  {adjusting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enroll Modal */}
      {enrollModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-900">Enroll Customer</h2>
              <button onClick={() => { setEnrollModal(false); setCustSearch(''); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input placeholder="Search customer by name or phone…" value={custSearch} onChange={e => setCustSearch(e.target.value)}
                autoFocus
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
              {customers.map(c => (
                <div key={c.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 rounded-xl">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{c.name}</div>
                    <div className="text-xs text-gray-400">{c.phone}</div>
                  </div>
                  <button onClick={() => enroll(c.id)} disabled={enrolling === c.id}
                    className="text-xs bg-amber-500 hover:bg-amber-400 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1">
                    {enrolling === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Enroll
                  </button>
                </div>
              ))}
              {custSearch && customers.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No customers found</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
