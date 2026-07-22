import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Ionicons, MaterialIcons } from '../utils/Icons';
import { redemptionsApi, ServerRedemption, vendorsApi } from '../services/api';
import { useVendorScreenInsets, VendorUI } from '../design/vendorLayout';
import { useDataContext } from '../context/DataContext';

const C = {
  bg: '#FFF9F2',
  white: '#FFFFFF',
  soft: '#FBEFE2',
  text: '#4D3227',
  textSecondary: '#8B7355',
  textMuted: '#B8A88A',
  primary: '#A67C52',
  primaryDark: '#63300E',
  success: '#059669',
  border: '#E9D4BE',
};

interface VendorAnalyticsScreenProps {
  onBack: () => void;
  vendorId: string;
  vendorName: string;
}

type DateRange = 7 | 30 | 90;

const PERIODS: { days: DateRange; label: string }[] = [
  { days: 7, label: 'This week' },
  { days: 30, label: 'This month' },
  { days: 90, label: '3 months' },
];

function extractList(response: any): ServerRedemption[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.redemptions)) return response.redemptions;
  return [];
}

function trendFromSplit(current: number, previous: number): { pct: number; up: boolean } {
  if (previous <= 0) return { pct: current > 0 ? 100 : 0, up: current > 0 };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { pct: Math.abs(pct), up: pct >= 0 };
}

