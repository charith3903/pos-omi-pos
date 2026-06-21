import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ShiftsService } from './shifts.service';

class OpenShiftDto {
  @IsNumber() @Min(0) openingCash: number;
  @IsOptional() @IsString() outletId?: string;
}

class CloseShiftDto {
  @IsNumber() @Min(0) closingCash: number;
  @IsOptional() @IsString() notes?: string;
}

@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
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
}
