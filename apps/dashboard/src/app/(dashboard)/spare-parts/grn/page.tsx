'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Truck, Plus, Search, CheckCircle, Trash2, Search as SearchIcon } from 'lucide-react';

export default function GrnPage() {
  const [grns, setGrns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [pos, setPos] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');
  
  // Form State
  const [selectedPoId, setSelectedPoId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<any[]>([]); // { productId, name, qty }

  const loadGRNs = async () => {
    try {
      setLoading(true);
      const res = await api.getGrns();
      setGrns(res || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGRNs();
    api.getPurchaseOrders()
      .then(res => {
        // Only pending POs
        setPos((res || []).filter((po: any) => po.status !== 'COMPLETED'));
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (productSearch.length > 2) {
      api.getProducts({ search: productSearch, limit: 10 }).then(res => setProducts(res.items || [])).catch(console.error);
    } else {
      setProducts([]);
    }
  }, [productSearch]);

  const handlePoSelect = (poId: string) => {
    setSelectedPoId(poId);
    if (!poId) return setItems([]);
    
    const po = pos.find(p => p.id === poId);
    if (po && po.items) {
      setItems(po.items.map((i: any) => ({
        productId: i.productId,
        name: i.product?.name || 'Unknown Part',
        qty: i.qty
      })));
    }
  };

  const handleAddItem = (product: any) => {
    if (items.find(i => i.productId === product.id)) return;
    setItems([...items, { productId: product.id, name: product.name, qty: 1 }]);
    setProductSearch('');
  };

  const handleRemoveItem = (productId: string) => {
    setItems(items.filter(i => i.productId !== productId));
  };

  const handleItemChange = (productId: string, value: string) => {
    setItems(items.map(i => {
      if (i.productId === productId) {
        return { ...i, qty: Number(value) };
      }
      return i;
    }));
  };

  const handleSubmit = async () => {
    if (items.length === 0) return alert('Add at least one item');
    try {
      await api.createGrn({
        poId: selectedPoId || undefined,
        notes,
        items
      });
      setShowModal(false);
      setSelectedPoId('');
      setNotes('');
      setItems([]);
      loadGRNs();
      
      // Update PO list to remove completed ones
      const resPos = await api.getPurchaseOrders();
      setPos((resPos || []).filter((po: any) => po.status !== 'COMPLETED'));
      
    } catch (e) {
      alert('Error creating GRN');
    }
  };

  const filtered = grns.filter(g => 
    g.number.toLowerCase().includes(search.toLowerCase()) ||
    (g.po?.number && g.po.number.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-full bg-slate-900 text-slate-200 p-8 flex flex-col h-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Truck className="w-8 h-8 text-green-400" /> Goods Received Notes
          </h1>
          <p className="text-slate-400 text-sm">Receive stock against POs and update inventory immediately.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-6 py-2.5 rounded-lg font-semibold shadow-lg shadow-green-500/20 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> Receive Goods
        </button>
      </div>

      <div className="mb-6 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input 
          type="text" 
          placeholder="Search by GRN or PO number..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 transition-colors outline-none"
        />
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
              <th className="p-4 font-medium">GRN Number</th>
              <th className="p-4 font-medium">Date</th>
              <th className="p-4 font-medium">Linked PO</th>
              <th className="p-4 font-medium">Items Received</th>
              <th className="p-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filtered.map(g => (
              <tr key={g.id} className="hover:bg-slate-700/30 transition-colors">
                <td className="p-4 text-white font-medium">{g.number}</td>
                <td className="p-4 text-slate-300">{new Date(g.createdAt).toLocaleDateString()}</td>
                <td className="p-4 text-blue-400">{g.po?.number || 'N/A'}</td>
                <td className="p-4 text-slate-300">{g.items?.length || 0}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 w-max ${
                    g.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                    'bg-slate-700 text-slate-400 border border-slate-600'
                  }`}>
                    {g.status === 'COMPLETED' && <CheckCircle className="w-3.5 h-3.5" />} {g.status}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">No goods received notes found.</td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">Loading...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
              <h2 className="text-xl font-bold text-white">Receive Goods</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-xl">&times;</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Link to PO (Optional)</label>
                  <select 
                    value={selectedPoId} 
                    onChange={(e) => handlePoSelect(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-blue-500 outline-none"
                  >
                    <option value="">-- No PO (Manual Receive) --</option>
                    {pos.map(p => (
                      <option key={p.id} value={p.id}>{p.number} ({p.supplier?.name})</option>
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
                    placeholder="Delivery notes, vehicle number, etc." 
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">Received Items</label>
                {!selectedPoId && (
                  <div className="relative mb-4">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input 
                      type="text" 
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm focus:border-blue-500 outline-none" 
                      placeholder="Search parts by name or SKU to add..." 
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
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {items.length > 0 ? (
                  <div className="border border-slate-700 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700">
                          <th className="p-3 font-medium">Part Name</th>
                          <th className="p-3 font-medium w-32">Qty Received</th>
                          {!selectedPoId && <th className="p-3 font-medium w-16"></th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/50">
                        {items.map(item => (
                          <tr key={item.productId} className="bg-slate-800 text-sm">
                            <td className="p-3 text-white">{item.name}</td>
                            <td className="p-3">
                              <input 
                                type="number" 
                                min="1"
                                value={item.qty} 
                                onChange={(e) => handleItemChange(item.productId, e.target.value)}
                                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 outline-none focus:border-blue-500 text-white" 
                              />
                            </td>
                            {!selectedPoId && (
                              <td className="p-3">
                                <button onClick={() => handleRemoveItem(item.productId)} className="text-slate-500 hover:text-red-400">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 border border-dashed border-slate-700 rounded-xl text-center text-slate-500">
                    No items selected. Select a PO or search for products above.
                  </div>
                )}
              </div>

            </div>
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-800/50 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-slate-300 hover:text-white font-medium">Cancel</button>
              <button 
                onClick={handleSubmit} 
                disabled={items.length === 0} 
                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium shadow-lg shadow-green-500/20"
              >
                Complete GRN (Update Stock)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
