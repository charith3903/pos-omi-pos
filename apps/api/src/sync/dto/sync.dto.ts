import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class SyncItemPaymentDto {
  @IsEnum(['CASH', 'CARD', 'TRANSFER', 'CHEQUE', 'CREDIT'])
  method: string;

  @IsNumber()
  amount: number;
}

export class SyncItemLineDto {
  @IsString()
  productId: string;

  @IsString()
  nameSnapshot: string;

  @IsNumber()
  qty: number;

  @IsNumber()
  unitPrice: number;

  @IsNumber()
  @IsOptional()
  discount?: number;

  @IsNumber()
  @IsOptional()
  tax?: number;

  @IsNumber()
  lineTotal: number;

  /**
   * Vertical-specific metadata attached by the client at billing time.
   *
   * MOBILE:  { imei: string, serial?: string, warrantyMonths?: number }
   * TEXTILE: { variantId?: string, size?: string, color?: string }
   */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class SyncInvoiceDataDto {
  @IsUUID()
  id: string;

  @IsString()
  outletId: string;

  @IsString()
  @IsOptional()
  customerId?: string;

  @IsNumber()
  subtotal: number;

  @IsNumber()
  @IsOptional()
  discount?: number;

  @IsNumber()
  @IsOptional()
  tax?: number;

  @IsNumber()
  total: number;

  @IsString()
  @IsOptional()
  createdAt?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncItemLineDto)
  items: SyncItemLineDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncItemPaymentDto)
  payments: SyncItemPaymentDto[];

  /**
   * Vertical-specific invoice-level metadata.
   *
   * RESTAURANT: { tableId?: string, orderType?: string, modifiers?: Record<productId, string[]> }
   * RENTAL:     { rentalAgreement?: { productId, rate, rateUnit, deposit, outAt, expectedInAt } }
   */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class SyncItemDto {
  @IsString()
  type: string; // 'invoice'

  @IsUUID()
  id: string;

  @IsObject()
  @ValidateNested()
  @Type(() => SyncInvoiceDataDto)
  data: SyncInvoiceDataDto;
}

export class SyncPushDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncItemDto)
  items: SyncItemDto[];

  @IsString()
  @IsOptional()
  deviceId?: string;
}
