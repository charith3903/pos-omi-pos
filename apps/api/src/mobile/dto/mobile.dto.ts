import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class RecordImeiDto {
  @IsString()
  productId: string;

  @IsString()
  imei: string;

  @IsOptional()
  @IsString()
  serial?: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  warrantyMonths?: number;
}
