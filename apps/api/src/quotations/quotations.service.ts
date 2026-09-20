import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationStatusDto } from './dto/update-quotation-status.dto';

@Injectable()
export class QuotationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.quotation.findMany({
        where: { tenantId },
        include: { items: { include: { product: { select: { id: true, name: true } } } }, customer: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async get(tenantId: string, id: string) {
    const quotation = await this.prisma.withTenant(tenantId, (tx) =>
      tx.quotation.findFirst({
        where: { id, tenantId },
        include: { items: { include: { product: { select: { id: true, name: true } }, variant: true } }, customer: true },
      }),
    );
    if (!quotation) throw new NotFoundException('Quotation not found');
    return quotation;
  }

  async create(tenantId: string, dto: CreateQuotationDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const count = await tx.quotation.count({ where: { tenantId } });
      const number = `QUO-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

      let total = 0;
      const items = dto.items.map((item) => {
        const lineTotal = item.qty * item.unitPrice - (item.discount ?? 0);
        total += lineTotal;
        return {
          tenantId,
          productId: item.productId,
          variantId: item.variantId ?? null,
          qty: item.qty,
          unitPrice: item.unitPrice,
          discount: item.discount ?? 0,
          lineTotal,
        };
      });

      return tx.quotation.create({
        data: {
          tenantId,
          outletId: dto.outletId ?? null,
          customerId: dto.customerId ?? null,
          number,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          notes: dto.notes ?? null,
          total,
          items: { create: items },
        },
        include: { items: true },
      });
    });
  }

  async updateStatus(tenantId: string, id: string, dto: UpdateQuotationStatusDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.quotation.findFirst({ where: { id, tenantId } });
      if (!existing) throw new NotFoundException('Quotation not found');
      return tx.quotation.update({ where: { id }, data: { status: dto.status } });
    });
  }
}
