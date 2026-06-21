'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { reportApi, type Outlet } from '@/lib/reports';

interface OutletSwitcherProps {
  value: string | undefined;
  onChange: (outletId: string | undefined) => void;
}

export default function OutletSwitcher({ value, onChange }: OutletSwitcherProps) {
  const { t } = useI18n();
  const [outlets, setOutlets] = useState<Outlet[]>([]);

  useEffect(() => {
    reportApi.getOutlets().then(setOutlets).catch(() => {});
  }, []);

  if (outlets.length <= 1) return null; // no switcher needed for single-outlet tenants

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 font-medium">{t('report.outlet')}:</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-blue-400"
      >
        <option value="">{t('report.allOutlets')}</option>
        {outlets.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </div>
  );
}
