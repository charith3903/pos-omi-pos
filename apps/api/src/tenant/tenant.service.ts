import { Injectable, NotFoundException } from '@nestjs/common';
import { Tenant } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolve a tenant by subdomain — used by the login flow before a JWT exists. */
  async findBySubdomain(subdomain: string): Promise<Tenant> {
    const tenant = await this.prisma.tenant.findUnique({ where: { subdomain } });
    if (!tenant) throw new NotFoundException(`Tenant '${subdomain}' not found`);
    return tenant;
  }

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException(`Tenant not found`);
    return tenant;
  }
}
