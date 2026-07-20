import { BadRequestException, Controller, Get, Logger, Post, Query, Req, Res } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PaymentGateway } from '@omnipos/types';
import { PaymentsService } from './payments.service';
import { PayhereAdapter } from './adapters/payhere.adapter';

/**
 * Publicly reachable, unauthenticated by design — payment gateways call
 * these directly with no user session. Security comes entirely from each
 * adapter's own cryptographic verification (Stripe HMAC signature, PayPal
 * verify-signature API call, PayHere MD5 hash), not from JwtAuthGuard.
 * Deliberately NOT behind SubscriptionGuard either (Phase 3) — a webhook for
 * a currently-SUSPENDED tenant is exactly the request that must go through.
 */
@Controller('billing')
export class BillingWebhooksController {
  private readonly logger = new Logger(BillingWebhooksController.name);

  constructor(private readonly payments: PaymentsService) {}

  @Post('webhooks/stripe')
  stripeWebhook(@Req() req: RawBodyRequest<Request>) {
    return this.handle('STRIPE', req);
  }

  @Post('webhooks/paypal')
  paypalWebhook(@Req() req: RawBodyRequest<Request>) {
    return this.handle('PAYPAL', req);
  }

  @Post('webhooks/payhere')
  payhereWebhook(@Req() req: RawBodyRequest<Request>) {
    return this.handle('PAYHERE', req);
  }

  /**
   * A failed signature/hash check must come back as a clean 400, not a
   * generic 500 — gateways log and alert differently on 4xx (bad request,
   * won't be retried the same way) vs 5xx (transient, will retry), and a
   * 500 here would also leak internal error detail via Nest's default
   * exception filter.
   */
  private async handle(gateway: PaymentGateway, req: RawBodyRequest<Request>) {
    if (!req.rawBody) throw new BadRequestException('Missing raw body');
    try {
      await this.payments.handleWebhookEvent(gateway, req.rawBody, req.headers as Record<string, string>);
      return { received: true };
    } catch (err) {
      this.logger.warn(`Rejected ${gateway} webhook: ${(err as Error).message}`);
      throw new BadRequestException('Webhook verification failed');
    }
  }

  /**
   * Renders an auto-submitting HTML form that POSTs to PayHere's hosted
   * checkout page — PayHere only accepts a browser form POST, not a GET
   * redirect, so this is the page `createCheckoutSession`'s `redirectUrl`
   * points the browser at (see PayhereAdapter for why).
   */
  @Get('payhere/checkout-form')
  payhereCheckoutForm(@Query('data') data: string, @Res() res: Response) {
    if (!data) throw new BadRequestException('Missing checkout data');
    const fields = PayhereAdapter.decodeFormFields(data);
    const actionUrl = this.payments.payhereAdapter.formActionUrl;

    const inputs = Object.entries(fields)
      .map(([key, value]) => `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}" />`)
      .join('\n');

    res.type('html').send(`<!doctype html>
<html>
<body onload="document.forms[0].submit()">
  <p>Redirecting to PayHere…</p>
  <form method="POST" action="${escapeHtml(actionUrl)}">
    ${inputs}
  </form>
</body>
</html>`);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
