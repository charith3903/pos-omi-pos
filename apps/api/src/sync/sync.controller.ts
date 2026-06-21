import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { SyncPushDto } from './dto/sync.dto';
import { SyncService } from './sync.service';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly svc: SyncService) {}

  /**
   * POST /sync/push
   * Accepts a batch of outbox items from the Flutter POS client.
   * Idempotent by invoice UUID.
   */
  @Post('push')
  push(@CurrentUser() u: RequestUser, @Body() dto: SyncPushDto) {
    return this.svc.push(u.tenantId, dto.deviceId ?? u.userId, dto);
  }

  /**
   * GET /sync/pull?since=ISO_DATE
   * Returns products, categories, and customers updated after `since`.
   * Cloud is source of truth for master data.
   */
  @Get('pull')
  pull(@CurrentUser() u: RequestUser, @Query('since') since?: string) {
    const sinceDate = since ? new Date(since) : new Date(0);
    return this.svc.pull(u.tenantId, sinceDate);
  }
}
