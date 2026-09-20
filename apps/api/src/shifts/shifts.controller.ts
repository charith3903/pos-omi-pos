import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CashMovementType } from '@prisma/client';
import { ShiftsService } from './shifts.service';

class OpenShiftDto {
  @IsNumber() @Min(0) openingCash: number;
  @IsOptional() @IsString() outletId?: string;
}

class CloseShiftDto {
  @IsNumber() @Min(0) closingCash: number;
  @IsOptional() @IsString() notes?: string;
}

class CreateCashMovementDto {
  @IsEnum(CashMovementType) type: CashMovementType;
  @IsNumber() @Min(0) amount: number;
  @IsOptional() @IsString() reason?: string;
}

@Controller('shifts')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
export class ShiftsController {
  constructor(private readonly svc: ShiftsService) {}

  @Get('current')
  getCurrent(@CurrentUser() u: RequestUser) {
    return this.svc.getCurrentShift(u.tenantId);
  }

  @Get()
  list(@CurrentUser() u: RequestUser) {
    return this.svc.listShifts(u.tenantId);
  }

  @Post('open')
  @Roles('OWNER', 'MANAGER')
  @HttpCode(HttpStatus.CREATED)
  open(@CurrentUser() u: RequestUser, @Body() dto: OpenShiftDto) {
    return this.svc.openShift(u.tenantId, u.email ?? 'system', dto.openingCash, dto.outletId);
  }

  @Post(':id/close')
  @Roles('OWNER', 'MANAGER')
  close(@CurrentUser() u: RequestUser, @Param('id') id: string, @Body() dto: CloseShiftDto) {
    return this.svc.closeShift(u.tenantId, id, u.email ?? 'system', dto.closingCash, dto.notes);
  }

  // Cash drawer / expense / paid-out — any signed-in cashier can log these,
  // unlike opening/closing the shift itself which stays manager-gated above.
  @Get(':id/cash-movements')
  listCashMovements(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.svc.listCashMovements(u.tenantId, id);
  }

  @Post(':id/cash-movements')
  @HttpCode(HttpStatus.CREATED)
  addCashMovement(@CurrentUser() u: RequestUser, @Param('id') id: string, @Body() dto: CreateCashMovementDto) {
    return this.svc.addCashMovement(u.tenantId, id, u.email ?? 'system', dto.type, dto.amount, dto.reason);
  }
}
