'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  Search, Plus, Minus, X, Send, FileText, Star, Printer,
  ChevronRight, Loader2, AlertCircle, CheckCircle, Gift,
  SplitSquareHorizontal, Zap, Clock
} from 'lucide-react';

interface CartItem { productId: string; name: string; portion: string; portionPrice: number; qty: number; notes: string; isComplementary: boolean; modifiers: string[]; stations: string[] }
interface Product { id: string; name: string; price: number; categoryId?: string; category?: { name: string }; attributes?: any }
interface Category { id: string; name: string }

const PORTION_LABELS = ['Full', 'Half', 'Quarter'];

export default function RestaurantPOS() {
  const sp = useSearchParams();
  const router = useRouter();
  const orderId = sp.get('orderId');
  const tableId = sp.get('tableId');

  const [order, setOrder] = useState<any | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedPortion, setSelectedPortion] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [firingKot, setFiringKot] = useState(false);
  const [billing, setBilling] = useState(false);
  const [bill, setBill] = useState<any | null>(null);
  const [showBill, setShowBill] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [splitCount, setSplitCount] = useState(2);
  const [complementary, setComplementary] = useState(false);
  const [compNote, setCompNote] = useState('');
  const [discount, setDiscount] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState<number | null>(null);
  const [redeemPoints, setRedeemPoints] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prods, cats, ord] = await Promise.all([
        api.getProducts({ limit: 200 }).then(r => r.items),
        api.getCategories(),
        orderId ? api.getOrder(orderId) : Promise.resolve(null),
      ]);
      setProducts(prods as Product[]);
      setCategories(cats as Category[]);
      setOrder(ord);
    } finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Search customers for loyalty
  useEffect(() => {
    if (!customerSearch.trim()) { setCustomers([]); return; }
    const t = setTimeout(async () => {
      try { setCustomers(await api.getCustomers(customerSearch)); } catch { setCustomers([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [customerSearch]);

  async function selectCustomer(c: any) {
    setSelectedCustomer(c);
    setCustomers([]);
    setCustomerSearch(c.name);
    try {
      const acc = await api.getLoyaltyAccount(c.id);
      setLoyaltyPoints(acc.points);
    } catch { setLoyaltyPoints(0); }
  }

  function getPortionPrice(product: Product, portion: string): number {
    const portions = product.attributes?.portions as any[] | undefined;
    if (portions?.length) {
      const p = portions.find((x: any) => x.label === portion);
      if (p) return Number(p.price);
    }
    return Number(product.price);
  }

  // Portion buttons only render for genuinely portion-based items — single
  // items and meal combos each get one fixed-price line, no guessed splits.
  function getProductPortions(product: Product): { label: string; price: number }[] {
    const attrs = product.attributes ?? {};
    if (attrs.itemType === 'PORTION' && attrs.portions?.length) {
      return attrs.portions.map((p: any) => ({ label: p.label, price: Number(p.price) }));
    }
    return [{ label: attrs.itemType === 'MEAL' ? 'Meal' : 'Full', price: Number(product.price) }];
  }

  function addToCart(product: Product) {
    const portion = selectedPortion[product.id] ?? getProductPortions(product)[0].label;
    const price = getPortionPrice(product, portion);
    const stations: string[] = product.attributes?.stations?.length ? product.attributes.stations : ['KITCHEN'];
    setCart(prev => {
      const existing = prev.findIndex(i => i.productId === product.id && i.portion === portion);
      if (existing >= 0) {
        return prev.map((i, idx) => idx === existing ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { productId: product.id, name: product.name, portion, portionPrice: price, qty: 1, notes: '', isComplementary: false, modifiers: [], stations }];
    });
  }

  function updateCartItem(idx: number, updates: Partial<CartItem>) {
    setCart(prev => prev.map((i, n) => n === idx ? { ...i, ...updates } : i));
  }

  function removeItem(idx: number) { setCart(prev => prev.filter((_, n) => n !== idx)); }

  // Fire a single order: items tagged KITCHEN go to a KOT ticket, items
  // tagged BAR go to a separate BOT ticket — an item can go to both.
  async function fireKot() {
    if (!cart.length) return;
    setFiringKot(true);
    try {
      const toItemDto = (i: CartItem) => ({
        productId: i.productId, name: i.name, portion: i.portion,
        portionPrice: i.portionPrice, qty: i.qty, notes: i.notes || undefined,
        isComplementary: i.isComplementary, modifiers: i.modifiers,
      });

      const kotItems = cart.filter(i => i.stations.includes('KITCHEN'));
      const botItems = cart.filter(i => i.stations.includes('BAR'));

      let activeOrderId = orderId ?? undefined;
      const sent: string[] = [];

      if (kotItems.length) {
        const kot = await api.createKot({
          orderId: activeOrderId, tableId: tableId ?? undefined, orderType: 'DINE_IN',
          station: 'KITCHEN', items: kotItems.map(toItemDto),
        });
        activeOrderId = activeOrderId ?? kot.orderId ?? undefined;
        sent.push(`${kotItems.length} item(s) → KOT`);
      }
      if (botItems.length) {
        const bot = await api.createKot({
          orderId: activeOrderId, tableId: tableId ?? undefined, orderType: 'DINE_IN',
          station: 'BAR', items: botItems.map(toItemDto),
        });
        activeOrderId = activeOrderId ?? bot.orderId ?? undefined;
        sent.push(`${botItems.length} item(s) → BOT`);
      }

      setCart([]);
      showToast(sent.length ? `Fired: ${sent.join(' · ')}` : 'Order fired!');
      loadData();
    } catch (e: any) { showToast(e.message ?? 'Failed to fire order'); } finally { setFiringKot(false); }
  }

  async function loadBill() {
    if (!orderId) return;
    setBilling(true);
    try {
      const b = await api.getOrderBill(orderId);
      setBill(b);
      setShowBill(true);
    } finally { setBilling(false); }
  }

  async function applyComplementary() {
    if (!orderId) return;
    await api.setOrderComplementary(orderId, { isComplementary: complementary, complementaryNote: compNote });
    showToast(complementary ? 'Order marked as complementary' : 'Complementary removed');
    loadBill();
  }

  async function applyDiscount() {
    if (!orderId || !discount) return;
    await api.applyOrderDiscount(orderId, Number(discount));
    showToast(`Discount Rs ${discount} applied`);
    loadBill();
  }

  async function handleSplitBill() {
    if (!orderId || !bill) return;
    const totalNum = Number(bill.total);
    const perPerson = totalNum / splitCount;
    const parts = Array.from({ length: splitCount }, (_, i) => ({
      label: `Person ${i + 1}`,
      items: [],
      total: perPerson,
    }));
    await api.createSplit(orderId, { parts });
    showToast(`Bill split into ${splitCount} equal parts`);
    setShowSplit(false);
    loadBill();
  }

  const filteredProducts = products.filter(p => {
    const matchCat = selectedCat === 'ALL' || p.categoryId === selectedCat;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const cartTotal = cart.reduce((s, i) => s + i.portionPrice * i.qty, 0);
  const kotCount = order?.kots?.length ?? 0;

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading POS…</div>;
  }

  return (
    <div className="flex h-full">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      {/* LEFT: Menu */}
      <div className="flex flex-col w-[55%] border-r border-gray-200 bg-white">
        {/* Category Tabs */}
        <div className="flex gap-1 p-3 border-b border-gray-100 overflow-x-auto flex-shrink-0">
          <button onClick={() => setSelectedCat('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${selectedCat === 'ALL' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            All
          </button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setSelectedCat(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${selectedCat === c.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {c.name}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="p-3 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input ref={searchRef} placeholder="Search menu items…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filteredProducts.map(product => {
              const portions = getProductPortions(product);
              const curPortion = selectedPortion[product.id] ?? portions[0].label;
              const curPrice = getPortionPrice(product, curPortion);
              const isVeg = product.attributes?.is_vegetarian;
              const isMeal = product.attributes?.itemType === 'MEAL';
              return (
                <div key={product.id} className="bg-white border border-gray-100 rounded-xl p-3 hover:border-blue-200 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <div className="text-sm font-semibold text-gray-900 leading-tight truncate">{product.name}</div>
                        {isMeal && (
                          <span className="shrink-0 text-[9px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">MEAL</span>
                        )}
                      </div>
                      {isVeg != null && (
                        <div className={`inline-flex w-3.5 h-3.5 rounded-sm border-2 mt-0.5 items-center justify-center ${isVeg ? 'border-green-600' : 'border-red-600'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${isVeg ? 'bg-green-600' : 'bg-red-600'}`} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Portion selector */}
                  {portions.length > 1 && (
                    <div className="flex gap-1 mb-2">
                      {portions.map(p => (
                        <button key={p.label}
                          onClick={() => setSelectedPortion(prev => ({ ...prev, [product.id]: p.label }))}
                          className={`flex-1 py-0.5 text-[10px] font-semibold rounded transition-colors ${curPortion === p.label ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm font-bold text-gray-900">Rs {curPrice.toLocaleString()}</span>
                    <button onClick={() => addToCart(product)}
                      className="w-7 h-7 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {filteredProducts.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">No items found</div>
          )}
        </div>
      </div>

      {/* RIGHT: Order */}
      <div className="flex flex-col w-[45%] bg-gray-50">
        {/* Order Header */}
        <div className="bg-white border-b border-gray-100 p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-gray-900">
                {order ? order.orderNumber : tableId ? 'New Order' : 'Takeaway / Delivery'}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {order?.table?.name ?? (tableId ? `Table loading…` : 'No table')}
                {order && ` · ${order.guestCount} guests · ${kotCount} KOT${kotCount !== 1 ? 's' : ''}`}
              </div>
            </div>
            {kotCount > 0 && (
              <div className="flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-semibold">
                <Clock className="w-3 h-3" /> {kotCount} KOT
              </div>
            )}
          </div>

          {/* Customer / loyalty */}
          <div className="mt-3 relative">
            <div className="relative">
              <Star className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-400" />
              <input placeholder="Search customer for loyalty…" value={customerSearch}
                onChange={e => { setCustomerSearch(e.target.value); if (!e.target.value) { setSelectedCustomer(null); setLoyaltyPoints(null); } }}
                className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-blue-400" />
            </div>
            {customers.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {customers.slice(0, 4).map(c => (
                  <button key={c.id} onClick={() => selectCustomer(c)}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50 flex items-center justify-between">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-gray-400">{c.phone}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedCustomer && loyaltyPoints != null && (
              <div className="mt-1 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                <Star className="w-3 h-3" />
                <span>{selectedCustomer.name} · <strong>{loyaltyPoints} pts</strong></span>
                <input type="number" placeholder="Redeem pts" value={redeemPoints}
                  onChange={e => setRedeemPoints(e.target.value)}
                  className="ml-auto w-20 border border-amber-200 rounded px-1 py-0.5 text-xs focus:outline-none" />
              </div>
            )}
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-300">
              <AlertCircle className="w-8 h-8 mb-2" />
              <p className="text-sm">Cart is empty</p>
            </div>
          ) : cart.map((item, idx) => (
            <div key={idx} className={`bg-white rounded-xl border p-3 ${item.isComplementary ? 'border-green-200 bg-green-50' : 'border-gray-100'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="text-sm font-semibold text-gray-900 truncate">{item.name}</div>
                    {item.stations.map(s => (
                      <span key={s} className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        s === 'BAR' ? 'bg-cyan-100 text-cyan-700' : 'bg-orange-100 text-orange-700'}`}>
                        {s === 'BAR' ? 'BOT' : 'KOT'}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-blue-600 font-medium">{item.portion} · Rs {item.portionPrice.toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => updateCartItem(idx, { qty: Math.max(1, item.qty - 1) })}
                    className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center text-sm font-bold">{item.qty}</span>
                  <button onClick={() => updateCartItem(idx, { qty: item.qty + 1 })}
                    className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                    <Plus className="w-3 h-3" />
                  </button>
                  <button onClick={() => removeItem(idx)} className="w-6 h-6 text-red-400 hover:text-red-600 flex items-center justify-center ml-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <input placeholder="Special instructions…" value={item.notes}
                onChange={e => updateCartItem(idx, { notes: e.target.value })}
                className="mt-2 w-full text-xs border-none bg-gray-50 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300" />
              <div className="flex items-center gap-2 mt-1">
                <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={item.isComplementary} onChange={e => updateCartItem(idx, { isComplementary: e.target.checked })} className="w-3 h-3 accent-green-600" />
                  Comp
                </label>
                <span className="ml-auto text-xs font-bold text-gray-900">Rs {(item.portionPrice * item.qty).toLocaleString()}</span>
              </div>
            </div>
          ))}

          {/* Previous KOTs / BOTs */}
          {order?.kots?.length > 0 && (
            <div className="border-t border-gray-200 pt-2 mt-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Previous Tickets</p>
              {order.kots.map((kot: any) => (
                <div key={kot.id} className={`text-xs rounded-lg px-3 py-2 mb-1 flex items-center justify-between ${
                  kot.status === 'DELIVERED' ? 'bg-green-50 text-green-700' :
                  kot.status === 'READY' ? 'bg-blue-50 text-blue-700' :
                  kot.status === 'COOKING' ? 'bg-amber-50 text-amber-700' :
                  kot.status === 'CANCELLED' ? 'bg-gray-50 text-gray-400 line-through' :
                  'bg-orange-50 text-orange-700'}`}>
                  <span className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      kot.station === 'BAR' ? 'bg-cyan-100 text-cyan-700' : 'bg-orange-100 text-orange-700'}`}>
                      {kot.station === 'BAR' ? 'BOT' : 'KOT'}
                    </span>
                    {(kot.items as any[]).length} item(s) · {new Date(kot.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="font-semibold">{kot.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-white border-t border-gray-100 p-4 space-y-3 flex-shrink-0">
          {/* Discount */}
          <div className="flex gap-2">
            <input type="number" placeholder="Discount (Rs)" value={discount} onChange={e => setDiscount(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            <button onClick={applyDiscount} disabled={!discount || !orderId}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold disabled:opacity-40 transition-colors">
              Apply
            </button>
          </div>

          {/* Boss complementary */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={complementary} onChange={e => setComplementary(e.target.checked)} className="w-4 h-4 accent-green-600" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-900 flex items-center gap-1"><Gift className="w-4 h-4 text-green-600" /> Boss Complementary</div>
              <input placeholder="Reason…" value={compNote} onChange={e => setCompNote(e.target.value)}
                className={`mt-1 w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none ${!complementary ? 'opacity-40' : ''}`}
                disabled={!complementary} />
            </div>
            <button onClick={applyComplementary} disabled={!orderId}
              className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-xs font-semibold disabled:opacity-40">
              Set
            </button>
          </label>

          {/* Total */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-sm font-semibold text-gray-600">Cart Total</span>
            <span className="text-xl font-bold text-gray-900">Rs {cartTotal.toLocaleString()}</span>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={fireKot} disabled={cart.length === 0 || firingKot}
              className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-bold transition-colors">
              {firingKot ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              Fire Order
            </button>
            <button onClick={loadBill} disabled={billing || !orderId}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-bold transition-colors">
              {billing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              View Bill
            </button>
          </div>
          <button onClick={() => setShowSplit(true)} disabled={!orderId}
            className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-colors">
            <SplitSquareHorizontal className="w-4 h-4" /> Split Bill
          </button>
        </div>
      </div>

      {/* Bill Modal */}
      {showBill && bill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Order Bill — {bill.order?.orderNumber}</h2>
              <button onClick={() => setShowBill(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {bill.order?.isComplementary && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-xs px-3 py-2 rounded-xl flex items-center gap-2">
                  <Gift className="w-4 h-4" /> Complementary order
                  {bill.order.complementaryNote && ` — ${bill.order.complementaryNote}`}
                </div>
              )}
              {bill.items.map((item: any, i: number) => (
                <div key={i} className={`flex justify-between text-sm py-1.5 border-b border-gray-50 ${item.isComplementary ? 'text-green-600' : ''}`}>
                  <div>
                    <span className="font-medium">{item.name}</span>
                    <span className="text-gray-400 text-xs ml-2">{item.portion}</span>
                    <span className="text-gray-400 text-xs ml-1">×{item.qty}</span>
                    {item.isComplementary && <span className="ml-2 text-xs">(Comp)</span>}
                  </div>
                  <span className="font-semibold">{item.isComplementary ? 'Rs 0' : `Rs ${(Number(item.portionPrice) * item.qty).toLocaleString()}`}</span>
                </div>
              ))}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span>Rs {Number(bill.subtotal).toLocaleString()}</span></div>
                {Number(bill.discount) > 0 && <div className="flex justify-between text-sm text-red-600"><span>Discount</span><span>- Rs {Number(bill.discount).toLocaleString()}</span></div>}
                {Number(bill.tax) > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">Tax</span><span>Rs {Number(bill.tax).toLocaleString()}</span></div>}
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200"><span>Total</span><span>Rs {Number(bill.total).toLocaleString()}</span></div>
              </div>

              {/* Split parts */}
              {bill.order?.splitBills?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Split Bills</p>
                  {bill.order.splitBills.map((s: any) => (
                    <div key={s.id} className={`flex items-center justify-between text-sm py-2 border-b border-gray-50 ${s.paid ? 'opacity-50' : ''}`}>
                      <span className="font-medium">{s.label}</span>
                      <div className="flex items-center gap-2">
                        <span>Rs {Number(s.total).toLocaleString()}</span>
                        {!s.paid && (
                          <button onClick={async () => { await api.markSplitPaid(s.id); loadBill(); }}
                            className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Paid</button>
                        )}
                        {s.paid && <span className="text-xs text-green-600 font-semibold">✓ Paid</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-3">
              <button onClick={async () => {
                if (!orderId) return;
                await api.closeOrder(orderId, { status: 'PAID' });
                if (selectedCustomer) {
                  await api.earnPoints(selectedCustomer.id, Number(bill.total), orderId).catch(() => {});
                  if (redeemPoints) await api.redeemPoints(selectedCustomer.id, Number(redeemPoints), orderId).catch(() => {});
                }
                showToast('Order closed successfully!');
                setShowBill(false);
                router.push('/restaurant/floor');
              }} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl text-sm font-bold">
                Mark Paid & Close
              </button>
              <button onClick={() => setShowBill(false)} className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Split Modal */}
      {showSplit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 space-y-4">
            <h2 className="font-bold text-gray-900">Split Bill Equally</h2>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Number of people</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setSplitCount(Math.max(2, splitCount - 1))} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><Minus className="w-4 h-4" /></button>
                <span className="text-2xl font-bold w-8 text-center">{splitCount}</span>
                <button onClick={() => setSplitCount(Math.min(12, splitCount + 1))} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowSplit(false)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold">Cancel</button>
              <button onClick={handleSplitBill} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold">Split</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
