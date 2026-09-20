import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { IsNumber, IsOptional, Min } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';

class SetCreditLimitDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number | null;
}

class RecordCreditPaymentDto {
  @IsNumber()
  @Min(0.01)
  amount: number;
}

@Controller('customers')
@UseGuards(JwtAuthGuard, SubscriptionGuard)
export class CustomersController {
  constructor(private readonly svc: CustomersService) {}

  @Get()
  list(@CurrentUser() u: RequestUser, @Query('search') search?: string) {
    return this.svc.list(u.tenantId, search);
  }

  @Get(':id')
  get(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.svc.getById(u.tenantId, id);
  }

  @Post()
  create(@CurrentUser() u: RequestUser, @Body() dto: CreateCustomerDto) {
    return this.svc.create(u.tenantId, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() u: RequestUser,
    @Param('id') id: string,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.svc.update(u.tenantId, id, dto);
  }

  @Patch(':id/credit')
  setCreditLimit(@CurrentUser() u: RequestUser, @Param('id') id: string, @Body() dto: SetCreditLimitDto) {
    return this.svc.setCreditLimit(u.tenantId, id, dto.creditLimit ?? null);
  }

  @Post(':id/credit-payments')
  recordCreditPayment(@CurrentUser() u: RequestUser, @Param('id') id: string, @Body() dto: RecordCreditPaymentDto) {
    return this.svc.recordCreditPayment(u.tenantId, id, dto.amount);
  }
}
