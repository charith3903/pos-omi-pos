import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import {
  CloseOrderDto,
  ComplementaryDto,
  CreateKotDto,
  CreateOrderDto,
  CreateSplitDto,
  CreateTableDto,
  DiscountDto,
  UpdateKotStatusDto,
  UpdateTableDto,
  UpdateTableStatusDto,
} from './dto/restaurant.dto';
import { RestaurantService } from './restaurant.service';

@Controller('restaurant')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RestaurantController {
  constructor(private readonly svc: RestaurantService) {}

  // ── Tables ──────────────────────────────────────────────────────────────

  @Get('tables')
  listTables(@CurrentUser() u: RequestUser) {
    return this.svc.listTables(u.tenantId);
  }

  @Post('tables')
  @Roles('OWNER', 'MANAGER')
  @HttpCode(HttpStatus.CREATED)
  createTable(@CurrentUser() u: RequestUser, @Body() dto: CreateTableDto) {
    return this.svc.createTable(u.tenantId, dto);
  }

  @Put('tables/:id')
  @Roles('OWNER', 'MANAGER')
  updateTable(@CurrentUser() u: RequestUser, @Param('id') id: string, @Body() dto: UpdateTableDto) {
    return this.svc.updateTable(u.tenantId, id, dto);
  }

  @Delete('tables/:id')
  @Roles('OWNER', 'MANAGER')
  deleteTable(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.svc.deleteTable(u.tenantId, id);
  }

  @Patch('tables/:id/status')
  updateTableStatus(
    @CurrentUser() u: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateTableStatusDto,
  ) {
    return this.svc.updateTableStatus(u.tenantId, id, dto);
  }

  // ── Orders ──────────────────────────────────────────────────────────────

  @Get('orders')
  listOrders(
    @CurrentUser() u: RequestUser,
    @Query('status') status?: string,
    @Query('tableId') tableId?: string,
  ) {
    return this.svc.listOrders(u.tenantId, status, tableId);
  }

  @Get('orders/:id')
  getOrder(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.svc.getOrder(u.tenantId, id);
  }

  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  createOrder(@CurrentUser() u: RequestUser, @Body() dto: CreateOrderDto) {
    return this.svc.createOrder(u.tenantId, dto);
  }

  @Patch('orders/:id/close')
  closeOrder(
    @CurrentUser() u: RequestUser,
    @Param('id') id: string,
    @Body() dto: CloseOrderDto,
  ) {
    return this.svc.closeOrder(u.tenantId, id, dto);
  }

  @Patch('orders/:id/complementary')
  @Roles('OWNER', 'MANAGER')
  setComplementary(
    @CurrentUser() u: RequestUser,
    @Param('id') id: string,
    @Body() dto: ComplementaryDto,
  ) {
    return this.svc.setComplementary(u.tenantId, id, dto);
  }

  @Patch('orders/:id/discount')
  @Roles('OWNER', 'MANAGER')
  applyDiscount(
    @CurrentUser() u: RequestUser,
    @Param('id') id: string,
    @Body() dto: DiscountDto,
  ) {
    return this.svc.applyDiscount(u.tenantId, id, dto);
  }

  @Patch('orders/:id/transfer/:tableId')
  transferTable(
    @CurrentUser() u: RequestUser,
    @Param('id') orderId: string,
    @Param('tableId') tableId: string,
  ) {
    return this.svc.transferTable(u.tenantId, orderId, tableId);
  }

  @Get('orders/:id/bill')
  getOrderBill(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.svc.getOrderBill(u.tenantId, id);
  }

  // ── Split Bill ───────────────────────────────────────────────────────────

  @Post('orders/:id/split')
  createSplit(
    @CurrentUser() u: RequestUser,
    @Param('id') orderId: string,
    @Body() dto: CreateSplitDto,
  ) {
    return this.svc.createSplit(u.tenantId, orderId, dto);
  }

  @Patch('split/:splitId/paid')
  markSplitPaid(@CurrentUser() u: RequestUser, @Param('splitId') splitId: string) {
    return this.svc.markSplitPaid(u.tenantId, splitId);
  }

  // ── KOTs ────────────────────────────────────────────────────────────────

  @Get('kots')
  listKots(
    @CurrentUser() u: RequestUser,
    @Query('tableId') tableId?: string,
    @Query('status') status?: string,
    @Query('orderId') orderId?: string,
  ) {
    return this.svc.listKots(u.tenantId, tableId, status, orderId);
  }

  @Post('kots')
  @HttpCode(HttpStatus.CREATED)
  createKot(@CurrentUser() u: RequestUser, @Body() dto: CreateKotDto) {
    return this.svc.createKot(u.tenantId, dto);
  }

  @Patch('kots/:id/status')
  updateKotStatus(
    @CurrentUser() u: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateKotStatusDto,
  ) {
    return this.svc.updateKotStatus(u.tenantId, id, dto);
  }

  @Delete('kots/:id')
  deleteKot(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.svc.deleteKot(u.tenantId, id);
  }

  // ── Promotions ────────────────────────────────────────────────────────────

  @Get('promotions')
  listPromotions(@CurrentUser() u: RequestUser) {
    return this.svc.listPromotions(u.tenantId);
  }

  @Post('promotions')
  @Roles('OWNER', 'MANAGER')
  @HttpCode(HttpStatus.CREATED)
  createPromotion(@CurrentUser() u: RequestUser, @Body() body: any) {
    return this.svc.createPromotion(u.tenantId, body);
  }
}
