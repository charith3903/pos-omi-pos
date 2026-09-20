import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { PosSettingsService } from './pos-settings.service';
import { UpdatePosSettingsDto } from './dto/update-pos-settings.dto';

@Controller('outlets/:outletId/settings')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
export class PosSettingsController {
  constructor(private readonly svc: PosSettingsService) {}

  @Get()
  @Roles('OWNER', 'MANAGER')
  get(@CurrentUser() u: RequestUser, @Param('outletId') outletId: string) {
    return this.svc.getForOutlet(u.tenantId, outletId);
  }

  @Put()
  @Roles('OWNER', 'MANAGER')
  update(@CurrentUser() u: RequestUser, @Param('outletId') outletId: string, @Body() dto: UpdatePosSettingsDto) {
    return this.svc.update(u.tenantId, outletId, dto);
  }
}
