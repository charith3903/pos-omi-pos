import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CashMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentShift(tenantId: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.shift.findFirst({ where: { status: 'OPEN' }, orderBy: { openedAt: 'desc' } }),
    );
  }

  listShifts(tenantId: string, limit = 20) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.shift.findMany({ orderBy: { openedAt: 'desc' }, take: limit }),
    );
  }

  async openShift(tenantId: string, openedBy: string, openingCash = 0, outletId?: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const open = await tx.shift.findFirst({ where: { status: 'OPEN' } });
      if (open) throw new BadRequestException('A shift is already open');
      return tx.shift.create({
        data: { tenantId, outletId: outletId ?? null, openedBy, openingCash, status: 'OPEN' },
      });
    });
  }

  /**
   * Expected cash = opening float + cash sales taken since the shift opened
   * + cash paid in − cash paid out. Compared against the counted
   * `closingCash` so the close-shift screen can show a variance instead of
   * just recording whatever was counted with no reconciliation at all.
   */
  async closeShift(tenantId: string, id: string, closedBy: string, closingCash: number, notes?: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const shift = await tx.shift.findUnique({ where: { id } });
      if (!shift) throw new NotFoundException('Shift not found');
      if (shift.status !== 'OPEN') throw new BadRequestException('Shift is already closed');

      const [cashSales, movements] = await Promise.all([
        tx.payment.aggregate({
          where: { tenantId, method: 'CASH', createdAt: { gte: shift.openedAt } },
          _sum: { amount: true },
        }),
        tx.cashMovement.groupBy({
          by: ['type'],
          where: { tenantId, shiftId: id },
          _sum: { amount: true },
        }),
      ]);

      const paidIn = Number(movements.find((m) => m.type === 'PAID_IN')?._sum.amount ?? 0);
      const paidOut = Number(movements.find((m) => m.type === 'PAID_OUT')?._sum.amount ?? 0);
      const expectedCash = Number(shift.openingCash) + Number(cashSales._sum.amount ?? 0) + paidIn - paidOut;

      const closed = await tx.shift.update({
        where: { id },
        data: { status: 'CLOSED', closedAt: new Date(), closedBy, closingCash, notes: notes ?? null },
      });

      return { ...closed, expectedCash, variance: closingCash - expectedCash };
    });
  }

  // ── Cash drawer / expense / paid-out ledger ─────────────────────────────

  async listCashMovements(tenantId: string, shiftId: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.cashMovement.findMany({ where: { tenantId, shiftId }, orderBy: { createdAt: 'desc' } }),
    );
  }

  async addCashMovement(
    tenantId: string,
    shiftId: string,
    createdBy: string,
    type: CashMovementType,
    amount: number,
    reason?: string,
  ) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const shift = await tx.shift.findFirst({ where: { id: shiftId, tenantId } });
      if (!shift) throw new NotFoundException('Shift not found');
      if (shift.status !== 'OPEN') throw new BadRequestException('Shift is not open');
      return tx.cashMovement.create({
        data: { tenantId, outletId: shift.outletId, shiftId, type, amount, reason: reason ?? null, createdBy },
      });
    });
  }
}
