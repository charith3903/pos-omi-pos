import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// `stripe` is a plain CJS export (no ESM default marker) and this project
// doesn't enable esModuleInterop, so `import Stripe from 'stripe'` compiles
// to a `.default` access that doesn't exist at runtime. `import ... =
// require(...)` compiles to a direct `require()` call that matches the
// package's actual shape.
import Stripe = require('stripe');
import {
  CheckoutParams,
  CheckoutResult,
  NormalizedBillingEvent,
  PaymentGatewayAdapter,
  SubscriptionGatewayRefs,
} from './payment-gateway-adapter.interface';

@Injectable()
export class StripeAdapter implements PaymentGatewayAdapter {
  readonly gateway = 'STRIPE' as const;
  private readonly logger = new Logger(StripeAdapter.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(private readonly config: ConfigService) {
    // Fall back to an obviously-fake key rather than '' so the app can still
    // boot with Stripe unconfigured (e.g. fresh dev setups, or tenants who
    // only ever use PayPal/PayHere) — Stripe's constructor rejects a falsy
    // key outright, but any *real* API call with a fake key fails cleanly
    // with an auth error at the point of use instead of crashing the app.
    this.stripe = new Stripe(this.config.get('STRIPE_SECRET_KEY', 'sk_test_not_configured'));
    this.webhookSecret = this.config.get('STRIPE_WEBHOOK_SECRET', '');
  }

  async createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult> {
    if (!params.planPriceId) {
      throw new Error('Stripe checkout requires Plan.stripePriceId to be configured');
    }

    const metadata = {
      tenantId: params.tenantId,
      planId: params.planId,
      kind: params.kind,
      addOnModuleId: params.addOnModuleId ?? '',
    };
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: params.customerEmail,
      line_items: [{ price: params.planPriceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata,
      subscription_data: { metadata },
    });

    if (!session.url) throw new Error('Stripe did not return a checkout URL');
    return { redirectUrl: session.url, gatewayRef: session.id };
  }

  async parseWebhookEvent(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<NormalizedBillingEvent | null> {
    const signature = headers['stripe-signature'];
    if (!signature || Array.isArray(signature)) {
      throw new Error('Missing stripe-signature header');
    }

    // constructEvent verifies the signature against the raw body and throws
    // if it doesn't match — this is the entire security boundary for this
    // webhook, so any failure here must propagate as an error, never a
    // silently-ignored null.
    const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        return {
          type: 'subscription.activated',
          gateway: this.gateway,
          tenantId: session.metadata?.tenantId,
          kind: (session.metadata?.kind as 'plan' | 'addon') || 'plan',
          addOnModuleId: session.metadata?.addOnModuleId || undefined,
          gatewayCustomerId: String(session.customer),
          gatewaySubscriptionId: String(session.subscription),
          gatewayTxnId: event.id,
          amount: (session.amount_total ?? 0) / 100,
          currency: (session.currency ?? 'usd').toUpperCase() as 'USD',
          raw: event,
        };
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = this.extractSubscriptionId(invoice);
        const meta = await this.fetchSubscriptionMetadata(subscriptionId);
        return {
          type: 'subscription.renewed',
          gateway: this.gateway,
          tenantId: meta?.tenantId,
          kind: meta?.kind,
          addOnModuleId: meta?.addOnModuleId,
          gatewayCustomerId: String(invoice.customer),
          gatewaySubscriptionId: subscriptionId,
          gatewayTxnId: event.id,
          amount: (invoice.amount_paid ?? 0) / 100,
          currency: (invoice.currency ?? 'usd').toUpperCase() as 'USD',
          currentPeriodEnd: invoice.lines.data[0]?.period?.end
            ? new Date(invoice.lines.data[0].period.end * 1000)
            : undefined,
          raw: event,
        };
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = this.extractSubscriptionId(invoice);
        const meta = await this.fetchSubscriptionMetadata(subscriptionId);
        return {
          type: 'subscription.payment_failed',
          gateway: this.gateway,
          tenantId: meta?.tenantId,
          kind: meta?.kind,
          addOnModuleId: meta?.addOnModuleId,
          gatewayCustomerId: String(invoice.customer),
          gatewaySubscriptionId: subscriptionId,
          gatewayTxnId: event.id,
          amount: (invoice.amount_due ?? 0) / 100,
          currency: (invoice.currency ?? 'usd').toUpperCase() as 'USD',
          raw: event,
        };
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        return {
          type: 'subscription.cancelled',
          gateway: this.gateway,
          tenantId: sub.metadata?.tenantId,
          kind: (sub.metadata?.kind as 'plan' | 'addon') || 'plan',
          addOnModuleId: sub.metadata?.addOnModuleId || undefined,
          gatewayCustomerId: String(sub.customer),
          gatewaySubscriptionId: sub.id,
          gatewayTxnId: event.id,
          amount: 0,
          currency: 'USD',
          raw: event,
        };
      }
      default:
        this.logger.debug(`Ignoring unhandled Stripe event type: ${event.type}`);
        return null;
    }
  }

  async cancelSubscription(refs: SubscriptionGatewayRefs): Promise<void> {
    if (!refs.stripeSubscriptionId) return;
    await this.stripe.subscriptions.cancel(refs.stripeSubscriptionId);
  }

  /**
   * Renewal/failure/cancellation webhooks don't carry the subscription's
   * metadata inline — only the subscription id. Fetch it once from Stripe
   * (source of truth for `tenantId`/`kind`/`addOnModuleId`, set at checkout
   * via `subscription_data.metadata`) rather than maintaining a separate
   * local mapping table just to resolve which tenant/purchase a webhook
   * belongs to.
   */
  private async fetchSubscriptionMetadata(
    subscriptionId: string | undefined,
  ): Promise<{ tenantId?: string; kind?: 'plan' | 'addon'; addOnModuleId?: string } | undefined> {
    if (!subscriptionId) return undefined;
    try {
      const sub = await this.stripe.subscriptions.retrieve(subscriptionId);
      return {
        tenantId: sub.metadata?.tenantId,
        kind: (sub.metadata?.kind as 'plan' | 'addon') || 'plan',
        addOnModuleId: sub.metadata?.addOnModuleId || undefined,
      };
    } catch (err) {
      this.logger.error(`Failed to fetch Stripe subscription ${subscriptionId} for tenant resolution`, err);
      return undefined;
    }
  }

  /**
   * As of newer Stripe API versions, an invoice's subscription reference
   * moved from the top-level `subscription` field to
   * `parent.subscription_details.subscription` (can be a string id or an
   * expanded Subscription object depending on the `expand` params used).
   */
  private extractSubscriptionId(invoice: Stripe.Invoice): string | undefined {
    const ref = invoice.parent?.subscription_details?.subscription;
    if (!ref) return undefined;
    return typeof ref === 'string' ? ref : ref.id;
  }
}
