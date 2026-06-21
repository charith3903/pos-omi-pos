import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, search?: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.customer.findMany({
        where: search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : undefined,
        orderBy: { name: 'asc' },
      }),
    );
  }

  async getById(tenantId: string, id: string) {
    const c = await this.prisma.withTenant(tenantId, (tx) =>
      tx.customer.findUnique({ where: { id } }),
    );
    if (!c) throw new NotFoundException('Customer not found');
    return c;
  }

  create(tenantId: string, dto: CreateCustomerDto) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.customer.create({ data: { tenantId, ...dto } }),
    );
  }

  async update(tenantId: string, id: string, dto: Partial<CreateCustomerDto>) {
    await this.getById(tenantId, id);
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.customer.update({ where: { id }, data: dto }),
    );
  }
}
