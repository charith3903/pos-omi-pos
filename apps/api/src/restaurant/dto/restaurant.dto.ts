import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Tables ────────────────────────────────────────────────────────────────────

export class CreateTableDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsInt()
  capacity?: number;
}

export class UpdateTableStatusDto {
  @IsEnum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING'])
  status: string;
}

export class UpdateTableDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsInt()
  capacity?: number;
}

// ── Orders ───────────────────────────────────────────────────────────────────

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  tableId?: string;

  @IsOptional()
  @IsEnum(['DINE_IN', 'TAKEAWAY', 'DELIVERY'])
  orderType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  guestCount?: number;

  @IsOptional()
  @IsString()
  waiterId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CloseOrderDto {
  @IsEnum(['BILLED', 'PAID', 'VOID'])
  status: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;
}

export class ComplementaryDto {
  @IsBoolean()
  isComplementary: boolean;

  @IsOptional()
  @IsString()
  complementaryNote?: string;
}

export class DiscountDto {
  @IsNumber()
  @Min(0)
  discount: number;
}

// ── KOTs ─────────────────────────────────────────────────────────────────────

export class KotItemDto {
  @IsString()
  productId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  portion?: string;

  @IsOptional()
  @IsNumber()
  portionPrice?: number;

  @IsInt()
  @Min(1)
  qty: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modifiers?: string[];

  @IsOptional()
  @IsBoolean()
  isComplementary?: boolean;
}

export class CreateKotDto {
  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  tableId?: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsOptional()
  @IsEnum(['DINE_IN', 'TAKEAWAY', 'DELIVERY'])
  orderType?: string;

  @IsOptional()
  @IsString()
  kotNotes?: string;

  @IsOptional()
  @IsEnum(['KITCHEN', 'BAR'])
  station?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KotItemDto)
  items: KotItemDto[];
}

export class UpdateKotStatusDto {
  @IsEnum(['PENDING', 'COOKING', 'READY', 'DELIVERED', 'CANCELLED'])
  status: string;
}

// ── Bill Split ────────────────────────────────────────────────────────────────

export class SplitPartDto {
  @IsString()
  label: string;

  @IsArray()
  items: any[];

  @IsNumber()
  total: number;
}

export class CreateSplitDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SplitPartDto)
  parts: SplitPartDto[];
}
