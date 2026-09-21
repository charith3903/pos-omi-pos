import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordImeiDto } from './dto/mobile.dto';

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
}
