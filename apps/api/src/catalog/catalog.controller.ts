import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CatalogService } from './catalog.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { redactProductCost, redactProductsCost } from '../common/utils/redact-cost.util';

@Controller()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  // ─── Categories ────────────────────────────────────────────────────────

  @Get('categories')
  listCategories(@CurrentUser() u: RequestUser) {
    return this.catalog.listCategories(u.tenantId);
  }

  @Post('categories')
  @Roles('OWNER', 'MANAGER')
  @HttpCode(HttpStatus.CREATED)
  createCategory(@CurrentUser() u: RequestUser, @Body() dto: CreateCategoryDto) {
    return this.catalog.createCategory(u.tenantId, dto);
  }

  // ─── Products ──────────────────────────────────────────────────────────

  @Get('products')
  async listProducts(
    @CurrentUser() u: RequestUser,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('season') season?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.catalog.listProducts(u.tenantId, {
      search,
      categoryId,
      season,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
    return { ...result, items: redactProductsCost(result.items, u.role) };
  }

  @Get('products/barcode/:barcode')
  async getByBarcode(@CurrentUser() u: RequestUser, @Param('barcode') barcode: string) {
    const product = await this.catalog.getProductByBarcode(u.tenantId, barcode);
    return redactProductCost(product, u.role);
  }

  @Get('products/:id')
  async getProduct(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    const product = await this.catalog.getProductById(u.tenantId, id);
    return redactProductCost(product, u.role);
  }

  @Post('products')
  @Roles('OWNER', 'MANAGER')
  @HttpCode(HttpStatus.CREATED)
  createProduct(@CurrentUser() u: RequestUser, @Body() dto: CreateProductDto) {
    return this.catalog.createProduct(u.tenantId, dto);
  }

  @Put('products/:id')
  @Roles('OWNER', 'MANAGER')
  updateProduct(
    @CurrentUser() u: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalog.updateProduct(u.tenantId, id, dto);
  }

  @Delete('products/:id')
  @Roles('OWNER', 'MANAGER')
  deleteProduct(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.catalog.deleteProduct(u.tenantId, id);
  }
}
