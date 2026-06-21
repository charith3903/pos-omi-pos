'use client';

import { fmtCurrency, fmtNum } from '@/lib/i18n';

interface KpiCardProps {
  label: string;
  value: number;
  format?: 'currency' | 'number';
  icon: string;
  color: 'blue' | 'green' | 'purple' | 'amber' | 'rose';
  trend?: number; // percentage change vs previous period
  sub?: string;   // secondary label
}

const COLOR_MAP = {
  blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-100 text-blue-600',   text: 'text-blue-700'   },
  green:  { bg: 'bg-green-50',  icon: 'bg-green-100 text-green-600', text: 'text-green-700'  },
  purple: { bg: 'bg-purple-50', icon: 'bg-purple-100 text-purple-600', text: 'text-purple-700'},
  amber:  { bg: 'bg-amber-50',  icon: 'bg-amber-100 text-amber-600', text: 'text-amber-700'  },
  rose:   { bg: 'bg-rose-50',   icon: 'bg-rose-100 text-rose-600',   text: 'text-rose-700'   },
};

export default function KpiCard({ label, value, format = 'currency', icon, color, trend, sub }: KpiCardProps) {
  const c = COLOR_MAP[color];
  const formatted = format === 'currency' ? fmtCurrency(value) : fmtNum(value, value % 1 !== 0 ? 1 : 0);

  return (
    <div className={`${c.bg} rounded-2xl p-5 flex flex-col gap-3 shadow-sm border border-white/60`}>
      <div className="flex items-start justify-between">
        <div className={`${c.icon} w-10 h-10 rounded-xl flex items-center justify-center text-xl`}>
          {icon}
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            trend >= 0
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold ${c.text} mt-0.5 leading-tight`}>{formatted}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
