import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class RefundItemDto {
  @IsString()
  invoiceItemId: string;

  @IsNumber()
  @Min(0.001)
  qtyToRefund: number;
}

export class ProcessRefundDto {
  @IsString()
  invoiceId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RefundItemDto)
  items: RefundItemDto[];

  @IsOptional()
  @IsBoolean()
  restock?: boolean;
}
