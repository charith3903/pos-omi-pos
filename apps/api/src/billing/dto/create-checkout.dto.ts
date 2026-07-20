import { IsIn } from 'class-validator';

const GATEWAYS = ['STRIPE', 'PAYPAL', 'PAYHERE'] as const;
const CYCLES = ['MONTHLY', 'ANNUAL'] as const;
const CURRENCIES = ['USD', 'LKR'] as const;

export class CreateCheckoutDto {
  @IsIn(GATEWAYS)
  gateway: (typeof GATEWAYS)[number];

  @IsIn(CYCLES)
  billingCycle: (typeof CYCLES)[number];

  @IsIn(CURRENCIES)
  currency: (typeof CURRENCIES)[number];
}
