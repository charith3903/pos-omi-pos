import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ApplyPromotionsDto, CreatePromotionDto } from './dto/supermarket.dto';
import { SupermarketService } from './supermarket.service';

@Controller('supermarket')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupermarketController {
  constructor(private readonly svc: SupermarketService) {}

  @Get('promotions')
  listPromotions(@CurrentUser() u: RequestUser, @Query('all') all?: string) {
    return this.svc.listPromotions(u.tenantId, all !== 'true');
  }

  @Post('promotions')
  @Roles('OWNER', 'MANAGER')
  @HttpCode(HttpStatus.CREATED)
  createPromotion(@CurrentUser() u: RequestUser, @Body() dto: CreatePromotionDto) {
    return this.svc.createPromotion(u.tenantId, dto);
  }

  @Delete('promotions/:id')
  @Roles('OWNER', 'MANAGER')
  deactivatePromotion(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.svc.deactivatePromotion(u.tenantId, id);
  }

  /** Called from the POS billing screen before checkout to compute discount breakdown. */
  @Post('apply-promotions')
  applyPromotions(@CurrentUser() u: RequestUser, @Body() dto: ApplyPromotionsDto) {
    return this.svc.applyPromotions(u.tenantId, dto);
  }
}
