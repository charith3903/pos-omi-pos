import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequiresModule } from '../common/decorators/requires-module.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { AddRepairPartDto, CheckoutRepairJobDto, CreateRepairJobDto, UpdateRepairJobDto } from './dto/repair.dto';
import { RepairsService } from './repairs.service';

@Controller('repairs')
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@RequiresModule('repairs')
export class RepairsController {
  constructor(private readonly svc: RepairsService) {}

  @Get()
  list(
    @CurrentUser() u: RequestUser,
    @Query('status') status?: string,
    @Query('technicianId') technicianId?: string,
  ) {
    return this.svc.list(u.tenantId, { status, technicianId });
  }

  @Get(':id')
  getById(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.svc.getById(u.tenantId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() u: RequestUser, @Body() dto: CreateRepairJobDto) {
    return this.svc.create(u.tenantId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() u: RequestUser, @Param('id') id: string, @Body() dto: UpdateRepairJobDto) {
    return this.svc.update(u.tenantId, id, dto);
  }

  @Post(':id/parts')
  @HttpCode(HttpStatus.CREATED)
  addPart(@CurrentUser() u: RequestUser, @Param('id') id: string, @Body() dto: AddRepairPartDto) {
    return this.svc.addPart(u.tenantId, id, dto);
  }

  @Delete(':id/parts/:partId')
  removePart(@CurrentUser() u: RequestUser, @Param('id') id: string, @Param('partId') partId: string) {
    return this.svc.removePart(u.tenantId, id, partId);
  }

  @Post(':id/checkout')
  @HttpCode(HttpStatus.CREATED)
  checkout(@CurrentUser() u: RequestUser, @Param('id') id: string, @Body() dto: CheckoutRepairJobDto) {
    return this.svc.checkout(u.tenantId, id, dto);
  }
}
