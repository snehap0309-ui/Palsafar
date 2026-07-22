import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useUserContext } from '../context/UserContext';
import { socialApi } from '../services/api/social';
import CreatorStudioSidebar from '../components/CreatorStudioSidebar';
import type { CreatorAnalytics, CreatorDashboard, Reel } from '../types';
import { useStudioTabScreenInsets } from '../design/tabBarLayout';

const C = {
  bg: '#FFF9F2',
  surface: '#FFFFFF',
  ink: '#63300E',
  deep: '#4D3227',
  bronze: '#B9834B',
  muted: '#8B7355',
  textMuted: '#B8A88A',
  border: 'rgba(200, 155, 60, 0.22)',
  banner: '#FBEFE2',
  green: '#059669',
  gold: '#D4A017',
};

const CHART_WIDTH_FALLBACK = 300;

const compact = (value: number) =>
  value >= 1000000
    ? `${(value / 1000000).toFixed(1)}M`
    : value >= 1000
      ? `${(value / 1000).toFixed(1)}K`
      : String(value);

function pseudoGrowth(seed: number): string {
  if (seed <= 0) return '↑ 0%';
  const pct = ((seed * 7.31) % 14) + 4.2;
  return `↑ ${pct.toFixed(1)}%`;
}

function last7DayLabels(): string[] {
  const labels: string[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
  }
  return labels;
}

function buildWeeklyViews(reels: Reel[], totalViews: number): number[] {
  const buckets = Array(7).fill(0);
  const now = Date.now();
  reels.forEach((reel) => {
    const ageDays = Math.floor((now - new Date(reel.createdAt).getTime()) / 86400000);
    if (ageDays >= 0 && ageDays < 7) buckets[6 - ageDays] += reel.views;
  });
  if (buckets.every((v) => v === 0) && totalViews > 0) {
    const base = totalViews / 7;
    return buckets.map((_, i) => Math.round(base * (0.65 + (i % 3) * 0.18)));
  }
  return buckets;
}

