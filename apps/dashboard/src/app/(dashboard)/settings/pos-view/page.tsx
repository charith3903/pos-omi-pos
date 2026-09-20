'use client';

import { useEffect, useState } from 'react';
import { Monitor, CheckCircle2, Loader2, LayoutGrid, List } from 'lucide-react';
import { api } from '@/lib/api';

type Outlet = { id: string; name: string; address: string | null; isDefault: boolean };
type PosViewMode = 'MODERN' | 'TRADITIONAL';

export default function PosViewSettingsPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletId] = useState<string>('');
  const [posViewMode, setPosViewMode] = useState<PosViewMode>('TRADITIONAL');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getOutlets()
      .then((list) => {
        setOutlets(list);
        const def = list.find((o) => o.isDefault) ?? list[0];
        if (def) setOutletId(def.id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!outletId) return;
    setLoading(true);
    api.getPosSettings(outletId)
      .then((s) => setPosViewMode(s.posViewMode))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [outletId]);

  async function handleSave() {
    if (!outletId) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await api.updatePosSettings(outletId, posViewMode);
      setPosViewMode(updated.posViewMode);
      setSaved(true);
    } catch (err: any) {
      alert(err.message ?? 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Monitor className="w-6 h-6 text-primary-600" /> POS View
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Choose how the checkout screen looks on POS devices at each outlet.
        </p>
      </div>

      <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Outlet</label>
          <select
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.isDefault ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="text-gray-400 flex items-center gap-2 py-6"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => { setPosViewMode('TRADITIONAL'); setSaved(false); }}
              className={`text-left border rounded-xl p-4 space-y-2 transition-colors ${
                posViewMode === 'TRADITIONAL' ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <List className="w-5 h-5 text-gray-700" />
              <div className="font-semibold text-gray-900 text-sm">Traditional</div>
              <p className="text-xs text-gray-500">
                Search-and-list layout — a search box, results list, and a fixed cart panel. Familiar, compact, fast on a keyboard.
              </p>
            </button>

            <button
              type="button"
              onClick={() => { setPosViewMode('MODERN'); setSaved(false); }}
              className={`text-left border rounded-xl p-4 space-y-2 transition-colors ${
                posViewMode === 'MODERN' ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <LayoutGrid className="w-5 h-5 text-gray-700" />
              <div className="font-semibold text-gray-900 text-sm">Modern</div>
              <p className="text-xs text-gray-500">
                Grid of product tiles with larger touch targets and a wider cart panel — better for touchscreens.
              </p>
            </button>
          </div>
        )}
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || loading || !outletId}
          className="bg-primary-700 hover:bg-primary-800 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {saved && <span className="text-green-600 text-sm flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Saved</span>}
      </div>
    </div>
  );
}
