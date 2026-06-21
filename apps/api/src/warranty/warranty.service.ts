import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WarrantyService {
  constructor(private prisma: PrismaService) {}

  async getClaims(tenantId: string) {
    return this.prisma.warrantyClaim.findMany({
      where: { tenantId },
      include: { product: true, invoice: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createClaim(tenantId: string, data: any) {
    return this.prisma.warrantyClaim.create({
      data: {
        tenantId,
        productId: data.productId,
        invoiceId: data.invoiceId,
        serial: data.serial,
        issue: data.issue,
        notes: data.notes,
        status: 'PENDING',
      },
    });
  }

  async updateStatus(tenantId: string, id: string, status: any) {
    return this.prisma.warrantyClaim.update({
      where: { id, tenantId },
      data: { status },
    });
  }
}
