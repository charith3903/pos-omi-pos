import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateRentalAgreementDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsNumber()
  @Min(0)
  rate: number;

  @IsEnum(['HOUR', 'DAY', 'WEEK', 'MONTH'])
  rateUnit: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deposit?: number;

  @IsString()
  outAt: string; // ISO date string

  @IsString()
  expectedInAt: string; // ISO date string

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReturnRentalDto {
  @IsString()
  actualInAt: string; // ISO date string
}

export class CheckAvailabilityDto {
  @IsString()
  productId: string;

  @IsString()
  from: string;

  @IsString()
  to: string;
}
