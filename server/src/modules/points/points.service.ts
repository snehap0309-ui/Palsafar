import { AuditAction } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../shared/utils/ApiError';
import { auditService } from '../audit/audit.service';

const POINTS_PER_RUPEE = 10;

export const pointsService = {
  async getBalance(userId: string) {
    const balance = await prisma.pointBalance.findUnique({ where: { userId } });
    return {
      balance: balance?.balance || 0,
      lifetimeEarned: balance?.lifetimeEarned || 0,
      lifetimeSpent: balance?.lifetimeSpent || 0,
    };
  },

  async earn(userId: string, amount: number, reason: string, referenceId?: string) {
    if (amount <= 0) throw new ApiError(400, 'Amount must be positive');

    const balance = await prisma.$transaction(async (tx) => {
      const updated = await tx.pointBalance.upsert({
        where: { userId },
        update: {
          balance: { increment: amount },
          lifetimeEarned: { increment: amount },
        },
        create: { userId, balance: amount, lifetimeEarned: amount, lifetimeSpent: 0 },
      });

      await tx.pointTransaction.create({
        data: { userId, amount, type: 'EARN', reason, referenceId },
      });

      return updated;
    });

    await auditService.log(AuditAction.POINTS_EARNED, 'PointTransaction', referenceId || balance.id, userId, null, null, { amount, reason, referenceId });

    return balance;
  },

  async spend(userId: string, amount: number, reason: string, referenceId?: string) {
    if (amount <= 0) throw new ApiError(400, 'Amount must be positive');

    const updated = await prisma.$transaction(async (tx) => {
      const balance = await tx.pointBalance.findUnique({ where: { userId } });
      if (!balance || balance.balance < amount) {
        throw new ApiError(400, 'Insufficient points');
      }

      const updatedBalance = await tx.pointBalance.update({
        where: { userId },
        data: {
          balance: { decrement: amount },
          lifetimeSpent: { increment: amount },
        },
      });

      await tx.pointTransaction.create({
        data: { userId, amount: -amount, type: 'SPEND', reason, referenceId },
      });

      return updatedBalance;
    });

    await auditService.log(AuditAction.POINTS_REDEEMED, 'PointTransaction', referenceId || updated.id, userId, null, null, { amount, reason, referenceId });

    return updated;
  },

  async getTransactionHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.pointTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.pointTransaction.count({ where: { userId } }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  },

  pointsToRupees(points: number): number {
    return Math.floor(points / POINTS_PER_RUPEE);
  },

  rupeesToPoints(rupees: number): number {
    return rupees * POINTS_PER_RUPEE;
  },
};
