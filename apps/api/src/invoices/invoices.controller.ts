import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private readonly svc: InvoicesService) {}

  /**
   * POST /invoices
   * Idempotent: same UUID → returns the existing invoice without side-effects.
   * Transaction writes: invoice + items + payments + stock_movements atomically.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() u: RequestUser, @Body() dto: CreateInvoiceDto) {
    return this.svc.create(u.tenantId, dto);
  }

  @Get()
  list(
    @CurrentUser() u: RequestUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.list(u.tenantId, page ? +page : 1, limit ? +limit : 20);
  }

  @Get(':id')
  getById(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.svc.getById(u.tenantId, id);
  }
}
