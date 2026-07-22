import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  Image,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from '../utils/LinearGradient';
import { useUserContext } from '../context/UserContext';
import { gamificationApi, walletApi } from '../services/api';
import type { LeaderboardEntry } from '../services/api/gamification';
import { getCampaigns } from '../services/api/campaigns';
import type { Campaign } from '../services/api/campaigns';
import { useHeaderSafePadding } from '../design/responsive';

const H_PAD = 16;

const C = {
  bg: '#FFF9F2',
  surface: '#FFFFFF',
  card: '#FBEFE2',
  cardAlt: '#F5E6D0',
  ink: '#63300E',
  gold: '#B9834B',
  text: '#2C1810',
  textSub: '#8B7355',
  textMuted: '#B8A88A',
  border: 'rgba(200, 155, 60, 0.18)',
};

const RANK_STYLES = [
  { bg: '#FEF3C7', text: '#B45309', crown: '#EAB308' },
  { bg: '#F1F5F9', text: '#64748B', crown: '#94A3B8' },
  { bg: '#FFEDD5', text: '#C2410C', crown: '#EA580C' },
];

const HERO_SLIDES = [
  {
    id: 'hero-1',
    title: 'Amazing Rewards\nJust for You!',
    subtitle: 'Explore exciting rewards and redeem your PalPoints',
    gradient: ['#F5E6D0', '#E8D5C4', '#D4C4A8'],
  },
  {
    id: 'hero-2',
    title: 'Win Big with\nPalPoints',
    subtitle: 'From bikes to gadgets — claim exclusive prizes',
    gradient: ['#EDE9FE', '#DDD6FE', '#C4B5FD'],
  },
  {
    id: 'hero-3',
    title: 'Limited-Time\nCampaigns',
    subtitle: 'Hurry — stock is limited on featured rewards',
    gradient: ['#DBEAFE', '#BFDBFE', '#93C5FD'],
  },
];

type CampaignBadge = { label: string; tone: 'featured' | 'hot' | 'limited' | 'new' };

function campaignBadge(campaign: Campaign, index: number): CampaignBadge | null {
  const claimed = Math.max(0, (campaign.totalWinnerSlots || 0) - (campaign.remainingWinnerSlots || 0));
  if (index === 0) return { label: 'Featured', tone: 'featured' };
  if ((campaign.remainingWinnerSlots || 0) <= 1) return { label: 'Limited Stock', tone: 'limited' };
  if (claimed >= 2 && (campaign.totalWinnerSlots || 0) >= 3) return { label: 'Hot', tone: 'hot' };
  const created = new Date(campaign.createdAt).getTime();
  if (Date.now() - created < 14 * 86400000) return { label: 'New', tone: 'new' };
  return null;
}

function badgeStyle(tone: CampaignBadge['tone']) {
  switch (tone) {
    case 'featured':
      return { bg: '#DBEAFE', text: '#2563EB' };
    case 'hot':
      return { bg: '#FEE2E2', text: '#EF4444' };
    case 'limited':
      return { bg: 'rgba(15,23,42,0.72)', text: '#FFF' };
    case 'new':
      return { bg: '#D1FAE5', text: '#059669' };
  }
}

function progressColor(claimed: number, total: number): string {
  if (total <= 0) return C.gold;
  const ratio = claimed / total;
  if (ratio >= 0.5) return '#EA580C';
  if (ratio > 0) return '#2563EB';
  return C.gold;
}

function formatPts(n: number): string {
  return `${Math.round(n).toLocaleString('en-IN')} pts`;
}

