import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { VerticalService } from './vertical.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class VerticalController {
  constructor(private readonly svc: VerticalService) {}

  /**
   * GET /vertical-pack
   * Returns the full vertical pack for the authenticated tenant.
   * UI uses this to self-configure labels, forms, and receipt layout.
   * Deliberately NOT behind SubscriptionGuard: the dashboard shell fetches
   * this on every page (including the reactivation/account-subscription
   * page) to render nav/labels — a suspended or trial-expired tenant must
   * still get a correctly-labeled UI while they pay to reactivate.
   */
  @Get('vertical-pack')
  async getPack(@CurrentUser() u: RequestUser) {
    return this.svc.getPackForTenant(u.tenantId);
  }

  /**
   * GET /products/search?q=BP-1234
   * Full-text + attribute search across pack-defined searchable fields.
   * Positioned before /products/:id so :id doesn't shadow it. This one IS
   * real business data, so it stays behind SubscriptionGuard.
   */
  @Get('products/search')
  @UseGuards(SubscriptionGuard)
  async searchProducts(
    @CurrentUser() u: RequestUser,
    @Query('q') q = '',
    @Query('limit') limit?: string,
  ) {
    const pack = await this.svc.getPackForTenant(u.tenantId);
    return this.svc.searchProducts(u.tenantId, q, pack, limit ? parseInt(limit) : 20);
  }
}
