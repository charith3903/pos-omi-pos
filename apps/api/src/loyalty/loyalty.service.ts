import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const TIER_THRESHOLDS = { BRONZE: 0, SILVER: 500, GOLD: 2000, PLATINUM: 5000 };
const EARN_RATE = 1; // 1 point per Rs 100 spent

function computeTier(lifetimePoints: number): string {
  if (lifetimePoints >= TIER_THRESHOLDS.PLATINUM) return 'PLATINUM';
  if (lifetimePoints >= TIER_THRESHOLDS.GOLD) return 'GOLD';
  if (lifetimePoints >= TIER_THRESHOLDS.SILVER) return 'SILVER';
  return 'BRONZE';
}

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrEnroll(tenantId: string, customerId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id: customerId } });
      if (!customer) throw new NotFoundException('Customer not found');

      const existing = await tx.loyaltyAccount.findUnique({ where: { customerId } });
      if (existing) return { ...existing, customer };

      const account = await tx.loyaltyAccount.create({
        data: { tenantId, customerId, points: 0, lifetimePoints: 0, tier: 'BRONZE' },
      });
      return { ...account, customer };
    });
  }

  async getAccount(tenantId: string, customerId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const account = await tx.loyaltyAccount.findUnique({
        where: { customerId },
        include: {
          customer: { select: { id: true, name: true, phone: true, email: true } },
          transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      });
      if (!account) throw new NotFoundException('Loyalty account not found');
      return account;
    });
  }

  listAccounts(tenantId: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.loyaltyAccount.findMany({
        include: {
          customer: { select: { id: true, name: true, phone: true, email: true } },
        },
        orderBy: { points: 'desc' },
      }),
    );
  }

  async earnPoints(tenantId: string, customerId: string, amount: number, referenceId?: string, notes?: string) {
    const pointsToAdd = Math.floor(amount / 100) * EARN_RATE;
    if (pointsToAdd <= 0) return null;

    return this.prisma.withTenant(tenantId, async (tx) => {
      let account = await tx.loyaltyAccount.findUnique({ where: { customerId } });
      if (!account) {
        account = await tx.loyaltyAccount.create({
          data: { tenantId, customerId, points: 0, lifetimePoints: 0, tier: 'BRONZE' },
        });
      }

      const newLifetime = account.lifetimePoints + pointsToAdd;
      const newTier = computeTier(newLifetime);

      const updated = await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          points: { increment: pointsToAdd },
          lifetimePoints: { increment: pointsToAdd },
          tier: newTier,
          updatedAt: new Date(),
        },
      });

      await tx.loyaltyTransaction.create({
        data: {
          tenantId,
          accountId: account.id,
          type: 'EARN',
          points: pointsToAdd,
          referenceId: referenceId ?? null,
          notes: notes ?? `Earned from Rs ${amount} purchase`,
        },
      });

      return updated;
    });
  }

  async redeemPoints(tenantId: string, customerId: string, pointsToRedeem: number, referenceId?: string) {
    if (pointsToRedeem <= 0) throw new BadRequestException('Points must be positive');

    return this.prisma.withTenant(tenantId, async (tx) => {
      const account = await tx.loyaltyAccount.findUnique({ where: { customerId } });
      if (!account) throw new NotFoundException('Loyalty account not found');
      if (account.points < pointsToRedeem) {
        throw new BadRequestException(`Insufficient points. Available: ${account.points}`);
      }

      const updated = await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: { points: { decrement: pointsToRedeem }, updatedAt: new Date() },
      });

      await tx.loyaltyTransaction.create({
        data: {
          tenantId,
          accountId: account.id,
          type: 'REDEEM',
          points: -pointsToRedeem,
          referenceId: referenceId ?? null,
          notes: `Redeemed ${pointsToRedeem} points`,
        },
      });

      return { account: updated, redeemedValue: (pointsToRedeem / 10).toFixed(2) };
    });
  }

  async adjustPoints(tenantId: string, customerId: string, points: number, notes?: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const account = await tx.loyaltyAccount.findUnique({ where: { customerId } });
      if (!account) throw new NotFoundException('Loyalty account not found');

      const newPoints = Math.max(0, account.points + points);
      const updated = await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: { points: newPoints, updatedAt: new Date() },
      });

      await tx.loyaltyTransaction.create({
        data: {
          tenantId,
          accountId: account.id,
          type: 'ADJUST',
          points,
          notes: notes ?? 'Manual adjustment',
        },
      });

      return updated;
    });
  }

  getTransactions(tenantId: string, customerId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const account = await tx.loyaltyAccount.findUnique({ where: { customerId } });
      if (!account) throw new NotFoundException('Loyalty account not found');
      return tx.loyaltyTransaction.findMany({
        where: { accountId: account.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });
  }

  getTierSummary() {
    return {
      tiers: [
        { name: 'BRONZE',   minPoints: TIER_THRESHOLDS.BRONZE,   perks: 'Base earn rate: 1 pt / Rs 100' },
        { name: 'SILVER',   minPoints: TIER_THRESHOLDS.SILVER,   perks: '5% discount + 1.5x points' },
        { name: 'GOLD',     minPoints: TIER_THRESHOLDS.GOLD,     perks: '10% discount + 2x points + priority seating' },
        { name: 'PLATINUM', minPoints: TIER_THRESHOLDS.PLATINUM, perks: '15% discount + 3x points + complimentary dessert' },
      ],
      earnRate: EARN_RATE,
      redeemRate: '10 points = Rs 1',
    };
  }
}
