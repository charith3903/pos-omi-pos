import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRepairJobDto, RecordImeiDto, UpdateRepairJobDto } from './dto/mobile.dto';

@Injectable()
export class MobileService {
  constructor(private readonly prisma: PrismaService) {}

  // ── IMEI Records ──────────────────────────────────────────────────────────

  recordImei(tenantId: string, dto: RecordImeiDto) {
    const warrantyMonths = dto.warrantyMonths ?? 12;
    const warrantyExpires = new Date();
    warrantyExpires.setMonth(warrantyExpires.getMonth() + warrantyMonths);

    return this.prisma.withTenant(tenantId, (tx) =>
      tx.imeiRecord.create({
        data: {
          tenantId,
          productId: dto.productId,
          imei: dto.imei,
          serial: dto.serial,
          invoiceId: dto.invoiceId ?? null,
          warrantyMonths,
          warrantyExpires,
        },
      }),
    );
  }

  lookupImei(tenantId: string, imei: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.imeiRecord.findMany({
        where: { imei },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  // ── Repair Jobs ───────────────────────────────────────────────────────────

  listRepairJobs(tenantId: string, status?: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.repairJob.findMany({
        where: { ...(status && { status }) },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  }

  createRepairJob(tenantId: string, dto: CreateRepairJobDto) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.repairJob.create({
        data: {
          tenantId,
          customerId: dto.customerId ?? null,
          deviceMake: dto.deviceMake,
          deviceModel: dto.deviceModel,
          imei: dto.imei ?? null,
          issue: dto.issue,
          estimatedCost: dto.estimatedCost ?? null,
        },
      }),
    );
  }

  async updateRepairJob(tenantId: string, id: string, dto: UpdateRepairJobDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const job = await tx.repairJob.findUnique({ where: { id } });
      if (!job) throw new NotFoundException('Repair job not found');

      return tx.repairJob.update({
        where: { id },
        data: {
          ...(dto.status && { status: dto.status }),
          ...(dto.technicianNotes !== undefined && { technicianNotes: dto.technicianNotes }),
          ...(dto.actualCost !== undefined && { actualCost: dto.actualCost }),
          ...(dto.status === 'DELIVERED' && { completedAt: new Date() }),
        },
      });
    });
  }
}
