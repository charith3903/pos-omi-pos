'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Plus, Search, X, Pencil, Loader2, UtensilsCrossed, Leaf, Flame } from 'lucide-react';

const SPICE_LEVELS = ['Mild', 'Medium', 'Hot', 'Extra Hot'];

const EMPTY_FORM = {
  name: '', categoryId: '', price: '', sku: '',
  prepTime: '', allergens: '', isVeg: false, spiceLevel: 'Mild',
  portions: [{ label: 'Full', price: '' }],
  trackStock: false,
};

export default function MenuPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [prods, cats] = await Promise.all([
        api.getProducts({ limit: 200 }).then(r => r.items),
        api.getCategories(),
      ]);
      setProducts(prods as any[]);
      setCategories(cats as any[]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModal(true);
  }

  function openEdit(p: any) {
    const attrs = p.attributes ?? {};
    setEditing(p);
    setForm({
      name: p.name,
      categoryId: p.categoryId ?? '',
      price: String(p.price),
      sku: p.sku ?? '',
      prepTime: String(attrs.prep_time_minutes ?? ''),
      allergens: attrs.allergens ?? '',
      isVeg: attrs.is_vegetarian ?? false,
      spiceLevel: attrs.spice_level ?? 'Mild',
      portions: attrs.portions?.length ? attrs.portions.map((x: any) => ({ label: x.label, price: String(x.price) })) : [{ label: 'Full', price: String(p.price) }],
      trackStock: p.trackStock,
    });
    setModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        name: form.name,
        categoryId: form.categoryId || undefined,
        price: Number(form.price || form.portions[0].price || 0),
        sku: form.sku || undefined,
        trackStock: form.trackStock,
        attributes: {
          prep_time_minutes: form.prepTime ? Number(form.prepTime) : undefined,
          allergens: form.allergens || undefined,
          is_vegetarian: form.isVeg,
          spice_level: form.spiceLevel,
          portions: form.portions.filter(p => p.label && p.price).map(p => ({ label: p.label, price: Number(p.price) })),
        },
      };
      if (editing) {
        await api.updateProduct(editing.id, data);
      } else {
        await api.createProduct(data);
      }
      setModal(false);
      fetchData();
    } finally { setSaving(false); }
  }

  function addPortion() { setForm(f => ({ ...f, portions: [...f.portions, { label: '', price: '' }] })); }
  function removePortion(idx: number) { setForm(f => ({ ...f, portions: f.portions.filter((_, i) => i !== idx) })); }
  function updatePortion(idx: number, field: 'label' | 'price', val: string) {
    setForm(f => ({ ...f, portions: f.portions.map((p, i) => i === idx ? { ...p, [field]: val } : p) }));
  }

  const displayed = products.filter(p => {
    const matchCat = filterCat === 'ALL' || p.categoryId === filterCat;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu Management</h1>
          <p className="text-sm text-gray-500 mt-1">{products.length} items across {categories.length} categories</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input placeholder="Search menu items…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setFilterCat('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterCat === 'ALL' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            All
          </button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setFilterCat(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterCat === c.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…</div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <UtensilsCrossed className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No menu items. <button className="text-blue-600 underline" onClick={openCreate}>Add your first item</button></p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Item', 'Category', 'Portions / Price', 'Prep', 'Dietary', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayed.map(p => {
                const attrs = p.attributes ?? {};
                const portions = attrs.portions as any[] | undefined;
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{p.name}</div>
                      {p.sku && <div className="text-xs text-gray-400 font-mono">{p.sku}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.category?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      {portions?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {portions.map((pt: any) => (
                            <span key={pt.label} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                              {pt.label}: Rs {Number(pt.price).toLocaleString()}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="font-semibold text-gray-900">Rs {Number(p.price).toLocaleString()}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{attrs.prep_time_minutes ? `${attrs.prep_time_minutes}m` : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {attrs.is_vegetarian != null && (
                          <span className={`w-5 h-5 rounded border-2 flex items-center justify-center ${attrs.is_vegetarian ? 'border-green-600' : 'border-red-600'}`}>
                            <div className={`w-2.5 h-2.5 rounded-full ${attrs.is_vegetarian ? 'bg-green-600' : 'bg-red-600'}`} />
                          </span>
                        )}
                        {attrs.spice_level && attrs.spice_level !== 'Mild' && (
                          <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">🌶 {attrs.spice_level}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(p)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium">
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">{editing ? 'Edit Menu Item' : 'Add Menu Item'}</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="overflow-y-auto flex-1 p-5 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Item Name *</label>
                  <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    placeholder="Butter Chicken, Biryani…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
                  <select value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                    <option value="">No category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Item Code / SKU</label>
                  <input value={form.sku} onChange={e => setForm({...form, sku: e.target.value})}
                    placeholder="BC-001"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>

              {/* Portions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-600">Portions & Prices *</label>
                  <button type="button" onClick={addPortion} className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add Portion
                  </button>
                </div>
                <div className="space-y-2">
                  {form.portions.map((p, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input value={p.label} onChange={e => updatePortion(idx, 'label', e.target.value)}
                        placeholder="Full / Half / Quarter"
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                      <input type="number" min={0} value={p.price} onChange={e => updatePortion(idx, 'price', e.target.value)}
                        placeholder="Price (Rs)"
                        className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                      {form.portions.length > 1 && (
                        <button type="button" onClick={() => removePortion(idx)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">The first portion price is used as the default/base price</p>
              </div>

              {/* Restaurant attributes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Prep Time (minutes)</label>
                  <input type="number" min={0} value={form.prepTime} onChange={e => setForm({...form, prepTime: e.target.value})}
                    placeholder="15"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Spice Level</label>
                  <select value={form.spiceLevel} onChange={e => setForm({...form, spiceLevel: e.target.value})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                    {SPICE_LEVELS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Allergens</label>
                  <input value={form.allergens} onChange={e => setForm({...form, allergens: e.target.value})}
                    placeholder="Nuts, Dairy, Gluten…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>

              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={form.isVeg} onChange={e => setForm({...form, isVeg: e.target.checked})} className="w-4 h-4 accent-green-600" />
                  <div className="flex items-center gap-1 text-sm text-gray-700"><Leaf className="w-4 h-4 text-green-600" /> Vegetarian</div>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={form.trackStock} onChange={e => setForm({...form, trackStock: e.target.checked})} className="w-4 h-4 accent-blue-600" />
                  <div className="text-sm text-gray-700">Track Inventory</div>
                </label>
              </div>
            </form>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button type="button" onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {editing ? 'Update' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
