import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { LinearGradient } from '../utils/LinearGradient';
import CreatorCTA from './CreatorCTA';
import VendorCTA from './VendorCTA';
import ProfileModeSwitcher from './ProfileModeSwitcher';
import { useEntitlements } from '../context/EntitlementContext';
import { DEV_FLAGS } from '../config/devFlags';
import { tripsApi } from '../services/api/trips';
import type { UserActiveMode, UserProfile } from '../types';
import { getMainTabBarClearance } from '../design/tabBarLayout';
import { useHeaderSafePadding } from '../design/responsive';

const H_PAD = 16;

const C = {
  bg: '#FFF9F2',
  surface: '#FFFFFF',
  gold: '#B9834B',
  goldLight: '#D4A87A',
  ink: '#63300E',
  text: '#2C1810',
  textSub: '#8B7355',
  textMuted: '#B8A88A',
  border: 'rgba(200, 155, 60, 0.15)',
  blue: '#2563EB',
  green: '#059669',
  orange: '#EA580C',
};

const AVATARS = ['👦', '👧', '👨', '👩', '👶', '👸', '🤴', '🧑', '🧒', '👱'];

interface ProfileSectionProps {
  user: UserProfile;
  onEditProfile?: () => void;
  onAvatarChange?: (uri: string) => void;
  onSettingsPress?: () => void;
  totalDistance?: number;
  citiesExplored?: number;
  hiddenGemsSubmitted?: number;
  hiddenGemsPending?: number;
  hiddenGemsPoints?: number;
  location?: string;
  onSubmitHiddenGem?: () => void;
  onMyContributions?: () => void;
  onRewardsWallet?: () => void;
  onExploreRewards?: () => void;
  onRewardCampaignsPress?: () => void;
  palPoints?: number;
  onBecomeCreator?: () => void;
  onBecomeVendor?: () => void;
  creatorApplyIsSwitch?: boolean;
  vendorApplyIsSwitch?: boolean;
  vendorApplicationStatus?: string | null;
  vendorRejectionReason?: string | null;
  onPremiumPress?: () => void;
  onLogoutAction?: () => void;
  isGuest?: boolean;
  switchableModes?: UserActiveMode[];
  activeMode?: string;
  onSwitchMode?: (mode: UserActiveMode) => Promise<void>;
}

function formatPoints(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString('en-IN');
}

function StatCard({
  icon,
  iconColor,
  iconBg,
  value,
  label,
}: {
  icon: string;
  iconColor: string;
  iconBg: string;
  value: string | number;
  label: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: iconBg }]}>
        <Icon name={icon as any} size={18} color={iconColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActivityRow({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  onPress,
}: {
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.activityRow} activeOpacity={0.85} onPress={onPress}>
      <View style={[styles.activityIcon, { backgroundColor: iconBg }]}>
        <Icon name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={styles.activityText}>
        <Text style={styles.activityTitle}>{title}</Text>
        <Text style={styles.activitySub}>{subtitle}</Text>
      </View>
      <Icon name="chevron-forward" size={18} color={C.textMuted} />
    </TouchableOpacity>
  );
}

