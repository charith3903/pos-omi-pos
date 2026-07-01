'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { UtensilsCrossed, Table2, ChefHat, ShoppingBag, TrendingUp, Users, Clock, Star, ArrowRight, Activity, Wine } from 'lucide-react';

export default function RestaurantDashboard() {
  const [tables, setTables] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [kots, setKots] = useState<any[]>([]);
  const [shift, setShift] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getTables().catch(() => []),
      api.getOrders('OPEN').catch(() => []),
      api.getKots({ status: 'PENDING' }).catch(() => []),
      api.getCurrentShift().catch(() => null),
    ]).then(([t, o, k, s]) => {
      setTables(t as any[]);
      setOrders(o as any[]);
      setKots(k as any[]);
      setShift(s);
      setLoading(false);
    });
  }, []);

  const occupied = tables.filter(t => t.status === 'OCCUPIED').length;
  const available = tables.filter(t => t.status === 'AVAILABLE').length;
  const pendingKots = kots.length;

  const quickLinks = [
    { href: '/restaurant/floor', icon: <Table2 className="w-6 h-6" />, label: 'Floor Plan', desc: 'Manage tables & orders', color: 'bg-blue-500' },
    { href: '/billing', icon: <ShoppingBag className="w-6 h-6" />, label: 'POS / Order', desc: 'Take new orders', color: 'bg-green-500' },
    { href: '/restaurant/kitchen', icon: <ChefHat className="w-6 h-6" />, label: 'Kitchen (KDS)', desc: 'Live KOT display', color: 'bg-orange-500' },
    { href: '/restaurant/bar', icon: <Wine className="w-6 h-6" />, label: 'Bar (BOT)', desc: 'Live BOT display', color: 'bg-cyan-500' },
    { href: '/products', icon: <UtensilsCrossed className="w-6 h-6" />, label: 'Food Menu', desc: 'Manage items & portions', color: 'bg-purple-500' },
    { href: '/restaurant/loyalty', icon: <Star className="w-6 h-6" />, label: 'Loyalty', desc: 'Points & rewards', color: 'bg-amber-500' },
    { href: '/restaurant/shift', icon: <Clock className="w-6 h-6" />, label: 'Shift', desc: shift ? `Shift open` : 'Open shift', color: shift ? 'bg-emerald-500' : 'bg-gray-400' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Restaurant Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {shift ? (
              <span className="text-emerald-600 font-medium">● Shift open since {new Date(shift.openedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
            ) : (
              <span className="text-red-500 font-medium">● No shift open — <Link href="/restaurant/shift" className="underline">open shift</Link></span>
            )}
          </p>
        </div>
        <Link href="/billing" className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
          <ShoppingBag className="w-4 h-4" /> New Order
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Tables Occupied', value: occupied, total: tables.length, icon: <Table2 className="w-5 h-5" />, color: 'text-blue-600 bg-blue-50' },
          { label: 'Tables Available', value: available, total: tables.length, icon: <Activity className="w-5 h-5" />, color: 'text-green-600 bg-green-50' },
          { label: 'Open Orders', value: orders.length, icon: <ShoppingBag className="w-5 h-5" />, color: 'text-purple-600 bg-purple-50' },
          { label: 'Pending KOTs', value: pendingKots, icon: <ChefHat className="w-5 h-5" />, color: pendingKots > 0 ? 'text-orange-600 bg-orange-50' : 'text-gray-500 bg-gray-50' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className={`p-2.5 rounded-xl ${kpi.color}`}>{kpi.icon}</div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {kpi.value}{kpi.total != null ? <span className="text-base font-normal text-gray-400">/{kpi.total}</span> : ''}
              </div>
              <div className="text-xs text-gray-500">{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {quickLinks.map(l => (
          <Link key={l.href} href={l.href} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all group">
            <div className={`p-3 rounded-xl text-white ${l.color} group-hover:scale-110 transition-transform`}>{l.icon}</div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900">{l.label}</div>
              <div className="text-xs text-gray-500">{l.desc}</div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
          </Link>
        ))}
      </div>

      {/* Live Orders */}
      {orders.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Open Orders</h2>
            <Link href="/restaurant/floor" className="text-xs text-blue-600 hover:underline">View floor →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {orders.slice(0, 6).map((o: any) => (
              <div key={o.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 text-xs font-bold">
                    {o.table?.name?.replace('Table ', 'T') ?? o.orderType?.[0] ?? 'T'}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{o.orderNumber}</div>
                    <div className="text-xs text-gray-500">{o.table?.name ?? o.orderType} · {o.guestCount} guests</div>
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  {Math.round((Date.now() - new Date(o.openedAt).getTime()) / 60000)}m ago
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
