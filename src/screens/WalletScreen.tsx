import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { LinearGradient } from '../utils/LinearGradient';
import { Ionicons } from '../utils/Icons';
import { useTheme } from '../context/ThemeContext';
import { spacing, borderRadius, shadows } from '../config/theme';
import { UserProfile } from '../types';
import { DEV_FLAGS } from '../config/devFlags';
import { walletApi, WalletProfile, WalletTransaction } from '../services/api';
import BannerAdSlot from '../components/ads/BannerAdSlot';
import { useHeaderSafePadding } from '../design/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface WalletScreenProps {
  user: UserProfile;
  onBack: () => void;
  onNavigateToRewards: () => void;
  onNavigateToScanner?: () => void;
  walletProfile?: WalletProfile;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
  if (diffHr < 24) return `${diffHr} ${diffHr === 1 ? 'hour' : 'hours'} ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  return dateStr.split('T')[0];
}

const featuredRewards = [
  { id: '1', title: 'Free Chai at Bhopal Café', pointsRequired: 200 },
  { id: '2', title: '20% Off at Jabalpur Hotel', pointsRequired: 500 },
  { id: '3', title: '₹200 Travel Voucher', pointsRequired: 1000 },
  { id: '4', title: 'Exclusive Heritage Tour', pointsRequired: 2500 },
];

export default function WalletScreen({
  user,
  onBack,
  onNavigateToRewards,
  onNavigateToScanner,
  walletProfile: initialWalletProfile,
}: WalletScreenProps) {
  const { theme } = useTheme();
  const headerPadTop = useHeaderSafePadding(12);
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState<WalletProfile | null>(initialWalletProfile || null);
  const [error, setError] = useState<string | null>(null);

  const palPoints = wallet?.palPoints ?? user.totalPoints ?? 0;
  const lifetimeEarned = wallet?.lifetimeEarned ?? 0;
  const lifetimeSpent = wallet?.lifetimeSpent ?? 0;
  const redemptionsCount = user.redeemedOffers?.length ?? wallet?.recentTransactions?.filter(t => t.type === 'SPEND').length ?? 0;
  const transactions: WalletTransaction[] = wallet?.recentTransactions ?? [];

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      if (DEV_FLAGS.USE_SERVER_API) {
        const walletRes = await walletApi.getProfile();
        const data: any = walletRes?.data ?? walletRes;
        if (data) {
          setWallet({
            id: data.id || 'wallet',
            userId: data.userId || user.uid,
            palPoints: data.palPoints ?? data.pointBalance ?? user.totalPoints ?? 0,
            lifetimeEarned: data.lifetimeEarned ?? 0,
            lifetimeSpent: data.lifetimeSpent ?? 0,
            pointBalance: data.pointBalance ?? data.palPoints ?? 0,
            recentTransactions: data.recentTransactions ?? [],
          });
        } else {
          setWallet({
            id: 'fallback',
            userId: user.uid,
            palPoints: user.totalPoints || 0,
            lifetimeEarned: user.totalPoints || 0,
            lifetimeSpent: 0,
            pointBalance: user.totalPoints || 0,
            recentTransactions: [],
          });
        }
      } else {
        setWallet(initialWalletProfile || {
          id: 'local',
          userId: user.uid,
          palPoints: user.totalPoints || 0,
          lifetimeEarned: user.totalPoints || 0,
          lifetimeSpent: 0,
          pointBalance: user.totalPoints || 0,
          recentTransactions: [],
        });
      }
    } catch (err: any) {
      console.warn('Failed to load wallet data:', err);
      // Keep the screen usable with local/fallback points instead of hard-failing.
      setWallet(prev => prev || {
        id: 'fallback',
        userId: user.uid,
        palPoints: user.totalPoints || 0,
        lifetimeEarned: user.totalPoints || 0,
        lifetimeSpent: 0,
        pointBalance: user.totalPoints || 0,
        recentTransactions: [],
      });
      setError(err?.message || 'Showing local balance — could not sync wallet');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [initialWalletProfile, user.uid, user.totalPoints]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.border, paddingTop: headerPadTop }]}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: theme.surface }]} onPress={onBack}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Pal Wallet</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  if (error && !wallet) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.border, paddingTop: headerPadTop }]}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: theme.surface }]} onPress={onBack}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Pal Wallet</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="wallet-outline" size={64} color={theme.textMuted} />
          <Text style={[styles.errorTitle, { color: theme.text }]}>Unable to Load Wallet</Text>
          <Text style={[styles.errorText, { color: theme.textMuted }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={() => { setLoading(true); fetchData(); }}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.surface, marginTop: 12, borderWidth: 1, borderColor: theme.border }]}
            onPress={onNavigateToRewards}
          >
            <Text style={[styles.retryButtonText, { color: theme.text }]}>Browse Rewards</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border, paddingTop: headerPadTop }]}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: theme.surface }]} onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Pal Wallet</Text>
        <TouchableOpacity
          style={[styles.settingsButton, { backgroundColor: theme.surface }]}
          onPress={() => Alert.alert('Notifications', 'No new notifications at this time.')}
        >
          <Ionicons name="notifications-outline" size={22} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        <BannerAdSlot />
        <LinearGradient
          colors={[theme.primary, theme.primaryDark]}
          style={styles.balanceCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.balanceLabel}>Pal Points Balance</Text>
          <Text style={styles.balanceValue}>{palPoints.toLocaleString()}</Text>
          <Text style={styles.balanceHint}>Use points on vendor offers</Text>
        </LinearGradient>

        {!!error && (
          <View style={[styles.syncBanner, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="cloud-offline-outline" size={16} color={theme.textSecondary} />
            <Text style={[styles.syncBannerText, { color: theme.textSecondary }]} numberOfLines={2}>
              {error}
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <View style={[styles.statsRow, { backgroundColor: theme.surface }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.green }]}>+{lifetimeEarned.toLocaleString()}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Lifetime Earned</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.danger }]}>-{lifetimeSpent.toLocaleString()}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Lifetime Spent</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text }]}>{redemptionsCount}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Redemptions</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              style={[styles.quickActionCard, { backgroundColor: theme.surface }]}
              onPress={onNavigateToRewards}
              activeOpacity={0.8}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: theme.gold + '20' }]}>
                <Ionicons name="gift" size={24} color={theme.gold} />
              </View>
              <Text style={[styles.quickActionTitle, { color: theme.text }]} numberOfLines={2}>
                Discover Rewards
              </Text>
              <Text style={[styles.quickActionSub, { color: theme.textMuted }]} numberOfLines={2}>
                Spend your points
              </Text>
            </TouchableOpacity>

            {onNavigateToScanner && (
              <TouchableOpacity
                style={[styles.quickActionCard, { backgroundColor: theme.surface }]}
                onPress={onNavigateToScanner}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: theme.accent + '20' }]}>
                  <Ionicons name="send" size={24} color={theme.accent} />
                </View>
                <Text style={[styles.quickActionTitle, { color: theme.text }]} numberOfLines={2}>
                  Send to Vendor
                </Text>
                <Text style={[styles.quickActionSub, { color: theme.textMuted }]} numberOfLines={2}>
                  Enter business code
                </Text>
              </TouchableOpacity>
            )}

          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Transactions</Text>
          {transactions.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
              <Ionicons name="receipt-outline" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No transactions yet</Text>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                Your transaction history will appear here
              </Text>
            </View>
          ) : (
            transactions.map((txn) => {
              const isEarn = txn.type === 'EARN';
              return (
                <View key={txn.id} style={[styles.transactionItem, { backgroundColor: theme.surface }]}>
                  <View style={[styles.transactionIcon, { backgroundColor: isEarn ? theme.green + '20' : theme.danger + '20' }]}>
                    <Ionicons
                      name={isEarn ? 'arrow-down' : 'arrow-up'}
                      size={16}
                      color={isEarn ? theme.green : theme.danger}
                    />
                  </View>
                  <View style={styles.transactionContent}>
                    <Text style={[styles.transactionReason, { color: theme.text }]} numberOfLines={1}>
                      {txn.reason}
                    </Text>
                    <Text style={[styles.transactionDate, { color: theme.textMuted }]}>
                      {formatRelativeTime(txn.createdAt)}
                    </Text>
                  </View>
                  <Text style={[
                    styles.transactionAmount,
                    { color: isEarn ? theme.green : theme.danger }
                  ]}>
                    {isEarn ? '+' : '-'}{txn.amount}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Reward Progress</Text>
            <TouchableOpacity onPress={onNavigateToRewards}>
              <Text style={[styles.seeAllText, { color: theme.primary }]}>See All</Text>
            </TouchableOpacity>
          </View>
          {featuredRewards.slice(0, 3).map((reward) => {
            const progress = Math.min(100, Math.round((palPoints / reward.pointsRequired) * 100));
            return (
              <TouchableOpacity
                key={reward.id}
                style={[styles.rewardProgressCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={onNavigateToRewards}
                activeOpacity={0.7}
              >
                <View style={styles.rewardProgressInfo}>
                  <Text style={[styles.rewardProgressTitle, { color: theme.text }]} numberOfLines={1}>
                    {reward.title}
                  </Text>
                  <Text style={[styles.rewardProgressPoints, { color: theme.textMuted }]}>
                    {reward.pointsRequired.toLocaleString()} pts needed
                  </Text>
                </View>
                <View style={styles.rewardProgressBarRow}>
                  <View style={[styles.rewardProgressBar, { backgroundColor: theme.backgroundLight }]}>
                    <View
                      style={[
                        styles.rewardProgressFill,
                        {
                          width: `${progress}%`,
                          backgroundColor: progress >= 100 ? theme.green : theme.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.rewardProgressPercent, { color: progress >= 100 ? theme.green : theme.primary }]}>
                    {progress}%
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.bottomSpacing, { height: Math.max(insets.bottom, 24) + 24 }]} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 0,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  retryButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  balanceCard: {
    margin: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    ...shadows.md,
  },
  syncBanner: {
    marginHorizontal: spacing.lg,
    marginTop: -spacing.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  balanceLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  balanceValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#fff',
    marginTop: spacing.sm,
  },
  balanceHint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
    marginTop: spacing.sm,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 36,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  quickActionCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  quickActionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  quickActionSub: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
    width: '100%',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  transactionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  transactionContent: {
    flex: 1,
  },
  transactionReason: {
    fontSize: 14,
    fontWeight: '500',
  },
  transactionDate: {
    fontSize: 11,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    borderRadius: borderRadius.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  rewardProgressCard: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  rewardProgressInfo: {
    marginBottom: spacing.sm,
  },
  rewardProgressTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  rewardProgressPoints: {
    fontSize: 11,
    marginTop: 2,
  },
  rewardProgressBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rewardProgressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  rewardProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  rewardProgressPercent: {
    fontSize: 12,
    fontWeight: '700',
    width: 36,
    textAlign: 'right',
  },
  bottomSpacing: {
    height: 100,
  },
});
