import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async getSuppliers(tenantId: string, search?: string) {
    return this.prisma.supplier.findMany({
      where: {
        tenantId,
        ...(search ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { purchaseOrders: true }
        }
      }
    });
  }

  async createSupplier(tenantId: string, data: any) {
    return this.prisma.supplier.create({
      data: {
        tenantId,
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
      },
    });
  }

  async updateSupplier(tenantId: string, id: string, data: any) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, tenantId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    return this.prisma.supplier.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
      },
    });
  }

  async deleteSupplier(tenantId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, tenantId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    return this.prisma.supplier.delete({
      where: { id },
    });
  }
}
