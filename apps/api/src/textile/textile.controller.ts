import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { GenerateVariantsDto } from './dto/textile.dto';
import { TextileService } from './textile.service';

@Controller('textile')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TextileController {
  constructor(private readonly svc: TextileService) {}

  /**
   * POST /textile/generate-variants
   * Generates a size × color variant matrix, skipping existing combos.
   */
  @Post('generate-variants')
  @Roles('OWNER', 'MANAGER')
  @HttpCode(HttpStatus.CREATED)
  generateVariants(@CurrentUser() u: RequestUser, @Body() dto: GenerateVariantsDto) {
    return this.svc.generateVariants(u.tenantId, dto);
  }

  /**
   * GET /textile/variants/:productId
   * Returns all variants with a matrix summary { sizes, colors }.
   */
  @Get('variants/:productId')
  listVariants(@CurrentUser() u: RequestUser, @Param('productId') productId: string) {
    return this.svc.listVariants(u.tenantId, productId);
  }
}
