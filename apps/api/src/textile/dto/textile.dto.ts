import { IsArray, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class GenerateVariantsDto {
  @IsString()
  productId: string;

  /** Size options — e.g. ['XS','S','M','L','XL','XXL'] */
  @IsArray()
  @IsString({ each: true })
  sizes: string[];

  /** Colour options — e.g. ['Black','White','Navy'] */
  @IsArray()
  @IsString({ each: true })
  colors: string[];

  /**
   * Optional barcode prefix. Generated barcodes will be:
   * `{prefix}-{SIZE}-{COLOR}`.  If omitted no barcode is set.
   */
  @IsOptional()
  @IsString()
  barcodePrefix?: string;
}

export class ExchangeVariantDto {
  /** The InvoiceItem being exchanged — must already carry a variantId. */
  @IsString()
  invoiceItemId: string;

  /** The variant the customer is taking instead — must be the same product. */
  @IsString()
  toVariantId: string;

  @IsNumber()
  @IsPositive()
  qty: number;
}
