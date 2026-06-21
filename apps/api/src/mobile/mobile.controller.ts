import {
  Body,
  Controller,
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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateRepairJobDto, RecordImeiDto, UpdateRepairJobDto } from './dto/mobile.dto';
import { MobileService } from './mobile.service';

@Controller('mobile')
@UseGuards(JwtAuthGuard)
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

  @Get('repair-jobs')
  listRepairJobs(@CurrentUser() u: RequestUser, @Query('status') status?: string) {
    return this.svc.listRepairJobs(u.tenantId, status);
  }

  @Post('repair-jobs')
  @HttpCode(HttpStatus.CREATED)
  createRepairJob(@CurrentUser() u: RequestUser, @Body() dto: CreateRepairJobDto) {
    return this.svc.createRepairJob(u.tenantId, dto);
  }

  @Patch('repair-jobs/:id')
  updateRepairJob(
    @CurrentUser() u: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateRepairJobDto,
  ) {
    return this.svc.updateRepairJob(u.tenantId, id, dto);
  }
}
