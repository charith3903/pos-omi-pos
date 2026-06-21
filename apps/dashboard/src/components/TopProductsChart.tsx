'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fmtCurrency, fmtNum } from '@/lib/i18n';
import type { TopProductRow } from '@/lib/reports';

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'];

interface TopProductsChartProps {
  data: TopProductRow[];
  metric: 'revenue' | 'qty' | 'profit';
}

export default function TopProductsChart({ data, metric }: TopProductsChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No data for this period
      </div>
    );
  }

  const chartData = data.slice(0, 10).map((r) => ({
    name: r.productName.length > 18 ? r.productName.slice(0, 17) + '…' : r.productName,
    fullName: r.productName,
    value: metric === 'qty' ? r.qtySold : metric === 'profit' ? r.profit : r.revenue,
  }));

  const isCurrency = metric !== 'qty';

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
        <XAxis
          type="number"
          tickFormatter={(v) => (isCurrency ? (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)) : fmtNum(v))}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fontSize: 11, fill: '#374151' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(v: number) => [isCurrency ? fmtCurrency(v) : fmtNum(v, 1), metric === 'qty' ? 'Qty Sold' : metric === 'profit' ? 'Profit' : 'Revenue']}
          labelFormatter={(_, p) => p?.[0]?.payload?.fullName ?? ''}
          contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.08)' }}
          labelStyle={{ fontWeight: 600, fontSize: 12 }}
          itemStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
