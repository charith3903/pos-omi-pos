import {
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateTableDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}

export class UpdateTableStatusDto {
  @IsEnum(['AVAILABLE', 'OCCUPIED', 'RESERVED'])
  status: string;
}

export class KotItemDto {
  @IsString()
  productId: string;

  @IsString()
  name: string;

  @IsInt()
  @Min(1)
  qty: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modifiers?: string[];
}

export class CreateKotDto {
  @IsOptional()
  @IsString()
  tableId?: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsEnum(['DINE_IN', 'TAKEAWAY', 'DELIVERY'])
  orderType: string;

  @IsArray()
  @IsObject({ each: true })
  items: KotItemDto[];
}

export class UpdateKotStatusDto {
  @IsEnum(['PENDING', 'SENT', 'DONE', 'CANCELLED'])
  status: string;
}
