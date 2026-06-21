import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
  ArrayMinSize,
  IsArray,
} from 'class-validator';

class InvoiceItemDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsString()
  nameSnapshot: string;

  @IsNumber()
  @Min(0.001)
  qty: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tax?: number;

  @IsNumber()
  @Min(0)
  lineTotal: number;
}

class PaymentDto {
  @IsEnum(['CASH', 'CARD', 'TRANSFER', 'CHEQUE', 'CREDIT'])
  method: 'CASH' | 'CARD' | 'TRANSFER' | 'CHEQUE' | 'CREDIT';

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class CreateInvoiceDto {
  /** Client-generated UUID — guarantees idempotency on retry / offline sync. */
  @IsUUID(4)
  id: string;

  @IsString()
  outletId: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsNumber()
  @Min(0)
  subtotal: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tax?: number;

  @IsNumber()
  @Min(0)
  total: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentDto)
  payments: PaymentDto[];
}
