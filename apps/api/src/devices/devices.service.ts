import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDeviceDto, RenameDeviceDto } from './dto/device.dto';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.device.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } }),
    );
  }

  async get(tenantId: string, id: string) {
    const device = await this.prisma.withTenant(tenantId, (tx) =>
      tx.device.findFirst({ where: { id, tenantId } }),
    );
    if (!device) throw new NotFoundException('Device not found');
    return device;
  }

  /**
   * Registers a new till/device — e.g. a browser opening the web POS for
   * the first time. Falls back to the tenant's default outlet when none is
   * given, since the web POS (unlike the Flutter app) has no outlet-picker
   * of its own yet.
   */
  async register(tenantId: string, dto: RegisterDeviceDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      let outletId = dto.outletId;
      if (!outletId) {
        const outlet = await tx.outlet.findFirst({ where: { tenantId, isDefault: true } });
        outletId = outlet?.id;
      }
      if (!outletId) throw new NotFoundException('No outlet found for this tenant');

      const count = await tx.device.count({ where: { tenantId } });
      return tx.device.create({
        data: { tenantId, outletId, name: dto.name?.trim() || `Till ${count + 1}` },
      });
    });
  }

  async rename(tenantId: string, id: string, dto: RenameDeviceDto) {
    await this.get(tenantId, id);
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.device.update({ where: { id }, data: { name: dto.name.trim() } }),
    );
  }

  async touchLastSync(tenantId: string, id: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.device.update({ where: { id }, data: { lastSyncAt: new Date() } }),
    );
  }
}
