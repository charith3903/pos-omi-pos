import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { NotificationsService } from './notifications.service';
import { UpdateNotificationSettingsDto } from './dto/update-settings.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get('settings')
  @Roles('OWNER', 'MANAGER')
  getSettings(@CurrentUser() u: RequestUser) {
    return this.svc.getSettings(u.tenantId);
  }

  @Put('settings')
  @Roles('OWNER', 'MANAGER')
  updateSettings(@CurrentUser() u: RequestUser, @Body() dto: UpdateNotificationSettingsDto) {
    return this.svc.updateSettings(u.tenantId, dto);
  }

  // Any authenticated role can send — e.g. a cashier sending a receipt after checkout.
  @Post('send')
  send(@CurrentUser() u: RequestUser, @Body() dto: SendMessageDto) {
    return this.svc.send(u.tenantId, dto);
  }

  @Get('logs')
  getLogs(@CurrentUser() u: RequestUser, @Query('page') page?: string) {
    return this.svc.getLogs(u.tenantId, page ? Number(page) : 1);
  }
}
