import { prisma } from '../../config/database';
import { ApiError } from '../../shared/utils/ApiError';
import { notificationService } from '../notifications/notification.service';
import { logger } from '../../config/logger';

export const walletService = {
  async getOrCreateWallet(userId: string) {
    let wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: { userId },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
    }

    return wallet;
  },

  async getProfile(userId: string) {
    const wallet = await this.getOrCreateWallet(userId);
    const [pointsBalance, recentTransactions] = await Promise.all([
      prisma.pointBalance.findUnique({ where: { userId } }),
      prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      palPoints: wallet.palPoints,
      lifetimeEarned: wallet.lifetimeEarned,
      lifetimeSpent: wallet.lifetimeSpent,
      pointBalance: pointsBalance?.balance || 0,
      recentTransactions,
    };
  },

  async getBatchProfiles(userIds: string[]) {
    const uniqueIds = [...new Set(userIds)];
    const wallets = await prisma.wallet.findMany({
      where: { userId: { in: uniqueIds } },
      select: {
        userId: true,
        palPoints: true,
        lifetimeEarned: true,
        lifetimeSpent: true,
      },
    });

    const map: Record<string, { palPoints: number; lifetimeEarned: number; lifetimeSpent: number }> = {};
    for (const wallet of wallets) {
      map[wallet.userId] = {
        palPoints: wallet.palPoints,
        lifetimeEarned: wallet.lifetimeEarned,
        lifetimeSpent: wallet.lifetimeSpent,
      };
    }
    return map;
  },

  async earn(userId: string, amount: number, reason: string, referenceId?: string, referenceType?: string) {
    if (amount <= 0) throw new ApiError(400, 'Amount must be positive');

    await this.getOrCreateWallet(userId);

    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.update({
        where: { userId },
        data: {
          palPoints: { increment: amount },
          lifetimeEarned: { increment: amount },
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId,
          amount,
          type: 'EARN',
          reason,
          referenceId,
          referenceType,
        },
      });

      return wallet;
    });

    setImmediate(() => {
      notificationService
        .sendToUser(userId, `+${amount} Pal Points`, reason, { type: 'points_earned', amount }, 'points_earned')
        .catch((err: any) => logger.error({ err, userId, amount, reason }, 'Failed to send points notification'));
    });

    return result;
  },

  async spend(userId: string, amount: number, reason: string, referenceId?: string, referenceType?: string) {
    if (amount <= 0) throw new ApiError(400, 'Amount must be positive');

    await this.getOrCreateWallet(userId);

    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.wallet.updateMany({
        where: { userId, palPoints: { gte: amount } },
        data: {
          palPoints: { decrement: amount },
          lifetimeSpent: { increment: amount },
        },
      });

      if (updateResult.count === 0) {
        throw new ApiError(400, `Insufficient Pal Points. Need ${amount}`);
      }

      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new ApiError(404, 'Wallet not found');

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId,
          amount: -amount,
          type: 'SPEND',
          reason,
          referenceId,
          referenceType,
        },
      });

      return wallet;
    });

    return result;
  },

  async getTransactions(userId: string, page = 1, limit = 20) {
    const wallet = await this.getOrCreateWallet(userId);
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.walletTransaction.count({ where: { walletId: wallet.id } }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  },

  async adjustWallet(userId: string, adminId: string, data: { palPoints?: number; reason: string }) {
    await this.getOrCreateWallet(userId);
    
    return prisma.$transaction(async (tx) => {
      const updateData: any = {};
      if (data.palPoints !== undefined) {
        updateData.palPoints = { increment: data.palPoints };
      }

      const wallet = await tx.wallet.update({ where: { userId }, data: updateData });

      if (data.palPoints) {
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            userId,
            amount: data.palPoints,
            type: data.palPoints > 0 ? 'EARN' : 'SPEND',
            reason: `Admin Adjustment: ${data.reason}`,
            referenceType: 'ADMIN_ADJUSTMENT',
            referenceId: adminId
          }
        });
      }

      return wallet;
    });
  },

  async getLeaderboard(page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.wallet.findMany({
        where: { palPoints: { gt: 0 }, NOT: { user: { permission: 'ADMIN' } } },
        orderBy: { palPoints: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              permission: true,
              userRoles: {
                where: { status: 'APPROVED' },
                select: { role: true },
              },
            },
          },
        },
      }),
      prisma.wallet.count({ where: { palPoints: { gt: 0 }, NOT: { user: { permission: 'ADMIN' } } } }),
    ]);

    const totalPages = Math.ceil(total / limit);
    const ranks = data.map((w, i) => {
      const permission = String(w.user.permission || 'USER').toUpperCase();
      const roles = (w.user.userRoles || []).map((r) => String(r.role).toUpperCase());
      let roleLabel = 'Traveler';
      if (permission === 'VENDOR' || roles.includes('VENDOR')) roleLabel = 'Vendor';
      else if (
        permission === 'CONTENT_CREATOR' ||
        roles.includes('CONTENT_CREATOR')
      ) {
        roleLabel = 'Creator';
      }

      return {
        rank: skip + i + 1,
        userId: w.userId,
        name: w.user.name || 'Unknown',
        email: w.user.email,
        palPoints: w.palPoints,
        lifetimeEarned: w.lifetimeEarned,
        roleLabel,
      };
    });

    const avgPoints = total > 0
      ? Math.round(data.reduce((s, w) => s + w.palPoints, 0) / data.length)
      : 0;

    return {
      data: ranks,
      stats: {
        totalUsers: total,
        averagePoints: avgPoints,
        topScore: data[0]?.palPoints || 0,
      },
      pagination: {
        page, limit, total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  },

  async getRegionalLeaderboard(city: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    // Find all check-ins in the specified city
    const checkIns = await prisma.checkIn.findMany({
      where: {
        place: {
          city: { equals: city, mode: 'insensitive' },
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    // Group check-ins by user to calculate regional exploration activity
    const userMap = new Map<string, { userId: string; name: string; email: string; avatar: string | null; checkInCount: number }>();
    for (const c of checkIns) {
      if (!c.user) continue;
      const existing = userMap.get(c.userId);
      if (existing) {
        existing.checkInCount += 1;
      } else {
        userMap.set(c.userId, {
          userId: c.userId,
          name: c.user.name || 'Unknown',
          email: c.user.email,
          avatar: c.user.avatar,
          checkInCount: 1,
        });
      }
    }

    // Sort users by check-in count
    const sorted = Array.from(userMap.values())
      .sort((a, b) => b.checkInCount - a.checkInCount);

    const paginatedData = sorted.slice(skip, skip + limit);
    const total = sorted.length;

    const ranks = paginatedData.map((item, index) => ({
      rank: skip + index + 1,
      userId: item.userId,
      name: item.name,
      email: item.email,
      avatar: item.avatar,
      checkInCount: item.checkInCount,
    }));

    return {
      data: ranks,
      total,
    };
  },
};
