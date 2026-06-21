'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { FileSpreadsheet, Plus, Search, FileText, Trash2, Search as SearchIcon } from 'lucide-react';

export default function PurchaseOrdersPage() {
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');
  
  // Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<any[]>([]); // { productId, name, qty, unitPrice }

  const loadPOs = async () => {
    try {
      setLoading(true);
      const res = await api.getPurchaseOrders();
      setPos(res || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPOs();
    api.getSuppliers().then(res => setSuppliers(res || [])).catch(console.error);
  }, []);

  useEffect(() => {
    if (productSearch.length > 2) {
      api.getProducts({ search: productSearch, limit: 10 }).then(res => setProducts(res.items || [])).catch(console.error);
    } else {
      setProducts([]);
    }
  }, [productSearch]);

  const handleAddItem = (product: any) => {
    if (items.find(i => i.productId === product.id)) return;
    setItems([...items, { productId: product.id, name: product.name, qty: 1, unitPrice: product.cost || 0 }]);
    setProductSearch('');
  };

  const handleRemoveItem = (productId: string) => {
    setItems(items.filter(i => i.productId !== productId));
  };

  const handleItemChange = (productId: string, field: string, value: string) => {
    setItems(items.map(i => {
      if (i.productId === productId) {
        return { ...i, [field]: Number(value) };
      }
      return i;
    }));
  };

  const handleSubmit = async () => {
    if (!selectedSupplierId || items.length === 0) return alert('Select a supplier and add at least one item');
    try {
      await api.createPurchaseOrder({
        supplierId: selectedSupplierId,
        notes,
        items
      });
      setShowModal(false);
      setSelectedSupplierId('');
      setNotes('');
      setItems([]);
      loadPOs();
    } catch (e) {
      alert('Error creating PO');
    }
  };

  const filtered = pos.filter(po => 
    po.number.toLowerCase().includes(search.toLowerCase()) ||
    (po.supplier?.name && po.supplier.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-full bg-slate-900 text-slate-200 p-8 flex flex-col h-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-blue-400" /> Purchase Orders
          </h1>
          <p className="text-slate-400 text-sm">Create and manage POs to your suppliers.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-2.5 rounded-lg font-semibold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> New PO
        </button>
      </div>

      <div className="mb-6 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input 
          type="text" 
          placeholder="Search by PO number or supplier..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 transition-colors outline-none"
        />
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
              <th className="p-4 font-medium">PO Number</th>
              <th className="p-4 font-medium">Date</th>
              <th className="p-4 font-medium">Supplier</th>
              <th className="p-4 font-medium">Total Amount</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filtered.map(po => (
              <tr key={po.id} className="hover:bg-slate-700/30 transition-colors">
                <td className="p-4 text-white font-medium">{po.number}</td>
                <td className="p-4 text-slate-300">{new Date(po.createdAt).toLocaleDateString()}</td>
                <td className="p-4 text-slate-300">{po.supplier?.name || 'Unknown Supplier'}</td>
                <td className="p-4 text-slate-300">Rs. {Number(po.total).toFixed(2)}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 w-max ${
                    po.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                    po.status === 'SENT' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    'bg-slate-700 text-slate-400 border border-slate-600'
                  }`}>
                    {po.status}
                  </span>
                </td>
                <td className="p-4">
                  <button className="text-blue-400 hover:text-blue-300 font-medium text-sm flex items-center gap-1.5 transition-colors">
                    <FileText className="w-4 h-4" /> View
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">No purchase orders found.</td>
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
              <h2 className="text-xl font-bold text-white">Create Purchase Order</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-xl">&times;</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Select Supplier <span className="text-red-400">*</span></label>
                  <select 
                    value={selectedSupplierId} 
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-blue-500 outline-none"
                  >
                    <option value="">-- Select a Supplier --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Notes</label>
                  <input 
                    type="text" 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-blue-500 outline-none" 
                    placeholder="Delivery instructions, etc." 
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">Add Parts</label>
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
                          onClick={() => handleAddItem(p)}
                        >
                          <span className="text-white">{p.name}</span>
                          <span className="text-slate-400 text-xs">Cost: Rs. {p.cost || 0}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {items.length > 0 && (
                <div className="border border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700">
                        <th className="p-3 font-medium">Part Name</th>
                        <th className="p-3 font-medium w-32">Unit Cost (Rs)</th>
                        <th className="p-3 font-medium w-24">Qty</th>
                        <th className="p-3 font-medium w-32">Total</th>
                        <th className="p-3 font-medium w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {items.map(item => (
                        <tr key={item.productId} className="bg-slate-800 text-sm">
                          <td className="p-3 text-white">{item.name}</td>
                          <td className="p-3">
                            <input 
                              type="number" 
                              value={item.unitPrice} 
                              onChange={(e) => handleItemChange(item.productId, 'unitPrice', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 outline-none focus:border-blue-500 text-white" 
                            />
                          </td>
                          <td className="p-3">
                            <input 
                              type="number" 
                              min="1"
                              value={item.qty} 
                              onChange={(e) => handleItemChange(item.productId, 'qty', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 outline-none focus:border-blue-500 text-white" 
                            />
                          </td>
                          <td className="p-3 text-slate-300 font-medium">Rs. {(item.qty * item.unitPrice).toFixed(2)}</td>
                          <td className="p-3">
                            <button onClick={() => handleRemoveItem(item.productId)} className="text-slate-500 hover:text-red-400">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-900/30">
                        <td colSpan={3} className="p-3 text-right text-slate-400 font-medium">Grand Total:</td>
                        <td className="p-3 text-white font-bold text-lg">
                          Rs. {items.reduce((sum, i) => sum + (i.qty * i.unitPrice), 0).toFixed(2)}
                        </td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

            </div>
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-800/50 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-slate-300 hover:text-white font-medium">Cancel</button>
              <button 
                onClick={handleSubmit} 
                disabled={!selectedSupplierId || items.length === 0} 
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium shadow-lg shadow-blue-500/20"
              >
                Create PO
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
