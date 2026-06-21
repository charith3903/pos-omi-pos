'use client';

import { useI18n } from '@/lib/i18n';
import { isoDate, thisMonthRange, thisWeekRange } from '@/lib/reports';

export interface DateRange {
  from: string;
  to: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (r: DateRange) => void;
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const { t } = useI18n();

  const presets = [
    { label: t('period.today'),  range: { from: isoDate(), to: isoDate() } },
    { label: t('period.week'),   range: thisWeekRange() },
    { label: t('period.month'),  range: thisMonthRange() },
  ];

  const isActive = (r: DateRange) => r.from === value.from && r.to === value.to;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((p) => (
        <button
          key={p.label}
          onClick={() => onChange(p.range)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            isActive(p.range)
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
          }`}
        >
          {p.label}
        </button>
      ))}

      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1">
        <span className="text-xs text-gray-400">{t('report.from')}</span>
        <input
          type="date"
          value={value.from}
          max={value.to}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          className="text-sm text-gray-700 border-none outline-none bg-transparent"
        />
        <span className="text-xs text-gray-400">–</span>
        <span className="text-xs text-gray-400">{t('report.to')}</span>
        <input
          type="date"
          value={value.to}
          min={value.from}
          max={isoDate()}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          className="text-sm text-gray-700 border-none outline-none bg-transparent"
        />
      </div>
    </div>
  );
}