export default function ProfileSection({
  user,
  onEditProfile,
  onAvatarChange,
  hiddenGemsSubmitted = 0,
  onSubmitHiddenGem,
  onMyContributions,
  onRewardsWallet,
  onExploreRewards,
  palPoints,
  onBecomeCreator,
  onBecomeVendor,
  creatorApplyIsSwitch = false,
  vendorApplyIsSwitch = false,
  vendorApplicationStatus,
  vendorRejectionReason,
  onSettingsPress,
  onRewardCampaignsPress,
  onLogoutAction,
  isGuest = false,
  switchableModes = ['USER'],
  activeMode = 'USER',
  onSwitchMode,
}: ProfileSectionProps) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const headerPadTop = useHeaderSafePadding(8);
  const { isPremium } = useEntitlements();
  const [itineraryCount, setItineraryCount] = useState(0);

  const points = palPoints ?? user.totalPoints ?? 0;
  const placesVisited = user.visitedSpots?.length || 0;
  const userAvatar = AVATARS[user.avatarStyle] || '🧭';
  const handle = user.creatorProfile?.username
    ? `@${user.creatorProfile.username}`
    : `@${(user.displayName || 'guest').toLowerCase().replace(/\s+/g, '')}`;

  const loadTripCount = useCallback(async () => {
    if (isGuest || !DEV_FLAGS.USE_SERVER_API) return;
    try {
      const res = await tripsApi.list({ limit: 50 });
      setItineraryCount((res.data || []).length);
    } catch {
      /* offline */
    }
  }, [isGuest]);

  useFocusEffect(
    useCallback(() => {
      loadTripCount();
    }, [loadTripCount]),
  );

  const handlePickImage = () => {
    launchImageLibrary(
      { mediaType: 'photo', quality: 0.7, selectionLimit: 1 },
      response => {
        if (response.didCancel || response.errorCode) return;
        const uri = response.assets?.[0]?.uri;
        if (uri) onAvatarChange?.(uri);
      },
    );
  };

  return (
    <ScrollView
      style={styles.scroll}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: getMainTabBarClearance(insets.bottom) }}
    >
      {/* Header hero */}
      <View style={styles.hero}>
        <LinearGradient
          colors={['#FFF9F2', '#FBEFE2', '#FFF9F2']}
          style={StyleSheet.absoluteFill}
        />
        <MaterialCommunityIcons
          name="image-filter-hdr"
          size={160}
          color="rgba(185,131,75,0.08)"
          style={styles.heroDecorLeft}
        />
        <MaterialCommunityIcons
          name="bank-outline"
          size={72}
          color="rgba(185,131,75,0.1)"
          style={styles.heroDecorRight}
        />
        <View style={[styles.heroTop, { paddingTop: headerPadTop }]}>
          <View style={{ width: 40 }} />
          <View style={styles.heroActions}>
            <TouchableOpacity
              style={styles.iconCircle}
              onPress={onRewardCampaignsPress || onExploreRewards}
              accessibilityLabel="Reward campaigns"
            >
              <Icon name="trophy-outline" size={20} color={C.ink} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconCircle} onPress={onSettingsPress}>
              <Icon name="settings-outline" size={20} color={C.ink} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.profileRow}>
          <TouchableOpacity onPress={handlePickImage} activeOpacity={0.9}>
            <View style={styles.avatarWrap}>
              {user.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarEmoji}>{userAvatar}</Text>
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Icon name="camera" size={12} color="#FFF" />
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName} numberOfLines={1}>{user.displayName || 'Guest'}</Text>
              <TouchableOpacity hitSlop={8} onPress={onEditProfile}>
                <Icon name="create-outline" size={16} color={C.textSub} />
              </TouchableOpacity>
            </View>
            <Text style={styles.handle}>{handle}</Text>
            {isPremium ? (
              <View style={styles.badgeRow}>
                <View style={[styles.proBadge, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.proBadgeText, { color: '#B45309' }]}>PRO</Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard
          icon="location"
          iconColor={C.blue}
          iconBg="#DBEAFE"
          value={placesVisited}
          label="Places Visited"
        />
        <StatCard
          icon="map-outline"
          iconColor={C.green}
          iconBg="#D1FAE5"
          value={itineraryCount}
          label="Itineraries"
        />
        <StatCard
          icon="star"
          iconColor={C.orange}
          iconBg="#FFEDD5"
          value={formatPoints(points)}
          label="PalPoints"
        />
      </View>

      {/* PalPoints balance */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onExploreRewards || onRewardsWallet}
        style={styles.pointsCardWrap}
      >
        <View style={styles.pointsCard}>
          <View style={styles.pointsCopy}>
            <Text style={styles.pointsLabel}>PalPoints Balance</Text>
            <View style={styles.pointsValueRow}>
              <View style={styles.pointsCoin}>
                <Text style={styles.pointsCoinLetter}>P</Text>
              </View>
              <Text style={styles.pointsValue}>{points.toLocaleString('en-IN')}</Text>
            </View>
            <Text style={styles.pointsSub}>Redeem exciting rewards</Text>
          </View>
          <View style={styles.pointsRight}>
            <View style={styles.viewRewardsBtn}>
              <Text style={styles.viewRewardsText}>View Rewards</Text>
              <View style={styles.viewRewardsArrow}>
                <Icon name="chevron-forward" size={14} color="#FFF9F2" />
              </View>
            </View>
            <View style={styles.giftVisual}>
              <Text style={styles.giftEmoji}>🎁</Text>
              <Text style={styles.coinEmoji}>🪙</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* My Activity */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>My Activity</Text>
        <View style={styles.menuCard}>
          <ActivityRow
            icon="star-outline"
            iconColor={C.blue}
            iconBg="#DBEAFE"
            title="My Reviews"
            subtitle="Reviews you've posted"
            onPress={() => navigation.navigate('MyContributions')}
          />
          <View style={styles.menuDivider} />
          <ActivityRow
            icon="images-outline"
            iconColor={C.green}
            iconBg="#D1FAE5"
            title="Photos & Videos"
            subtitle="Your uploaded memories"
            onPress={() => navigation.navigate('Memories')}
          />
          <View style={styles.menuDivider} />
          <ActivityRow
            icon="time-outline"
            iconColor="#7C3AED"
            iconBg="#EDE9FE"
            title="Recently Viewed"
            subtitle="Places you looked at"
            onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
          />
          <View style={styles.menuDivider} />
          <ActivityRow
            icon="heart-outline"
            iconColor="#EF4444"
            iconBg="#FEE2E2"
            title="Wishlist"
            subtitle="Places you want to visit"
            onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
          />
          {onSubmitHiddenGem ? (
            <>
              <View style={styles.menuDivider} />
              <ActivityRow
                icon="diamond-outline"
                iconColor="#B45309"
                iconBg="#FEF3C7"
                title="Hidden Gems"
                subtitle={`${hiddenGemsSubmitted} submitted · Share & earn`}
                onPress={onSubmitHiddenGem}
              />
            </>
          ) : null}
        </View>
      </View>

      {switchableModes.length > 1 && onSwitchMode ? (
        <View style={styles.section}>
          <ProfileModeSwitcher
            modes={switchableModes}
            activeMode={activeMode}
            onSwitch={onSwitchMode}
            variant="inline"
          />
        </View>
      ) : null}

      {user.creatorProfile?.status === 'PENDING' ? (
        <View style={[styles.section, styles.noticeCard]}>
          <Text style={styles.noticeTitle}>Creator application pending</Text>
          <Text style={styles.noticeSub}>@{user.creatorProfile.username} is under review.</Text>
        </View>
      ) : null}

      {onBecomeCreator ? (
        <View style={styles.section}>
          <CreatorCTA onApply={onBecomeCreator} isSwitch={creatorApplyIsSwitch} />
        </View>
      ) : null}

      {onBecomeVendor ? (
        <View style={styles.section}>
          {vendorApplicationStatus && ['rejected', 'changes_requested'].includes(vendorApplicationStatus) ? (
            <View style={[styles.noticeCard, { marginBottom: 10 }]}>
              <Text style={[styles.noticeTitle, { color: '#EF4444' }]}>Vendor application needs updates</Text>
              <Text style={styles.noticeSub}>{vendorRejectionReason || 'Please resubmit your application.'}</Text>
            </View>
          ) : null}
          <VendorCTA onApply={onBecomeVendor} isSwitch={vendorApplyIsSwitch} />
        </View>
      ) : null}

      {onMyContributions && hiddenGemsSubmitted > 0 ? (
        <TouchableOpacity style={[styles.section, styles.linkBtn]} onPress={onMyContributions}>
          <Text style={styles.linkBtnText}>View my Hidden Gem contributions</Text>
        </TouchableOpacity>
      ) : null}

      {!isGuest && onLogoutAction ? (
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() =>
            Alert.alert('Log out', 'Are you sure you want to log out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Log out', style: 'destructive', onPress: onLogoutAction },
            ])
          }
        >
          <Icon name="log-out-outline" size={18} color="#EF4444" />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.bg },
  hero: {
    paddingHorizontal: H_PAD,
    paddingBottom: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  heroDecorLeft: {
    position: 'absolute',
    left: -20,
    top: 40,
  },
  heroDecorRight: {
    position: 'absolute',
    right: 24,
    top: 56,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroActions: { flexDirection: 'row', gap: 10 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: '#FFF',
  },
  avatarFallback: {
    backgroundColor: '#F5E6D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 36 },
  cameraBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  profileInfo: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  displayName: {
    fontSize: 20,
    fontWeight: '800',
    color: C.text,
    flexShrink: 1,
  },
  handle: { fontSize: 13, fontWeight: '500', color: C.textSub, marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  proBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  proBadgeText: { fontSize: 10, fontWeight: '800' },

  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: H_PAD,
    gap: 10,
    marginTop: -4,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: 'rgba(185,131,75,0.2)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: { fontSize: 17, fontWeight: '800', color: C.text },
  statLabel: { fontSize: 9, fontWeight: '600', color: C.textSub, textAlign: 'center', marginTop: 2 },

  pointsCardWrap: { marginHorizontal: H_PAD, marginBottom: 18 },
  pointsCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: 'rgba(185,131,75,0.15)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  pointsCopy: { flex: 1 },
  pointsLabel: { fontSize: 12, fontWeight: '600', color: C.textSub },
  pointsValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  pointsCoin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsCoinLetter: { fontSize: 14, fontWeight: '900', color: '#FFF9F2' },
  pointsValue: { fontSize: 28, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
  pointsSub: { fontSize: 11, fontWeight: '500', color: C.textSub, marginTop: 2 },
  pointsRight: { alignItems: 'flex-end', gap: 6 },
  viewRewardsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.ink,
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 8,
    borderRadius: 999,
  },
  viewRewardsText: { fontSize: 12, fontWeight: '700', color: '#FFF9F2' },
  viewRewardsArrow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftVisual: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, marginTop: 2 },
  giftEmoji: { fontSize: 36 },
  coinEmoji: { fontSize: 16, marginBottom: 4 },

  section: { marginHorizontal: H_PAD, marginBottom: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: C.text },

  menuCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    shadowColor: 'rgba(185,131,75,0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 1,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityText: { flex: 1 },
  activityTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  activitySub: { fontSize: 11, fontWeight: '500', color: C.textSub, marginTop: 2 },
  menuDivider: { height: 1, backgroundColor: C.border, marginLeft: 62 },

  noticeCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 14,
  },
  noticeTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: C.text },
  noticeSub: { fontSize: 11, fontFamily: 'Inter-Medium', color: C.textSub, marginTop: 4 },
  linkBtn: { alignItems: 'center', paddingVertical: 8 },
  linkBtnText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: C.blue },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: H_PAD,
    marginBottom: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#EF4444' },
});
