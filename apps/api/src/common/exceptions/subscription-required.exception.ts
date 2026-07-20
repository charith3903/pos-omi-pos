import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 402 Payment Required — distinct from 403 Forbidden so the dashboard can
 * branch differently (redirect to the billing/reactivation page) rather than
 * showing a generic "you don't have permission" error.
 */
export class SubscriptionRequiredException extends HttpException {
  constructor(message = 'Subscription inactive or trial expired') {
    super({ statusCode: HttpStatus.PAYMENT_REQUIRED, message }, HttpStatus.PAYMENT_REQUIRED);
  }
}
