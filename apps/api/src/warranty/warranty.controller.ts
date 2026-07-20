import { Controller, Get, Post, Body, Delete, Param, Put, Query, UseGuards, Req } from '@nestjs/common';
import { WarrantyService } from './warranty.service';
import { RequiresModule } from '../common/decorators/requires-module.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import {
  CreateWarrantyClaimDto,
  ListWarrantyClaimsQueryDto,
  UpdateWarrantyClaimStatusDto,
} from './dto/warranty.dto';

@Controller('warranty')
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@RequiresModule('warranty')
export class WarrantyController {
  constructor(private readonly warrantyService: WarrantyService) {}

  @Get()
  getClaims(@Req() req, @Query() query: ListWarrantyClaimsQueryDto) {
    return this.warrantyService.getClaims(req.user.tenantId, query);
  }

  @Post()
  createClaim(@Req() req, @Body() dto: CreateWarrantyClaimDto) {
    return this.warrantyService.createClaim(req.user.tenantId, dto);
  }

  @Put(':id/status')
  updateStatus(@Req() req, @Param('id') id: string, @Body() dto: UpdateWarrantyClaimStatusDto) {
    return this.warrantyService.updateStatus(req.user.tenantId, id, dto.status);
  }

  @Delete(':id')
  deleteClaim(@Req() req, @Param('id') id: string) {
    return this.warrantyService.deleteClaim(req.user.tenantId, id);
  }
}
