import { Controller, Get, Post, Body, Param, Put, UseGuards, Req } from '@nestjs/common';
import { WarrantyService } from './warranty.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('warranty')
@UseGuards(JwtAuthGuard)
export class WarrantyController {
  constructor(private readonly warrantyService: WarrantyService) {}

  @Get()
  getClaims(@Req() req) {
    return this.warrantyService.getClaims(req.user.tenantId);
  }

  @Post()
  createClaim(@Req() req, @Body() body) {
    return this.warrantyService.createClaim(req.user.tenantId, body);
  }

  @Put(':id/status')
  updateStatus(@Req() req, @Param('id') id: string, @Body('status') status: any) {
    return this.warrantyService.updateStatus(req.user.tenantId, id, status);
  }
}
