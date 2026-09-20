import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { RefundsService } from './refunds.service';
import { ProcessRefundDto } from './dto/process-refund.dto';
import { RequiresModule } from '../common/decorators/requires-module.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';

@Controller('refunds')
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@RequiresModule('refunds')
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Post()
  processRefund(@Req() req, @Body() dto: ProcessRefundDto) {
    return this.refundsService.processRefund(req.user.tenantId, dto);
  }
}
