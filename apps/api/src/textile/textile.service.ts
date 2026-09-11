import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ExchangeVariantDto, GenerateVariantsDto } from './dto/textile.dto';

interface VariantCsvRow {
  sku?: string;
  size?: string;
  color?: string;
  barcode?: string;
  price?: string;
}

export interface VariantImportResult {
  created: number;
  updated: number;
  errors: { row: number; sku: string; reason: string }[];
}

@Injectable()
export class TextileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

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

  /**
   * Exchange one variant of an already-sold line for another variant of the
   * same product (e.g. size M for size L). Records two linked stock
   * movements and repoints the InvoiceItem at the new variant — all in one
   * transaction, since two independent stock adjustments could otherwise
   * half-fail and create phantom stock. `unitPrice`/`lineTotal` on the
   * InvoiceItem are left untouched (historical revenue integrity); the
   * price difference, if any, is returned for the cashier to collect or
   * refund manually rather than auto-processing a payment.
   */
  async exchangeVariant(tenantId: string, dto: ExchangeVariantDto) {
    const result = await this.prisma.withTenant(tenantId, async (tx) => {
      const invoiceItem = await tx.invoiceItem.findUnique({
        where: { id: dto.invoiceItemId },
        include: { product: true },
      });
      if (!invoiceItem) throw new NotFoundException('Invoice item not found');
      if (!invoiceItem.variantId) {
        throw new BadRequestException('This line was not sold as a specific variant — nothing to exchange');
      }

      const toVariant = await tx.productVariant.findUnique({ where: { id: dto.toVariantId } });
      if (!toVariant) throw new NotFoundException('Target variant not found');
      if (toVariant.productId !== invoiceItem.productId) {
        throw new BadRequestException('The target variant must belong to the same product');
      }
      if (toVariant.id === invoiceItem.variantId) {
        throw new BadRequestException('That is already the variant on this line');
      }

      const fromVariantId = invoiceItem.variantId;
      const exchangeId = `exchange_${dto.invoiceItemId}_${Date.now()}`;

      await tx.stockMovement.createMany({
        data: [
          {
            tenantId,
            productId: invoiceItem.productId,
            variantId: fromVariantId,
            qtyDelta: dto.qty,
            reason: 'EXCHANGE',
            refId: exchangeId,
          },
          {
            tenantId,
            productId: invoiceItem.productId,
            variantId: toVariant.id,
            qtyDelta: -dto.qty,
            reason: 'EXCHANGE',
            refId: exchangeId,
          },
        ],
      });

      const attrs = toVariant.attributes as Record<string, string>;
      const variantLabel = Object.values(attrs).filter(Boolean).join(' / ');
      const baseName = invoiceItem.nameSnapshot.replace(/\s*\[.*\]$/, '');

      const updatedItem = await tx.invoiceItem.update({
        where: { id: dto.invoiceItemId },
        data: {
          variantId: toVariant.id,
          nameSnapshot: variantLabel ? `${baseName}  [${variantLabel}]` : baseName,
        },
      });

      const newUnitPrice = Number(toVariant.price ?? invoiceItem.product.price);
      const priceDifference = newUnitPrice - Number(invoiceItem.unitPrice);

      return {
        exchangeId,
        from: { variantId: fromVariantId, qty: dto.qty },
        to: { variantId: toVariant.id, qty: dto.qty },
        priceDifference,
        invoiceItem: updatedItem,
      };
    });

    await Promise.allSettled([
      this.redis.del(`stock:${tenantId}:${result.invoiceItem.productId}`),
      this.redis.del(`stock:${tenantId}:all`),
      this.redis.del(`stock:${tenantId}:allVariants`),
    ]);

    return result;
  }

  /**
   * Bulk-creates/updates variants from a CSV file: columns sku, size, color,
   * barcode (optional), price (optional). Matches the Product by `sku`, then
   * upserts the variant on (productId, size, color) — re-uploading the same
   * file later bulk-updates barcodes/prices rather than erroring on
   * duplicates. One bad row never aborts the rest of the import.
   */
  async importVariantsFromCsv(tenantId: string, buffer: Buffer): Promise<VariantImportResult> {
    let rows: VariantCsvRow[];
    try {
      rows = parse(buffer, { columns: true, skip_empty_lines: true, trim: true }) as VariantCsvRow[];
    } catch (err: any) {
      throw new BadRequestException(`Could not parse CSV: ${err.message}`);
    }

    const result: VariantImportResult = { created: 0, updated: 0, errors: [] };

    await this.prisma.withTenant(tenantId, async (tx) => {
      for (let i = 0; i < rows.length; i++) {
        const rowNum = i + 2; // +1 for 0-index, +1 for the header line
        const row = rows[i];
        const sku = row.sku?.trim();
        const size = row.size?.trim();
        const color = row.color?.trim();

        if (!sku || !size || !color) {
          result.errors.push({ row: rowNum, sku: sku ?? '', reason: 'sku, size and color are required' });
          continue;
        }

        const product = await tx.product.findFirst({ where: { sku } });
        if (!product) {
          result.errors.push({ row: rowNum, sku, reason: 'No product found with this SKU' });
          continue;
        }

        let price: number | undefined;
        if (row.price !== undefined && row.price !== '') {
          price = Number(row.price);
          if (Number.isNaN(price)) {
            result.errors.push({ row: rowNum, sku, reason: `Invalid price "${row.price}"` });
            continue;
          }
        }

        const existing = await tx.productVariant.findMany({
          where: { productId: product.id },
          select: { id: true, attributes: true },
        });
        const match = existing.find((v) => {
          const a = v.attributes as Record<string, string>;
          return a.size === size && a.color === color;
        });

        if (match) {
          await tx.productVariant.update({
            where: { id: match.id },
            data: {
              ...(row.barcode ? { barcode: row.barcode.trim() } : {}),
              ...(price !== undefined ? { price } : {}),
            },
          });
          result.updated++;
        } else {
          await tx.productVariant.create({
            data: {
              tenantId,
              productId: product.id,
              attributes: { size, color },
              barcode: row.barcode?.trim() || null,
              price: price ?? null,
            },
          });
          result.created++;
        }
      }
    });

    return result;
  }
}
