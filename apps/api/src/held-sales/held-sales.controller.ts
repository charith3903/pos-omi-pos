import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { HeldSalesService } from './held-sales.service';
import { CreateHeldSaleDto } from './dto/create-held-sale.dto';

@Controller('held-sales')
@UseGuards(JwtAuthGuard, SubscriptionGuard)
export class HeldSalesController {
  constructor(private readonly svc: HeldSalesService) {}

  @Get()
  list(@CurrentUser() u: RequestUser) {
    return this.svc.list(u.tenantId);
  }

  @Post()
  create(@CurrentUser() u: RequestUser, @Body() dto: CreateHeldSaleDto) {
    return this.svc.create(u.tenantId, u.userId, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.svc.remove(u.tenantId, id);
  }
}
