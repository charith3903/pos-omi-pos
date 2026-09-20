import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';

@Controller('users')
@UseGuards(JwtAuthGuard, SubscriptionGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /** Minimal tenant staff list — e.g. for a "Salesman" picker in the POS. */
  @Get()
  list(@CurrentUser() u: RequestUser) {
    return this.prisma.withTenant(u.tenantId, (tx) =>
      tx.user.findMany({
        where: { tenantId: u.tenantId },
        select: { id: true, name: true, role: true },
        orderBy: { name: 'asc' },
      }),
    );
  }
}
