import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InvoicesService } from '../invoices/invoices.service';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { AddRepairPartDto, CheckoutRepairJobDto, CreateRepairJobDto, UpdateRepairJobDto } from './dto/repair.dto';

const JOB_INCLUDE = {
  customer: { select: { id: true, name: true, phone: true } },
  technician: { select: { id: true, name: true } },
  outlet: { select: { id: true, name: true } },
  parts: { include: { product: { select: { id: true, name: true } }, variant: true } },
} as const;

@Injectable()
export class RepairsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly invoices: InvoicesService,
  ) {}

  list(tenantId: string, filters: { status?: string; technicianId?: string }) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.repairJob.findMany({
        where: {
          ...(filters.status && { status: filters.status }),
          ...(filters.technicianId && { technicianId: filters.technicianId }),
        },
        include: JOB_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    );
  }

  async getById(tenantId: string, id: string) {
    const job = await this.prisma.withTenant(tenantId, (tx) =>
      tx.repairJob.findUnique({ where: { id }, include: JOB_INCLUDE }),
    );
    if (!job) throw new NotFoundException('Repair job not found');
    return job;
  }

  create(tenantId: string, dto: CreateRepairJobDto) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.repairJob.create({
        data: {
          tenantId,
          outletId: dto.outletId ?? null,
          customerId: dto.customerId ?? null,
          technicianId: dto.technicianId ?? null,
          deviceMake: dto.deviceMake,
          deviceModel: dto.deviceModel,
          imei: dto.imei ?? null,
          issue: dto.issue,
          estimatedCost: dto.estimatedCost ?? null,
        },
        include: JOB_INCLUDE,
      }),
    );
  }

  async update(tenantId: string, id: string, dto: UpdateRepairJobDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const job = await tx.repairJob.findUnique({ where: { id } });
      if (!job) throw new NotFoundException('Repair job not found');
      if (dto.laborCharge !== undefined && job.invoiceId) {
        throw new BadRequestException('Cannot change the labor charge after this job has been billed');
      }

      return tx.repairJob.update({
        where: { id },
        data: {
          ...(dto.status && { status: dto.status }),
          ...(dto.diagnosis !== undefined && { diagnosis: dto.diagnosis }),
          ...(dto.technicianNotes !== undefined && { technicianNotes: dto.technicianNotes }),
          ...(dto.technicianId !== undefined && { technicianId: dto.technicianId }),
          ...(dto.laborCharge !== undefined && { laborCharge: dto.laborCharge }),
          ...(dto.estimatedCost !== undefined && { estimatedCost: dto.estimatedCost }),
          ...(dto.status === 'DELIVERED' && !job.completedAt && { completedAt: new Date() }),
        },
        include: JOB_INCLUDE,
      });
    });
  }

  // ── Parts ────────────────────────────────────────────────────────────────
  // Stock is NOT touched here — only at checkout(), through the same
  // stock-consumption path as any other invoice. This table is just a
  // running tally of what a job will be billed for.

  async addPart(tenantId: string, jobId: string, dto: AddRepairPartDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const job = await tx.repairJob.findUnique({ where: { id: jobId } });
      if (!job) throw new NotFoundException('Repair job not found');
      if (job.invoiceId) throw new BadRequestException('This job has already been billed');

      const product = await tx.product.findUnique({ where: { id: dto.productId } });
      if (!product) throw new NotFoundException('Product not found');
      const variant = dto.variantId
        ? await tx.productVariant.findUnique({ where: { id: dto.variantId } })
        : null;

      if (product.trackStock) {
        const available = await this.stock.getProductStock(tenantId, dto.productId);
        if (available < dto.qty) {
          throw new BadRequestException(`Only ${available} of "${product.name}" in stock`);
        }
      }

      const unitPrice = dto.unitPrice ?? Number(variant?.price ?? product.price);
      const unitCost = variant?.cost ?? product.cost ?? null;

      return tx.repairJobPart.create({
        data: {
          tenantId,
          repairJobId: jobId,
          productId: dto.productId,
          variantId: dto.variantId ?? null,
          qty: dto.qty,
          unitPrice,
          unitCost,
        },
        include: { product: { select: { id: true, name: true } }, variant: true },
      });
    });
  }

  async removePart(tenantId: string, jobId: string, partId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const job = await tx.repairJob.findUnique({ where: { id: jobId } });
      if (!job) throw new NotFoundException('Repair job not found');
      if (job.invoiceId) throw new BadRequestException('This job has already been billed');

      const part = await tx.repairJobPart.findFirst({ where: { id: partId, repairJobId: jobId } });
      if (!part) throw new NotFoundException('Part not found on this job');

      await tx.repairJobPart.delete({ where: { id: partId } });
      return { success: true };
    });
  }

  // ── Checkout ─────────────────────────────────────────────────────────────
  // Bills parts + labor by generating a real invoice through the existing
  // InvoicesService — this is what actually consumes stock (batch/FIFO
  // costing included) and makes the sale show up in normal sales/profit
  // reports, exactly like a till sale.

  async checkout(tenantId: string, jobId: string, dto: CheckoutRepairJobDto) {
    const job = await this.prisma.withTenant(tenantId, (tx) =>
      tx.repairJob.findUnique({
        where: { id: jobId },
        include: { parts: { include: { product: { select: { id: true, name: true } } } } },
      }),
    );
    if (!job) throw new NotFoundException('Repair job not found');
    if (job.invoiceId) throw new BadRequestException('This job has already been billed');

    const laborCharge = dto.laborCharge ?? Number(job.laborCharge);
    if (job.parts.length === 0 && laborCharge <= 0) {
      throw new BadRequestException('Add at least one part or a labor charge before billing');
    }

    const items = job.parts.map((p) => ({
      productId: p.productId,
      variantId: p.variantId ?? undefined,
      nameSnapshot: p.product.name,
      qty: Number(p.qty),
      unitPrice: Number(p.unitPrice),
      lineTotal: Number(p.qty) * Number(p.unitPrice),
    }));

    if (laborCharge > 0) {
      const laborProduct = await this.ensureLaborProduct(tenantId);
      items.push({
        productId: laborProduct.id,
        variantId: undefined,
        nameSnapshot: 'Repair Labor',
        qty: 1,
        unitPrice: laborCharge,
        lineTotal: laborCharge,
      });
    }

    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const discount = dto.discount ?? 0;
    const total = Math.max(0, subtotal - discount);

    const invoice = await this.invoices.create(tenantId, {
      id: randomUUID(),
      outletId: dto.outletId,
      deviceId: dto.deviceId,
      customerId: dto.customerId ?? job.customerId ?? undefined,
      notes: `Repair job ${job.id.slice(-8).toUpperCase()} — ${job.deviceMake} ${job.deviceModel}`,
      subtotal,
      discount,
      tax: 0,
      total,
      items,
      payments: dto.payments,
    });

    await this.prisma.withTenant(tenantId, (tx) =>
      tx.repairJob.update({
        where: { id: jobId },
        data: {
          invoiceId: invoice.id,
          actualCost: total,
          laborCharge,
          status: 'DELIVERED',
          completedAt: job.completedAt ?? new Date(),
        },
      }),
    );

    return invoice;
  }

  private async ensureLaborProduct(tenantId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.product.findFirst({ where: { tenantId, sku: 'REPAIR-LABOR' } });
      if (existing) return existing;
      return tx.product.create({
        data: {
          tenantId,
          name: 'Repair Labor',
          sku: 'REPAIR-LABOR',
          price: 0,
          trackStock: false,
          taxRate: 0,
        },
      });
    });
  }
}
