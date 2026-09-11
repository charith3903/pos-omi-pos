import { Body, Controller, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { BusinessType } from '@omnipos/types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { CreateAddOnCheckoutDto } from './dto/create-addon-checkout.dto';

/**
 * Deliberately NOT behind SubscriptionGuard (unlike almost every other
 * controller) — a tenant whose trial has expired or subscription is
 * suspended must still be able to view their plan and pay to reactivate.
 * Gating this controller by subscription status would create a lockout with
 * no way back in.
 */
@Controller('billing')
export class SubscriptionController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  /** Public — powers the pre-signup pricing page and the post-signup plan-selection step. */
  @Get('plans')
  async getPlans(@Query('businessType') businessType?: BusinessType) {
    return this.prisma.plan.findMany({
      where: { isActive: true, ...(businessType ? { businessType } : {}) },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('subscription')
  async getSubscription(@CurrentUser() user: RequestUser) {
    const subscription = await this.prisma.withTenant(user.tenantId, (tx) =>
      tx.subscription.findUnique({
        where: { tenantId: user.tenantId },
        include: { plan: true, addOns: { include: { addOnModule: true } } },
      }),
    );
    if (!subscription) throw new NotFoundException('No subscription found');
    return subscription;
  }

  @UseGuards(JwtAuthGuard)
  @Get('subscription/history')
  async getBillingHistory(@CurrentUser() user: RequestUser) {
    return this.prisma.withTenant(user.tenantId, (tx) =>
      tx.billingTransaction.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscription/checkout')
  async createCheckout(@CurrentUser() user: RequestUser, @Body() dto: CreateCheckoutDto) {
    return this.payments.createCheckoutSession(user.tenantId, dto.gateway, dto.billingCycle, dto.currency);
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscription/cancel')
  async cancel(@CurrentUser() user: RequestUser) {
    await this.payments.cancelSubscription(user.tenantId);
    return { cancelled: true };
  }

  /** Add-on modules available for the tenant's business type, each flagged with current entitlement. */
  @UseGuards(JwtAuthGuard)
  @Get('addons')
  async getAddOns(@CurrentUser() user: RequestUser) {
    return this.payments.listAddOnsForTenant(user.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('addons/:addOnModuleId/checkout')
  async createAddOnCheckout(
    @CurrentUser() user: RequestUser,
    @Param('addOnModuleId') addOnModuleId: string,
    @Body() dto: CreateAddOnCheckoutDto,
  ) {
    return this.payments.createAddOnCheckoutSession(user.tenantId, addOnModuleId, dto.gateway, dto.currency);
  }

  @UseGuards(JwtAuthGuard)
  @Post('addons/:addOnModuleId/cancel')
  async cancelAddOn(@CurrentUser() user: RequestUser, @Param('addOnModuleId') addOnModuleId: string) {
    await this.payments.cancelAddOn(user.tenantId, addOnModuleId);
    return { cancelled: true };
  }
}
