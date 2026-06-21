'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { getAccessToken } from '@/lib/auth';
import { reportApi } from '@/lib/reports';

interface ExportButtonProps {
  type: 'sales' | 'products' | 'stock' | 'customers';
  from: string;
  to: string;
  outletId?: string;
}

export default function ExportButton({ type, from, to, outletId }: ExportButtonProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  async function handleCsvExport() {
    setLoading(true);
    try {
      const url = reportApi.exportUrl(type, from, to, outletId);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1]
        ?? `${type}_report.csv`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      alert('Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="flex items-center gap-2 print:hidden">
      <button
        onClick={handleCsvExport}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:text-blue-600 transition-colors disabled:opacity-50"
      >
        <span>⬇</span>
        {loading ? '…' : t('report.export')}
      </button>
      <button
        onClick={handlePrint}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:text-blue-600 transition-colors"
      >
        <span>🖨</span>
        {t('report.print')}
      </button>
    </div>
  );
}
