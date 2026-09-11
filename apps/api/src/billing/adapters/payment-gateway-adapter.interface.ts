import { BillingCurrency, BillingCycle, PaymentGateway } from '@omnipos/types';

export interface CheckoutParams {
  tenantId: string;
  /** 'plan' = the tenant's own Plan subscription; 'addon' = a purchasable AddOnModule. */
  kind: 'plan' | 'addon';
  /** Set when kind === 'addon' — the AddOnModule being purchased. */
  addOnModuleId?: string;
  planId: string;
  planPriceId: string | null; // gateway-specific price/plan id (stripePriceId / paypalPlanId), null for PayHere
  amount: number; // decimal amount in `currency`, for gateways that need it up front (PayHere)
  currency: BillingCurrency;
  billingCycle: BillingCycle;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  /** Where the frontend should navigate the browser to complete payment. */
  redirectUrl: string;
  /** Gateway-side reference (Stripe Checkout Session id / PayPal subscription id / PayHere order id). */
  gatewayRef: string;
}

export type NormalizedBillingEventType =
  | 'subscription.activated'
  | 'subscription.renewed'
  | 'subscription.payment_failed'
  | 'subscription.cancelled';

export interface NormalizedBillingEvent {
  type: NormalizedBillingEventType;
  gateway: PaymentGateway;
  /**
   * Populated directly from gateway metadata/custom-id/order-id when the
   * event carries it (always true for the first 'subscription.activated'
   * event, since that's the only point where no Subscription row is yet
   * linked to a gateway subscription id to look up by). For later events
   * (renewed/failed/cancelled) this may be omitted — PaymentsService
   * resolves tenantId by matching gatewaySubscriptionId against the
   * already-linked Subscription row instead.
   */
  tenantId?: string;
  /** Mirrors CheckoutParams.kind/addOnModuleId, carried back from gateway metadata/custom-id/order-id. */
  kind?: 'plan' | 'addon';
  addOnModuleId?: string;
  /** Gateway customer/subscription reference used to resolve tenantId via Subscription lookup. */
  gatewayCustomerId?: string;
  gatewaySubscriptionId?: string;
  /** Unique per-delivery id — used as BillingTransaction.gatewayTxnId for idempotency. */
  gatewayTxnId: string;
  amount: number;
  currency: BillingCurrency;
  currentPeriodEnd?: Date;
  raw: unknown;
}

export interface SubscriptionGatewayRefs {
  stripeSubscriptionId?: string | null;
  paypalSubscriptionId?: string | null;
  payhereMerchantId?: string | null;
}

export interface PaymentGatewayAdapter {
  readonly gateway: PaymentGateway;

  createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult>;

  /**
   * Verify + parse a webhook delivery in one step (verification and parsing
   * are inseparable for Stripe/PayHere — the signature is only meaningful in
   * the context of the specific payload). Returns null if the event type
   * isn't one we care about (adapter should not throw for those).
   * Throws if the signature/hash is invalid.
   */
  parseWebhookEvent(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<NormalizedBillingEvent | null>;

  cancelSubscription(refs: SubscriptionGatewayRefs): Promise<void>;
}
