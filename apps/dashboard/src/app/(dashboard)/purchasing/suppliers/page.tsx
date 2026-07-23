'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Factory, Plus, Search, Phone, Mail, MapPin, Trash2, Pencil, X } from 'lucide-react';

const EMPTY_FORM = { name: '', phone: '', email: '', address: '' };

export default function PurchasingSuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.getSuppliers();
      setSuppliers(res || []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setFormData(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(s: any) {
    setEditing(s);
    setFormData({ name: s.name, phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '' });
    setShowModal(true);
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await api.updateSupplier(editing.id, formData);
      } else {
        await api.createSupplier(formData);
      }
      setShowModal(false);
      setFormData(EMPTY_FORM);
      setEditing(null);
      load();
    } catch {
      alert(editing ? 'Error updating supplier' : 'Error creating supplier');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this supplier?')) return;
    try {
      await api.deleteSupplier(id);
      load();
    } catch { alert('Error deleting supplier'); }
  };

  const filtered = suppliers.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-full bg-slate-900 text-slate-200 p-8 flex flex-col h-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Factory className="w-8 h-8 text-blue-400" /> Suppliers
          </h1>
          <p className="text-slate-400 text-sm">Vendors you receive fabric/stock batches from.</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-2.5 rounded-lg font-semibold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> Add Supplier
        </button>
      </div>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search suppliers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 transition-colors outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
          {loading && <div className="col-span-full py-12 text-center text-slate-500">Loading...</div>}
          {!loading && filtered.length === 0 && <div className="col-span-full py-12 text-center text-slate-500">No suppliers found.</div>}
          {filtered.map((s) => (
            <div key={s.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-6 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 hover:border-slate-600 transition-all flex flex-col">
              <h3 className="text-xl font-bold text-white line-clamp-2 mb-4">{s.name}</h3>
              <div className="space-y-3 flex-1 mb-6">
                <div className="flex items-center gap-3 text-sm"><Phone className="w-4 h-4 text-slate-500" /><span className="text-slate-300">{s.phone || 'N/A'}</span></div>
                <div className="flex items-center gap-3 text-sm"><Mail className="w-4 h-4 text-slate-500" /><span className="text-slate-300">{s.email || 'N/A'}</span></div>
                <div className="flex items-start gap-3 text-sm"><MapPin className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" /><span className="text-slate-300 line-clamp-2">{s.address || 'N/A'}</span></div>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-3 mb-5 border border-slate-700/50 flex justify-between items-center">
                <span className="text-xs text-slate-400 font-medium uppercase">Purchase Orders</span>
                <span className="font-mono text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded">{s._count?.purchaseOrders || 0}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(s)} className="flex-1 flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button onClick={() => handleDelete(s.id)} className="w-10 bg-slate-800 border border-slate-700 hover:border-red-500 hover:text-red-400 text-slate-400 flex items-center justify-center rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
              <h2 className="text-xl font-bold text-white">{editing ? 'Edit Supplier' : 'Add Supplier'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Company Name <span className="text-red-400">*</span></label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-blue-500 outline-none" placeholder="e.g. Ceylon Textile Mills" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Phone Number</label>
                <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-blue-500 outline-none" placeholder="011 234 5678" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Email Address</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-blue-500 outline-none" placeholder="sales@company.com" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Address</label>
                <textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-blue-500 outline-none h-20 resize-none" placeholder="Full address..." />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-800/50 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-slate-300 hover:text-white font-medium">Cancel</button>
              <button onClick={handleSave} disabled={!formData.name || saving} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium shadow-lg shadow-blue-500/20">
                {saving ? 'Saving…' : editing ? 'Update Supplier' : 'Save Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
