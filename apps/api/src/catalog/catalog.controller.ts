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
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CatalogService } from './catalog.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
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
  listProducts(
    @CurrentUser() u: RequestUser,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.catalog.listProducts(u.tenantId, {
      search,
      categoryId,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('products/barcode/:barcode')
  getByBarcode(@CurrentUser() u: RequestUser, @Param('barcode') barcode: string) {
    return this.catalog.getProductByBarcode(u.tenantId, barcode);
  }

  @Get('products/:id')
  getProduct(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.catalog.getProductById(u.tenantId, id);
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
