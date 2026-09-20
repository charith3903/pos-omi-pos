'use client';

import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { api } from '@/lib/api';
import { DEFAULT_PACK, fetchVerticalPack, label } from '@/lib/vertical';
import type { VerticalPack } from '@/lib/vertical';
import { DynamicProductForm } from '@/components/DynamicProductForm';
import { BarcodeLabel } from '@/components/BarcodeLabel';

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

// ─── Variant matrix (size × color) ────────────────────────────────────────────

function VariantsModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [variants, setVariants] = useState<any[]>([]);
  const [sizes, setSizes] = useState('S, M, L, XL');
  const [colors, setColors] = useState('Black, White');
  const [barcodePrefix, setBarcodePrefix] = useState(product.sku ?? '');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: { row: number; sku: string; reason: string }[] } | null>(null);

  function load() {
    api.listVariants(product.id).then((res) => setVariants(res.variants)).catch(() => {});
  }

  useEffect(load, [product.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      await api.generateVariants({
        productId: product.id,
        sizes: sizes.split(',').map((s) => s.trim()).filter(Boolean),
        colors: colors.split(',').map((c) => c.trim()).filter(Boolean),
        barcodePrefix: barcodePrefix || undefined,
      });
      load();
    } catch (err: any) {
      setError(err.message ?? 'Failed to generate variants');
    } finally {
      setGenerating(false);
    }
  }

  async function handleImportCsv(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    setError('');
    try {
      const res = await api.importVariantsCsv(file);
      setImportResult(res);
      load();
    } catch (err: any) {
      setError(err.message ?? 'CSV import failed');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-900">Variants — {product.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Sizes (comma separated)</label>
              <input value={sizes} onChange={(e) => setSizes(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Colors (comma separated)</label>
              <input value={colors} onChange={(e) => setColors(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Barcode prefix (optional)</label>
            <input value={barcodePrefix} onChange={(e) => setBarcodePrefix(e.target.value)} placeholder="e.g. TS-2024-001" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button onClick={handleGenerate} disabled={generating} className="bg-primary-700 hover:bg-primary-800 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            {generating ? 'Generating…' : 'Generate Variant Matrix'}
          </button>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Or import from CSV</h3>
            <p className="text-xs text-gray-500 mb-2">
              Columns: <code>sku, size, color, barcode, price</code> (barcode/price optional). Re-uploading updates
              existing barcodes/prices for matching size/color rows.
            </p>
            <label className={`inline-block px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer ${importing ? 'bg-gray-200 text-gray-400' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              {importing ? 'Importing…' : 'Choose CSV file'}
              <input type="file" accept=".csv,text/csv" onChange={handleImportCsv} disabled={importing} className="hidden" />
            </label>
            {importResult && (
              <div className="mt-2 text-sm">
                <p className="text-green-700">{importResult.created} created, {importResult.updated} updated</p>
                {importResult.errors.length > 0 && (
                  <ul className="mt-1 text-red-600 text-xs list-disc list-inside">
                    {importResult.errors.map((e, i) => (
                      <li key={i}>Row {e.row} ({e.sku || '—'}): {e.reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Existing variants ({variants.length})</h3>
            <div className="max-h-64 overflow-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {variants.map((v) => {
                const a = v.attributes ?? {};
                return (
                  <div key={v.id} className="flex justify-between items-center px-3 py-2 text-sm gap-3">
                    <span className="text-gray-800">{[a.size, a.color].filter(Boolean).join(' / ')}</span>
                    <span className="text-gray-400 font-mono text-xs">{v.barcode ?? '—'}</span>
                    {v.cost != null && (
                      <span className="text-gray-500 text-xs" title="Cost from the newest GRN batch received for this variant">
                        Cost: LKR {Number(v.cost).toFixed(2)}
                      </span>
                    )}
                    <span className="text-primary-700 font-medium">LKR {Number(v.price ?? product.price).toFixed(2)}</span>
                  </div>
                );
              })}
              {variants.length === 0 && <div className="px-3 py-4 text-center text-gray-400 text-sm">No variants yet — generate some above.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Size chart ───────────────────────────────────────────────────────────────

interface SizeChartRow {
  size: string;
  chest?: string;
  length?: string;
  shoulder?: string;
  sleeve?: string;
  waist?: string;
}

const SIZE_CHART_COLUMNS: { key: keyof SizeChartRow; label: string }[] = [
  { key: 'size', label: 'Size' },
  { key: 'chest', label: 'Chest' },
  { key: 'length', label: 'Length' },
  { key: 'shoulder', label: 'Shoulder' },
  { key: 'sleeve', label: 'Sleeve' },
  { key: 'waist', label: 'Waist' },
];

function SizeChartModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [rows, setRows] = useState<SizeChartRow[]>(
    (product.attributes?.size_chart as SizeChartRow[] | undefined) ?? [{ size: '' }],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setCell(i: number, key: keyof SizeChartRow, value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { size: '' }]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const cleaned = rows.filter((r) => r.size.trim());
      await api.updateProduct(product.id, {
        attributes: { ...(product.attributes ?? {}), size_chart: cleaned },
      });
      setRows(cleaned.length ? cleaned : [{ size: '' }]);
    } catch (err: any) {
      setError(err.message ?? 'Failed to save size chart');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b print:hidden">
          <h2 className="font-semibold text-gray-900">Size Chart — {product.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="p-6 space-y-4 print:hidden">
          <p className="text-xs text-gray-500">All measurements in cm. Leave a column blank if not applicable.</p>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {SIZE_CHART_COLUMNS.map((c) => (
                    <th key={c.key} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{c.label}</th>
                  ))}
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, i) => (
                  <tr key={i}>
                    {SIZE_CHART_COLUMNS.map((c) => (
                      <td key={c.key} className="px-2 py-1.5">
                        <input
                          value={row[c.key] ?? ''}
                          onChange={(e) => setCell(i, c.key, e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1.5">
                      <button onClick={() => removeRow(i)} className="text-gray-400 hover:text-red-600 text-xs">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={addRow} className="text-primary-600 hover:text-primary-800 text-sm font-medium">+ Add row</button>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving} className="bg-primary-700 hover:bg-primary-800 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold">
              {saving ? 'Saving…' : 'Save Size Chart'}
            </button>
            <button onClick={() => window.print()} className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-semibold">
              Print
            </button>
          </div>
        </div>

        {/* Print-only clean table for handing to a customer */}
        <div className="hidden print:block p-6">
          <h2 className="font-semibold text-gray-900 mb-3">{product.name} — Size Chart (cm)</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {SIZE_CHART_COLUMNS.map((c) => (
                  <th key={c.key} className="border border-gray-300 px-3 py-1.5 text-left">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.filter((r) => r.size.trim()).map((row, i) => (
                <tr key={i}>
                  {SIZE_CHART_COLUMNS.map((c) => (
                    <td key={c.key} className="border border-gray-300 px-3 py-1.5">{row[c.key] ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Barcode label printing ─────────────────────────────────────────────────

function LabelPrintModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [variants, setVariants] = useState<any[]>([]);
  const [qtyByVariant, setQtyByVariant] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listVariants(product.id)
      .then((res) => {
        setVariants(res.variants);
        setQtyByVariant(Object.fromEntries(res.variants.map((v: any) => [v.id, v.barcode ? 1 : 0])));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [product.id]);

  function setQty(variantId: string, qty: number) {
    setQtyByVariant((prev) => ({ ...prev, [variantId]: Math.max(0, qty) }));
  }

  const labels: { key: string; variant: any }[] = [];
  for (const v of variants) {
    const qty = qtyByVariant[v.id] ?? 0;
    for (let i = 0; i < qty; i++) labels.push({ key: `${v.id}-${i}`, variant: v });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b print:hidden">
          <h2 className="font-semibold text-gray-900">Print Labels — {product.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="p-6 space-y-4 print:hidden">
          {loading ? (
            <p className="text-sm text-gray-400">Loading variants…</p>
          ) : variants.length === 0 ? (
            <p className="text-sm text-gray-400">This product has no variants yet — generate them first.</p>
          ) : (
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
              {variants.map((v) => {
                const a = v.attributes ?? {};
                return (
                  <div key={v.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div>
                      <span className="text-gray-800">{[a.size, a.color].filter(Boolean).join(' / ')}</span>
                      <span className="text-gray-400 font-mono text-xs ml-2">{v.barcode ?? 'no barcode'}</span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={qtyByVariant[v.id] ?? 0}
                      onChange={(e) => setQty(v.id, Number(e.target.value))}
                      className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm text-right"
                    />
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={() => window.print()}
            disabled={labels.length === 0}
            className="bg-primary-700 hover:bg-primary-800 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Print {labels.length} label{labels.length === 1 ? '' : 's'}
          </button>
        </div>

        <div className="hidden print:flex print:flex-wrap print:gap-2 p-2">
          {labels.map(({ key, variant }) => (
            <BarcodeLabel
              key={key}
              productName={product.name}
              variantLabel={[variant.attributes?.size, variant.attributes?.color].filter(Boolean).join(' / ')}
              price={variant.price ?? product.price}
              barcode={variant.barcode ?? ''}
            />
          ))}
        </div>
      </div>
    </div>
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
  const [categoryFilter, setCategoryFilter] = useState('');
  const [seasonFilter, setSeasonFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Product | null | 'new'>(null);
  const [variantsProduct, setVariantsProduct] = useState<Product | null>(null);
  const [labelsProduct, setLabelsProduct] = useState<Product | null>(null);
  const [sizeChartProduct, setSizeChartProduct] = useState<Product | null>(null);

  // Fetch pack once on mount
  useEffect(() => {
    fetchVerticalPack().then(setPack).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cats] = await Promise.all([
        api.getProducts({
          search: search || undefined,
          categoryId: categoryFilter || undefined,
          season: seasonFilter || undefined,
          page,
          limit: 20,
        }),
        categories.length ? Promise.resolve(categories) : api.getCategories(),
      ]);
      setProducts(pRes.items);
      setTotal(pRes.total);
      if (!categories.length) setCategories(cats);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, seasonFilter, page]); // eslint-disable-line react-hooks/exhaustive-deps

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

      {/* Search + filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="search"
          placeholder={label(pack, 'searchPlaceholder', 'Search…')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All {label(pack, 'category', 'categories').toLowerCase()}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        {(() => {
          const seasonField = pack.productFields.find((f) => f.key === 'season');
          if (!seasonField?.options?.length) return null;
          return (
            <select
              value={seasonFilter}
              onChange={(e) => { setSeasonFilter(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All {seasonField.label.toLowerCase()}s</option>
              {seasonField.options.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          );
        })()}
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
                    {pack.enabledModules.includes('variants') && (
                      <>
                        <button onClick={() => setVariantsProduct(p)} className="text-purple-600 hover:text-purple-800 text-xs font-medium">Variants</button>
                        <button onClick={() => setLabelsProduct(p)} className="text-purple-600 hover:text-purple-800 text-xs font-medium">Labels</button>
                        <button onClick={() => setSizeChartProduct(p)} className="text-purple-600 hover:text-purple-800 text-xs font-medium">Size Chart</button>
                      </>
                    )}
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

      {variantsProduct && (
        <VariantsModal product={variantsProduct} onClose={() => setVariantsProduct(null)} />
      )}
      {labelsProduct && (
        <LabelPrintModal product={labelsProduct} onClose={() => setLabelsProduct(null)} />
      )}
      {sizeChartProduct && (
        <SizeChartModal product={sizeChartProduct} onClose={() => setSizeChartProduct(null)} />
      )}
    </div>
  );
}
