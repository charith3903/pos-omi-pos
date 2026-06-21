import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { StockService } from './stock.service';

class AdjustStockDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsNumber()
  qtyDelta: number;

  @IsEnum(['ADJUSTMENT', 'PURCHASE', 'RETURN', 'DAMAGE', 'TRANSFER'])
  reason: 'ADJUSTMENT' | 'PURCHASE' | 'RETURN' | 'DAMAGE' | 'TRANSFER';

  @IsOptional()
  @IsString()
  refId?: string;
}

@Controller('stock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockController {
  constructor(private readonly svc: StockService) {}

  /** GET /stock — all product stock levels for the tenant (Redis-cached). */
  @Get()
  getAll(@CurrentUser() u: RequestUser) {
    return this.svc.getAllStock(u.tenantId);
  }

  /** GET /stock/list — stock with product names for management UI. */
  @Get('list')
  getList(@CurrentUser() u: RequestUser) {
    return this.svc.getStockList(u.tenantId);
  }

  /** GET /stock/:productId — stock for one product (Redis-cached). */
  @Get(':productId')
  getOne(@CurrentUser() u: RequestUser, @Param('productId') productId: string) {
    return this.svc.getProductStock(u.tenantId, productId).then((stock) => ({ productId, stock }));
  }

  /** POST /stock/adjust — manual adjustment (OWNER/MANAGER only). */
  @Post('adjust')
  @Roles('OWNER', 'MANAGER')
  adjust(@CurrentUser() u: RequestUser, @Body() dto: AdjustStockDto) {
    return this.svc.adjust(
      u.tenantId,
      dto.productId,
      dto.variantId ?? null,
      dto.qtyDelta,
      dto.reason,
      dto.refId,
    );
  }
}
