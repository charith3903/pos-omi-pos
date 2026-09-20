import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePosSettingsDto } from './dto/update-pos-settings.dto';

@Injectable()
export class PosSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getForOutlet(tenantId: string, outletId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      await this.assertOutletOwnership(tx, tenantId, outletId);
      const settings = await tx.outletSettings.findUnique({ where: { outletId } });
      return { outletId, posViewMode: settings?.posViewMode ?? 'TRADITIONAL' };
    });
  }

  /** The tenant's default outlet's setting — used by VerticalService to self-configure the POS. */
  async getForDefaultOutlet(tenantId: string): Promise<'MODERN' | 'TRADITIONAL'> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const outlet = await tx.outlet.findFirst({ where: { tenantId, isDefault: true } });
      if (!outlet) return 'TRADITIONAL';
      const settings = await tx.outletSettings.findUnique({ where: { outletId: outlet.id } });
      return settings?.posViewMode ?? 'TRADITIONAL';
    });
  }

  async update(tenantId: string, outletId: string, dto: UpdatePosSettingsDto) {
    await this.prisma.withTenant(tenantId, async (tx) => {
      await this.assertOutletOwnership(tx, tenantId, outletId);
      await tx.outletSettings.upsert({
        where: { outletId },
        update: { posViewMode: dto.posViewMode },
        create: { tenantId, outletId, posViewMode: dto.posViewMode },
      });
    });
    return this.getForOutlet(tenantId, outletId);
  }

  private async assertOutletOwnership(tx: Prisma.TransactionClient, tenantId: string, outletId: string) {
    const outlet = await tx.outlet.findFirst({ where: { id: outletId, tenantId } });
    if (!outlet) throw new NotFoundException('Outlet not found');
  }
}