export default function LeaderboardScreen() {
  const { user, isGuest } = useUserContext();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { width: SCREEN_W } = useWindowDimensions();
  const REWARD_CARD_W = SCREEN_W * 0.72;
  const HERO_W = SCREEN_W - H_PAD * 2;
  const headerPadTop = useHeaderSafePadding(8);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [myPoints, setMyPoints] = useState(Number(user?.totalPoints) || 0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      const [lbRes, campRes, walletRes] = await Promise.allSettled([
        gamificationApi.getLeaderboard(),
        getCampaigns({ status: 'ACTIVE', limit: 50 }),
        isGuest ? Promise.resolve(null) : walletApi.getProfile(),
      ]);

      if (lbRes.status === 'fulfilled') {
        setLeaderboard(Array.isArray(lbRes.value) ? lbRes.value : []);
      }

      if (campRes.status === 'fulfilled') {
        const list = Array.isArray(campRes.value) ? campRes.value : [];
        setCampaigns(list.filter(c => String(c?.status || '').toUpperCase() === 'ACTIVE'));
      } else {
        setCampaigns([]);
      }

      if (!isGuest && walletRes.status === 'fulfilled' && walletRes.value) {
        const w: any = walletRes.value;
        const profile = w?.data ?? w;
        const pts = Number(
          profile?.palPoints ?? profile?.pointBalance ?? profile?.data?.palPoints ?? user?.totalPoints ?? 0,
        );
        if (!Number.isNaN(pts)) setMyPoints(pts);
      } else if (user?.totalPoints != null) {
        setMyPoints(Number(user.totalPoints) || 0);
      }
    } catch {
      if (user?.totalPoints != null) setMyPoints(Number(user.totalPoints) || 0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.totalPoints, isGuest]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const activeCampaigns = useMemo(
    () => campaigns.filter(c => String(c.status || '').toUpperCase() === 'ACTIVE'),
    [campaigns],
  );

  const topLeaderboard = useMemo(() => leaderboard.slice(0, 10), [leaderboard]);

  const onHeroScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / HERO_W);
    if (idx >= 0 && idx < HERO_SLIDES.length) setHeroIndex(idx);
  };

  const toggleSaved = (id: string) => {
    setSavedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderHeroSlide = (slide: typeof HERO_SLIDES[0]) => (
    <LinearGradient
      key={slide.id}
      colors={slide.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.heroSlide, { width: HERO_W }]}
    >
      <View style={styles.heroCopy}>
        <Text style={styles.heroTitle}>{slide.title}</Text>
        <Text style={styles.heroSub}>{slide.subtitle}</Text>
      </View>
      <View style={styles.heroArt}>
        <MaterialCommunityIcons name="gift-open-outline" size={56} color="rgba(99,48,14,0.35)" />
        <View style={styles.heroCoin}>
          <Text style={styles.heroCoinLetter}>P</Text>
        </View>
      </View>
    </LinearGradient>
  );

  const renderRewardCard = (c: Campaign, index: number): React.ReactElement => {
    const claimed = Math.max(0, (c.totalWinnerSlots || 0) - (c.remainingWinnerSlots || 0));
    const total = c.totalWinnerSlots || 0;
    const available = c.remainingWinnerSlots || 0;
    const progress = total > 0 ? claimed / total : 0;
    const badge = campaignBadge(c, index);
    const badgeColors = badge ? badgeStyle(badge.tone) : null;
    const saved = savedIds.has(c.id);

    return (
      <TouchableOpacity
        key={`campaign-${c.id}-${index}`}
        activeOpacity={0.92}
        style={[styles.rewardCard, { width: REWARD_CARD_W }]}
        onPress={() => navigation.navigate('Rewards')}
      >
        <View style={styles.rewardImageWrap}>
          {c.imageUrl ? (
            <Image source={{ uri: c.imageUrl }} style={styles.rewardImage} />
          ) : (
            <View style={[styles.rewardImage, styles.rewardImageFallback]}>
              <Icon name="gift-outline" size={36} color={C.gold} />
            </View>
          )}
          {badge ? (
            <View style={[
              styles.rewardBadge,
              badge.tone === 'limited' ? styles.rewardBadgeOverlay : { backgroundColor: badgeColors!.bg },
            ]}>
              <Text style={[styles.rewardBadgeText, { color: badgeColors!.text }]}>{badge.label}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.heartBtn}
            hitSlop={8}
            onPress={() => toggleSaved(c.id)}
          >
            <Icon name={saved ? 'heart' : 'heart-outline'} size={18} color={saved ? '#EF4444' : '#FFF'} />
          </TouchableOpacity>
        </View>

        <View style={styles.rewardBody}>
          <Text style={styles.rewardTitle} numberOfLines={2}>{c.name}</Text>
          <Text style={styles.rewardDesc} numberOfLines={2}>
            {c.description || `Redeem ${formatPts(c.pointsRequired || 0)} for this exclusive reward.`}
          </Text>

          <View style={styles.rewardPtsRow}>
            <View style={styles.rewardPtsPill}>
              <MaterialCommunityIcons name="circle-multiple" size={14} color={C.ink} />
              <Text style={styles.rewardPtsText}>{formatPts(c.pointsRequired || 0)}</Text>
            </View>
          </View>

          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(progress * 100, 100)}%`, backgroundColor: progressColor(claimed, total) },
                ]}
              />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.progressClaimed}>{claimed}/{total} claimed</Text>
              <Text style={styles.progressAvail}>{available}/{total} available</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderLeaderRow = (item: LeaderboardEntry, index: number): React.ReactElement => {
    const isCurrentUser = item.userId === user?.uid;
    const rankStyle = index < 3 ? RANK_STYLES[index] : null;

    return (
      <View
        key={`leader-${item.userId ?? 'anon'}-${item.rank}-${index}`}
        style={[styles.leaderRow, isCurrentUser && styles.leaderRowYou]}
      >
        <View style={[styles.rankCircle, rankStyle ? { backgroundColor: rankStyle.bg } : styles.rankCircleDefault]}>
          <Text style={[styles.rankNum, rankStyle ? { color: rankStyle.text } : { color: C.textSub }]}>
            {item.rank}
          </Text>
        </View>

        <View style={[styles.avatar, isCurrentUser && { backgroundColor: C.gold }]}>
          <Text style={[styles.avatarLetter, isCurrentUser && { color: '#FFF' }]}>
            {item.name?.charAt(0)?.toUpperCase() || 'U'}
          </Text>
        </View>

        <View style={styles.leaderInfo}>
          <Text style={[styles.leaderName, isCurrentUser && { color: C.ink }]} numberOfLines={1}>
            {item.name || 'Anonymous'}
            {isCurrentUser ? ' (You)' : ''}
          </Text>
          {item.roleLabel ? (
            <Text style={styles.leaderRole} numberOfLines={1}>{item.roleLabel}</Text>
          ) : null}
        </View>

        <View style={styles.leaderPtsCol}>
          {index < 3 ? (
            <MaterialCommunityIcons
              name="crown"
              size={16}
              color={rankStyle!.crown}
              style={{ marginBottom: 2 }}
            />
          ) : null}
          <Text style={styles.leaderPts}>{(item.palPoints || 0).toLocaleString('en-IN')}</Text>
          <Text style={styles.leaderPtsLabel}>pts</Text>
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.screen, { paddingTop: headerPadTop }]}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={C.gold} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: headerPadTop }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={22} color={C.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.pointsPill}
            activeOpacity={0.88}
            onPress={() => navigation.navigate('Wallet')}
          >
            <Icon name="wallet-outline" size={15} color="#FFF9F2" />
            <Text style={styles.pointsPillText}>
              {myPoints.toLocaleString('en-IN')} PalPoints
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>Reward Campaigns</Text>
        <Text style={styles.headerSub}>Redeem your PalPoints for exclusive rewards</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />
        }
      >
        {/* Hero carousel */}
        <View style={styles.heroWrap}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onHeroScroll}
            decelerationRate="fast"
            snapToInterval={HERO_W + 10}
            contentContainerStyle={styles.heroScroll}
          >
            {HERO_SLIDES.map(renderHeroSlide)}
          </ScrollView>
          <View style={styles.heroDots}>
            {HERO_SLIDES.map((s, i) => (
              <View key={s.id} style={[styles.heroDot, i === heroIndex && styles.heroDotActive]} />
            ))}
          </View>
        </View>

        {/* Available Rewards */}
        <View style={styles.sectionHead}>
          <View style={styles.sectionHeadLeft}>
            <View style={[styles.sectionIcon, { backgroundColor: '#EDE9FE' }]}>
              <Icon name="gift-outline" size={16} color="#7C3AED" />
            </View>
            <View>
              <Text style={styles.sectionTitle}>Available Rewards</Text>
              <Text style={styles.sectionSub}>Choose from our exclusive collection</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Rewards')} hitSlop={8}>
            <Text style={styles.viewAll}>View All ›</Text>
          </TouchableOpacity>
        </View>

        {activeCampaigns.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rewardScroll}
          >
            {activeCampaigns.map((c, index) => renderRewardCard(c, index))}
          </ScrollView>
        ) : (
          <TouchableOpacity style={styles.emptyRewards} onPress={() => navigation.navigate('Rewards')}>
            <Icon name="gift-outline" size={32} color={C.gold} />
            <Text style={styles.emptyRewardsTitle}>No active campaigns</Text>
            <Text style={styles.emptyRewardsSub}>Browse partner offers you can redeem with PalPoints</Text>
            <Text style={styles.viewAll}>Browse rewards ›</Text>
          </TouchableOpacity>
        )}

        {/* Leaderboard */}
        <View style={[styles.sectionHead, { marginTop: 20 }]}>
          <View style={styles.sectionHeadLeft}>
            <View style={[styles.sectionIcon, { backgroundColor: '#FEF3C7' }]}>
              <Icon name="trophy-outline" size={16} color="#B45309" />
            </View>
            <View>
              <Text style={styles.sectionTitle}>PalPoints Leaderboard</Text>
              <Text style={styles.sectionSub}>Rankings fluctuate as users earn & spend points</Text>
            </View>
          </View>
          <TouchableOpacity hitSlop={8}>
            <Text style={styles.viewAll}>View All ›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.leaderList}>
          {topLeaderboard.length > 0 ? (
            topLeaderboard.map((item, index) => renderLeaderRow(item, index))
          ) : (
            <View style={styles.emptyLeader}>
              <Icon name="trophy-outline" size={40} color={C.textMuted} />
              <Text style={styles.emptyLeaderText}>No leaderboard data yet</Text>
            </View>
          )}
        </View>

        {/* Earn footer */}
        <View style={styles.earnBanner}>
          <View style={styles.earnLeft}>
            <View style={styles.earnIconWrap}>
              <Icon name="star" size={18} color="#B45309" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.earnTitle}>Earn more PalPoints</Text>
              <Text style={styles.earnSub}>Explore, create, refer & engage to earn more points!</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.earnBtn}
            activeOpacity={0.88}
            onPress={() => navigation.navigate('Quest')}
          >
            <Text style={styles.earnBtnText}>How to Earn ›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    paddingHorizontal: H_PAD,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.ink,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pointsPillText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#FFF9F2',
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: 'Inter-Black',
    color: C.text,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: C.textSub,
    marginTop: 4,
    lineHeight: 18,
  },

  heroWrap: { marginTop: 4, marginBottom: 18 },
  heroScroll: { paddingHorizontal: H_PAD, gap: 10 },
  heroSlide: {
    height: 132,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  heroCopy: { flex: 1, paddingRight: 8 },
  heroTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Black',
    color: C.ink,
    lineHeight: 24,
  },
  heroSub: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: C.textSub,
    marginTop: 6,
    lineHeight: 16,
  },
  heroArt: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCoin: {
    position: 'absolute',
    bottom: 4,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF9F2',
  },
  heroCoinLetter: {
    fontSize: 14,
    fontFamily: 'Inter-Black',
    color: '#FFF9F2',
  },
  heroDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(185,131,75,0.25)',
  },
  heroDotActive: {
    width: 18,
    backgroundColor: C.gold,
  },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
    marginBottom: 12,
    gap: 8,
  },
  sectionHeadLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: C.text,
  },
  sectionSub: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: C.textSub,
    marginTop: 2,
    lineHeight: 15,
  },
  viewAll: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: C.gold,
    marginTop: 4,
  },

  rewardScroll: {
    paddingHorizontal: H_PAD,
    gap: 14,
    paddingBottom: 4,
  },
  rewardCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  rewardImageWrap: {
    height: 130,
    backgroundColor: C.cardAlt,
    position: 'relative',
  },
  rewardImage: {
    width: '100%',
    height: '100%',
  },
  rewardImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rewardBadgeOverlay: {
    top: 10,
    left: 10,
  },
  rewardBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
  },
  heartBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardBody: { padding: 14 },
  rewardTitle: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: C.text,
    marginBottom: 4,
  },
  rewardDesc: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: C.textSub,
    lineHeight: 16,
    marginBottom: 10,
  },
  rewardPtsRow: { marginBottom: 10 },
  rewardPtsPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  rewardPtsText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: C.ink,
  },
  progressWrap: { gap: 6 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E8DDD0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressClaimed: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    color: C.textSub,
  },
  progressAvail: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    color: C.textMuted,
  },

  emptyRewards: {
    marginHorizontal: H_PAD,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  emptyRewardsTitle: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: C.text,
    marginTop: 4,
  },
  emptyRewardsSub: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: C.textSub,
    textAlign: 'center',
    lineHeight: 17,
  },

  leaderList: {
    paddingHorizontal: H_PAD,
    gap: 8,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  leaderRowYou: {
    borderColor: C.gold,
    backgroundColor: '#FFFBF5',
  },
  rankCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankCircleDefault: {
    backgroundColor: '#F1F5F9',
  },
  rankNum: {
    fontSize: 12,
    fontFamily: 'Inter-Black',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8DDD0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: C.textSub,
  },
  leaderInfo: { flex: 1, minWidth: 0 },
  leaderName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: C.text,
  },
  leaderRole: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: C.textSub,
    marginTop: 1,
  },
  leaderPtsCol: { alignItems: 'flex-end', minWidth: 56 },
  leaderPts: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: C.text,
  },
  leaderPtsLabel: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: C.textMuted,
  },
  emptyLeader: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyLeaderText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: C.textMuted,
  },

  earnBanner: {
    marginHorizontal: H_PAD,
    marginTop: 20,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 12,
  },
  earnLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  earnIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  earnTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: C.text,
  },
  earnSub: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: C.textSub,
    marginTop: 2,
    lineHeight: 16,
  },
  earnBtn: {
    alignSelf: 'flex-start',
    backgroundColor: C.ink,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  earnBtnText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#FFF9F2',
  },
});