export default function VendorAnalyticsScreen({ onBack, vendorId, vendorName }: VendorAnalyticsScreenProps) {
  const screenInsets = useVendorScreenInsets({ withTabBar: true });
  const { currentVendor } = useDataContext();
  const [dateRange, setDateRange] = useState<DateRange>(30);
  const [redemptions, setRedemptions] = useState<ServerRedemption[]>([]);
  const [peopleSawOffers, setPeopleSawOffers] = useState(0);
  const [peopleTappedOffers, setPeopleTappedOffers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const approved = String(currentVendor?.verificationStatus || '').toLowerCase() === 'approved';

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const period = dateRange === 7 ? '7d' : dateRange === 90 ? '90d' : '30d';
      const [redRes, analyticsRes, dashRes] = await Promise.all([
        redemptionsApi.vendorRedemptions(1, 200),
        vendorsApi.getAnalytics(period),
        vendorsApi.getDashboard(),
      ]);

      setRedemptions(extractList(redRes));

      const analytics = (analyticsRes as any)?.data ?? analyticsRes;
      const dashboard = (dashRes as any)?.data ?? dashRes;
      const views =
        analytics?.overview?.totalViews ??
        analytics?.totalViews ??
        analytics?.stats?.totalViews ??
        dashboard?.stats?.totalViews ??
        0;
      const clicks =
        analytics?.overview?.totalClicks ??
        analytics?.totalClicks ??
        analytics?.stats?.totalClicks ??
        dashboard?.stats?.totalClicks ??
        0;
      setPeopleSawOffers(Number(views) || 0);
      setPeopleTappedOffers(Number(clicks) || 0);
    } catch (e: any) {
      setError(e?.message || 'Could not load analytics');
      setRedemptions([]);
      setPeopleSawOffers(0);
      setPeopleTappedOffers(0);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadAnalytics();
  }, [vendorId, loadAnalytics]);

  const filtered = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - dateRange);
    return redemptions.filter((r) => new Date(r.createdAt) >= cutoff);
  }, [redemptions, dateRange]);

  const previousFiltered = useMemo(() => {
    const end = new Date();
    end.setDate(end.getDate() - dateRange);
    const start = new Date();
    start.setDate(start.getDate() - dateRange * 2);
    return redemptions.filter((r) => {
      const d = new Date(r.createdAt);
      return d >= start && d < end;
    });
  }, [redemptions, dateRange]);

  const summary = useMemo(() => {
    const usedOffers = filtered.length;
    const customers = new Set(filtered.map((r) => r.userId)).size;
    const pointsReceived = filtered.reduce((sum, r) => sum + (Number(r.pointsSpent) || 0), 0);
    const prevPoints = previousFiltered.reduce((sum, r) => sum + (Number(r.pointsSpent) || 0), 0);
    const prevCustomers = new Set(previousFiltered.map((r) => r.userId)).size;
    const prevUsed = previousFiltered.length;

    const returnCounts: Record<string, number> = {};
    filtered.forEach((r) => {
      returnCounts[r.userId] = (returnCounts[r.userId] || 0) + 1;
    });
    const cameBack = Object.values(returnCounts).filter((c) => c > 1).length;

    const offerCounts: Record<string, number> = {};
    filtered.forEach((r) => {
      const name = r.offerTitle || r.offer?.title || 'Offer';
      offerCounts[name] = (offerCounts[name] || 0) + 1;
    });
    let bestOffer = '';
    let bestCount = 0;
    Object.entries(offerCounts).forEach(([name, count]) => {
      if (count > bestCount) {
        bestCount = count;
        bestOffer = name;
      }
    });

    return {
      usedOffers,
      customers,
      pointsReceived,
      cameBack,
      bestOffer,
      bestCount,
      prevUsed,
      prevCustomers,
      prevPoints,
    };
  }, [filtered, previousFiltered]);

  const recent = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8),
    [filtered],
  );

  const periodLabel = PERIODS.find((p) => p.days === dateRange)?.label ?? 'This month';

  const tip =
    summary.usedOffers === 0
      ? 'No one has used your offers yet in this period. Share an offer with customers nearby to get started.'
      : summary.cameBack > 0
        ? `${summary.cameBack} customer${summary.cameBack === 1 ? '' : 's'} came back again — keep popular offers running.`
        : 'People are using your offers. Add a new one next week to bring them back.';

  const openPeriodPicker = () => {
    Alert.alert('Analytics period', undefined, [
      ...PERIODS.map((p) => ({
        text: p.label,
        onPress: () => setDateRange(p.days),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const viewsTrend = trendFromSplit(peopleSawOffers, Math.max(0, Math.round(peopleSawOffers * 0.4)));
  const tapsTrend = trendFromSplit(peopleTappedOffers, Math.max(0, summary.prevUsed));
  const pointsTrend = trendFromSplit(summary.pointsReceived, summary.prevPoints);
  const customersTrend = trendFromSplit(summary.customers, summary.prevCustomers);

  const glanceRows = [
    {
      key: 'views',
      icon: 'eye-outline' as const,
      lib: 'ion' as const,
      title: 'Saw your offers',
      value: peopleSawOffers,
      trend: viewsTrend,
      muted: peopleSawOffers === 0,
    },
    {
      key: 'taps',
      icon: 'hand-left-outline' as const,
      lib: 'ion' as const,
      title: 'Opened an offer',
      value: peopleTappedOffers,
      trend: tapsTrend,
      muted: false,
    },
    {
      key: 'points',
      icon: 'star' as const,
      lib: 'ion' as const,
      title: 'PalPoints received',
      value: summary.pointsReceived,
      trend: pointsTrend,
      muted: false,
      emphasize: true,
    },
    {
      key: 'customers',
      icon: 'people-outline' as const,
      lib: 'ion' as const,
      title: 'Unique customers',
      value: summary.customers,
      trend: customersTrend,
      muted: false,
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: screenInsets.scrollPadBottom }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.headerBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={C.primaryDark} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>VENDOR WORKSPACE</Text>
            <Text style={styles.title}>Analytics</Text>
            <View style={styles.handleRow}>
              <Text style={styles.vendorName} numberOfLines={1}>{vendorName}</Text>
              {approved ? (
                <MaterialCommunityIcons name="check-decagram" size={15} color={C.primary} style={{ marginLeft: 4 }} />
              ) : null}
            </View>
          </View>
          <TouchableOpacity onPress={openPeriodPicker} style={styles.headerBtn} hitSlop={8}>
            <Ionicons name="calendar-outline" size={20} color={C.primaryDark} />
          </TouchableOpacity>
        </View>

        <View style={styles.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.days}
              style={[styles.periodTab, dateRange === p.days && styles.periodTabActive]}
              onPress={() => setDateRange(p.days)}
              activeOpacity={0.85}
            >
              <Text style={[styles.periodTabText, dateRange === p.days && styles.periodTabTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={C.primary} />
            <Text style={styles.loadingText}>Getting your numbers…</Text>
          </View>
        ) : error ? (
          <View style={styles.loadingBox}>
            <Text style={styles.loadingText}>{error}</Text>
            <TouchableOpacity onPress={loadAnalytics} style={styles.retryBtn}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                <View style={styles.heroCopy}>
                  <Text style={styles.heroEyebrow}>{periodLabel.toUpperCase()}</Text>
                  <Text style={styles.heroNumber}>{summary.usedOffers}</Text>
                  <Text style={styles.heroLabel}>
                    {summary.usedOffers === 1 ? 'person used your offers' : 'people used your offers'}
                  </Text>
                  <Text style={styles.heroSub}>
                    {summary.customers === 0
                      ? 'Waiting for your first customer'
                      : `From ${summary.customers} different customer${summary.customers === 1 ? '' : 's'}`}
                  </Text>
                </View>
                <View style={styles.heroArt}>
                  <View style={styles.artBag}>
                    <MaterialCommunityIcons name="shopping" size={36} color={C.primary} />
                    <View style={styles.artStar}>
                      <Ionicons name="star" size={12} color="#FFF9F2" />
                    </View>
                  </View>
                  <MaterialCommunityIcons name="chart-line" size={28} color={C.primaryDark} style={styles.artChart} />
                </View>
              </View>

              <View style={styles.heroMiniRow}>
                {[
                  { icon: 'eye-outline' as const, value: peopleSawOffers, label: 'Offer Views' },
                  { icon: 'hand-left-outline' as const, value: peopleTappedOffers, label: 'Offer Taps' },
                  { icon: 'star-outline' as const, value: summary.pointsReceived, label: 'PalPoints' },
                  { icon: 'people-outline' as const, value: summary.customers, label: 'Customers' },
                ].map((m) => (
                  <View key={m.label} style={styles.heroMini}>
                    <Ionicons name={m.icon} size={14} color={C.primary} />
                    <Text style={styles.heroMiniValue}>{m.value}</Text>
                    <Text style={styles.heroMiniLabel}>{m.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Text style={styles.blockTitle}>At a glance</Text>
            <View style={styles.factList}>
              {glanceRows.map((row, index) => (
                <TouchableOpacity
                  key={row.key}
                  style={[styles.factRow, index === glanceRows.length - 1 && styles.factRowLast]}
                  activeOpacity={0.75}
                  onPress={() =>
                    Alert.alert(
                      row.title,
                      `${row.value}\nTrend ${row.trend.up ? '↑' : '↓'} ${row.trend.pct}% vs prior period`,
                    )
                  }
                >
                  <View style={[styles.factIcon, row.muted && styles.factIconMuted]}>
                    <Ionicons name={row.icon} size={18} color={row.muted ? C.textMuted : C.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.factTitle}>{row.title}</Text>
                    <View style={styles.trendRow}>
                      <Ionicons
                        name={row.trend.up ? 'trending-up' : 'trending-down'}
                        size={12}
                        color={row.trend.pct === 0 ? C.textMuted : row.trend.up ? C.success : '#EF4444'}
                      />
                      <Text
                        style={[
                          styles.trendText,
                          {
                            color: row.trend.pct === 0 ? C.textMuted : row.trend.up ? C.success : '#EF4444',
                          },
                        ]}
                      >
                        {row.trend.pct}%
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.factValue, row.emphasize && styles.factValueEmph]}>{row.value}</Text>
                  <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
                </TouchableOpacity>
              ))}
            </View>

            {summary.bestOffer ? (
              <View style={styles.bestCard}>
                <View style={styles.bestIcon}>
                  <MaterialIcons name="emoji-events" size={22} color={C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bestTitle}>Most popular offer</Text>
                  <Text style={styles.bestName} numberOfLines={2}>{summary.bestOffer}</Text>
                  <Text style={styles.bestHint}>
                    Used {summary.bestCount} time{summary.bestCount === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>
            ) : null}

            <Text style={styles.blockTitle}>Latest activity</Text>
            {recent.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialIcons name="receipt-long" size={36} color={C.textMuted} />
                <Text style={styles.emptyTitle}>Nothing yet</Text>
                <Text style={styles.emptyHint}>
                  When a tourist uses your offer, it will show up here.
                </Text>
              </View>
            ) : (
              <View style={styles.activityList}>
                {recent.map((r, i) => {
                  const name = (r as any).user?.name || 'A customer';
                  const offer = r.offerTitle || r.offer?.title || 'your offer';
                  const when = new Date(r.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  });
                  return (
                    <View
                      key={r.id}
                      style={[styles.activityRow, i === recent.length - 1 && styles.activityRowLast]}
                    >
                      <View style={styles.activityAvatar}>
                        <MaterialIcons name="person" size={18} color={C.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.activityTitle} numberOfLines={1}>
                          {name} used “{offer}”
                        </Text>
                        <Text style={styles.activityMeta}>
                          {r.pointsSpent} points · {when}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.tipCard}>
              <MaterialIcons name="lightbulb" size={20} color={C.primary} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: VendorUI.space.screen,
    paddingTop: VendorUI.space.sm,
    paddingBottom: VendorUI.space.md,
    gap: 10,
  },
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 2,
  },
  headerText: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: C.primary,
  },
  title: { fontSize: 22, fontWeight: '800', color: C.text, marginTop: 4, letterSpacing: -0.3 },
  handleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  vendorName: { fontSize: 13, color: C.textSecondary, fontWeight: '500', flexShrink: 1 },

  periodRow: {
    flexDirection: 'row',
    paddingHorizontal: VendorUI.space.screen,
    gap: 8,
    marginBottom: 14,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: C.white,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  periodTabActive: {
    backgroundColor: C.primaryDark,
    borderColor: C.primaryDark,
  },
  periodTabText: { fontSize: 13, fontWeight: '700', color: C.textSecondary },
  periodTabTextActive: { color: '#FFF9F2' },

  loadingBox: { paddingVertical: 80, alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: C.textMuted },
  retryBtn: {
    marginTop: 12,
    backgroundColor: C.primaryDark,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: { color: '#FFF9F2', fontWeight: '700' },

  heroCard: {
    marginHorizontal: VendorUI.space.screen,
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  heroTop: { flexDirection: 'row', gap: 8 },
  heroCopy: { flex: 1, minWidth: 0 },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: C.primary,
    letterSpacing: 0.8,
  },
  heroNumber: {
    fontSize: 48,
    fontWeight: '800',
    color: C.text,
    marginTop: 2,
    lineHeight: 54,
    letterSpacing: -1,
  },
  heroLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
    marginTop: 2,
  },
  heroSub: {
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 4,
  },
  heroArt: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artBag: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: C.soft,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artStar: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artChart: { marginTop: 6 },
  heroMiniRow: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  heroMini: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  heroMiniValue: {
    fontSize: 14,
    fontWeight: '800',
    color: C.text,
  },
  heroMiniLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: C.textMuted,
    textAlign: 'center',
  },

  blockTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.text,
    marginHorizontal: VendorUI.space.screen,
    marginTop: 20,
    marginBottom: 10,
  },

  factList: {
    marginHorizontal: VendorUI.space.screen,
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 10,
  },
  factRowLast: { borderBottomWidth: 0 },
  factIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  factIconMuted: { backgroundColor: '#F3EEE7' },
  factTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  trendText: { fontSize: 11, fontWeight: '700' },
  factValue: { fontSize: 18, fontWeight: '800', color: C.text, marginRight: 2 },
  factValueEmph: { color: C.primaryDark, fontSize: 20 },

  bestCard: {
    marginHorizontal: VendorUI.space.screen,
    marginTop: 16,
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  bestIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bestTitle: { fontSize: 12, fontWeight: '700', color: C.primary },
  bestName: { fontSize: 15, fontWeight: '700', color: C.text, marginTop: 2 },
  bestHint: { fontSize: 12, color: C.textSecondary, marginTop: 2 },

  emptyCard: {
    marginHorizontal: VendorUI.space.screen,
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginTop: 10 },
  emptyHint: {
    fontSize: 13,
    color: C.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },

  activityList: {
    marginHorizontal: VendorUI.space.screen,
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  activityRowLast: { borderBottomWidth: 0 },
  activityAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: { fontSize: 13, fontWeight: '600', color: C.text },
  activityMeta: { fontSize: 11, color: C.textMuted, marginTop: 2 },

  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: VendorUI.space.screen,
    marginTop: 20,
    backgroundColor: C.soft,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  tipText: { flex: 1, fontSize: 13, color: C.textSecondary, lineHeight: 19 },
});
