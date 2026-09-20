import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateHeldSaleDto {
  @IsOptional()
  @IsString()
  outletId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  note?: string;

  /** The full in-progress cart — lines, discounts, draft payments, rate type. Opaque to the server. */
  @IsObject()
  cartSnapshot: Record<string, unknown>;
}
