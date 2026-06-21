'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Plus, Tag, Loader2, X, AlertCircle, CheckCircle, Calendar, Percent } from 'lucide-react';

const PROMO_TYPES = [
  { value: 'PERCENTAGE', label: 'Percentage Off', desc: 'e.g. 20% off total bill' },
  { value: 'FLAT', label: 'Flat Amount Off', desc: 'e.g. Rs 500 off total bill' },
  { value: 'BUY_X_GET_Y', label: 'Buy X Get Y', desc: 'e.g. Buy 2 get 1 free' },
  { value: 'HAPPY_HOUR', label: 'Happy Hour', desc: 'Time-based discount' },
];

const EMPTY_FORM = {
  name: '', code: '', type: 'PERCENTAGE', value: '', minOrderValue: '',
  startDate: '', endDate: '', maxUses: '', description: '',
  happyHourStart: '', happyHourEnd: '', buyQty: '', getFreeQty: '',
};

export default function PromotionsPage() {
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try { setPromos(await api.getPromotions()); } catch { setPromos([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createPromotion({
        name: form.name,
        code: form.code || undefined,
        type: form.type,
        value: Number(form.value || 0),
        minOrderValue: form.minOrderValue ? Number(form.minOrderValue) : undefined,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
        maxUses: form.maxUses ? Number(form.maxUses) : undefined,
        description: form.description || undefined,
        config: {
          happyHourStart: form.happyHourStart || undefined,
          happyHourEnd: form.happyHourEnd || undefined,
          buyQty: form.buyQty ? Number(form.buyQty) : undefined,
          getFreeQty: form.getFreeQty ? Number(form.getFreeQty) : undefined,
        },
      });
      setModal(false);
      setForm(EMPTY_FORM);
      fetchData();
    } finally { setSaving(false); }
  }

  function isActive(promo: any) {
    const now = new Date();
    if (promo.startDate && new Date(promo.startDate) > now) return false;
    if (promo.endDate && new Date(promo.endDate) < now) return false;
    return promo.isActive !== false;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Promotions</h1>
          <p className="text-sm text-gray-500 mt-1">{promos.length} promotions · {promos.filter(isActive).length} active</p>
        </div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" /> New Promotion
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…</div>
      ) : promos.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No promotions yet. <button className="text-blue-600 underline" onClick={() => setModal(true)}>Create your first</button></p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {promos.map(p => {
            const active = isActive(p);
            return (
              <div key={p.id} className={`bg-white rounded-2xl border-2 p-5 ${active ? 'border-blue-200' : 'border-gray-100 opacity-60'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-bold text-gray-900">{p.name}</div>
                    {p.code && (
                      <div className="inline-block mt-1 text-xs font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded-lg">{p.code}</div>
                    )}
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {active ? '● Active' : '○ Inactive'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-2xl font-black text-blue-600 mb-3">
                  {p.type === 'PERCENTAGE' && <><Percent className="w-5 h-5" />{p.value}% OFF</>}
                  {p.type === 'FLAT' && <>Rs {Number(p.value).toLocaleString()} OFF</>}
                  {p.type === 'BUY_X_GET_Y' && <>Buy {p.config?.buyQty} Get {p.config?.getFreeQty} Free</>}
                  {p.type === 'HAPPY_HOUR' && <>{p.value}% · {p.config?.happyHourStart}–{p.config?.happyHourEnd}</>}
                </div>
                {p.description && <p className="text-xs text-gray-500 mb-3">{p.description}</p>}
                <div className="space-y-1 text-xs text-gray-400">
                  {p.minOrderValue && <div>Min order: Rs {Number(p.minOrderValue).toLocaleString()}</div>}
                  {p.startDate && <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(p.startDate).toLocaleDateString('en-GB')} – {p.endDate ? new Date(p.endDate).toLocaleDateString('en-GB') : 'No end'}</div>}
                  {p.maxUses && <div>Max uses: {p.usedCount ?? 0}/{p.maxUses}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">New Promotion</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="overflow-y-auto flex-1 p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Promotion Name *</label>
                  <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    placeholder="Weekend Special, Happy Hour…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Coupon Code</label>
                  <input value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})}
                    placeholder="WEEKEND20"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Type *</label>
                  <select required value={form.type} onChange={e => setForm({...form, type: e.target.value})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                    {PROMO_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              {(form.type === 'PERCENTAGE' || form.type === 'FLAT' || form.type === 'HAPPY_HOUR') && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      {form.type === 'PERCENTAGE' || form.type === 'HAPPY_HOUR' ? 'Discount %' : 'Amount (Rs)'} *
                    </label>
                    <input required type="number" min={0} value={form.value} onChange={e => setForm({...form, value: e.target.value})}
                      placeholder={form.type === 'FLAT' ? '500' : '20'}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Min Order Value (Rs)</label>
                    <input type="number" min={0} value={form.minOrderValue} onChange={e => setForm({...form, minOrderValue: e.target.value})}
                      placeholder="1000"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                </div>
              )}

              {form.type === 'BUY_X_GET_Y' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Buy Qty *</label>
                    <input required type="number" min={1} value={form.buyQty} onChange={e => setForm({...form, buyQty: e.target.value})}
                      placeholder="2"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Get Free Qty *</label>
                    <input required type="number" min={1} value={form.getFreeQty} onChange={e => setForm({...form, getFreeQty: e.target.value})}
                      placeholder="1"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                </div>
              )}

              {form.type === 'HAPPY_HOUR' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Start Time *</label>
                    <input required type="time" value={form.happyHourStart} onChange={e => setForm({...form, happyHourStart: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">End Time *</label>
                    <input required type="time" value={form.happyHourEnd} onChange={e => setForm({...form, happyHourEnd: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Start Date</label>
                  <input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">End Date</label>
                  <input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Max Uses</label>
                  <input type="number" min={1} value={form.maxUses} onChange={e => setForm({...form, maxUses: e.target.value})}
                    placeholder="Unlimited"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  rows={2} placeholder="Visible to staff on POS…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" />
              </div>
            </form>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button type="button" onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-600 font-medium">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
