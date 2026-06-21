import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyPromotionsDto, CartLineDto, CreatePromotionDto } from './dto/supermarket.dto';

interface AppliedDiscount {
  promotionId: string;
  promotionName: string;
  discountAmt: number;
  description: string;
}

@Injectable()
export class SupermarketService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Promotions CRUD ───────────────────────────────────────────────────────

  listPromotions(tenantId: string, activeOnly = true) {
    const now = new Date();
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.promotion.findMany({
        where: {
          ...(activeOnly && { isActive: true }),
          ...(activeOnly && { validFrom: { lte: now } }),
          OR: [{ validUntil: null }, { validUntil: { gte: now } }],
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  createPromotion(tenantId: string, dto: CreatePromotionDto) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.promotion.create({
        data: {
          tenantId,
          name: dto.name,
          type: dto.type,
          conditions: dto.conditions,
          reward: dto.reward,
          validFrom: new Date(dto.validFrom),
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        },
      }),
    );
  }

  deactivatePromotion(tenantId: string, id: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.promotion.update({ where: { id }, data: { isActive: false } }),
    );
  }

  // ── Apply promotions to a cart ────────────────────────────────────────────

  async applyPromotions(
    tenantId: string,
    dto: ApplyPromotionsDto,
  ): Promise<{ lines: CartLineDto[]; discounts: AppliedDiscount[]; totalDiscount: number }> {
    const activePromos = await this.listPromotions(tenantId, true) as any[];

    const discounts: AppliedDiscount[] = [];

    for (const promo of activePromos) {
      const cond = promo.conditions as Record<string, any>;
      const rew = promo.reward as Record<string, any>;

      switch (promo.type) {
        case 'MULTI_BUY': {
          // Buy ≥ minQty of a specific product → apply reward
          const minQty = Number(cond.minQty ?? 0);
          const eligibleLines = dto.lines.filter(
            (l) =>
              (!cond.productId || l.productId === cond.productId) &&
              (!cond.categoryId || l.categoryId === cond.categoryId) &&
              l.qty >= minQty,
          );
          for (const line of eligibleLines) {
            const discount = rew.discountAmt
              ? Number(rew.discountAmt)
              : rew.discountPct
              ? (line.unitPrice * line.qty * Number(rew.discountPct)) / 100
              : rew.freeQty
              ? Number(rew.freeQty) * line.unitPrice
              : 0;

            if (discount > 0) {
              discounts.push({
                promotionId: promo.id,
                promotionName: promo.name,
                discountAmt: discount,
                description: `${promo.name} on ${line.productId}`,
              });
            }
          }
          break;
        }

        case 'PCT_DISCOUNT': {
          // Cart total ≥ minTotal → X% off eligible lines
          const cartTotal = dto.lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
          const minTotal = Number(cond.minTotal ?? 0);
          if (cartTotal >= minTotal) {
            const eligibleLines = dto.lines.filter(
              (l) => !cond.categoryId || l.categoryId === cond.categoryId,
            );
            const eligible = eligibleLines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
            const discount = (eligible * Number(rew.discountPct ?? 0)) / 100;
            if (discount > 0) {
              discounts.push({
                promotionId: promo.id,
                promotionName: promo.name,
                discountAmt: discount,
                description: `${promo.name} (${rew.discountPct}% off)`,
              });
            }
          }
          break;
        }

        case 'BOGO': {
          // Buy one get one free on a specific product
          const line = dto.lines.find((l) => l.productId === cond.productId);
          if (line && line.qty >= 2) {
            const freeQty = Math.floor(line.qty / 2);
            const discount = freeQty * line.unitPrice;
            discounts.push({
              promotionId: promo.id,
              promotionName: promo.name,
              discountAmt: discount,
              description: `${promo.name} — ${freeQty} free`,
            });
          }
          break;
        }
      }
    }

    const totalDiscount = discounts.reduce((s, d) => s + d.discountAmt, 0);
    return { lines: dto.lines, discounts, totalDiscount };
  }
}
