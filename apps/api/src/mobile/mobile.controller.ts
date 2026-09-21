import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequiresModule } from '../common/decorators/requires-module.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { RecordImeiDto } from './dto/mobile.dto';
import { MobileService } from './mobile.service';

// Repair-job endpoints moved to RepairsModule ('/repairs') — that feature
// grew technician assignment, parts billing, and invoice checkout, which
// didn't belong bolted onto a controller named for IMEI tracking.
@Controller('mobile')
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@RequiresModule('mobile')
export class MobileController {
  constructor(private readonly svc: MobileService) {}

  @Post('imei')
  @HttpCode(HttpStatus.CREATED)
  recordImei(@CurrentUser() u: RequestUser, @Body() dto: RecordImeiDto) {
    return this.svc.recordImei(u.tenantId, dto);
  }

  @Get('imei')
  lookupImei(@CurrentUser() u: RequestUser, @Query('imei') imei: string) {
    return this.svc.lookupImei(u.tenantId, imei);
  }
}
