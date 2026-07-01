'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DEFAULT_PACK, fetchVerticalPack, label } from '@/lib/vertical';
import type { VerticalPack } from '@/lib/vertical';
import { DynamicProductForm } from '@/components/DynamicProductForm';

interface Product {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  price: string;
  taxRate: string;
  trackStock: boolean;
  attributes?: Record<string, unknown>;
  category?: { id: string; name: string } | null;
}

interface Category {
  id: string;
  name: string;
}

// ─── Product Form ─────────────────────────────────────────────────────────────

function ProductForm({
  initial,
  categories,
  pack,
  onSave,
  onCancel,
}: {
  initial?: Partial<Product>;
  categories: Category[];
  pack: VerticalPack;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    sku: initial?.sku ?? '',
    barcode: initial?.barcode ?? '',
    price: initial?.price ?? '',
    taxRate: initial?.taxRate ?? String(pack.defaultTaxRate),
    trackStock: initial?.trackStock ?? true,
    categoryId: initial?.category?.id ?? '',
  });
  const [attributes, setAttributes] = useState<Record<string, unknown>>(
    (initial?.attributes as Record<string, unknown>) ?? {},
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | string[]>('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data = {
        name: form.name,
        sku: form.sku || undefined,
        barcode: form.barcode || undefined,
        price: parseFloat(form.price),
        taxRate: parseFloat(form.taxRate),
        trackStock: form.trackStock,
        categoryId: form.categoryId || undefined,
        attributes: Object.keys(attributes).length ? attributes : undefined,
      };
      if (initial?.id) {
        await api.updateProduct(initial.id, data);
      } else {
        await api.createProduct(data);
      }
      onSave();
    } catch (err: any) {
      // API returns array of messages for attribute validation errors
      setError(Array.isArray(err.message) ? err.message : err.message);
    } finally {
      setSaving(false);
    }
  }

  const inp = (lbl: string, key: keyof typeof form, type = 'text', extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{lbl}</label>
      <input
        type={type}
        value={String(form[key])}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        {...extra}
      />
    </div>
  );

  const errors = Array.isArray(error) ? error : error ? [error] : [];

  return (
    <form onSubmit={submit} className="space-y-4">
      {errors.length > 0 && (
        <ul className="text-red-600 text-sm list-disc list-inside space-y-1">
          {errors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}

      {/* Core fields — labels driven by pack */}
      {inp(`${label(pack, 'product', 'Product')} name *`, 'name', 'text', { required: true })}
      <div className="grid grid-cols-2 gap-3">
        {inp(label(pack, 'sku', 'SKU'), 'sku')}
        {inp(label(pack, 'barcode', 'Barcode'), 'barcode')}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {inp('Price (LKR) *', 'price', 'number', { required: true, min: '0', step: '0.01' })}
        {inp('Tax rate (0–1)', 'taxRate', 'number', { min: '0', max: '1', step: '0.01' })}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label(pack, 'category', 'Category')}
        </label>
        <select
          value={form.categoryId}
          onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">— None —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.trackStock}
          onChange={(e) => setForm({ ...form, trackStock: e.target.checked })}
          className="rounded"
        />
        Track stock
      </label>

      {/* Vertical-specific attribute fields — zero rendering when pack.productFields is empty */}
      {pack.productFields.length > 0 && (
        <div className="border-t border-gray-100 pt-4">
          <DynamicProductForm
            pack={pack}
            attributes={attributes}
            onChange={setAttributes}
          />
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="bg-primary-700 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-primary-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : initial?.id ? 'Update' : 'Create'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg text-sm hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GenericProducts() {
  const [pack, setPack] = useState<VerticalPack>(DEFAULT_PACK);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Product | null | 'new'>(null);

  // Fetch pack once on mount
  useEffect(() => {
    fetchVerticalPack().then(setPack).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cats] = await Promise.all([
        api.getProducts({ search: search || undefined, page, limit: 20 }),
        categories.length ? Promise.resolve(categories) : api.getCategories(),
      ]);
      setProducts(pRes.items);
      setTotal(pRes.total);
      if (!categories.length) setCategories(cats);
    } finally {
      setLoading(false);
    }
  }, [search, page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    if (!confirm(`Delete this ${label(pack, 'product', 'product')}?`)) return;
    await api.deleteProduct(id);
    load();
  }

  // Searchable attribute columns to show in the table (up to 2)
  const attrCols = pack.productFields.filter((f) => f.searchable).slice(0, 2);
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {label(pack, 'products', 'Products')}
          </h1>
          <p className="text-sm text-gray-500">{total} total</p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary-800"
        >
          + {label(pack, 'addProduct', 'New Product')}
        </button>
      </div>

      {/* Slide-in form */}
      {editing && (
        <div className="mb-6 bg-white rounded-xl shadow p-6 border border-primary-100">
          <h2 className="text-lg font-semibold mb-4">
            {editing === 'new'
              ? `New ${label(pack, 'product', 'Product')}`
              : `Edit — ${(editing as Product).name}`}
          </h2>
          <ProductForm
            initial={editing === 'new' ? undefined : (editing as Product)}
            categories={categories}
            pack={pack}
            onSave={() => { setEditing(null); load(); }}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {/* Search */}
      <div className="flex gap-3 mb-4">
        <input
          type="search"
          placeholder={label(pack, 'searchPlaceholder', 'Search…')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                {label(pack, 'product', 'Product')}
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                {label(pack, 'sku', 'SKU')}
              </th>
              {/* Vertical-specific attribute columns */}
              {attrCols.map((f) => (
                <th key={f.key} className="text-left px-4 py-3 font-medium text-gray-600">
                  {f.label}
                </th>
              ))}
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                {label(pack, 'category', 'Category')}
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Price</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Stock</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6 + attrCols.length} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={6 + attrCols.length} className="px-4 py-8 text-center text-gray-400">
                {label(pack, 'noProducts', 'No products yet')}
              </td></tr>
            ) : products.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.sku ?? '—'}</td>
                {attrCols.map((f) => (
                  <td key={f.key} className="px-4 py-3 text-gray-600 font-mono text-xs">
                    {String(p.attributes?.[f.key] ?? '—')}
                  </td>
                ))}
                <td className="px-4 py-3 text-gray-500">{p.category?.name ?? '—'}</td>
                <td className="px-4 py-3 font-medium">LKR {Number(p.price).toFixed(2)}</td>
                <td className="px-4 py-3">
                  {p.trackStock ? (
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">Tracked</span>
                  ) : (
                    <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditing(p)} className="text-primary-600 hover:text-primary-800 text-xs font-medium">Edit</button>
                    <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">← Prev</button>
              <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
