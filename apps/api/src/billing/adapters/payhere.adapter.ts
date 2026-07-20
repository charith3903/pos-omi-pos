import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CheckoutParams,
  CheckoutResult,
  NormalizedBillingEvent,
  PaymentGatewayAdapter,
  SubscriptionGatewayRefs,
} from './payment-gateway-adapter.interface';

function md5Upper(input: string): string {
  return createHash('md5').update(input).digest('hex').toUpperCase();
}

/**
 * PayHere has no true "subscription" object — it's a one-time hosted payment
 * (redirect + form POST + notify_url webhook, all secured by an MD5 hash of
 * the merchant secret, not a signed-payload SDK call). Recurring billing is
 * handled by OmniPOS's own scheduler re-generating a fresh checkout each
 * period, not by PayHere itself — see SubscriptionRenewalService.
 *
 * PayHere's checkout endpoint only accepts a browser form POST, not a GET
 * redirect, so `createCheckoutSession` can't return PayHere's URL directly.
 * Instead it returns a link to our own `/billing/payhere/checkout-form`
 * endpoint, which renders a minimal auto-submitting HTML form that POSTs the
 * computed (and hashed) fields to PayHere on the user's behalf.
 */
@Injectable()
export class PayhereAdapter implements PaymentGatewayAdapter {
  readonly gateway = 'PAYHERE' as const;
  private readonly logger = new Logger(PayhereAdapter.name);
  private readonly merchantId: string;
  private readonly merchantSecret: string;
  private readonly checkoutUrl: string;
  private readonly apiBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.merchantId = this.config.get('PAYHERE_MERCHANT_ID', '');
    this.merchantSecret = this.config.get('PAYHERE_MERCHANT_SECRET', '');
    this.checkoutUrl = this.config.get(
      'PAYHERE_CHECKOUT_URL',
      'https://sandbox.payhere.lk/pay/checkout',
    );
    this.apiBaseUrl = this.config.get('API_PUBLIC_URL', 'http://localhost:3000');
  }

  private computeCheckoutHash(orderId: string, amount: number, currency: string): string {
    const amountStr = amount.toFixed(2);
    return md5Upper(
      `${this.merchantId}${orderId}${amountStr}${currency}${md5Upper(this.merchantSecret)}`,
    );
  }

  async createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult> {
    const orderId = `sub_${params.tenantId}_${Date.now()}`;
    const hash = this.computeCheckoutHash(orderId, params.amount, params.currency);

    const fields = {
      merchant_id: this.merchantId,
      return_url: params.successUrl,
      cancel_url: params.cancelUrl,
      notify_url: `${this.apiBaseUrl}/billing/webhooks/payhere`,
      order_id: orderId,
      items: `OmniPOS subscription (${params.billingCycle})`,
      currency: params.currency,
      amount: params.amount.toFixed(2),
      first_name: params.customerEmail.split('@')[0],
      last_name: '',
      email: params.customerEmail,
      phone: '',
      address: '',
      city: '',
      country: 'Sri Lanka',
      hash,
    };

    const encoded = Buffer.from(JSON.stringify(fields)).toString('base64url');
    return {
      redirectUrl: `${this.apiBaseUrl}/billing/payhere/checkout-form?data=${encoded}`,
      gatewayRef: orderId,
    };
  }

  /** Used by BillingWebhooksController's checkout-form render route. */
  static decodeFormFields(data: string): Record<string, string> {
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  }

  get formActionUrl(): string {
    return this.checkoutUrl;
  }

  async parseWebhookEvent(
    rawBody: Buffer,
  ): Promise<NormalizedBillingEvent | null> {
    // PayHere posts standard form fields (application/x-www-form-urlencoded),
    // not JSON — the caller passes the parsed body through as rawBody's
    // string form for us to re-parse here, keeping this adapter's interface
    // consistent with the others.
    const params = new URLSearchParams(rawBody.toString('utf8'));
    const merchantId = params.get('merchant_id') ?? '';
    const orderId = params.get('order_id') ?? '';
    const amount = params.get('payhere_amount') ?? '';
    const currency = params.get('payhere_currency') ?? '';
    const statusCode = params.get('status_code') ?? '';
    const receivedSig = params.get('md5sig') ?? '';

    const expectedSig = md5Upper(
      `${merchantId}${orderId}${amount}${currency}${statusCode}${md5Upper(this.merchantSecret)}`,
    );
    if (expectedSig !== receivedSig) {
      throw new Error('PayHere webhook hash verification failed');
    }

    const gatewayTxnId = `payhere_${orderId}_${statusCode}`;
    const parsedAmount = Number(amount);
    const parsedCurrency = (currency || 'LKR') as 'LKR';

    // order_id is `sub_<tenantId>_<timestamp>` (see createCheckoutSession) —
    // cuid()-generated tenant ids are alphanumeric only, so splitting on
    // '_' is safe.
    const tenantId = orderId.startsWith('sub_') ? orderId.split('_')[1] : undefined;

    switch (statusCode) {
      case '2':
        return {
          type: 'subscription.activated',
          gateway: this.gateway,
          tenantId,
          gatewaySubscriptionId: orderId,
          gatewayTxnId,
          amount: parsedAmount,
          currency: parsedCurrency,
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          raw: Object.fromEntries(params),
        };
      case '-1':
        return {
          type: 'subscription.cancelled',
          gateway: this.gateway,
          gatewaySubscriptionId: orderId,
          gatewayTxnId,
          amount: parsedAmount,
          currency: parsedCurrency,
          raw: Object.fromEntries(params),
        };
      case '-2':
      case '-3':
        return {
          type: 'subscription.payment_failed',
          gateway: this.gateway,
          gatewaySubscriptionId: orderId,
          gatewayTxnId,
          amount: parsedAmount,
          currency: parsedCurrency,
          raw: Object.fromEntries(params),
        };
      default:
        this.logger.debug(`Ignoring PayHere status_code=${statusCode} (pending or unknown)`);
        return null;
    }
  }

  async cancelSubscription(_refs: SubscriptionGatewayRefs): Promise<void> {
    // No gateway-side subscription object exists to cancel — PayHere is
    // one-time-payment based. Cancellation is purely internal: the caller
    // (PaymentsService) marks Subscription.status = CANCELLED and the
    // renewal scheduler simply stops generating new checkout links for it.
    this.logger.log('PayHere has no subscription object to cancel — internal state only');
  }
}
