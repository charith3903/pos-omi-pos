import { IsEnum, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreatePromotionDto {
  @IsString()
  name: string;

  @IsEnum(['MULTI_BUY', 'PCT_DISCOUNT', 'BOGO'])
  type: string;

  /**
   * Conditions object — shape depends on type:
   *   MULTI_BUY:     { minQty: 3, productId?: string, categoryId?: string }
   *   PCT_DISCOUNT:  { minTotal?: number, categoryId?: string }
   *   BOGO:          { productId: string }
   */
  @IsObject()
  conditions: Record<string, unknown>;

  /**
   * Reward object — shape depends on type:
   *   MULTI_BUY:     { discountAmt: number } | { discountPct: number } | { freeQty: 1 }
   *   PCT_DISCOUNT:  { discountPct: number }
   *   BOGO:          { freeQty: 1 }
   */
  @IsObject()
  reward: Record<string, unknown>;

  @IsString()
  validFrom: string; // ISO date

  @IsOptional()
  @IsString()
  validUntil?: string;
}

export class CartLineDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsNumber()
  @Min(1)
  qty: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class ApplyPromotionsDto {
  @IsObject({ each: true })
  lines: CartLineDto[];
}
