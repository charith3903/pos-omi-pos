import { Controller, Get, Post, Body, Param, Put, Query, UseGuards, Req } from '@nestjs/common';
import { PurchasingService } from './purchasing.service';
import { RequiresModule } from '../common/decorators/requires-module.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { redactBatchCost } from '../common/utils/redact-cost.util';

@Controller('purchasing')
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@RequiresModule('purchasing')
export class PurchasingController {
  constructor(private readonly purchasingService: PurchasingService) {}

  // ── Purchase Orders ──
  @Get('po')
  getPurchaseOrders(@Req() req) {
    return this.purchasingService.getPurchaseOrders(req.user.tenantId);
  }

  @Post('po')
  createPurchaseOrder(@Req() req, @Body() body) {
    return this.purchasingService.createPurchaseOrder(req.user.tenantId, body);
  }

  // ── Goods Received Notes ──
  @Get('grn')
  getGrns(@Req() req) {
    return this.purchasingService.getGrns(req.user.tenantId);
  }

  @Post('grn')
  createGrn(@Req() req, @Body() body) {
    return this.purchasingService.createGrn(req.user.tenantId, body);
  }

  // ── Batches (batch-wise stock/pricing) ──
  @Get('batches')
  async getBatches(@Req() req, @Query('productId') productId?: string, @Query('variantId') variantId?: string) {
    const batches = await this.purchasingService.getBatches(req.user.tenantId, productId, variantId);
    return redactBatchCost(batches, req.user.role);
  }
}