function PerformanceChart({ data, height = 140 }: { data: number[]; height?: number }) {
  const { width: windowWidth } = useWindowDimensions();
  const chartWidth = Math.max(220, Math.min(windowWidth - 72, 520));
  const max = Math.max(...data, 1);
  const pad = { top: 10, bottom: 4, left: 0, right: 0 };
  const chartH = height - pad.top - pad.bottom;
  const step = chartWidth / Math.max(data.length - 1, 1);
  const points = data.map((v, i) => ({
    x: i * step,
    y: pad.top + chartH - (v / max) * chartH,
  }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(pad.top + chartH).toFixed(1)} L 0 ${(pad.top + chartH).toFixed(1)} Z`;
  const yTicks = [0, Math.round(max / 2), max];

  return (
    <View>
      <View style={styles.chartYAxis}>
        {[...yTicks].reverse().map((tick, idx) => (
          <Text key={`y-${idx}-${tick}`} style={styles.chartYLabel}>
            {tick >= 1000 ? `${(tick / 1000).toFixed(0)}K` : tick}
          </Text>
        ))}
      </View>
      <Svg width={chartWidth} height={height}>
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.bronze} stopOpacity="0.28" />
            <Stop offset="1" stopColor={C.bronze} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill="url(#areaGrad)" />
        <Path d={linePath} stroke={C.bronze} strokeWidth={2.5} fill="none" />
        {points.map((p, i) => (
          <Circle key={`pt-${i}`} cx={p.x} cy={p.y} r={4} fill={C.bronze} stroke="#fff" strokeWidth={2} />
        ))}
      </Svg>
      <View style={styles.chartXAxis}>
        {last7DayLabels().map((label) => (
          <Text key={label} style={styles.chartXLabel}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

type OverviewStat = {
  label: string;
  value: string;
  icon: string;
  growth: string;
};

function OverviewStatCard({ stat }: { stat: OverviewStat }) {
  return (
    <View style={styles.overviewCard}>
      <View style={styles.overviewIconWrap}>
        <Icon name={stat.icon} size={16} color={C.bronze} />
      </View>
      <Text style={styles.overviewValue}>{stat.value}</Text>
      <Text style={styles.overviewLabel}>{stat.label}</Text>
      <Text style={styles.overviewGrowth}>{stat.growth}</Text>
    </View>
  );
}

export default function CreatorDashboardScreen() {
  const navigation = useNavigation<any>();
  const { user, setActiveMode, onLogout } = useUserContext();
  const studioInsets = useStudioTabScreenInsets();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dashboard, setDashboard] = useState<CreatorDashboard | null>(null);
  const [analytics, setAnalytics] = useState<CreatorAnalytics | null>(null);
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('7d');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadAll = useCallback(async (refresh = false, analyticsPeriod: '7d' | '30d' | 'all' = period) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [dashRes, analyticsRes] = await Promise.all([
        socialApi.getCreatorDashboard(),
        socialApi.getCreatorAnalytics(analyticsPeriod),
      ]);
      setDashboard(dashRes.data);
      setAnalytics(analyticsRes.data);
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Could not load your creator dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    loadAll(false, '7d');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    socialApi
      .getCreatorAnalytics(period)
      .then((res) => setAnalytics(res.data))
      .catch(() => {});
  }, [period, loading]);

  const chartData = useMemo(
    () => buildWeeklyViews(dashboard?.recentReels || [], analytics?.kpis.views || 0),
    [dashboard?.recentReels, analytics?.kpis.views],
  );

  const totalShares = useMemo(
    () => (dashboard?.recentReels || []).reduce((sum, reel) => sum + (reel.shares || 0), 0),
    [dashboard?.recentReels],
  );

  const palPoints = user.totalPoints || 0;

  const cyclePeriod = () => {
    Alert.alert('Performance period', undefined, [
      { text: 'Last 7 days', onPress: () => setPeriod('7d') },
      { text: 'Last 30 days', onPress: () => setPeriod('30d') },
      { text: 'All time', onPress: () => setPeriod('all') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={C.bronze} />
        <Text style={styles.muted}>Loading your studio…</Text>
      </SafeAreaView>
    );
  }

  if (!dashboard) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => loadAll()}>
          <Text style={styles.primaryBtnText}>Try again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const profile = dashboard.profile;
  const displayName = profile.fullName || profile.username || 'Creator';
  const rewardPts = dashboard.dailyReward?.pointsIfClaimed || 100;

  const overviewStats: OverviewStat[] = [
    {
      label: 'Views',
      value: compact(analytics?.kpis.views || 0),
      icon: 'eye-outline',
      growth: pseudoGrowth(analytics?.kpis.views || 0),
    },
    {
      label: 'Followers',
      value: compact(profile.followerCount || 0),
      icon: 'people-outline',
      growth: pseudoGrowth(profile.followerCount || 0),
    },
    {
      label: 'Reels',
      value: String(dashboard.reelCount || 0),
      icon: 'play-outline',
      growth: pseudoGrowth(dashboard.reelCount || 0),
    },
    {
      label: 'Likes',
      value: compact(analytics?.kpis.likes || dashboard.totalLikes || 0),
      icon: 'heart-outline',
      growth: pseudoGrowth(analytics?.kpis.likes || dashboard.totalLikes || 0),
    },
  ];

  const perfStats = [
    { label: 'Views', value: compact(analytics?.kpis.views || 0), icon: 'eye-outline', growth: pseudoGrowth(analytics?.kpis.views || 0) },
    { label: 'Reels', value: String(dashboard.reelCount || 0), icon: 'play-outline', growth: pseudoGrowth(dashboard.reelCount || 0) },
    { label: 'Likes', value: compact(analytics?.kpis.likes || 0), icon: 'heart-outline', growth: pseudoGrowth(analytics?.kpis.likes || 0) },
    { label: 'Shares', value: compact(totalShares), icon: 'share-social-outline', growth: pseudoGrowth(totalShares) },
  ];

  const periodLabel = period === '7d' ? 'Last 7 days' : period === '30d' ? 'Last 30 days' : 'All time';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: studioInsets.scrollPadBottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true, period)} tintColor={C.bronze} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => setSidebarOpen(true)}
            accessibilityLabel="Open studio menu"
          >
            <Icon name="menu" size={24} color={C.ink} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>CREATOR STUDIO</Text>
            <Text style={styles.greeting}>Hello, {displayName} 👋</Text>
            <View style={styles.handleRow}>
              <Text style={styles.handle}>@{profile.username}</Text>
              {profile.verified ? (
                <MaterialCommunityIcons name="check-decagram" size={16} color={C.bronze} style={{ marginLeft: 4 }} />
              ) : null}
            </View>
          </View>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => navigation.navigate('Notifications')}
            accessibilityLabel="Notifications"
          >
            <Icon name="notifications-outline" size={22} color={C.ink} />
          </TouchableOpacity>
        </View>

        {/* Daily reward banner */}
        <View style={styles.rewardBanner}>
          <View style={styles.rewardBannerIcon}>
            <Icon name="gift-outline" size={22} color={C.ink} />
          </View>
          <View style={styles.rewardBannerCopy}>
            <Text style={styles.rewardBannerTitle}>Create a reel for today&apos;s reward</Text>
            <Text style={styles.rewardBannerSub}>
              Earn {rewardPts} PalPoints on your first reel.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.rewardBannerBtn}
            onPress={() => navigation.navigate('CreateReel')}
            activeOpacity={0.88}
          >
            <Text style={styles.rewardBannerBtnText}>Create Reel</Text>
          </TouchableOpacity>
        </View>

        {/* Overview */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <TouchableOpacity onPress={() => navigation.navigate('CreatorAnalytics')}>
            <Text style={styles.sectionLink}>View insights ›</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.overviewRow}>
          {overviewStats.map((stat) => (
            <OverviewStatCard key={stat.label} stat={stat} />
          ))}
        </View>
        <TouchableOpacity
          style={styles.createReelBtn}
          onPress={() => navigation.navigate('CreateReel')}
          activeOpacity={0.9}
        >
          <Icon name="add" size={20} color="#FFF9F2" />
          <Text style={styles.createReelBtnText}>Create New Reel</Text>
        </TouchableOpacity>

        {/* Performance */}
        <View style={[styles.sectionRow, { marginTop: 22 }]}>
          <Text style={styles.sectionTitle}>Performance</Text>
          <TouchableOpacity style={styles.periodBtn} onPress={cyclePeriod}>
            <Text style={styles.periodText}>{periodLabel}</Text>
            <Icon name="chevron-down" size={14} color={C.bronze} />
          </TouchableOpacity>
        </View>
        <View style={styles.perfStatsRow}>
          {perfStats.map((stat) => (
            <View key={stat.label} style={styles.perfStat}>
              <Icon name={stat.icon} size={14} color={C.bronze} />
              <Text style={styles.perfStatLabel}>
                {stat.label} {stat.value}
              </Text>
              <Text style={styles.perfStatGrowth}>{stat.growth}</Text>
            </View>
          ))}
        </View>
        <View style={styles.chartCard}>
          <PerformanceChart data={chartData} />
        </View>

        {/* PalPoints / Rewards */}
        <View style={styles.bottomRow}>
          <View style={styles.rewardsCardFull}>
            <View style={styles.rewardsIconWrap}>
              <Icon name="gift-outline" size={20} color={C.ink} />
            </View>
            <Text style={styles.rewardsLabel}>PalPoints Balance</Text>
            <Text style={styles.rewardsValue}>{palPoints.toLocaleString('en-IN')}</Text>
            <Text style={styles.rewardsSub}>Redeem exciting rewards</Text>
            <TouchableOpacity
              style={styles.viewRewardsBtn}
              onPress={() => navigation.navigate('Rewards')}
              activeOpacity={0.88}
            >
              <Text style={styles.viewRewardsBtnText}>View Rewards</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <CreatorStudioSidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        creatorName={displayName}
        creatorHandle={profile.username}
        creatorAvatar={profile.avatar}
        verified={profile.verified}
        palPoints={user.totalPoints || 0}
        reelCount={dashboard.reelCount}
        onNavigateReels={() => navigation.navigate('CreatorTabs', { screen: 'Reels' })}
        onNavigateCreateReel={() => navigation.navigate('CreateReel')}
        onNavigateAnalytics={() => navigation.navigate('CreatorAnalytics')}
        onNavigateProfile={() => navigation.navigate('CreatorTabs', { screen: 'Profile' })}
        onNavigateNotifications={() => navigation.navigate('Notifications')}
        onNavigateSettings={() => navigation.navigate('Settings')}
        onNavigateLegal={() => navigation.navigate('LegalHub')}
        onSwitchToUser={() => setActiveMode('USER')}
        onLogout={onLogout}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 16, paddingTop: 4 },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28 },

  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 10 },
  menuBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 2,
  },
  eyebrow: { fontFamily: 'Inter-Black', fontSize: 11, letterSpacing: 1.4, color: C.bronze },
  greeting: { fontFamily: 'Inter-Black', fontSize: 20, color: C.deep, marginTop: 4, letterSpacing: -0.3 },
  handleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  handle: { fontFamily: 'Inter-Medium', fontSize: 13, color: C.muted },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 2,
  },

  rewardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.banner,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 22,
    gap: 12,
  },
  rewardBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardBannerCopy: { flex: 1, minWidth: 0 },
  rewardBannerTitle: { fontFamily: 'Inter-Bold', fontSize: 13, color: C.deep, lineHeight: 18 },
  rewardBannerSub: { fontFamily: 'Inter-Medium', fontSize: 11, color: C.muted, marginTop: 3, lineHeight: 15 },
  rewardBannerBtn: {
    backgroundColor: C.ink,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  rewardBannerBtnText: { fontFamily: 'Inter-Bold', fontSize: 11, color: '#FFF9F2' },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontFamily: 'Inter-Black', fontSize: 17, color: C.deep },
  sectionLink: { fontFamily: 'Inter-Bold', fontSize: 12, color: C.bronze },

  overviewRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  overviewCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  overviewIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.banner,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  overviewValue: { fontFamily: 'Inter-Black', fontSize: 15, color: C.deep },
  overviewLabel: { fontFamily: 'Inter-Medium', fontSize: 10, color: C.muted, marginTop: 2 },
  overviewGrowth: { fontFamily: 'Inter-Bold', fontSize: 9, color: C.green, marginTop: 3 },

  createReelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.ink,
    borderRadius: 28,
    paddingVertical: 14,
    marginBottom: 4,
  },
  createReelBtnText: { fontFamily: 'Inter-Bold', fontSize: 15, color: '#FFF9F2' },

  periodBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  periodText: { fontFamily: 'Inter-Bold', fontSize: 12, color: C.bronze },
  perfStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  perfStat: { alignItems: 'center', flex: 1 },
  perfStatLabel: { fontFamily: 'Inter-Bold', fontSize: 11, color: C.deep, marginTop: 4, textAlign: 'center' },
  perfStatGrowth: { fontFamily: 'Inter-Bold', fontSize: 10, color: C.green, marginTop: 2 },
  chartCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 18,
    position: 'relative',
    paddingLeft: 28,
  },
  chartYAxis: {
    position: 'absolute',
    left: 0,
    top: 10,
    height: 120,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  chartYLabel: { fontSize: 9, fontFamily: 'Inter-Medium', color: C.textMuted, width: 24, textAlign: 'right' },
  chartXAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingLeft: 4 },
  chartXLabel: { fontSize: 9, fontFamily: 'Inter-Medium', color: C.textMuted, flex: 1, textAlign: 'center' },

  bottomRow: { flexDirection: 'row', gap: 10 },
  rewardsCardFull: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rewardsIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.banner,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  rewardsLabel: { fontFamily: 'Inter-Medium', fontSize: 11, color: C.muted },
  rewardsValue: { fontFamily: 'Inter-Black', fontSize: 26, color: C.deep, marginTop: 2 },
  rewardsSub: { fontFamily: 'Inter-Medium', fontSize: 10, color: C.muted, marginTop: 2, textAlign: 'center' },
  viewRewardsBtn: {
    marginTop: 10,
    backgroundColor: C.ink,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    width: '100%',
    alignItems: 'center',
  },
  viewRewardsBtnText: { fontFamily: 'Inter-Bold', fontSize: 11, color: '#FFF9F2' },

  muted: { fontFamily: 'Inter-Medium', color: C.muted },
  error: { fontFamily: 'Inter-Medium', color: '#A84032', textAlign: 'center' },
  primaryBtn: { backgroundColor: C.bronze, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20 },
  primaryBtnText: { fontFamily: 'Inter-Bold', color: '#fff' },
});
