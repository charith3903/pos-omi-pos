import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import {
  CreateKotDto,
  CreateTableDto,
  UpdateKotStatusDto,
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

  @Patch('tables/:id/status')
  updateTableStatus(
    @CurrentUser() u: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateTableStatusDto,
  ) {
    return this.svc.updateTableStatus(u.tenantId, id, dto);
  }

  // ── KOTs ────────────────────────────────────────────────────────────────

  @Get('kots')
  listKots(
    @CurrentUser() u: RequestUser,
    @Query('tableId') tableId?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.listKots(u.tenantId, tableId, status);
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
}
