import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StripeAdapter } from './adapters/stripe.adapter';
import { PaypalAdapter } from './adapters/paypal.adapter';
import { PayhereAdapter } from './adapters/payhere.adapter';
import { PaymentsService } from './payments.service';
import { BillingWebhooksController } from './billing-webhooks.controller';
import { SubscriptionController } from './subscription.controller';

@Module({
  imports: [PrismaModule],
  controllers: [BillingWebhooksController, SubscriptionController],
  providers: [StripeAdapter, PaypalAdapter, PayhereAdapter, PaymentsService],
  exports: [PaymentsService],
})
export class BillingModule {}
