import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Controller('customers')
@UseGuards(JwtAuthGuard)
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
}
