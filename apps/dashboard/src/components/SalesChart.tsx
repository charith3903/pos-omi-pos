'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fmtCurrency, fmtDate } from '@/lib/i18n';
import type { SalesDayRow } from '@/lib/reports';

interface SalesChartProps {
  data: SalesDayRow[];
  showProfit?: boolean;
}

const formatX = (v: string) => {
  if (!v) return '';
  // period key like "2024-W32" or "2024-08"
  if (v.includes('W')) return v;
  if (v.length === 7) return new Date(v + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
  return fmtDate(v);
};

const formatY = (v: number) =>
  v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000
    ? `${(v / 1_000).toFixed(0)}k`
    : String(v);

export default function SalesChart({ data, showProfit = true }: SalesChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No data for this period
      </div>
    );
  }

  const chartData = data.map((r) => ({
    label: r.date ?? r.period ?? '',
    sales: Number(r.totalSales),
    profit: Number(r.totalProfit),
    tax: Number(r.totalTax),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="label"
          tickFormatter={formatX}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatY}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            fmtCurrency(value),
            name === 'sales' ? 'Revenue' : name === 'profit' ? 'Profit' : 'Tax',
          ]}
          labelFormatter={(l) => formatX(l)}
          contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.08)' }}
          labelStyle={{ fontWeight: 600, fontSize: 12 }}
          itemStyle={{ fontSize: 12 }}
        />
        <Area
          type="monotone"
          dataKey="sales"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#gradSales)"
          dot={false}
          activeDot={{ r: 4, fill: '#3b82f6' }}
        />
        {showProfit && (
          <Area
            type="monotone"
            dataKey="profit"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#gradProfit)"
            dot={false}
            activeDot={{ r: 4, fill: '#10b981' }}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
