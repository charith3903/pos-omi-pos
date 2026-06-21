import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { LoyaltyService } from './loyalty.service';

class EarnDto {
  @IsNumber() amount: number;
  @IsOptional() @IsString() referenceId?: string;
  @IsOptional() @IsString() notes?: string;
}

class RedeemDto {
  @IsInt() @Min(1) points: number;
  @IsOptional() @IsString() referenceId?: string;
}

class AdjustDto {
  @IsInt() points: number;
  @IsOptional() @IsString() notes?: string;
}

@Controller('loyalty')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LoyaltyController {
  constructor(private readonly svc: LoyaltyService) {}

  @Get('tiers')
  getTiers() {
    return this.svc.getTierSummary();
  }

  @Get('accounts')
  listAccounts(@CurrentUser() u: RequestUser) {
    return this.svc.listAccounts(u.tenantId);
  }

  @Post('enroll/:customerId')
  @HttpCode(HttpStatus.OK)
  enroll(@CurrentUser() u: RequestUser, @Param('customerId') customerId: string) {
    return this.svc.getOrEnroll(u.tenantId, customerId);
  }

  @Get(':customerId')
  getAccount(@CurrentUser() u: RequestUser, @Param('customerId') customerId: string) {
    return this.svc.getAccount(u.tenantId, customerId);
  }

  @Get(':customerId/transactions')
  getTransactions(@CurrentUser() u: RequestUser, @Param('customerId') customerId: string) {
    return this.svc.getTransactions(u.tenantId, customerId);
  }

  @Post(':customerId/earn')
  @HttpCode(HttpStatus.OK)
  earn(
    @CurrentUser() u: RequestUser,
    @Param('customerId') customerId: string,
    @Body() dto: EarnDto,
  ) {
    return this.svc.earnPoints(u.tenantId, customerId, dto.amount, dto.referenceId, dto.notes);
  }

  @Post(':customerId/redeem')
  @HttpCode(HttpStatus.OK)
  redeem(
    @CurrentUser() u: RequestUser,
    @Param('customerId') customerId: string,
    @Body() dto: RedeemDto,
  ) {
    return this.svc.redeemPoints(u.tenantId, customerId, dto.points, dto.referenceId);
  }

  @Post(':customerId/adjust')
  @Roles('OWNER', 'MANAGER')
  @HttpCode(HttpStatus.OK)
  adjust(
    @CurrentUser() u: RequestUser,
    @Param('customerId') customerId: string,
    @Body() dto: AdjustDto,
  ) {
    return this.svc.adjustPoints(u.tenantId, customerId, dto.points, dto.notes);
  }
}
