import { BadRequestException, Injectable } from '@nestjs/common';
import { VerticalField, VerticalPack } from '@omnipos/types';
import { PrismaService } from '../prisma/prisma.service';
import { getPackForBusinessType } from './packs/registry';

@Injectable()
export class VerticalService {
  constructor(private readonly prisma: PrismaService) {}

  async getPackForTenant(tenantId: string): Promise<VerticalPack> {
    const rows = await this.prisma.$queryRaw<[{ business_type: string }]>`
      SELECT business_type FROM tenants WHERE id = ${tenantId} LIMIT 1
    `;
    const businessType = rows[0]?.business_type ?? 'DEFAULT';
    return getPackForBusinessType(businessType);
  }

  /**
   * Validates `attributes` against the pack's productFields.
   * Throws BadRequestException with all validation errors at once.
   */
  validateAttributes(
    attributes: Record<string, unknown> | undefined | null,
    pack: VerticalPack,
  ): void {
    const errors: string[] = [];
    const attrs = attributes ?? {};

    for (const field of pack.productFields) {
      const value = attrs[field.key];

      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field.label} is required`);
        continue;
      }

      if (value === undefined || value === null || value === '') continue;

      this.validateField(field, value, errors);
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }
  }

  private validateField(
    field: VerticalField,
    value: unknown,
    errors: string[],
  ): void {
    switch (field.type) {
      case 'number':
        if (typeof value !== 'number' && isNaN(Number(value))) {
          errors.push(`${field.label} must be a number`);
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          errors.push(`${field.label} must be true or false`);
        }
        break;
      case 'select':
        if (field.options && !field.options.includes(String(value))) {
          errors.push(`${field.label} must be one of: ${field.options.join(', ')}`);
        }
        break;
      default:
        break;
    }
  }

  /**
   * Searches products using pack-defined searchable fields (JSONB attributes).
   * Falls back to name/sku/barcode for verticals with no attribute fields.
   */
  async searchProducts(
    tenantId: string,
    query: string,
    pack: VerticalPack,
    limit = 20,
  ): Promise<any[]> {
    const searchableKeys = pack.productFields
      .filter((f) => f.searchable)
      .map((f) => f.key);

    // Build attribute clauses using trusted pack field keys (not user input)
    const attrClauses = searchableKeys
      .map((k) => `p.attributes->>'${k}' ILIKE $1`)
      .join(' OR ');

    const sql = `
      SELECT
        p.id, p.name, p.sku, p.barcode, p.price, p.tax_rate AS "taxRate",
        p.track_stock AS "trackStock", p.category_id AS "categoryId",
        p.attributes
      FROM products p
      WHERE (
        p.name ILIKE $1
        OR p.sku ILIKE $1
        OR p.barcode = $2
        ${attrClauses ? `OR ${attrClauses}` : ''}
      )
      ORDER BY p.name
      LIMIT ${limit}
    `;

    return this.prisma.withTenant(tenantId, (tx) =>
      tx.$queryRawUnsafe<any[]>(sql, `%${query}%`, query),
    );
  }
}
