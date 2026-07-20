import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CheckoutParams,
  CheckoutResult,
  NormalizedBillingEvent,
  PaymentGatewayAdapter,
  SubscriptionGatewayRefs,
} from './payment-gateway-adapter.interface';

interface PaypalTokenCache {
  token: string;
  expiresAt: number;
}

/**
 * PayPal Subscriptions API via direct REST calls (no SDK — PayPal's official
 * server SDKs churn frequently and the Subscriptions API surface used here is
 * small enough that a thin fetch wrapper is more maintainable).
 */
@Injectable()
export class PaypalAdapter implements PaymentGatewayAdapter {
  readonly gateway = 'PAYPAL' as const;
  private readonly logger = new Logger(PaypalAdapter.name);
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly webhookId: string;
  private tokenCache: PaypalTokenCache | null = null;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get('PAYPAL_API_BASE', 'https://api-m.sandbox.paypal.com');
    this.clientId = this.config.get('PAYPAL_CLIENT_ID', '');
    this.clientSecret = this.config.get('PAYPAL_CLIENT_SECRET', '');
    this.webhookId = this.config.get('PAYPAL_WEBHOOK_ID', '');
  }

  private async getAccessToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
      return this.tokenCache.token;
    }
    const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) throw new Error(`PayPal OAuth token request failed: ${res.status}`);
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.tokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
    return data.access_token;
  }

  private async call<T>(path: string, method: string, body?: unknown): Promise<T> {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`PayPal API ${method} ${path} failed: ${res.status} ${errBody}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  async createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult> {
    if (!params.planPriceId) {
      throw new Error('PayPal checkout requires Plan.paypalPlanId to be configured');
    }

    const response = await this.call<{ id: string; links: { rel: string; href: string }[] }>(
      '/v1/billing/subscriptions',
      'POST',
      {
        plan_id: params.planPriceId,
        subscriber: { email_address: params.customerEmail },
        custom_id: params.tenantId,
        application_context: {
          return_url: params.successUrl,
          cancel_url: params.cancelUrl,
          user_action: 'SUBSCRIBE_NOW',
        },
      },
    );

    const approveLink = response.links.find((l) => l.rel === 'approve');
    if (!approveLink) throw new Error('PayPal did not return an approval link');
    return { redirectUrl: approveLink.href, gatewayRef: response.id };
  }

  async parseWebhookEvent(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<NormalizedBillingEvent | null> {
    const single = (h: string | string[] | undefined) => (Array.isArray(h) ? h[0] : h) ?? '';
    const event = JSON.parse(rawBody.toString('utf8'));

    // PayPal has no local-HMAC verification like Stripe — the signature is
    // checked by asking PayPal's own API to re-verify it. This is an extra
    // outbound call inside the webhook handler, so callers should treat this
    // adapter's parseWebhookEvent as slower/less reliable under load than
    // Stripe's, and duplicate-delivery idempotency (BillingTransaction's
    // unique gatewayTxnId) matters even more here.
    const verification = await this.call<{ verification_status: string }>(
      '/v1/notifications/verify-webhook-signature',
      'POST',
      {
        auth_algo: single(headers['paypal-auth-algo']),
        cert_url: single(headers['paypal-cert-url']),
        transmission_id: single(headers['paypal-transmission-id']),
        transmission_sig: single(headers['paypal-transmission-sig']),
        transmission_time: single(headers['paypal-transmission-time']),
        webhook_id: this.webhookId,
        webhook_event: event,
      },
    );

    if (verification.verification_status !== 'SUCCESS') {
      throw new Error('PayPal webhook signature verification failed');
    }

    const resource = event.resource ?? {};
    const gatewayTxnId: string = event.id;

    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        return {
          type: 'subscription.activated',
          gateway: this.gateway,
          tenantId: resource.custom_id,
          gatewaySubscriptionId: resource.id,
          gatewayTxnId,
          amount: Number(resource.billing_info?.last_payment?.amount?.value ?? 0),
          currency: (resource.billing_info?.last_payment?.amount?.currency_code ?? 'USD') as 'USD',
          raw: event,
        };
      case 'PAYMENT.SALE.COMPLETED': {
        const subId = resource.billing_agreement_id;
        return {
          type: 'subscription.renewed',
          gateway: this.gateway,
          tenantId: subId ? await this.fetchTenantIdFromSubscription(subId) : undefined,
          gatewaySubscriptionId: subId,
          gatewayTxnId,
          amount: Number(resource.amount?.total ?? 0),
          currency: (resource.amount?.currency ?? 'USD') as 'USD',
          raw: event,
        };
      }
      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        return {
          type: 'subscription.payment_failed',
          gateway: this.gateway,
          tenantId: await this.fetchTenantIdFromSubscription(resource.id),
          gatewaySubscriptionId: resource.id,
          gatewayTxnId,
          amount: 0,
          currency: 'USD',
          raw: event,
        };
      case 'BILLING.SUBSCRIPTION.CANCELLED':
        return {
          type: 'subscription.cancelled',
          gateway: this.gateway,
          tenantId: await this.fetchTenantIdFromSubscription(resource.id),
          gatewaySubscriptionId: resource.id,
          gatewayTxnId,
          amount: 0,
          currency: 'USD',
          raw: event,
        };
      default:
        this.logger.debug(`Ignoring unhandled PayPal event type: ${event.event_type}`);
        return null;
    }
  }

  async cancelSubscription(refs: SubscriptionGatewayRefs): Promise<void> {
    if (!refs.paypalSubscriptionId) return;
    await this.call(`/v1/billing/subscriptions/${refs.paypalSubscriptionId}/cancel`, 'POST', {
      reason: 'Cancelled by tenant',
    });
  }

  /**
   * Renewal/failure/cancellation webhooks reference a subscription id but
   * not its `custom_id` inline — fetch the subscription itself (source of
   * truth for tenantId, set at creation via `custom_id`) rather than
   * maintaining a separate local mapping table.
   */
  private async fetchTenantIdFromSubscription(subscriptionId: string): Promise<string | undefined> {
    try {
      const sub = await this.call<{ custom_id?: string }>(
        `/v1/billing/subscriptions/${subscriptionId}`,
        'GET',
      );
      return sub.custom_id;
    } catch (err) {
      this.logger.error(`Failed to fetch PayPal subscription ${subscriptionId} for tenant resolution`, err);
      return undefined;
    }
  }
}
