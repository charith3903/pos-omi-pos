import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateRepairJobDto {
  @IsOptional()
  @IsString()
  outletId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  technicianId?: string;

  @IsString()
  deviceMake: string;

  @IsString()
  deviceModel: string;

  @IsOptional()
  @IsString()
  imei?: string;

  @IsString()
  issue: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedCost?: number;
}

export class UpdateRepairJobDto {
  @IsOptional()
  @IsEnum(['RECEIVED', 'DIAGNOSING', 'REPAIRING', 'READY', 'DELIVERED', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsString()
  technicianNotes?: string;

  @IsOptional()
  @IsString()
  technicianId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  laborCharge?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedCost?: number;
}

export class AddRepairPartDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsNumber()
  @Min(0.001)
  qty: number;

  /** Defaults to the product/variant's own price when omitted. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}

class RepairPaymentDto {
  @IsEnum(['CASH', 'CARD', 'TRANSFER', 'CHEQUE', 'CREDIT'])
  method: 'CASH' | 'CARD' | 'TRANSFER' | 'CHEQUE' | 'CREDIT';

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class CheckoutRepairJobDto {
  @IsString()
  outletId: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  /**
   * Whatever is currently in the labor-charge field, even if it hasn't been
   * separately saved yet — the bill charges what's on screen at the moment
   * "Charge" is pressed, not whatever was last persisted.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  laborCharge?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RepairPaymentDto)
  payments: RepairPaymentDto[];
}
