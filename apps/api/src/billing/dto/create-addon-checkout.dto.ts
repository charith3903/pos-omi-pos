import { IsIn } from 'class-validator';

const GATEWAYS = ['STRIPE', 'PAYPAL', 'PAYHERE'] as const;
const CURRENCIES = ['USD', 'LKR'] as const;

// Add-ons are monthly-only (AddOnModule has no annual price field), so unlike
// CreateCheckoutDto there is no billingCycle to pick.
export class CreateAddOnCheckoutDto {
  @IsIn(GATEWAYS)
  gateway: (typeof GATEWAYS)[number];

  @IsIn(CURRENCIES)
  currency: (typeof CURRENCIES)[number];
}
