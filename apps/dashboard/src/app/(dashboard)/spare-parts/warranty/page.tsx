'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { ShieldCheck, Plus, Search, ShieldAlert, Shield, Search as SearchIcon } from 'lucide-react';

export default function WarrantyPage() {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');
  
  // Form State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProductName, setSelectedProductName] = useState('');
  const [serial, setSerial] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [issue, setIssue] = useState('');
  const [notes, setNotes] = useState('');

  const loadClaims = async () => {
    try {
      setLoading(true);
      const res = await api.getWarrantyClaims();
      setClaims(res || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClaims();
  }, []);

  useEffect(() => {
    if (productSearch.length > 2) {
      api.getProducts({ search: productSearch, limit: 10 }).then(res => setProducts(res.items || [])).catch(console.error);
    } else {
      setProducts([]);
    }
  }, [productSearch]);

  const handleProductSelect = (product: any) => {
    setSelectedProductId(product.id);
    setSelectedProductName(product.name);
    setProductSearch('');
  };

  const handleSubmit = async () => {
    if (!selectedProductId || !issue) return alert('Product and Issue description are required');
    try {
      await api.createWarrantyClaim({
        productId: selectedProductId,
        invoiceId: invoiceId || undefined,
        serial,
        issue,
        notes
      });
      setShowModal(false);
      setSelectedProductId('');
      setSelectedProductName('');
      setSerial('');
      setInvoiceId('');
      setIssue('');
      setNotes('');
      loadClaims();
    } catch (e) {
      alert('Error creating warranty claim');
    }
  };

  const filtered = claims.filter(c => 
    c.serial?.toLowerCase().includes(search.toLowerCase()) ||
    (c.product?.name && c.product.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-full bg-slate-900 text-slate-200 p-8 flex flex-col h-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-blue-400" /> Warranty Claims
          </h1>
          <p className="text-slate-400 text-sm">Track and manage product warranties and customer claims.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-2.5 rounded-lg font-semibold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> Log New Claim
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-center gap-4">
          <div className="bg-blue-500/20 p-4 rounded-full text-blue-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-1">Pending Claims</span>
            <span className="text-2xl font-bold text-white">{claims.filter(c => c.status === 'PENDING').length}</span>
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-center gap-4">
          <div className="bg-orange-500/20 p-4 rounded-full text-orange-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-1">Sent to Supplier</span>
            <span className="text-2xl font-bold text-white">{claims.filter(c => c.status === 'SENT_TO_SUPPLIER').length}</span>
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-center gap-4">
          <div className="bg-green-500/20 p-4 rounded-full text-green-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-1">Resolved</span>
            <span className="text-2xl font-bold text-white">{claims.filter(c => ['REPLACED', 'REFUNDED', 'REJECTED'].includes(c.status)).length}</span>
          </div>
        </div>
      </div>

      <div className="mb-6 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input 
          type="text" 
          placeholder="Search by serial number, IMEI or part name..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 transition-colors outline-none"
        />
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
              <th className="p-4 font-medium">Date</th>
              <th className="p-4 font-medium">Product</th>
              <th className="p-4 font-medium">Serial / IMEI</th>
              <th className="p-4 font-medium">Issue</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-slate-700/30 transition-colors">
                <td className="p-4 text-slate-300">{new Date(c.createdAt).toLocaleDateString()}</td>
                <td className="p-4 text-white font-medium">{c.product?.name || 'Unknown'}</td>
                <td className="p-4 text-slate-300 font-mono text-sm">{c.serial || 'N/A'}</td>
                <td className="p-4 text-slate-400 max-w-[200px] truncate">{c.issue}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    ['REPLACED', 'REFUNDED'].includes(c.status) ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                    c.status === 'REJECTED' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                    c.status === 'SENT_TO_SUPPLIER' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                    'bg-slate-700 text-slate-400 border border-slate-600'
                  }`}>
                    {c.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="p-4">
                  <select 
                    className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg px-2 py-1 outline-none focus:border-blue-500"
                    value={c.status}
                    onChange={(e) => {
                      api.updateWarrantyStatus(c.id, e.target.value).then(() => {
                        setClaims(claims.map(claim => claim.id === c.id ? { ...claim, status: e.target.value } : claim));
                      });
                    }}
                  >
                    <option value="PENDING">Pending</option>
                    <option value="SENT_TO_SUPPLIER">Sent to Supplier</option>
                    <option value="REPLACED">Replaced</option>
                    <option value="REFUNDED">Refunded</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">No warranty claims found.</td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">Loading...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Log Claim Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
              <h2 className="text-xl font-bold text-white">Log Warranty Claim</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-xl">&times;</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              
              <div>
                <label className="block text-sm text-slate-300 mb-1">Select Product <span className="text-red-400">*</span></label>
                {selectedProductId ? (
                  <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 flex justify-between items-center">
                    <span className="text-white font-medium">{selectedProductName}</span>
                    <button onClick={() => setSelectedProductId('')} className="text-slate-400 hover:text-white text-sm underline">Change</button>
                  </div>
                ) : (
                  <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input 
                      type="text" 
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm focus:border-blue-500 outline-none" 
                      placeholder="Search parts by name or SKU..." 
                    />
                    {products.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                        {products.map(p => (
                          <div 
                            key={p.id} 
                            className="px-4 py-2 hover:bg-slate-700 cursor-pointer flex justify-between items-center text-sm"
                            onClick={() => handleProductSelect(p)}
                          >
                            <span className="text-white">{p.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Serial Number / IMEI</label>
                  <input type="text" value={serial} onChange={(e) => setSerial(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-blue-500 outline-none" placeholder="Device or part serial..." />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Original Invoice ID</label>
                  <input type="text" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-blue-500 outline-none" placeholder="Optional" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">Issue Description <span className="text-red-400">*</span></label>
                <textarea value={issue} onChange={(e) => setIssue(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-blue-500 outline-none h-20 resize-none" placeholder="Describe the fault or defect..."></textarea>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">Internal Notes</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-blue-500 outline-none" placeholder="Optional notes" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-800/50 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-slate-300 hover:text-white font-medium">Cancel</button>
              <button 
                onClick={handleSubmit} 
                disabled={!selectedProductId || !issue} 
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium shadow-lg shadow-blue-500/20"
              >
                Log Claim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
