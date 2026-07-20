import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateWarrantyClaimDto,
  ListWarrantyClaimsQueryDto,
  WarrantyClaimStatusKey,
} from './dto/warranty.dto';

@Injectable()
export class WarrantyService {
  constructor(private prisma: PrismaService) {}

  async getClaims(tenantId: string, query: ListWarrantyClaimsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    return this.prisma.withTenant(tenantId, async (tx) => {
      const where = { tenantId, ...(query.status ? { status: query.status } : {}) };
      const [items, total] = await Promise.all([
        tx.warrantyClaim.findMany({
          where,
          include: { product: true, invoice: true },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        tx.warrantyClaim.count({ where }),
      ]);
      return { items, total, page, limit };
    });
  }

  async createClaim(tenantId: string, dto: CreateWarrantyClaimDto) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.warrantyClaim.create({
        data: {
          tenantId,
          productId: dto.productId,
          invoiceId: dto.invoiceId,
          serial: dto.serial,
          issue: dto.issue,
          notes: dto.notes,
          status: 'PENDING',
        },
      }),
    );
  }

  async updateStatus(tenantId: string, id: string, status: WarrantyClaimStatusKey) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.warrantyClaim.findFirst({ where: { id, tenantId } });
      if (!existing) throw new NotFoundException('Warranty claim not found');
      return tx.warrantyClaim.update({ where: { id }, data: { status } });
    });
  }

  async deleteClaim(tenantId: string, id: string): Promise<void> {
    await this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.warrantyClaim.findFirst({ where: { id, tenantId } });
      if (!existing) throw new NotFoundException('Warranty claim not found');
      await tx.warrantyClaim.delete({ where: { id } });
    });
  }
}
