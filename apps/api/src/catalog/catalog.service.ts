import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { VerticalService } from '../vertical/vertical.service';
import { PurchasingService } from '../purchasing/purchasing.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly vertical: VerticalService,
    private readonly purchasing: PurchasingService,
  ) {}

  /**
   * Annotates a product (and its variants) with `effectivePrice`: the
   * oldest-remaining batch's selling price (FIFO) when one exists, else the
   * product/variant's own `price`. Lets the till always show/charge the
   * correct batch-wise price without the caller needing to know about GRN
   * batches at all.
   */
  private async withEffectivePrice<T extends { id: string; price: any; variants?: { id: string; price: any }[] }>(
    tenantId: string,
    product: T,
  ): Promise<T & { effectivePrice: number; variants?: (T['variants'] extends (infer V)[] ? V & { effectivePrice: number } : never)[] }> {
    const [productBatchPrice, variantBatchPrices] = await Promise.all([
      this.purchasing.getEffectivePrice(tenantId, product.id, null),
      Promise.all(
        (product.variants ?? []).map((v) => this.purchasing.getEffectivePrice(tenantId, product.id, v.id)),
      ),
    ]);

    return {
      ...product,
      effectivePrice: productBatchPrice ?? Number(product.price),
      variants: product.variants?.map((v, i) => ({
        ...v,
        effectivePrice: variantBatchPrices[i] ?? Number(v.price ?? product.price),
      })) as any,
    };
  }

  // ─── Categories ──────────────────────────────────────────────────────────

  async listCategories(tenantId: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.category.findMany({ orderBy: { name: 'asc' }, include: { children: true } }),
    );
  }

  async createCategory(tenantId: string, dto: CreateCategoryDto) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.category.create({
        data: { tenantId, name: dto.name, parentId: dto.parentId },
      }),
    );
  }

  // ─── Products ────────────────────────────────────────────────────────────

  async listProducts(
    tenantId: string,
    opts: { search?: string; categoryId?: string; season?: string; page?: number; limit?: number },
  ) {
    const { search, categoryId, season, page = 1, limit = 30 } = opts;
    return this.prisma.withTenant(tenantId, async (tx) => {
      const where = {
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { sku: { contains: search, mode: 'insensitive' as const } },
            { barcode: { contains: search, mode: 'insensitive' as const } },
          ],
        }),
        ...(categoryId && { categoryId }),
        ...(season && { attributes: { path: ['season'], equals: season } }),
      };

      const [rawItems, total] = await Promise.all([
        tx.product.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { name: 'asc' },
          include: { category: { select: { id: true, name: true } }, variants: true },
        }),
        tx.product.count({ where }),
      ]);

      const items = await Promise.all(rawItems.map((p) => this.withEffectivePrice(tenantId, p)));
      return { items, total, page, limit };
    });
  }

  async getProductById(tenantId: string, id: string) {
    const product = await this.prisma.withTenant(tenantId, (tx) =>
      tx.product.findUnique({
        where: { id },
        include: { category: true, variants: true },
      }),
    );
    if (!product) throw new NotFoundException('Product not found');
    return this.withEffectivePrice(tenantId, product);
  }

  async getProductByBarcode(tenantId: string, barcode: string) {
    // Textile-style products are scanned by their variant's barcode (each
    // size/color combo gets its own), not the parent product's — match both.
    const product = await this.prisma.withTenant(tenantId, (tx) =>
      tx.product.findFirst({
        where: { OR: [{ barcode }, { variants: { some: { barcode } } }] },
        include: { category: { select: { id: true, name: true } }, variants: true },
      }),
    );
    if (!product) throw new NotFoundException('Product not found');
    const withPrice = await this.withEffectivePrice(tenantId, product);
    const matchedVariant = withPrice.variants?.find((v: any) => v.barcode === barcode);
    return matchedVariant ? { ...withPrice, matchedVariantId: matchedVariant.id } : withPrice;
  }

  async createProduct(tenantId: string, dto: CreateProductDto) {
    if (dto.sku) {
      const existing = await this.prisma.withTenant(tenantId, (tx) =>
        tx.product.findFirst({ where: { sku: dto.sku } }),
      );
      if (existing) throw new ConflictException('SKU already exists');
    }

    const pack = await this.vertical.getPackForTenant(tenantId);
    this.vertical.validateAttributes(dto.attributes, pack);

    return this.prisma.withTenant(tenantId, (tx) =>
      tx.product.create({
        data: {
          tenantId,
          name: dto.name,
          categoryId: dto.categoryId,
          sku: dto.sku,
          barcode: dto.barcode,
          price: dto.price,
          wholesalePrice: dto.wholesalePrice,
          cost: dto.cost,
          taxRate: dto.taxRate ?? pack.defaultTaxRate,
          trackStock: dto.trackStock ?? true,
          attributes: dto.attributes as any,
          variants: dto.variants
            ? {
                create: dto.variants.map((v) => ({
                  tenantId,
                  attributes: v.attributes as any,
                  price: v.price,
                  wholesalePrice: v.wholesalePrice,
                  barcode: v.barcode,
                  sku: v.sku,
                })),
              }
            : undefined,
        },
        include: { variants: true },
      }),
    );
  }

  async updateProduct(tenantId: string, id: string, dto: UpdateProductDto) {
    await this.getProductById(tenantId, id);

    if (dto.attributes !== undefined) {
      const pack = await this.vertical.getPackForTenant(tenantId);
      this.vertical.validateAttributes(dto.attributes, pack);
    }

    const updated = await this.prisma.withTenant(tenantId, (tx) =>
      tx.product.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
          ...(dto.sku !== undefined && { sku: dto.sku }),
          ...(dto.barcode !== undefined && { barcode: dto.barcode }),
          ...(dto.price !== undefined && { price: dto.price }),
          ...(dto.wholesalePrice !== undefined && { wholesalePrice: dto.wholesalePrice }),
          ...(dto.cost !== undefined && { cost: dto.cost }),
          ...(dto.taxRate !== undefined && { taxRate: dto.taxRate }),
          ...(dto.trackStock !== undefined && { trackStock: dto.trackStock }),
          ...(dto.attributes !== undefined && { attributes: dto.attributes as any }),
        },
        include: { variants: true },
      }),
    );

    await this.redis.del(`stock:${tenantId}:${id}`);
    return updated;
  }

  async deleteProduct(tenantId: string, id: string) {
    await this.getProductById(tenantId, id);
    await this.prisma.withTenant(tenantId, (tx) =>
      tx.product.delete({ where: { id } }),
    );
    await this.redis.del(`stock:${tenantId}:${id}`);
    return { deleted: true };
  }
}
