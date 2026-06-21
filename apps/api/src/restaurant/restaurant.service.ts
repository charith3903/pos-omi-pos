import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateKotDto,
  CreateTableDto,
  UpdateKotStatusDto,
  UpdateTableStatusDto,
} from './dto/restaurant.dto';

@Injectable()
export class RestaurantService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Tables ───────────────────────────────────────────────────────────────

  listTables(tenantId: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.restaurantTable.findMany({ orderBy: { name: 'asc' } }),
    );
  }

  createTable(tenantId: string, dto: CreateTableDto) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.restaurantTable.create({
        data: { tenantId, name: dto.name, area: dto.area, capacity: dto.capacity ?? 4 },
      }),
    );
  }

  async updateTableStatus(tenantId: string, id: string, dto: UpdateTableStatusDto) {
    await this.prisma.withTenant(tenantId, async (tx) => {
      const t = await tx.restaurantTable.findUnique({ where: { id } });
      if (!t) throw new NotFoundException('Table not found');
    });
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.restaurantTable.update({ where: { id }, data: { status: dto.status } }),
    );
  }

  // ── KOTs ─────────────────────────────────────────────────────────────────

  listKots(tenantId: string, tableId?: string, status?: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.kot.findMany({
        where: {
          ...(tableId && { tableId }),
          ...(status && { status }),
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  }

  createKot(tenantId: string, dto: CreateKotDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const kot = await tx.kot.create({
        data: {
          tenantId,
          tableId: dto.tableId ?? null,
          invoiceId: dto.invoiceId ?? null,
          orderType: dto.orderType,
          items: dto.items as any,
          status: 'PENDING',
        },
      });

      // Mark the table OCCUPIED when a KOT is opened for a dine-in
      if (dto.tableId && dto.orderType === 'DINE_IN') {
        await tx.restaurantTable.update({
          where: { id: dto.tableId },
          data: { status: 'OCCUPIED' },
        });
      }

      return kot;
    });
  }

  async updateKotStatus(tenantId: string, id: string, dto: UpdateKotStatusDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const kot = await tx.kot.findUnique({ where: { id } });
      if (!kot) throw new NotFoundException('KOT not found');

      const updated = await tx.kot.update({
        where: { id },
        data: { status: dto.status },
      });

      // Free the table when the last active KOT is done/cancelled
      if (kot.tableId && (dto.status === 'DONE' || dto.status === 'CANCELLED')) {
        const pending = await tx.kot.count({
          where: {
            tableId: kot.tableId,
            status: { in: ['PENDING', 'SENT'] },
          },
        });
        if (pending === 0) {
          await tx.restaurantTable.update({
            where: { id: kot.tableId },
            data: { status: 'AVAILABLE' },
          });
        }
      }

      return updated;
    });
  }
}
