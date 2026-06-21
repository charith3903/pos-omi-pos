import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

  async closeShift(tenantId: string, id: string, closedBy: string, closingCash: number, notes?: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const shift = await tx.shift.findUnique({ where: { id } });
      if (!shift) throw new NotFoundException('Shift not found');
      if (shift.status !== 'OPEN') throw new BadRequestException('Shift is already closed');
      return tx.shift.update({
        where: { id },
        data: { status: 'CLOSED', closedAt: new Date(), closedBy, closingCash, notes: notes ?? null },
      });
    });
  }
}
