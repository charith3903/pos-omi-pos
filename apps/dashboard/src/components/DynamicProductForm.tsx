'use client';

import type { VerticalField, VerticalPack } from '@omnipos/types';

interface Props {
  pack: VerticalPack;
  attributes: Record<string, unknown>;
  onChange: (attrs: Record<string, unknown>) => void;
  errors?: Record<string, string>;
}

export function DynamicProductForm({ pack, attributes, onChange, errors = {} }: Props) {
  if (pack.productFields.length === 0) return null;

  function set(key: string, value: unknown) {
    onChange({ ...attributes, [key]: value });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
        {pack.labels.product} Details
      </p>
      <div className="grid grid-cols-2 gap-4">
        {[...pack.productFields]
          .sort((a, b) => a.position - b.position)
          .map((field) => (
            <FieldInput
              key={field.key}
              field={field}
              value={attributes[field.key]}
              error={errors[field.key]}
              onChange={(v) => set(field.key, v)}
            />
          ))}
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: VerticalField;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
}) {
  const base =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';
  const err = error ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : '';

  switch (field.type) {
    case 'select':
      return (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">
            {field.label}
            {field.required && <span className="ml-1 text-red-500">*</span>}
          </span>
          <select
            className={`${base} ${err}`}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value || undefined)}
          >
            <option value="">— Select —</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </label>
      );

    case 'boolean':
      return (
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-primary-600"
            checked={value === true || value === 'true'}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="text-sm font-medium text-gray-700">{field.label}</span>
        </label>
      );

    case 'number':
      return (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">
            {field.label}
            {field.required && <span className="ml-1 text-red-500">*</span>}
          </span>
          <input
            type="number"
            className={`${base} ${err}`}
            placeholder={field.placeholder}
            value={value === undefined || value === null ? '' : String(value)}
            onChange={(e) =>
              onChange(e.target.value === '' ? undefined : Number(e.target.value))
            }
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </label>
      );

    default:
      return (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">
            {field.label}
            {field.required && <span className="ml-1 text-red-500">*</span>}
          </span>
          <input
            type="text"
            className={`${base} ${err}`}
            placeholder={field.placeholder}
            value={value === undefined || value === null ? '' : String(value)}
            onChange={(e) => onChange(e.target.value || undefined)}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </label>
      );
  }
}
