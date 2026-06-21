import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';

@Controller('outlets')
@UseGuards(JwtAuthGuard)
export class OutletsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@CurrentUser() u: RequestUser) {
    return this.prisma.withTenant(u.tenantId, (tx) =>
      tx.outlet.findMany({
        where: { tenantId: u.tenantId },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        select: { id: true, name: true, address: true, isDefault: true },
      }),
    );
  }
}
