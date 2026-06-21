import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

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

export class CreateRepairJobDto {
  @IsOptional()
  @IsString()
  customerId?: string;

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
  estimatedCost?: number;
}

export class UpdateRepairJobDto {
  @IsOptional()
  @IsEnum(['RECEIVED', 'DIAGNOSING', 'REPAIRING', 'READY', 'DELIVERED'])
  status?: string;

  @IsOptional()
  @IsString()
  technicianNotes?: string;

  @IsOptional()
  actualCost?: number;
}
