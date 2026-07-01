import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CloseOrderDto,
  ComplementaryDto,
  CreateKotDto,
  CreateOrderDto,
  CreateSplitDto,
  CreateTableDto,
  DiscountDto,
  UpdateKotStatusDto,
  UpdateTableDto,
  UpdateTableStatusDto,
} from './dto/restaurant.dto';

const ORDER_INCLUDE = {
  table: { select: { id: true, name: true, area: true, capacity: true } },
  kots: { orderBy: { createdAt: 'asc' } },
} as const;

@Injectable()
export class RestaurantService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Tables ───────────────────────────────────────────────────────────────

  listTables(tenantId: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.restaurantTable.findMany({
        orderBy: [{ area: 'asc' }, { name: 'asc' }],
        include: {
          orders: {
            where: { status: 'OPEN' },
            take: 1,
            select: { id: true, orderNumber: true, guestCount: true, openedAt: true },
          },
        },
      }),
    );
  }

  createTable(tenantId: string, dto: CreateTableDto) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.restaurantTable.create({
        data: { tenantId, name: dto.name, area: dto.area, capacity: dto.capacity ?? 4 },
      }),
    );
  }

  updateTable(tenantId: string, id: string, dto: UpdateTableDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const t = await tx.restaurantTable.findUnique({ where: { id } });
      if (!t) throw new NotFoundException('Table not found');
      return tx.restaurantTable.update({ where: { id }, data: dto });
    });
  }

  deleteTable(tenantId: string, id: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const t = await tx.restaurantTable.findUnique({ where: { id } });
      if (!t) throw new NotFoundException('Table not found');
      return tx.restaurantTable.delete({ where: { id } });
    });
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

  // ── Orders ───────────────────────────────────────────────────────────────

  listOrders(tenantId: string, status?: string, tableId?: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.restaurantOrder.findMany({
        where: {
          ...(status && { status }),
          ...(tableId && { tableId }),
        },
        orderBy: { openedAt: 'desc' },
        include: ORDER_INCLUDE,
        take: 200,
      }),
    );
  }

  getOrder(tenantId: string, id: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const order = await tx.restaurantOrder.findUnique({
        where: { id },
        include: { ...ORDER_INCLUDE, splitBills: true },
      });
      if (!order) throw new NotFoundException('Order not found');
      return order;
    });
  }

  async createOrder(tenantId: string, dto: CreateOrderDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      // Generate order number
      const count = await tx.restaurantOrder.count();
      const orderNumber = `ORD-${String(count + 1).padStart(4, '0')}`;

      const order = await tx.restaurantOrder.create({
        data: {
          tenantId,
          tableId: dto.tableId ?? null,
          orderNumber,
          orderType: dto.orderType ?? 'DINE_IN',
          guestCount: dto.guestCount ?? 1,
          waiterId: dto.waiterId ?? null,
          customerId: dto.customerId ?? null,
          notes: dto.notes ?? null,
          status: 'OPEN',
        },
        include: ORDER_INCLUDE,
      });

      // Mark table occupied
      if (dto.tableId && dto.orderType !== 'TAKEAWAY') {
        await tx.restaurantTable.update({
          where: { id: dto.tableId },
          data: { status: 'OCCUPIED' },
        });
      }

      return order;
    });
  }

  async closeOrder(tenantId: string, id: string, dto: CloseOrderDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const order = await tx.restaurantOrder.findUnique({ where: { id } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status !== 'OPEN' && order.status !== 'BILLED') {
        throw new BadRequestException('Order is not open');
      }

      const updated = await tx.restaurantOrder.update({
        where: { id },
        data: {
          status: dto.status,
          closedAt: new Date(),
          ...(dto.invoiceId && { invoiceId: dto.invoiceId }),
        },
        include: ORDER_INCLUDE,
      });

      // Free table when order is closed/paid/voided
      if (order.tableId && (dto.status === 'PAID' || dto.status === 'VOID')) {
        await tx.restaurantTable.update({
          where: { id: order.tableId },
          data: { status: 'AVAILABLE' },
        });
      }

      return updated;
    });
  }

  async setComplementary(tenantId: string, id: string, dto: ComplementaryDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const order = await tx.restaurantOrder.findUnique({ where: { id } });
      if (!order) throw new NotFoundException('Order not found');
      return tx.restaurantOrder.update({
        where: { id },
        data: {
          isComplementary: dto.isComplementary,
          complementaryNote: dto.complementaryNote ?? null,
        },
        include: ORDER_INCLUDE,
      });
    });
  }

  async applyDiscount(tenantId: string, id: string, dto: DiscountDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const order = await tx.restaurantOrder.findUnique({ where: { id } });
      if (!order) throw new NotFoundException('Order not found');
      return tx.restaurantOrder.update({
        where: { id },
        data: { discount: dto.discount },
        include: ORDER_INCLUDE,
      });
    });
  }

  async transferTable(tenantId: string, orderId: string, newTableId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const order = await tx.restaurantOrder.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Order not found');

      const newTable = await tx.restaurantTable.findUnique({ where: { id: newTableId } });
      if (!newTable) throw new NotFoundException('Target table not found');
      if (newTable.status === 'OCCUPIED') {
        throw new BadRequestException('Target table is already occupied');
      }

      // Free old table, occupy new
      if (order.tableId) {
        await tx.restaurantTable.update({ where: { id: order.tableId }, data: { status: 'AVAILABLE' } });
      }
      await tx.restaurantTable.update({ where: { id: newTableId }, data: { status: 'OCCUPIED' } });

      return tx.restaurantOrder.update({
        where: { id: orderId },
        data: { tableId: newTableId },
        include: ORDER_INCLUDE,
      });
    });
  }

  // ── Bill (compute totals) ─────────────────────────────────────────────────

  async getOrderBill(tenantId: string, id: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const order = await tx.restaurantOrder.findUnique({
        where: { id },
        include: { kots: true, table: true },
      });
      if (!order) throw new NotFoundException('Order not found');

      // Aggregate all KOT items
      const allItems: any[] = [];
      for (const kot of order.kots) {
        if (kot.status === 'CANCELLED') continue;
        const items = (kot.items as any[]) ?? [];
        for (const item of items) {
          allItems.push({
            ...item,
            kotId: kot.id,
            kotCreatedAt: kot.createdAt,
          });
        }
      }

      // Compute subtotal
      let subtotal = 0;
      for (const item of allItems) {
        if (item.isComplementary || order.isComplementary) continue;
        const price = item.portionPrice ?? item.unitPrice ?? 0;
        subtotal += Number(price) * Number(item.qty);
      }

      const discount = Number(order.discount);
      const taxPct = 0; // configure as needed
      const tax = ((subtotal - discount) * taxPct) / 100;
      const total = Math.max(0, subtotal - discount + tax);

      return {
        order,
        items: allItems,
        subtotal: subtotal.toFixed(2),
        discount: discount.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
        isComplementary: order.isComplementary,
      };
    });
  }

  // ── Split Bill ────────────────────────────────────────────────────────────

  async createSplit(tenantId: string, orderId: string, dto: CreateSplitDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const order = await tx.restaurantOrder.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Order not found');

      // Delete existing splits for this order
      await tx.splitBill.deleteMany({ where: { orderId } });

      // Create new splits
      await tx.splitBill.createMany({
        data: dto.parts.map((p) => ({
          tenantId,
          orderId,
          label: p.label,
          items: p.items as any,
          total: p.total,
        })),
      });

      return tx.splitBill.findMany({ where: { orderId } });
    });
  }

  async markSplitPaid(tenantId: string, splitId: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.splitBill.update({ where: { id: splitId }, data: { paid: true } }),
    );
  }

  // ── KOTs ─────────────────────────────────────────────────────────────────

  listKots(tenantId: string, tableId?: string, status?: string, orderId?: string, station?: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.kot.findMany({
        where: {
          ...(tableId && { tableId }),
          ...(status && { status }),
          ...(orderId && { orderId }),
          ...(station && { station }),
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    );
  }

  async createKot(tenantId: string, dto: CreateKotDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      // Auto-create order if not provided
      let orderId = dto.orderId ?? null;
      if (!orderId && dto.tableId) {
        const existingOrder = await tx.restaurantOrder.findFirst({
          where: { tenantId, tableId: dto.tableId, status: 'OPEN' },
        });
        if (existingOrder) {
          orderId = existingOrder.id;
        } else {
          const count = await tx.restaurantOrder.count();
          const newOrder = await tx.restaurantOrder.create({
            data: {
              tenantId,
              tableId: dto.tableId,
              orderNumber: `ORD-${String(count + 1).padStart(4, '0')}`,
              orderType: dto.orderType ?? 'DINE_IN',
              status: 'OPEN',
            },
          });
          orderId = newOrder.id;
        }
      }

      const kot = await tx.kot.create({
        data: {
          tenantId,
          orderId,
          tableId: dto.tableId ?? null,
          invoiceId: dto.invoiceId ?? null,
          orderType: dto.orderType ?? 'DINE_IN',
          items: dto.items as any,
          kotNotes: dto.kotNotes ?? null,
          station: dto.station ?? 'KITCHEN',
          status: 'PENDING',
        },
      });

      // Mark table OCCUPIED
      if (dto.tableId && dto.orderType !== 'TAKEAWAY') {
        await tx.restaurantTable.update({
          where: { id: dto.tableId },
          data: { status: 'OCCUPIED' },
        }).catch(() => { /* table may not exist */ });
      }

      return kot;
    });
  }

  async updateKotStatus(tenantId: string, id: string, dto: UpdateKotStatusDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const kot = await tx.kot.findUnique({ where: { id } });
      if (!kot) throw new NotFoundException('KOT not found');

      const updated = await tx.kot.update({ where: { id }, data: { status: dto.status } });

      // Free table when all KOTs for the order are done/cancelled
      if (kot.tableId && (dto.status === 'DELIVERED' || dto.status === 'CANCELLED')) {
        const pendingKots = await tx.kot.count({
          where: {
            tableId: kot.tableId,
            status: { in: ['PENDING', 'COOKING', 'READY'] },
          },
        });
        // Only free table when order is explicitly closed, not just KOT done
        // (Restaurant staff decide when to free the table)
      }

      return updated;
    });
  }

  async deleteKot(tenantId: string, id: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const kot = await tx.kot.findUnique({ where: { id } });
      if (!kot) throw new NotFoundException('KOT not found');
      if (kot.status !== 'PENDING') {
        throw new BadRequestException('Only PENDING KOTs can be deleted');
      }
      return tx.kot.update({ where: { id }, data: { status: 'CANCELLED' } });
    });
  }

  // ── Promotions ─────────────────────────────────────────────────────────────

  async listPromotions(tenantId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const rows = await tx.promotion.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        isActive: p.isActive,
        startDate: p.validFrom,
        endDate: p.validUntil,
        ...((p.conditions as any) ?? {}),
        ...((p.reward as any) ?? {}),
        config: p.conditions,
      }));
    });
  }

  async createPromotion(tenantId: string, body: any) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      return tx.promotion.create({
        data: {
          tenantId,
          name: body.name,
          type: body.type ?? 'PCT_DISCOUNT',
          conditions: {
            code: body.code,
            minOrderValue: body.minOrderValue,
            maxUses: body.maxUses,
            description: body.description,
            happyHourStart: body.config?.happyHourStart,
            happyHourEnd: body.config?.happyHourEnd,
            buyQty: body.config?.buyQty,
            getFreeQty: body.config?.getFreeQty,
          },
          reward: {
            value: body.value,
            discountPct: body.type === 'PERCENTAGE' || body.type === 'HAPPY_HOUR' ? body.value : undefined,
            discountAmt: body.type === 'FLAT' ? body.value : undefined,
          },
          validFrom: body.startDate ? new Date(body.startDate) : new Date(),
          validUntil: body.endDate ? new Date(body.endDate) : undefined,
          isActive: true,
        },
      });
    });
  }
}
