'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Factory, Plus, Search, User, Phone, Mail, MapPin, Trash2, Pencil, X } from 'lucide-react';

const EMPTY_FORM = { name: '', contactPerson: '', phone: '', email: '', address: '', notes: '' };

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const res = await api.getSuppliers();
      setSuppliers(res || []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSuppliers(); }, []);

  function openCreate() {
    setEditingSupplier(null);
    setFormData(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(s: any) {
    setEditingSupplier(s);
    setFormData({ name: s.name, contactPerson: s.contactPerson ?? '', phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '', notes: s.notes ?? '' });
    setShowModal(true);
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingSupplier) {
        await api.updateSupplier(editingSupplier.id, formData);
      } else {
        await api.createSupplier(formData);
      }
      setShowModal(false);
      setFormData(EMPTY_FORM);
      setEditingSupplier(null);
      loadSuppliers();
    } catch {
      alert(editingSupplier ? 'Error updating supplier' : 'Error creating supplier');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this supplier?')) return;
    try {
      await api.deleteSupplier(id);
      loadSuppliers();
    } catch { alert('Error deleting supplier'); }
  };

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.contactPerson && s.contactPerson.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  return (
    <div className="min-h-full bg-slate-900 text-slate-200 p-8 flex flex-col h-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Factory className="w-8 h-8 text-blue-400" /> Parts Suppliers
          </h1>
          <p className="text-slate-400 text-sm">Manage vendor relationships and procurement.</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-2.5 rounded-lg font-semibold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> Add Supplier
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex flex-col">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Total Suppliers</span>
          <span className="text-3xl font-bold text-white">{suppliers.length}</span>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex flex-col">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Active</span>
          <span className="text-3xl font-bold text-green-400">{suppliers.filter(s => s.active).length}</span>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex flex-col">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Purchase Orders</span>
          <span className="text-3xl font-bold text-blue-400">{suppliers.reduce((sum, s) => sum + (s._count?.purchaseOrders || 0), 0)}</span>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex flex-col">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Top Supplier</span>
          <span className="text-xl font-bold text-orange-400 truncate">{suppliers.length > 0 ? suppliers[0].name : 'N/A'}</span>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search suppliers by name or contact..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 transition-colors outline-none"
          />
        </div>
      </div>

      {/* Supplier Cards Grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
          {loading && <div className="col-span-full py-12 text-center text-slate-500">Loading...</div>}
          {!loading && filtered.length === 0 && <div className="col-span-full py-12 text-center text-slate-500">No suppliers found.</div>}
          {filtered.map(s => (
            <div key={s.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-6 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 hover:border-slate-600 transition-all flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-white line-clamp-2 pr-2">{s.name}</h3>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${s.active ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-slate-700 text-slate-400 border border-slate-600'}`}>
                  {s.active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="space-y-3 flex-1 mb-6">
                <div className="flex items-center gap-3 text-sm"><User className="w-4 h-4 text-slate-500" /><span className="text-slate-300 font-medium">{s.contactPerson || 'N/A'}</span></div>
                <div className="flex items-center gap-3 text-sm"><Phone className="w-4 h-4 text-slate-500" /><span className="text-slate-300">{s.phone || 'N/A'}</span></div>
                <div className="flex items-center gap-3 text-sm"><Mail className="w-4 h-4 text-slate-500" /><span className="text-slate-300">{s.email || 'N/A'}</span></div>
                <div className="flex items-start gap-3 text-sm"><MapPin className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" /><span className="text-slate-300 line-clamp-2">{s.address || 'N/A'}</span></div>
              </div>

              <div className="bg-slate-900/50 rounded-xl p-3 mb-5 border border-slate-700/50 flex justify-between items-center">
                <span className="text-xs text-slate-400 font-medium uppercase">Total POs</span>
                <span className="font-mono text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded">{s._count?.purchaseOrders || 0} POs</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(s)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="w-10 bg-slate-800 border border-slate-700 hover:border-red-500 hover:text-red-400 text-slate-400 flex items-center justify-center rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add / Edit Supplier Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
              <h2 className="text-xl font-bold text-white">{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Company Name <span className="text-red-400">*</span></label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-blue-500 outline-none" placeholder="e.g. AutoParts Lanka" />
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Contact Person</label>
                  <input type="text" value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-blue-500 outline-none" placeholder="Name of representative" />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Phone Number</label>
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-blue-500 outline-none" placeholder="011 234 5678" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Email Address</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-blue-500 outline-none" placeholder="sales@company.com" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Physical Address</label>
                <textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-blue-500 outline-none h-20 resize-none" placeholder="Full address..." />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Notes / Payment Terms</label>
                <input type="text" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-blue-500 outline-none" placeholder="e.g. Net 30, bulk discount available" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-800/50 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-slate-300 hover:text-white font-medium">Cancel</button>
              <button onClick={handleSave} disabled={!formData.name || saving} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium shadow-lg shadow-blue-500/20">
                {saving ? 'Saving…' : editingSupplier ? 'Update Supplier' : 'Save Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
