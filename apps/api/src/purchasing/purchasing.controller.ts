import { Controller, Get, Post, Body, Param, Put, UseGuards, Req } from '@nestjs/common';
import { PurchasingService } from './purchasing.service';
import { RequiresModule } from '../common/decorators/requires-module.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';

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
}
