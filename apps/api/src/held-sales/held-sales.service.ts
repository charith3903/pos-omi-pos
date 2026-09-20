import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHeldSaleDto } from './dto/create-held-sale.dto';

@Injectable()
export class HeldSalesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.heldSale.findMany({
        where: { tenantId },
        include: { customer: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async create(tenantId: string, createdBy: string, dto: CreateHeldSaleDto) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.heldSale.create({
        data: {
          tenantId,
          outletId: dto.outletId ?? null,
          customerId: dto.customerId ?? null,
          note: dto.note ?? null,
          cartSnapshot: dto.cartSnapshot as any,
          createdBy,
        },
      }),
    );
  }

  async remove(tenantId: string, id: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.heldSale.findFirst({ where: { id, tenantId } });
      if (!existing) throw new NotFoundException('Held sale not found');
      await tx.heldSale.delete({ where: { id } });
      return { id };
    });
  }
}
