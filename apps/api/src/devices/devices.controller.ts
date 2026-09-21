import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto, RenameDeviceDto } from './dto/device.dto';

@Controller('devices')
@UseGuards(JwtAuthGuard, SubscriptionGuard)
export class DevicesController {
  constructor(private readonly svc: DevicesService) {}

  @Get()
  list(@CurrentUser() u: RequestUser) {
    return this.svc.list(u.tenantId);
  }

  @Get(':id')
  get(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.svc.get(u.tenantId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  register(@CurrentUser() u: RequestUser, @Body() dto: RegisterDeviceDto) {
    return this.svc.register(u.tenantId, dto);
  }

  @Patch(':id')
  rename(@CurrentUser() u: RequestUser, @Param('id') id: string, @Body() dto: RenameDeviceDto) {
    return this.svc.rename(u.tenantId, id, dto);
  }
}
