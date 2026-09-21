import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequiresModule } from '../common/decorators/requires-module.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ExchangeVariantDto, GenerateVariantsDto } from './dto/textile.dto';
import { TextileService } from './textile.service';
import { canViewCost } from '../common/utils/redact-cost.util';

@Controller('textile')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@RequiresModule('variants')
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
  async listVariants(@CurrentUser() u: RequestUser, @Param('productId') productId: string) {
    const result = await this.svc.listVariants(u.tenantId, productId);
    if (canViewCost(u.role)) return result;
    return {
      ...result,
      variants: result.variants.map(({ cost: _cost, ...rest }: any) => rest),
    };
  }

  /**
   * POST /textile/exchange
   * Swaps one variant on an already-sold invoice line for another variant
   * of the same product. No @Roles restriction — this is a till-side
   * operation any authenticated staff member should be able to do.
   */
  @Post('exchange')
  exchangeVariant(@CurrentUser() u: RequestUser, @Body() dto: ExchangeVariantDto) {
    return this.svc.exchangeVariant(u.tenantId, dto);
  }

  /**
   * POST /textile/variants/import
   * Multipart CSV upload (columns: sku, size, color, barcode, price) —
   * bulk-creates/updates variants across many products at once.
   */
  @Post('variants/import')
  @Roles('OWNER', 'MANAGER')
  @UseInterceptors(FileInterceptor('file'))
  importVariants(@CurrentUser() u: RequestUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded — expected a "file" field');
    return this.svc.importVariantsFromCsv(u.tenantId, file.buffer);
  }
}
