import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import {
  DateRangeDto,
  ExportDto,
  RefreshReportDto,
  SalesReportDto,
  SlowMoversDto,
  TopCustomersDto,
  TopProductsDto,
} from './dto/reports.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'MANAGER')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  // ── KPI snapshot ───────────────────────────────────────────────────────────

  @Get('kpi/today')
  getTodayKpi(@CurrentUser() u: RequestUser, @Query('outletId') outletId?: string) {
    return this.svc.getTodayKpi(u.tenantId, outletId);
  }

  // ── Sales ──────────────────────────────────────────────────────────────────

  @Get('sales')
  getSales(@CurrentUser() u: RequestUser, @Query() q: SalesReportDto) {
    return this.svc.getSalesSummary(u.tenantId, q.from, q.to, q.outletId, q.groupBy);
  }

  @Get('cashier')
  getCashier(@CurrentUser() u: RequestUser, @Query() q: DateRangeDto) {
    return this.svc.getCashierBreakdown(u.tenantId, q.from, q.to, q.outletId);
  }

  // ── Products ───────────────────────────────────────────────────────────────

  @Get('products/top')
  getTopProducts(@CurrentUser() u: RequestUser, @Query() q: TopProductsDto) {
    return this.svc.getTopProducts(u.tenantId, q.from, q.to, q.metric, q.limit);
  }

  @Get('products/slow')
  getSlowMovers(@CurrentUser() u: RequestUser, @Query() q: SlowMoversDto) {
    return this.svc.getSlowMovers(u.tenantId, q.days, q.limit);
  }

  // ── Stock ──────────────────────────────────────────────────────────────────

  @Get('stock/value')
  getStockValue(@CurrentUser() u: RequestUser) {
    return this.svc.getStockValue(u.tenantId);
  }

  @Get('stock/alerts')
  getStockAlerts(@CurrentUser() u: RequestUser) {
    return this.svc.getStockAlerts(u.tenantId);
  }

  // ── Customers ──────────────────────────────────────────────────────────────

  @Get('customers/top')
  getTopCustomers(@CurrentUser() u: RequestUser, @Query() q: TopCustomersDto) {
    return this.svc.getTopCustomers(u.tenantId, q.from, q.to, q.limit);
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  @Get('export')
  async export(
    @CurrentUser() u: RequestUser,
    @Query() q: ExportDto,
    @Res() res: Response,
  ) {
    const { filename, csv } = await this.svc.exportCsv(u.tenantId, q.type, q.from, q.to, q.outletId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  // ── Manual refresh ─────────────────────────────────────────────────────────

  @Post('refresh')
  @Roles('OWNER')
  @HttpCode(HttpStatus.ACCEPTED)
  refresh(@CurrentUser() u: RequestUser, @Body() dto: RefreshReportDto) {
    return this.svc.triggerRefresh(u.tenantId, dto.date);
  }
}
