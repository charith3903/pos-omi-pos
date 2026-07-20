import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingCurrency, BillingCycle, PaymentGateway } from '@omnipos/types';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentGatewayAdapter } from './adapters/payment-gateway-adapter.interface';
import { StripeAdapter } from './adapters/stripe.adapter';
import { PaypalAdapter } from './adapters/paypal.adapter';
import { PayhereAdapter } from './adapters/payhere.adapter';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly adapters: Record<PaymentGateway, PaymentGatewayAdapter>;
  private readonly dashboardUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    stripe: StripeAdapter,
    paypal: PaypalAdapter,
    payhere: PayhereAdapter,
  ) {
    this.adapters = { STRIPE: stripe, PAYPAL: paypal, PAYHERE: payhere };
    this.dashboardUrl = this.config.get('DASHBOARD_URL', 'http://localhost:3001');
  }

  getAdapter(gateway: PaymentGateway): PaymentGatewayAdapter {
    return this.adapters[gateway];
  }

  get payhereAdapter(): PayhereAdapter {
    return this.adapters.PAYHERE as PayhereAdapter;
  }

  /**
   * Validate gateway/currency pairing up front — this is money-movement
   * code, never trust the frontend's combination blindly.
   */
  private assertGatewayCurrencyMatch(gateway: PaymentGateway, currency: BillingCurrency) {
    if (gateway === 'PAYHERE' && currency !== 'LKR') {
      throw new BadRequestException('PayHere only supports LKR');
    }
    if (gateway !== 'PAYHERE' && currency === 'LKR') {
      throw new BadRequestException(`${gateway} does not support LKR — use PayHere`);
    }
  }

  async createCheckoutSession(
    tenantId: string,
    gateway: PaymentGateway,
    billingCycle: BillingCycle,
    currency: BillingCurrency,
  ) {
    this.assertGatewayCurrencyMatch(gateway, currency);

    const { subscription, owner } = await this.prisma.withTenant(tenantId, async (tx) => {
      const subscription = await tx.subscription.findUnique({
        where: { tenantId },
        include: { plan: true },
      });
      const owner = await tx.user.findFirst({ where: { tenantId, role: 'OWNER' } });
      return { subscription, owner };
    });
    if (!subscription) throw new NotFoundException('No subscription found for this tenant');
    if (!owner) throw new NotFoundException('No owner user found for this tenant');

    const plan = subscription.plan;
    const planPriceId =
      gateway === 'STRIPE' ? plan.stripePriceId : gateway === 'PAYPAL' ? plan.paypalPlanId : null;

    const amount = this.resolveAmount(plan, gateway, currency, billingCycle);

    const adapter = this.getAdapter(gateway);
    const result = await adapter.createCheckoutSession({
      tenantId,
      planId: plan.id,
      planPriceId,
      amount,
      currency,
      billingCycle,
      customerEmail: owner.email,
      successUrl: `${this.dashboardUrl}/onboarding/success`,
      cancelUrl: `${this.dashboardUrl}/onboarding/plan`,
    });

    this.logger.log(`Checkout session created for tenant ${tenantId} via ${gateway}: ${result.gatewayRef}`);
    return result;
  }

  private resolveAmount(
    plan: { priceUsdMonthly: unknown; priceUsdAnnual: unknown; priceLkrMonthly: unknown; priceLkrAnnual: unknown },
    gateway: PaymentGateway,
    currency: BillingCurrency,
    billingCycle: BillingCycle,
  ): number {
    const field =
      currency === 'LKR'
        ? billingCycle === 'ANNUAL'
          ? plan.priceLkrAnnual
          : plan.priceLkrMonthly
        : billingCycle === 'ANNUAL'
          ? plan.priceUsdAnnual
          : plan.priceUsdMonthly;
    if (field == null) {
      throw new BadRequestException(`Plan has no ${currency} ${billingCycle} price configured`);
    }
    return Number(field);
  }

  /**
   * Verify + process one webhook delivery. Must be idempotent — all three
   * gateways retry on non-2xx and can deliver the same event more than once.
   */
  async handleWebhookEvent(
    gateway: PaymentGateway,
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<void> {
    const adapter = this.getAdapter(gateway);
    const event = await adapter.parseWebhookEvent(rawBody, headers);
    if (!event) return; // event type we don't act on — already logged by the adapter

    // Every adapter resolves tenantId directly from the gateway's own
    // subscription metadata/custom_id/order_id (see each adapter's
    // fetchTenantIdFromSubscription / order_id parsing) — never from a
    // cross-tenant DB search, so this can go straight through the tenant's
    // own RLS-scoped transaction like any other request.
    if (!event.tenantId) {
      this.logger.error(
        `Could not resolve tenant for ${gateway} webhook event ${event.gatewayTxnId} (type=${event.type}) — dropping`,
      );
      return;
    }
    const tenantId = event.tenantId;

    await this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.billingTransaction.findUnique({
        where: { gatewayTxnId: event.gatewayTxnId },
      });
      if (existing) {
        this.logger.log(`Duplicate webhook delivery ignored: ${event.gatewayTxnId}`);
        return;
      }

      const subscription = await tx.subscription.findUnique({ where: { tenantId } });
      if (!subscription) {
        this.logger.error(`Webhook resolved tenantId=${tenantId} but it has no Subscription row`);
        return;
      }

      const periodEnd =
        event.currentPeriodEnd ??
        new Date(Date.now() + (subscription.billingCycle === 'ANNUAL' ? 365 : 30) * 24 * 60 * 60 * 1000);

      const gatewayIdField =
        gateway === 'STRIPE'
          ? { stripeSubscriptionId: event.gatewaySubscriptionId, stripeCustomerId: event.gatewayCustomerId }
          : gateway === 'PAYPAL'
            ? { paypalSubscriptionId: event.gatewaySubscriptionId }
            : { payhereMerchantId: event.gatewaySubscriptionId };

      switch (event.type) {
        case 'subscription.activated':
        case 'subscription.renewed':
          await tx.subscription.update({
            where: { tenantId },
            data: {
              status: 'ACTIVE',
              gateway,
              currentPeriodStart: new Date(),
              currentPeriodEnd: periodEnd,
              cancelAtPeriodEnd: false,
              ...gatewayIdField,
            },
          });
          await tx.tenant.update({
            where: { id: tenantId },
            data: { status: 'ACTIVE', trialEndsAt: null },
          });
          break;
        case 'subscription.payment_failed':
          await tx.subscription.update({ where: { tenantId }, data: { status: 'PAST_DUE' } });
          break;
        case 'subscription.cancelled':
          await tx.subscription.update({ where: { tenantId }, data: { status: 'CANCELLED' } });
          await tx.tenant.update({ where: { id: tenantId }, data: { status: 'SUSPENDED' } });
          break;
      }

      await tx.billingTransaction.create({
        data: {
          tenantId,
          subscriptionId: subscription.id,
          gateway,
          gatewayTxnId: event.gatewayTxnId,
          amount: event.amount,
          currency: event.currency,
          status: event.type === 'subscription.payment_failed' ? 'FAILED' : 'SUCCEEDED',
          description: event.type,
          rawPayload: event.raw as object,
        },
      });
    });
  }

  async cancelSubscription(tenantId: string): Promise<void> {
    const subscription = await this.prisma.withTenant(tenantId, (tx) =>
      tx.subscription.findUnique({ where: { tenantId } }),
    );
    if (!subscription) throw new NotFoundException('No subscription found for this tenant');

    const adapter = this.getAdapter(subscription.gateway ?? 'STRIPE');
    await adapter.cancelSubscription({
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      paypalSubscriptionId: subscription.paypalSubscriptionId,
      payhereMerchantId: subscription.payhereMerchantId,
    });

    await this.prisma.withTenant(tenantId, (tx) =>
      tx.subscription.update({ where: { tenantId }, data: { cancelAtPeriodEnd: true } }),
    );
  }
}
