'use client';

import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeLabelProps {
  productName: string;
  variantLabel: string;
  price: string | number;
  barcode: string;
}

/** One printable garment label — barcode + product name/variant/price, sized for a common 50mm x 25mm label. */
export function BarcodeLabel({ productName, variantLabel, price, barcode }: BarcodeLabelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !barcode) return;
    try {
      JsBarcode(canvasRef.current, barcode, {
        format: 'CODE128',
        width: 1.5,
        height: 32,
        fontSize: 10,
        margin: 2,
        displayValue: true,
      });
    } catch {
      // Invalid barcode text (e.g. empty) — leave the canvas blank rather than crash the print sheet.
    }
  }, [barcode]);

  return (
    <div className="label-card border border-gray-300 rounded p-2 flex flex-col items-center justify-between w-[189px] h-[95px] break-inside-avoid">
      <p className="text-[10px] font-semibold text-gray-900 text-center leading-tight truncate w-full">{productName}</p>
      <p className="text-[9px] text-gray-600">{variantLabel}</p>
      {barcode ? (
        <canvas ref={canvasRef} />
      ) : (
        <p className="text-[9px] text-gray-400 italic">No barcode set</p>
      )}
      <p className="text-[11px] font-bold text-gray-900">LKR {Number(price).toFixed(2)}</p>
    </div>
  );
}
