import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingCurrency, BillingCycle, PaymentGateway } from '@omnipos/types';
import { PrismaService } from '../prisma/prisma.service';
import { NormalizedBillingEvent, PaymentGatewayAdapter } from './adapters/payment-gateway-adapter.interface';
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
      kind: 'plan',
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

  /** Available AddOnModules for the tenant's business type, flagged with current entitlement. */
  async listAddOnsForTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const [modules, activeAddOns] = await Promise.all([
      this.prisma.addOnModule.findMany({
        where: { isActive: true, applicableBusinessTypes: { has: tenant.businessType } },
      }),
      this.prisma.withTenant(tenantId, (tx) =>
        tx.subscriptionAddOn.findMany({ where: { tenantId, status: 'ACTIVE' } }),
      ),
    ]);

    const activeModuleIds = new Set(activeAddOns.map((a) => a.addOnModuleId));
    return modules.map((m) => ({ ...m, active: activeModuleIds.has(m.id) }));
  }

  async createAddOnCheckoutSession(
    tenantId: string,
    addOnModuleId: string,
    gateway: PaymentGateway,
    currency: BillingCurrency,
  ) {
    this.assertGatewayCurrencyMatch(gateway, currency);

    const addOnModule = await this.prisma.addOnModule.findUnique({ where: { id: addOnModuleId } });
    if (!addOnModule || !addOnModule.isActive) throw new NotFoundException('Add-on module not found');

    const { tenant, owner, existing } = await this.prisma.withTenant(tenantId, async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      const owner = await tx.user.findFirst({ where: { tenantId, role: 'OWNER' } });
      const existing = await tx.subscriptionAddOn.findUnique({
        where: { tenantId_addOnModuleId: { tenantId, addOnModuleId } },
      });
      return { tenant, owner, existing };
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!owner) throw new NotFoundException('No owner user found for this tenant');
    if (!addOnModule.applicableBusinessTypes.includes(tenant.businessType)) {
      throw new BadRequestException(`This add-on is not available for ${tenant.businessType} tenants`);
    }
    if (existing?.status === 'ACTIVE') {
      throw new BadRequestException('This add-on is already active on your account');
    }

    const planPriceId =
      gateway === 'STRIPE' ? addOnModule.stripePriceId : gateway === 'PAYPAL' ? addOnModule.paypalPlanId : null;
    const amount = this.resolveAddOnAmount(addOnModule, currency);

    const adapter = this.getAdapter(gateway);
    const result = await adapter.createCheckoutSession({
      tenantId,
      kind: 'addon',
      addOnModuleId,
      planId: addOnModule.id,
      planPriceId,
      amount,
      currency,
      billingCycle: 'MONTHLY',
      customerEmail: owner.email,
      successUrl: `${this.dashboardUrl}/settings/addons?success=1`,
      cancelUrl: `${this.dashboardUrl}/settings/addons`,
    });

    this.logger.log(
      `Add-on checkout session created for tenant ${tenantId}, module ${addOnModule.moduleKey} via ${gateway}: ${result.gatewayRef}`,
    );
    return result;
  }

  private resolveAddOnAmount(
    addOnModule: { priceUsdMonthly: unknown; priceLkrMonthly: unknown },
    currency: BillingCurrency,
  ): number {
    const field = currency === 'LKR' ? addOnModule.priceLkrMonthly : addOnModule.priceUsdMonthly;
    if (field == null) {
      throw new BadRequestException(`Add-on has no ${currency} price configured`);
    }
    return Number(field);
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

    if (event.kind === 'addon') {
      await this.handleAddOnWebhookEvent(tenantId, gateway, event);
      return;
    }

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

  /**
   * Add-on purchases activate a SubscriptionAddOn row instead of touching the
   * tenant's main Subscription/Tenant status — buying (or losing) an add-on
   * never affects the base plan or trial/suspension state.
   */
  private async handleAddOnWebhookEvent(
    tenantId: string,
    gateway: PaymentGateway,
    event: NormalizedBillingEvent,
  ): Promise<void> {
    if (!event.addOnModuleId) {
      this.logger.error(`Add-on webhook ${event.gatewayTxnId} missing addOnModuleId — dropping`);
      return;
    }
    const addOnModuleId = event.addOnModuleId;

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

      const gatewayIdField =
        gateway === 'STRIPE'
          ? { stripeSubscriptionId: event.gatewaySubscriptionId }
          : gateway === 'PAYPAL'
            ? { paypalSubscriptionId: event.gatewaySubscriptionId }
            : {};

      switch (event.type) {
        case 'subscription.activated':
        case 'subscription.renewed':
          await tx.subscriptionAddOn.upsert({
            where: { tenantId_addOnModuleId: { tenantId, addOnModuleId } },
            create: {
              tenantId,
              subscriptionId: subscription.id,
              addOnModuleId,
              status: 'ACTIVE',
              ...gatewayIdField,
            },
            update: { status: 'ACTIVE', cancelledAt: null, ...gatewayIdField },
          });
          break;
        case 'subscription.cancelled':
          await tx.subscriptionAddOn.updateMany({
            where: { tenantId, addOnModuleId },
            data: { status: 'CANCELLED', cancelledAt: new Date() },
          });
          break;
        case 'subscription.payment_failed':
          // Leave the add-on active on a single failed payment — the gateway
          // will retry, and only an explicit `subscription.cancelled` event
          // (from the gateway giving up) revokes access. Still logged below
          // via the BillingTransaction row for the tenant's billing history.
          break;
      }

      const addOnModule = await tx.addOnModule.findUnique({ where: { id: addOnModuleId } });
      await tx.billingTransaction.create({
        data: {
          tenantId,
          subscriptionId: subscription.id,
          gateway,
          gatewayTxnId: event.gatewayTxnId,
          amount: event.amount,
          currency: event.currency,
          status: event.type === 'subscription.payment_failed' ? 'FAILED' : 'SUCCEEDED',
          description: `addon:${addOnModule?.moduleKey ?? addOnModuleId}:${event.type}`,
          rawPayload: event.raw as object,
        },
      });
    });
  }

  async cancelAddOn(tenantId: string, addOnModuleId: string): Promise<void> {
    const addOn = await this.prisma.withTenant(tenantId, (tx) =>
      tx.subscriptionAddOn.findUnique({ where: { tenantId_addOnModuleId: { tenantId, addOnModuleId } } }),
    );
    if (!addOn || addOn.status !== 'ACTIVE') throw new NotFoundException('No active add-on found');

    const gateway = addOn.stripeSubscriptionId ? 'STRIPE' : addOn.paypalSubscriptionId ? 'PAYPAL' : 'PAYHERE';
    const adapter = this.getAdapter(gateway);
    await adapter.cancelSubscription({
      stripeSubscriptionId: addOn.stripeSubscriptionId,
      paypalSubscriptionId: addOn.paypalSubscriptionId,
      payhereMerchantId: null,
    });

    await this.prisma.withTenant(tenantId, (tx) =>
      tx.subscriptionAddOn.update({
        where: { tenantId_addOnModuleId: { tenantId, addOnModuleId } },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      }),
    );
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
