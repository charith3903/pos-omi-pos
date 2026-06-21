import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRentalAgreementDto, ReturnRentalDto } from './dto/rental.dto';

const UNIT_MS: Record<string, number> = {
  HOUR:  3_600_000,
  DAY:   86_400_000,
  WEEK:  604_800_000,
  MONTH: 2_592_000_000, // 30 days
};

@Injectable()
export class RentalService {
  constructor(private readonly prisma: PrismaService) {}

  listAgreements(tenantId: string, status?: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.rentalAgreement.findMany({
        where: { ...(status && { status }) },
        orderBy: { outAt: 'desc' },
        take: 100,
      }),
    );
  }

  createAgreement(tenantId: string, dto: CreateRentalAgreementDto) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.rentalAgreement.create({
        data: {
          tenantId,
          productId: dto.productId,
          customerId: dto.customerId ?? null,
          invoiceId: dto.invoiceId ?? null,
          rate: dto.rate,
          rateUnit: dto.rateUnit,
          deposit: dto.deposit ?? 0,
          outAt: new Date(dto.outAt),
          expectedInAt: new Date(dto.expectedInAt),
          notes: dto.notes ?? null,
          status: 'ACTIVE',
        },
      }),
    );
  }

  async processReturn(tenantId: string, id: string, dto: ReturnRentalDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const ag = await tx.rentalAgreement.findUnique({ where: { id } });
      if (!ag) throw new NotFoundException('Rental agreement not found');
      if (ag.status === 'RETURNED') throw new BadRequestException('Already returned');

      const actualIn = new Date(dto.actualInAt);
      const expected = new Date(ag.expectedInAt);

      // Calculate late fee: extra units × rate
      let lateFee = 0;
      if (actualIn > expected) {
        const overdueMsRaw = actualIn.getTime() - expected.getTime();
        const unitMs = UNIT_MS[ag.rateUnit] ?? UNIT_MS.DAY;
        const overdueUnits = Math.ceil(overdueMsRaw / unitMs);
        lateFee = overdueUnits * Number(ag.rate);
      }

      return tx.rentalAgreement.update({
        where: { id },
        data: {
          status: 'RETURNED',
          actualInAt: actualIn,
          lateFee,
        },
      });
    });
  }

  async checkAvailability(tenantId: string, productId: string, from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const conflicts = await this.prisma.withTenant(tenantId, (tx) =>
      tx.rentalAgreement.findMany({
        where: {
          productId,
          status: 'ACTIVE',
          outAt: { lte: toDate },
          expectedInAt: { gte: fromDate },
        },
        select: { id: true, outAt: true, expectedInAt: true, status: true },
      }),
    );

    return {
      available: conflicts.length === 0,
      conflicts,
    };
  }

  /** Called by SyncService when processing offline rental invoices. */
  createAgreementFromSync(
    tenantId: string,
    data: {
      productId: string;
      customerId?: string;
      invoiceId?: string;
      rate: number;
      rateUnit: string;
      deposit: number;
      outAt: string;
      expectedInAt: string;
    },
  ) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.rentalAgreement.create({
        data: {
          tenantId,
          productId: data.productId,
          customerId: data.customerId ?? null,
          invoiceId: data.invoiceId ?? null,
          rate: data.rate,
          rateUnit: data.rateUnit,
          deposit: data.deposit,
          outAt: new Date(data.outAt),
          expectedInAt: new Date(data.expectedInAt),
          status: 'ACTIVE',
        },
      }),
    );
  }
}
