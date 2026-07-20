import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SENT_TO_SUPPLIER', 'REPLACED', 'REFUNDED'] as const;
export type WarrantyClaimStatusKey = (typeof STATUSES)[number];

export class CreateWarrantyClaimDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @IsOptional()
  @IsString()
  serial?: string;

  @IsString()
  issue: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateWarrantyClaimStatusDto {
  @IsEnum(STATUSES)
  status: WarrantyClaimStatusKey;
}

export class ListWarrantyClaimsQueryDto {
  @IsOptional()
  @IsEnum(STATUSES)
  status?: WarrantyClaimStatusKey;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
