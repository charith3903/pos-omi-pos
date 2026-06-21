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
import { CreateRentalAgreementDto, ReturnRentalDto } from './dto/rental.dto';
import { RentalService } from './rental.service';

@Controller('rental')
@UseGuards(JwtAuthGuard)
export class RentalController {
  constructor(private readonly svc: RentalService) {}

  @Get('agreements')
  listAgreements(@CurrentUser() u: RequestUser, @Query('status') status?: string) {
    return this.svc.listAgreements(u.tenantId, status);
  }

  @Post('agreements')
  @HttpCode(HttpStatus.CREATED)
  createAgreement(@CurrentUser() u: RequestUser, @Body() dto: CreateRentalAgreementDto) {
    return this.svc.createAgreement(u.tenantId, dto);
  }

  @Patch('agreements/:id/return')
  processReturn(
    @CurrentUser() u: RequestUser,
    @Param('id') id: string,
    @Body() dto: ReturnRentalDto,
  ) {
    return this.svc.processReturn(u.tenantId, id, dto);
  }

  @Get('availability')
  checkAvailability(
    @CurrentUser() u: RequestUser,
    @Query('productId') productId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.svc.checkAvailability(u.tenantId, productId, from, to);
  }
}
