import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { QuotationsService } from './quotations.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationStatusDto } from './dto/update-quotation-status.dto';

@Controller('quotations')
@UseGuards(JwtAuthGuard, SubscriptionGuard)
export class QuotationsController {
  constructor(private readonly svc: QuotationsService) {}

  @Get()
  list(@CurrentUser() u: RequestUser) {
    return this.svc.list(u.tenantId);
  }

  @Get(':id')
  get(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.svc.get(u.tenantId, id);
  }

  @Post()
  create(@CurrentUser() u: RequestUser, @Body() dto: CreateQuotationDto) {
    return this.svc.create(u.tenantId, dto);
  }

  @Put(':id/status')
  updateStatus(@CurrentUser() u: RequestUser, @Param('id') id: string, @Body() dto: UpdateQuotationStatusDto) {
    return this.svc.updateStatus(u.tenantId, id, dto);
  }
}
