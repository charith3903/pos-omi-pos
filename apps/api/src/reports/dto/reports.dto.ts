import { IsEnum, IsISO8601, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class DateRangeDto {
  @IsISO8601()
  from: string;

  @IsISO8601()
  to: string;

  @IsOptional()
  @IsString()
  outletId?: string;
}

export class SalesReportDto extends DateRangeDto {
  @IsOptional()
  @IsEnum(['day', 'week', 'month'])
  groupBy?: 'day' | 'week' | 'month' = 'day';
}

export class TopProductsDto extends DateRangeDto {
  @IsOptional()
  @IsEnum(['revenue', 'qty', 'profit'])
  metric?: 'revenue' | 'qty' | 'profit' = 'revenue';

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

export class SlowMoversDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(1)
  days?: number = 30;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class TopCustomersDto extends DateRangeDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

export class ExportDto {
  @IsEnum(['sales', 'products', 'stock', 'customers'])
  type: 'sales' | 'products' | 'stock' | 'customers';

  @IsISO8601()
  from: string;

  @IsISO8601()
  to: string;

  @IsOptional()
  @IsEnum(['csv'])
  format?: 'csv' = 'csv';

  @IsOptional()
  @IsString()
  outletId?: string;
}

export class RefreshReportDto {
  /** ISO date string (YYYY-MM-DD). Defaults to yesterday if omitted. */
  @IsOptional()
  @IsISO8601()
  date?: string;

  /** Specific tenant to refresh. Defaults to caller's tenant. */
  @IsOptional()
  @IsString()
  tenantId?: string;
}
