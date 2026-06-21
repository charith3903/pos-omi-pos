import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { RefundsService } from './refunds.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('refunds')
@UseGuards(JwtAuthGuard)
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Post()
  processRefund(@Req() req, @Body() body) {
    return this.refundsService.processRefund(req.user.tenantId, body);
  }
}
