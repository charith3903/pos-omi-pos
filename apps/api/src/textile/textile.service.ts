import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateVariantsDto } from './dto/textile.dto';

@Injectable()
export class TextileService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a size × color variant matrix for a product.
   * Skips combinations that already exist (idempotent).
   * Returns the full list of variants after generation.
   */
  async generateVariants(tenantId: string, dto: GenerateVariantsDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const product = await tx.product.findUnique({ where: { id: dto.productId } });
      if (!product) throw new NotFoundException('Product not found');

      const existing = await tx.productVariant.findMany({
        where: { productId: dto.productId },
        select: { attributes: true },
      });

      // Build a set of existing size-color combinations
      const existingKeys = new Set(
        existing.map((v) => {
          const a = v.attributes as Record<string, string>;
          return `${a.size ?? ''}|${a.color ?? ''}`;
        }),
      );

      const toCreate: { size: string; color: string }[] = [];
      for (const size of dto.sizes) {
        for (const color of dto.colors) {
          const key = `${size}|${color}`;
          if (!existingKeys.has(key)) toCreate.push({ size, color });
        }
      }

      if (toCreate.length > 0) {
        await tx.productVariant.createMany({
          data: toCreate.map(({ size, color }) => ({
            tenantId,
            productId: dto.productId,
            attributes: { size, color },
            barcode: dto.barcodePrefix
              ? `${dto.barcodePrefix}-${size}-${color}`.replace(/\s/g, '').toUpperCase()
              : null,
          })),
        });
      }

      return tx.productVariant.findMany({
        where: { productId: dto.productId },
        orderBy: [{ createdAt: 'asc' }],
      });
    });
  }

  /** List all variants for a product with size/color grouping summary. */
  async listVariants(tenantId: string, productId: string) {
    const variants = await this.prisma.withTenant(tenantId, (tx) =>
      tx.productVariant.findMany({
        where: { productId },
        orderBy: { createdAt: 'asc' },
      }),
    );

    // Summarise distinct sizes and colors
    const sizes = [...new Set(variants.map((v) => (v.attributes as any).size).filter(Boolean))];
    const colors = [...new Set(variants.map((v) => (v.attributes as any).color).filter(Boolean))];

    return { variants, matrix: { sizes, colors } };
  }
}
