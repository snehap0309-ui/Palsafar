import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar,
  RefreshControl, Animated, Platform, Alert, FlatList, Image,
  LayoutAnimation, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  MaterialIcons, Ionicons, MaterialCommunityIcons, Feather,
} from '../utils/Icons';
import { useDataContext } from '../context/DataContext';
import { useUserContext } from '../context/UserContext';
import { getVendorCategoryEmoji } from '../data/vendors';
import { LinearGradient } from '../utils/LinearGradient';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { VendorBusiness } from '../types';
import { notificationService } from '../services/notificationService';
import { InAppNotification } from '../services/api/notifications';
import { vendorsApi } from '../services/api/vendors';
import { DEV_FLAGS } from '../config/devFlags';
import { useVendorScreenInsets, VendorUI } from '../design/vendorLayout';
import type { RootStackParamList } from '../navigation/types';
import { copyToClipboard } from '../utils/clipboard';
import VendorWorkspaceSidebar from '../components/VendorWorkspaceSidebar';

const CARD_RADIUS = 22;
const ICON_RADIUS = 18;
const BANNER_RADIUS = 24;

const COLORS = {
  // Creator-aligned cream / bronze workspace chrome
  sky: '#A67C52',
  skyDark: '#8B6B3A',
  skyDeep: '#63300E',
  skyMedium: '#D4A87A',
  skyLight: '#D4A87A',
  skyPale: '#FBEFE2',
  skyVeryPale: '#FFF5EB',
  white: '#FFFFFF',
  bg: '#FFF9F2',
  textPrimary: '#4D3227',
  textSecondary: '#8B7355',
  textMuted: '#B8A88A',
  border: '#E9D4BE',
  shadow: 'rgba(99, 48, 14, 0.16)',
  success: '#059669',
  warning: '#B9834B',
  star: '#B9834B',
  cardBg: '#FFFFFF',
};

type ActivityMetric = 'redemptions' | 'views' | 'customers';

function ProfileRing({ percent, size = 72 }: { percent: number; size?: number }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, percent));
  const offset = circ * (1 - pct / 100);
  const cx = size / 2;
  const cy = size / 2;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={cx} cy={cy} r={r} stroke="#FBEFE2" strokeWidth={stroke} fill="none" />
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke="#A67C52"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>
      <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.textPrimary }}>{pct}%</Text>
    </View>
  );
}

function ActivityLineChart({
  values,
  labels,
  width,
  height = 120,
}: {
  values: number[];
  labels: string[];
  width?: number;
  height?: number;
}) {
  const { width: screenW } = useWindowDimensions();
  const chartW = width ?? (screenW - 32 - 88 - 28);
  const max = Math.max(...values, 1);
  const pad = { top: 8, bottom: 4, left: 4, right: 4 };
  const chartH = height - pad.top - pad.bottom;
  const innerW = chartW - pad.left - pad.right;
  const points = values.map((v, i) => ({
    x: pad.left + i * (innerW / Math.max(values.length - 1, 1)),
    y: pad.top + chartH - (v / max) * chartH,
  }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(pad.top + chartH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(pad.top + chartH).toFixed(1)} Z`;

  return (
    <View>
      <Svg width={chartW} height={height}>
        <Defs>
          <SvgGradient id="vendorArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#A67C52" stopOpacity="0.28" />
            <Stop offset="1" stopColor="#A67C52" stopOpacity="0.02" />
          </SvgGradient>
        </Defs>
        <Path d={areaPath} fill="url(#vendorArea)" />
        <Path d={linePath} stroke="#A67C52" strokeWidth={2.5} fill="none" />
        {points.map((p, i) => (
          <Circle key={`pt-${i}`} cx={p.x} cy={p.y} r={3.5} fill="#A67C52" stroke="#fff" strokeWidth={1.5} />
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        {labels.map((label, i) => (
          <Text key={`${label}-${i}`} style={{ fontSize: 9, color: COLORS.textMuted, fontWeight: '600', width: 36, textAlign: i === 0 ? 'left' : i === labels.length - 1 ? 'right' : 'center' }}>
            {i === 0 || i === labels.length - 1 || i === Math.floor(labels.length / 2) ? label : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

const NAV_ITEMS = [
  { key: 'Home', icon: 'home', iconSet: 'Ionicons' },
  { key: 'Offers', icon: 'local-offer', iconSet: 'MaterialIcons' },
  { key: 'Analytics', icon: 'bar-chart-2', iconSet: 'Feather' },
  { key: 'Profile', icon: 'person', iconSet: 'Ionicons' },
] as const;

interface VendorDashboardScreenProps {
  onBack: () => void;
  onLogout?: () => void;
  onCreateOffer: () => void;
  onEditOffer?: (offerId: string) => void;
  onCreateReel?: () => void;
  onViewMyOffers?: () => void;
  onViewAnalytics: () => void;
  onViewProfile?: () => void;
  canGoBack?: boolean;
  /** When set by VendorTabs, locks content to that section */
  forcedTab?: 'Home' | 'Offers';
  /** Hide legacy fake bottom nav when real VendorTabs are used */
  hideBottomNav?: boolean;
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <MaterialIcons
        key={i}
        name={i <= Math.floor(rating) ? 'star' : i - 0.5 <= rating ? 'star-half' : 'star-border'}
        size={size}
        color={COLORS.star}
        style={{ marginRight: 1 }}
      />
    );
  }
  return <View style={{ flexDirection: 'row', alignItems: 'center' }}>{stars}</View>;
}

function PerformanceCard({ icon, label, value, color, iconSet = 'MaterialIcons' }: {
  icon: string; label: string; value: string | number; color: string; iconSet?: string;
}) {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const IconComponent =
    iconSet === 'Ionicons' ? Ionicons :
    iconSet === 'Feather' ? Feather :
    MaterialIcons;

  return (
    <View style={[s.performanceCard, { width: (SCREEN_WIDTH - 42) / 2 }]}>
      <View style={[s.perfIconWrap, { backgroundColor: color + '12' }]}>
        <IconComponent name={icon} size={20} color={color} />
      </View>
      <Text style={s.perfValue}>{value}</Text>
      <Text style={s.perfLabel}>{label}</Text>
    </View>
  );
}

interface NotifItem {
  id: string;
  title: string;
  desc: string;
  time: string;
  read: boolean;
  createdAt: string;
}

function NotificationsDropdown({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await notificationService.getNotifications(1, 20);
      const mapped: NotifItem[] = (data || []).map((n: InAppNotification) => ({
        id: n.id,
        title: n.title,
        desc: n.body || '',
        time: formatNotifTime(n.createdAt),
        read: n.read,
        createdAt: n.createdAt,
      }));
      setNotifications(mapped);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) fetchNotifications();
  }, [visible, fetchNotifications]);

  const handleMarkRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try {
      await notificationService.markAsRead(id);
    } catch (e) { console.warn('Caught empty exception', e); }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await notificationService.markAllAsRead();
    } catch (e) { console.warn('Caught empty exception', e); }
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  if (!visible) return null;

  return (
    <View style={s.notifDropdown}>
      <View style={s.notifHeaderRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={s.notifHeader}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={s.notifBadge}>
              <Text style={s.notifBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={onClose} style={s.notifCloseBtn}>
          <MaterialIcons name="close" size={20} color={COLORS.skyDeep} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: 13, color: COLORS.textMuted }}>Loading...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <Ionicons name="notifications-off-outline" size={32} color={COLORS.textMuted} />
          <Text style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 8 }}>No notifications yet</Text>
        </View>
      ) : (
        <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
          {notifications.slice(0, 10).map(n => (
            <TouchableOpacity
              key={n.id}
              style={[s.notifItem, !n.read && { backgroundColor: COLORS.skyPale }]}
              onPress={() => handleMarkRead(n.id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[s.notifTitle, !n.read && { fontWeight: '700' }]}>{n.title}</Text>
                {n.desc ? <Text style={s.notifDesc}>{n.desc}</Text> : null}
                <Text style={s.notifTime}>{n.time}</Text>
              </View>
              {!n.read && <View style={s.notifUnreadDot} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {!loading && notifications.length > 0 && (
        <>
          <View style={s.notifFooter}>
            {unreadCount > 0 && (
              <TouchableOpacity style={s.notifFooterBtn} onPress={handleMarkAllRead}>
                <Text style={s.notifFooterBtnText}>Mark all as read</Text>
              </TouchableOpacity>
            )}
            {notifications.length > 10 && (
              <Text style={{ fontSize: 12, color: COLORS.textMuted }}>+{notifications.length - 10} more</Text>
            )}
          </View>
        </>
      )}
    </View>
  );
}

function formatNotifTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const OFFER_FILTERS = ['Active', 'Scheduled', 'Expired', 'Draft'] as const;
type OfferFilter = (typeof OFFER_FILTERS)[number];

function getOfferLifecycleStatus(offer: any): OfferFilter {
  const now = Date.now();
  if (!offer.isActive) return 'Draft';
  if (offer.validTill) {
    const end = new Date(offer.validTill).getTime();
    if (!Number.isNaN(end) && end < now) return 'Expired';
  }
  if (offer.startDate) {
    const start = new Date(offer.startDate).getTime();
    if (!Number.isNaN(start) && start > now) return 'Scheduled';
  }
  return 'Active';
}

function formatOfferDate(value?: string | null): string {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTimeLeft(offer: any, status: OfferFilter): string {
  if (status === 'Draft') return 'Not published';
  if (status === 'Expired') {
    if (!offer.validTill) return 'Expired';
    const end = new Date(offer.validTill).getTime();
    if (Number.isNaN(end)) return 'Expired';
    const days = Math.max(1, Math.floor((Date.now() - end) / (1000 * 60 * 60 * 24)));
    return `Expired ${days} day${days !== 1 ? 's' : ''} ago`;
  }
  const target = status === 'Scheduled' ? offer.startDate : offer.validTill;
  if (!target) return status === 'Scheduled' ? 'Scheduled' : 'No end date';
  const t = new Date(target).getTime();
  if (Number.isNaN(t)) return 'N/A';
  const days = Math.max(0, Math.floor((t - Date.now()) / (1000 * 60 * 60 * 24)));
  if (status === 'Scheduled') return `${days} day${days !== 1 ? 's' : ''}`;
  return `${days} day${days !== 1 ? 's' : ''} left`;
}

function discountLabel(offer: any): string {
  if (offer.discountType === 'percentage') return `${offer.discountValue}% OFF`;
  if (offer.discountType === 'flat') return `₹${offer.discountValue} OFF`;
  if (offer.discountType === 'freebie') return 'Freebie';
  return 'Special';
}

function OffersView({
  onCreateOffer,
  onEditOffer,
  totalOffers = 0,
  activeOffers = 0,
  totalRedemptions = 0,
  pointsRedeemed = 0,
  offers = [],
  refreshing = false,
  onRefresh,
  scrollPadBottom = 120,
  padTop = 0,
}: {
  onCreateOffer: () => void;
  onEditOffer?: (offerId: string) => void;
  totalOffers?: number;
  activeOffers?: number;
  totalRedemptions?: number;
  pointsRedeemed?: number;
  offers?: any[];
  refreshing?: boolean;
  onRefresh?: () => void;
  scrollPadBottom?: number;
  padTop?: number;
}) {
  const { deleteVendorOffer, toggleVendorOffer, duplicateVendorOffer, refreshVendorData } = useDataContext();
  const [activeFilter, setActiveFilter] = useState<OfferFilter>('Active');
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleFilterChange = useCallback((filter: OfferFilter) => {
    LayoutAnimation.configureNext({
      duration: 400,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'spring', springDamping: 0.7 },
      delete: { type: 'easeInEaseOut', property: 'opacity' },
    });
    setActiveFilter(filter);
  }, []);

  const filterCounts = useMemo(() => {
    const counts: Record<OfferFilter, number> = { Active: 0, Scheduled: 0, Expired: 0, Draft: 0 };
    offers.forEach((o: any) => {
      counts[getOfferLifecycleStatus(o)] += 1;
    });
    return counts;
  }, [offers]);

  const displayCards = useMemo(() => {
    return offers
      .filter((o: any) => getOfferLifecycleStatus(o) === activeFilter)
      .map((offer: any) => {
        const status = getOfferLifecycleStatus(offer);
        return {
          id: offer.id,
          title: offer.offerTitle || offer.title || '',
          discount: discountLabel(offer),
          points: offer.pointsRequired ?? 0,
          minBill: offer.minBillAmount ? `₹${offer.minBillAmount}` : 'None',
          status,
          startDate: formatOfferDate(offer.startDate),
          validUntil: formatOfferDate(offer.validTill),
          timeLeft: formatTimeLeft(offer, status),
          imageUrl: offer.imageUrl || '',
          redemptions: offer.currentRedemptions ?? offer.redemptions ?? 0,
          createdAt: offer.createdAt,
          isActive: !!offer.isActive,
        };
      });
  }, [offers, activeFilter]);

  const handleDelete = useCallback((offerId: string, title: string) => {
    Alert.alert('Delete offer', `Delete "${title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setBusyId(offerId);
            await deleteVendorOffer(offerId);
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to delete offer.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }, [deleteVendorOffer]);

  const handleToggle = useCallback(async (offerId: string, currentlyActive: boolean) => {
    try {
      setBusyId(offerId);
      await toggleVendorOffer(offerId);
    } catch (err: any) {
      Alert.alert('Error', err?.message || `Failed to ${currentlyActive ? 'pause' : 'resume'} offer.`);
    } finally {
      setBusyId(null);
    }
  }, [toggleVendorOffer]);

  const handleDuplicate = useCallback((offerId: string, title: string) => {
    Alert.alert('Duplicate offer', `Create a copy of "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Duplicate',
        onPress: async () => {
          try {
            setBusyId(offerId);
            const created = await duplicateVendorOffer(offerId);
            await refreshVendorData().catch(() => {});
            if (created?.id) {
              Alert.alert('Offer duplicated', 'A draft copy was created. Edit and publish when ready.');
            }
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to duplicate offer.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }, [duplicateVendorOffer, refreshVendorData]);

  const handleOfferStats = useCallback(async (offerId: string, title: string) => {
    try {
      setBusyId(offerId);
      const res = await vendorsApi.getOfferAnalytics(offerId);
      const data = (res as any)?.data ?? res;
      const r = data?.redemptions || {};
      const o = data?.offer || {};
      Alert.alert(
        title || 'Offer stats',
        [
          `Views: ${o.viewCount ?? 0}`,
          `Clicks: ${o.clickCount ?? 0}`,
          `Redemptions: ${r.total ?? o.currentRedemptions ?? 0}`,
          `Verified: ${r.verified ?? 0}`,
          `Points spent: ${r.totalPointsSpent ?? 0}`,
        ].join('\n'),
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not load offer analytics.');
    } finally {
      setBusyId(null);
    }
  }, []);

  return (
    <ScrollView
      style={s.scrollView}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: scrollPadBottom, paddingTop: padTop }}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.sky} />
        ) : undefined
      }
    >
      <View style={s.OvHeader}>
        <View style={s.OvHeaderLeft}>
          <Text style={s.OvTitle}>Offers</Text>
          <Text style={s.OvSubtitle}>Create and manage offers to attract more tourists.</Text>
        </View>
        <TouchableOpacity style={s.OvCreateBtn} onPress={onCreateOffer} activeOpacity={0.85}>
          <MaterialIcons name="add" size={18} color="#FFF9F2" />
          <Text style={s.OvCreateBtnText}>Create Offer</Text>
        </TouchableOpacity>
      </View>

      <View style={s.OvStatsGrid}>
        {[
          { label: 'Total Offers', value: String(totalOffers), icon: 'local-offer' as const, color: COLORS.sky, active: false },
          { label: 'Active Offers', value: String(activeOffers), icon: 'check-circle' as const, color: '#059669', active: true },
          { label: 'Total Redeems', value: String(totalRedemptions), icon: 'receipt' as const, color: COLORS.skyDark, active: false },
          {
            label: 'Points Redeemed',
            value: pointsRedeemed >= 1000 ? `${(pointsRedeemed / 1000).toFixed(1)}K` : String(pointsRedeemed),
            icon: 'star' as const,
            color: COLORS.sky,
            active: false,
          },
        ].map((item) => (
          <View key={item.label} style={[s.OvStatCard, item.active && s.OvStatCardActive]}>
            <View style={[s.OvStatIcon, { backgroundColor: item.color + '18' }]}>
              <MaterialIcons name={item.icon} size={16} color={item.color} />
            </View>
            <Text style={[s.OvStatValue, item.active && { color: '#059669' }]}>{item.value}</Text>
            <Text style={[s.OvStatLabel, item.active && { color: '#059669' }]}>{item.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.OvFilterCard}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={s.OvFilterRow}>
            {OFFER_FILTERS.map((f) => {
              const isActive = activeFilter === f;
              return (
                <TouchableOpacity key={f} onPress={() => handleFilterChange(f)} style={s.OvFilterTab} activeOpacity={0.85}>
                  <Text style={[s.OvFilterText, isActive && s.OvFilterTextActive]}>
                    {f} ({filterCounts[f]})
                  </Text>
                  {isActive ? <View style={s.OvFilterLine} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <View style={s.OvFilterHintRow}>
        <View style={[
          s.OvFilterHintDot,
          {
            backgroundColor:
              activeFilter === 'Active' ? '#059669'
                : activeFilter === 'Expired' ? '#EF4444'
                  : COLORS.sky,
          },
        ]} />
        <Text style={s.OvFilterHint}>
          {activeFilter === 'Active' ? 'Visible to tourists now' :
           activeFilter === 'Scheduled' ? 'Goes live on start date' :
           activeFilter === 'Expired' ? 'No longer redeemable' :
           'Paused or unpublished — resume to go live'}
        </Text>
      </View>

      {displayCards.length === 0 ? (
        <View style={s.emptyRedemptions}>
          <MaterialIcons name="local-offer" size={40} color={COLORS.skyLight} />
          <Text style={s.emptyText}>No {activeFilter.toLowerCase()} offers</Text>
          <Text style={s.emptySubtext}>
            {activeFilter === 'Active'
              ? 'Create an offer to start attracting tourists.'
              : `You have no ${activeFilter.toLowerCase()} offers right now.`}
          </Text>
          {(activeFilter === 'Active' || activeFilter === 'Draft') ? (
            <TouchableOpacity style={[s.OvCreateBtn, { marginTop: 16 }]} onPress={onCreateOffer}>
              <MaterialIcons name="add" size={18} color="#FFF9F2" />
              <Text style={s.OvCreateBtnText}>Create Offer</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {displayCards.map((offer) => {
        const statusColors: Record<string, string> = {
          Active: '#059669', Scheduled: '#B9834B', Expired: '#EF4444', Draft: COLORS.textMuted,
        };
        const statusIcons: Record<string, string> = {
          Active: 'check-circle', Scheduled: 'schedule', Expired: 'cancel', Draft: 'edit-note',
        };
        const sc = statusColors[offer.status] || COLORS.textMuted;
        const isBusy = busyId === offer.id;
        const timeLabel = offer.status === 'Scheduled'
          ? `Starts in ${offer.timeLeft}`
          : offer.validUntil === 'N/A' || !offer.validUntil
            ? 'No end date'
            : offer.timeLeft;

        return (
          <View key={offer.id} style={s.OvCard}>
            <View style={s.OvCardMain}>
              <View style={s.OvImgWrap}>
                {offer.imageUrl ? (
                  <Image source={{ uri: offer.imageUrl }} style={s.OvImg} resizeMode="cover" />
                ) : (
                  <View style={s.OvImgPlaceholder}>
                    <MaterialIcons name="local-offer" size={28} color={COLORS.sky} />
                  </View>
                )}
                <View style={s.OvBadge}>
                  <Text style={s.OvBadgeText}>{offer.discount}</Text>
                </View>
              </View>

              <View style={s.OvCardBody}>
                <View style={s.OvTitleRow}>
                  <Text style={s.OvCardTitle} numberOfLines={1}>{offer.title}</Text>
                  <View style={[s.OvChip, { backgroundColor: sc + '18' }]}>
                    <MaterialIcons name={statusIcons[offer.status] as any} size={12} color={sc} />
                    <Text style={[s.OvChipText, { color: sc }]}>{offer.status}</Text>
                  </View>
                </View>

                <View style={s.OvMetaRow}>
                  <MaterialIcons name="star" size={13} color={COLORS.sky} />
                  <Text style={s.OvMetaText}>{offer.points} pts</Text>
                  <Text style={s.OvMetaSep}>·</Text>
                  <MaterialIcons name="account-balance-wallet" size={13} color={COLORS.textMuted} />
                  <Text style={s.OvMetaText}>Min. {offer.minBill}</Text>
                  <Text style={s.OvMetaSep}>·</Text>
                  <MaterialIcons name="event" size={13} color={COLORS.textMuted} />
                  <Text style={s.OvMetaText}>Valid till: {offer.validUntil}</Text>
                </View>

                {offer.status !== 'Draft' ? (
                  <View style={s.OvRedeemBar}>
                    <Text style={s.OvRedeemBarText}>
                      <Text style={s.OvRedeemBarStrong}>{offer.redemptions}</Text> TOTAL REDEEMS
                    </Text>
                    <View style={s.OvRedeemTime}>
                      <MaterialIcons name="access-time" size={12} color={COLORS.textMuted} />
                      <Text style={s.OvRedeemTimeText}>{timeLabel}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={s.OvActionRow}>
              {offer.status !== 'Expired' ? (
                <TouchableOpacity
                  style={s.OvActionBtn}
                  activeOpacity={0.7}
                  disabled={isBusy}
                  onPress={() => handleToggle(offer.id, offer.isActive)}
                >
                  <MaterialIcons name={offer.isActive ? 'pause' : 'play-arrow'} size={15} color={COLORS.skyDeep} />
                  <Text style={s.OvActionText}>{offer.isActive ? 'Pause' : 'Resume'}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={s.OvActionBtn}
                activeOpacity={0.7}
                disabled={isBusy}
                onPress={() => onEditOffer?.(offer.id)}
              >
                <MaterialIcons name="edit" size={15} color={COLORS.skyDeep} />
                <Text style={s.OvActionText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.OvActionBtn}
                activeOpacity={0.7}
                disabled={isBusy}
                onPress={() => handleDuplicate(offer.id, offer.title)}
              >
                <MaterialIcons name="content-copy" size={15} color={COLORS.skyDeep} />
                <Text style={s.OvActionText}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.OvActionBtn}
                activeOpacity={0.7}
                disabled={isBusy}
                onPress={() => handleOfferStats(offer.id, offer.title)}
              >
                <MaterialIcons name="show-chart" size={15} color={COLORS.skyDeep} />
                <Text style={s.OvActionText}>Stats</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.OvActionBtn}
                activeOpacity={0.7}
                disabled={isBusy}
                onPress={() => handleDelete(offer.id, offer.title)}
              >
                <MaterialIcons name="delete-outline" size={15} color="#EF4444" />
                <Text style={[s.OvActionText, { color: '#EF4444' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );

}

export default function VendorDashboardScreen({
  onBack, onLogout, onCreateOffer, onEditOffer, onCreateReel: _onCreateReel,
  onViewMyOffers,
  onViewAnalytics, onViewProfile,
  canGoBack = true,
  forcedTab,
  hideBottomNav = false,
}: VendorDashboardScreenProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { currentVendor, vendorOffers, redemptions, refreshVendorData } = useDataContext();
  const { user, setActiveMode, onLogout: contextLogout } = useUserContext();
  const screenInsets = useVendorScreenInsets({ withTabBar: hideBottomNav });
  const [refreshing, setRefreshing] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showVendorCode, setShowVendorCode] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [activeTab, setActiveTab] = useState<'Home' | 'Offers' | 'Analytics' | 'Profile'>(forcedTab || 'Home');
  const [showSidebar, setShowSidebar] = useState(false);
  const [activityMetric, setActivityMetric] = useState<ActivityMetric>('redemptions');
  const [dashStats, setDashStats] = useState<{
    todayRedemptions?: number;
    totalViews?: number;
    totalClicks?: number;
    conversionRate?: number;
    pendingApproval?: number;
  } | null>(null);

  const visibleTab = forcedTab || activeTab;

  const loadDashboardStats = useCallback(async () => {
    if (!DEV_FLAGS.USE_SERVER_API) return;
    try {
      const res = await vendorsApi.getDashboard();
      const data = (res as any)?.data ?? res;
      const stats = data?.stats || {};
      setDashStats({
        todayRedemptions: Number(stats.todayRedemptions) || 0,
        totalViews: Number(stats.totalViews) || 0,
        totalClicks: Number(stats.totalClicks) || 0,
        conversionRate: Number(stats.conversionRate) || 0,
        pendingApproval: Number(stats.pendingApproval) || 0,
      });
    } catch {
      /* keep local fallbacks */
    }
  }, []);

  // Load once per tab mount — do NOT depend on refreshVendorData/loadDashboardStats
  // identity or currentVendor, or setCurrentVendor creates an infinite getMe loop (429).
  useEffect(() => {
    if (visibleTab !== 'Offers' && visibleTab !== 'Home') return;
    let cancelled = false;
    (async () => {
      try {
        await refreshVendorData();
        if (!cancelled && visibleTab === 'Home') {
          await loadDashboardStats();
        }
      } catch {
        /* non-blocking */
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: mount / forcedTab only
  }, [visibleTab]);

  const scrollY = useRef(new Animated.Value(0)).current;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshVendorData(), loadDashboardStats()]);
    } catch (err) {
      console.warn('Failed to refresh vendor dashboard:', err);
    } finally {
      setRefreshing(false);
    }
  }, [refreshVendorData, loadDashboardStats]);

  const myOffers = useMemo(() => {
    if (!currentVendor) return [];
    const offerList = vendorOffers.filter(o => o.vendorId === currentVendor.id);
    return offerList.map(o => {
      const reds = redemptions.filter(r => r.offerId === o.id);
      return {
        ...o,
        currentRedemptions: o.currentRedemptions ?? reds.length,
        redemptions: o.currentRedemptions ?? reds.length,
        pointsRedeemed: reds.reduce((sum, r) => sum + (r.pointsSpent || 0), 0),
      };
    });
  }, [currentVendor, vendorOffers, redemptions]);

  const myRedemptions = useMemo(() => {
    if (!currentVendor) return [];
    return redemptions.filter(r => r.vendorId === currentVendor.id);
  }, [currentVendor, redemptions]);

  const verifiedRedemptions = useMemo(() => myRedemptions.filter(r => r.status === 'verified'), [myRedemptions]);
  const activeOffers = useMemo(
    () => myOffers.filter(o => getOfferLifecycleStatus(o) === 'Active'),
    [myOffers],
  );
  const totalPointsFromUsers = useMemo(
    () => myRedemptions.reduce((sum, r) => sum + (r.pointsSpent || 0), 0),
    [myRedemptions],
  );
  const uniqueVisitors = useMemo(() => {
    const ids = new Set(myRedemptions.map(r => r.userId));
    return ids.size;
  }, [myRedemptions]);

  const todayRedemptions = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return myRedemptions.filter(r => r.redeemedAt.slice(0, 10) === today).length;
  }, [myRedemptions]);

  const todayVisitors = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const ids = new Set(myRedemptions.filter(r => r.redeemedAt.slice(0, 10) === today).map(r => r.userId));
    return ids.size;
  }, [myRedemptions]);

  const repeatVisitors = useMemo(() => {
    const counts: Record<string, number> = {};
    myRedemptions.forEach(r => { counts[r.userId] = (counts[r.userId] || 0) + 1; });
    return Object.values(counts).filter(c => c > 1).length;
  }, [myRedemptions]);

  const redemptionRate = useMemo(() => {
    if (myRedemptions.length === 0) return '0%';
    const pct = Math.round((verifiedRedemptions.length / myRedemptions.length) * 100);
    return `${pct}%`;
  }, [myRedemptions, verifiedRedemptions]);

  const avgConversion = useMemo(() => {
    if (activeOffers.length === 0) return '0%';
    const perOffer = activeOffers.map(o => {
      const reds = myRedemptions.filter(r => r.offerId === o.id).length;
      return reds;
    });
    const avg = perOffer.reduce((a, b) => a + b, 0) / perOffer.length;
    return avg < 1 ? '<1' : Math.round(avg).toString();
  }, [activeOffers, myRedemptions]);

  const profileChecks = useMemo(() => {
    if (!currentVendor) {
      return { percent: 0, items: [] as { label: string; done: boolean; pending?: number }[] };
    }
    const hasProfile = !!(currentVendor.businessName && currentVendor.address && currentVendor.phone);
    const hasDocs = currentVendor.verificationStatus === 'approved';
    const amenityMissing = [
      !currentVendor.description,
      !currentVendor.openingHours && !(currentVendor as any).operatingHours,
      !currentVendor.website,
    ].filter(Boolean).length;
    const hasPhotos = !!currentVendor.imageUrl;
    const items = [
      { label: 'Business Profile', done: hasProfile },
      { label: 'Documents', done: hasDocs },
      { label: 'Amenities', done: amenityMissing === 0, pending: amenityMissing || undefined },
      { label: 'Photos & Media', done: hasPhotos },
    ];
    const doneCount = items.filter((i) => i.done).length;
    const percent = Math.round((doneCount / items.length) * 100);
    return { percent, items };
  }, [currentVendor]);

  const handleCopyId = async () => {
    if (!currentVendor) return;
    const code =
      currentVendor.vendorCode ||
      `PAL-${currentVendor.id.slice(0, 8).toUpperCase()}`;
    const ok = await copyToClipboard(code, 'Vendor Code');
    if (ok) {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1500);
    }
  };

  const chartDateLabels = useMemo(() => {
    const labels: string[] = [];
    for (let i = 6; i >= 1; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const day = d.getDate();
      const month = d.toLocaleString('en-US', { month: 'short' });
      labels.push(`${day} ${month}`);
    }
    labels.push('Today');
    return labels;
  }, []);

  const chartVisitorsData = useMemo(() => {
    const today = new Date();
    return chartDateLabels.map((label, idx) => {
      const targetDate = new Date();
      if (label === 'Today') {
        targetDate.setHours(0, 0, 0, 0);
      } else {
        targetDate.setDate(targetDate.getDate() - (6 - idx));
        targetDate.setHours(0, 0, 0, 0);
      }
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);
      const dayRedemptions = myRedemptions.filter(r => {
        const rd = new Date(r.redeemedAt);
        return rd >= targetDate && rd < nextDate;
      });
      const visitors = dayRedemptions.length;
      const unique = new Set(dayRedemptions.map(r => r.userId)).size;
      return { visitors, unique };
    });
  }, [myRedemptions, chartDateLabels]);

  const activitySeries = useMemo(() => {
    if (activityMetric === 'customers') {
      return chartVisitorsData.map((d) => d.unique);
    }
    if (activityMetric === 'views') {
      const totalViews = dashStats?.totalViews ?? 0;
      if (totalViews <= 0) return chartVisitorsData.map((d) => Math.max(0, d.visitors));
      const sumR = chartVisitorsData.reduce((s, d) => s + d.visitors, 0) || 1;
      return chartVisitorsData.map((d) => Math.round((d.visitors / sumR) * totalViews));
    }
    return chartVisitorsData.map((d) => d.visitors);
  }, [activityMetric, chartVisitorsData, dashStats?.totalViews]);

  const chartMaxY = useMemo(() => {
    const max = Math.max(...chartVisitorsData.map(d => Math.max(d.visitors, d.unique)), 10);
    const rounded = Math.ceil(max / 50) * 50;
    return rounded || 50;
  }, [chartVisitorsData]);

  const chartYLabels = useMemo(() => {
    const labels: string[] = [];
    for (let i = chartMaxY; i >= 0; i -= chartMaxY / 4) {
      labels.push(Math.round(i).toString());
    }
    return labels;
  }, [chartMaxY]);

  const toggleSidebar = () => setShowSidebar(prev => !prev);

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 0.92],
    extrapolate: 'clamp',
  });

  // Hooks must run unconditionally — never after an early return
  const displayAddress = useMemo(() => {
    if (!currentVendor) return '';
    const parts = [currentVendor.address, currentVendor.city, currentVendor.state].filter(Boolean);
    const unique: string[] = [];
    for (const p of parts) {
      const lower = p.trim().toLowerCase();
      if (!unique.some(u => u.toLowerCase() === lower)) {
        unique.push(p.trim());
      }
    }
    return unique.join(', ');
  }, [currentVendor]);

  const shortVendorId = useMemo(() => {
    if (!currentVendor) return '';
    const cityPart = (currentVendor.city || 'IND').slice(0, 3).toUpperCase();
    const catPart = (currentVendor.category || 'BIZ').slice(0, 4).toUpperCase();
    const numPart = currentVendor.id.slice(-4).toUpperCase();
    return `${cityPart}-${catPart}-${numPart}`;
  }, [currentVendor]);

  if (!currentVendor) {
    return (
      <SafeAreaView style={[s.container, { justifyContent: 'center', alignItems: 'center' }]} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
        <Text style={{ color: COLORS.textMuted, fontSize: 16 }}>Loading vendor data...</Text>
      </SafeAreaView>
    );
  }

  const isApproved = currentVendor.verificationStatus === 'approved';
  const vendorCode = currentVendor.vendorCode || `PAL-${currentVendor.id.slice(0, 6).toUpperCase()}`;
  const category = currentVendor.category || 'business';
  const categoryEmoji = getVendorCategoryEmoji(category);

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header — Creator-style studio chrome (Home only) */}
      {visibleTab === 'Home' ? (
      <Animated.View style={[s.header, { opacity: headerOpacity, paddingTop: screenInsets.headerPadTop }]}>
        <TouchableOpacity onPress={toggleSidebar} style={s.headerBtn} accessibilityLabel="Open menu">
          <Ionicons name="menu" size={24} color={COLORS.skyDeep} />
        </TouchableOpacity>
        <View style={s.headerCopy}>
          <Text style={s.eyebrow}>VENDOR WORKSPACE</Text>
          <Text style={s.greeting} numberOfLines={1}>
            Hello, {currentVendor.businessName} 👋
          </Text>
          <View style={s.handleRow}>
            <Text style={s.handle} numberOfLines={1}>
              {currentVendor.city || 'Business'}
            </Text>
            {isApproved ? (
              <MaterialCommunityIcons name="check-decagram" size={15} color={COLORS.sky} style={{ marginLeft: 4 }} />
            ) : null}
          </View>
        </View>
        <TouchableOpacity
          style={s.headerBtn}
          onPress={() => navigation.navigate('Notifications')}
          accessibilityLabel="Notifications"
        >
          <Ionicons name="notifications-outline" size={22} color={COLORS.skyDeep} />
        </TouchableOpacity>
      </Animated.View>
      ) : null}

      {showNotifDropdown && (
        <NotificationsDropdown visible={showNotifDropdown} onClose={() => setShowNotifDropdown(false)} />
      )}

      {visibleTab === 'Home' ? (
      <VendorWorkspaceSidebar
        visible={showSidebar}
        onClose={() => setShowSidebar(false)}
        user={user}
        vendor={currentVendor}
        offerCount={activeOffers.length}
        redemptionCount={myRedemptions.length}
        onNavigateOffers={() => {
          if (onViewMyOffers) onViewMyOffers();
          else navigation.navigate('VendorTabs', { screen: 'Offers' });
        }}
        onNavigateCreateOffer={onCreateOffer}
        onNavigateAnalytics={onViewAnalytics}
        onNavigateProfile={onViewProfile}
        onNavigateCustomers={() => navigation.navigate('VendorCustomers')}
        onNavigateRedemption={() => navigation.navigate('VendorRedemption')}
        onNavigateSubscription={() => navigation.navigate('VendorSubscription')}
        onNavigateNotifications={() => navigation.navigate('Notifications')}
        onNavigateSettings={() => navigation.navigate('VendorSettings')}
        onNavigateLegal={() => navigation.navigate('LegalHub')}
        onSwitchToUser={() => setActiveMode('USER')}
        onLogout={() => {
          if (onLogout) onLogout();
          else void contextLogout();
        }}
      />
      ) : null}

      {visibleTab === 'Home' ? (
        <ScrollView
          style={s.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: screenInsets.scrollPadBottom }}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.sky} />
          }
        >
          {/* Pending approval */}
          {!isApproved && (
            <View style={[
              s.statusBanner,
              currentVendor.verificationStatus === 'rejected' ? s.statusBannerRejected : s.statusBannerPending,
            ]}>
              <MaterialIcons
                name={currentVendor.verificationStatus === 'rejected' ? 'cancel' : 'hourglass-top'}
                size={18}
                color={currentVendor.verificationStatus === 'rejected' ? '#FF5A5F' : COLORS.sky}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.statusBannerTitle}>
                  {currentVendor.verificationStatus === 'rejected' ? 'Verification rejected' : 'Awaiting verification'}
                </Text>
                <Text style={s.statusBannerText}>
                  {currentVendor.verificationStatus === 'rejected'
                    ? (currentVendor.rejectedReason || 'Contact support to resubmit your documents.')
                    : 'Your business is under review. Offers stay hidden until approved.'}
                </Text>
              </View>
            </View>
          )}

          {/* Hero Business Card */}
          <View style={s.heroCard}>
            <View style={s.heroCardInner}>
              <View style={s.heroTopRow}>
                <View style={[
                  s.verifiedBadge,
                  isApproved
                    ? s.verifiedBadgeApproved
                    : {
                        backgroundColor: currentVendor.verificationStatus === 'rejected' ? '#FF5A5F12' : '#B9834B12',
                        borderColor: currentVendor.verificationStatus === 'rejected' ? '#FF5A5F30' : '#B9834B30',
                      },
                ]}>
                  <MaterialIcons
                    name={isApproved ? 'verified' : currentVendor.verificationStatus === 'rejected' ? 'error' : 'schedule'}
                    size={13}
                    color={isApproved ? COLORS.success : currentVendor.verificationStatus === 'rejected' ? '#FF5A5F' : COLORS.sky}
                  />
                  <Text style={[
                    s.verifiedText,
                    isApproved
                      ? s.verifiedTextApproved
                      : { color: currentVendor.verificationStatus === 'rejected' ? '#FF5A5F' : COLORS.sky },
                  ]}>
                    {isApproved ? 'Verified Partner' : currentVendor.verificationStatus === 'rejected' ? 'Rejected' : 'Pending Review'}
                  </Text>
                </View>
                {currentVendor.showOnMap !== false && isApproved ? (
                  <View style={s.mapPill}>
                    <View style={s.mapDot} />
                    <Text style={s.mapVisibilityText}>On map</Text>
                  </View>
                ) : null}
              </View>

              <View style={s.heroBodyRow}>
                <View style={s.heroBodyLeft}>
                  <Text style={s.heroBusinessName} numberOfLines={2}>
                    {currentVendor.businessName}
                  </Text>
                  <Text style={s.heroCategoryText}>{categoryEmoji} {String(category).replace(/_/g, ' ')}</Text>

                  <View style={s.heroLocationRow}>
                    <Ionicons name="location-outline" size={13} color={COLORS.sky} />
                    <Text style={s.heroLocationText} numberOfLines={2}>{displayAddress}</Text>
                  </View>

                  <TouchableOpacity style={s.editProfileBtn} onPress={onViewProfile} activeOpacity={0.85}>
                    <Feather name="edit-2" size={11} color="#FFF9F2" />
                    <Text style={s.editProfileText}>View listing</Text>
                  </TouchableOpacity>
                </View>

                <View style={s.heroBodyRight}>
                  <View style={s.heroPhotoWrap}>
                    {currentVendor.imageUrl ? (
                      <Image source={{ uri: currentVendor.imageUrl }} style={s.heroAvatarImage} />
                    ) : (
                      <View style={s.heroAvatarAdd}>
                        <MaterialIcons name="add-photo-alternate" size={28} color={COLORS.sky} />
                      </View>
                    )}
                    <TouchableOpacity
                      style={s.editPhotosChip}
                      activeOpacity={0.88}
                      onPress={() => navigation.navigate('VendorSettings')}
                    >
                      <Ionicons name="image-outline" size={12} color="#FFF9F2" />
                      <Text style={s.editPhotosChipText}>Edit photos</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={s.heroMetaRow}>
                <View style={s.heroMetaCard}>
                  <Text style={s.heroFooterLabel}>BUSINESS CODE</Text>
                  <View style={s.heroFooterValueRow}>
                    <Text style={s.heroFooterValue} selectable>
                      {showVendorCode
                        ? vendorCode
                        : `${vendorCode.slice(0, Math.min(8, vendorCode.length))}••••`}
                    </Text>
                    <TouchableOpacity
                      style={s.heroFooterAction}
                      onPress={() => setShowVendorCode(!showVendorCode)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name={showVendorCode ? 'eye-off-outline' : 'eye-outline'} size={14} color={COLORS.skyDark} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.heroFooterAction}
                      onPress={handleCopyId}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialIcons name={copiedId ? 'check' : 'content-copy'} size={14} color={copiedId ? COLORS.success : COLORS.skyDark} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={s.heroMetaCard}>
                  <Text style={s.heroFooterLabel}>ACTIVE OFFERS</Text>
                  <Text style={s.heroFooterValueAccent}>{activeOffers.length}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (onViewMyOffers) onViewMyOffers();
                      else navigation.navigate('VendorTabs', { screen: 'Offers' });
                    }}
                    hitSlop={8}
                  >
                    <Text style={s.heroMetaLink}>View all offers ›</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* Business health + Today */}
          <View style={s.homeSplitRow}>
            <View style={s.homeSplitCard}>
              <View style={s.homeSplitHeader}>
                <View style={s.homeSplitTitleRow}>
                  <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.sky} />
                  <Text style={s.homeSplitTitle}>Business health</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('VendorSettings')} hitSlop={8}>
                  <Text style={s.homeSplitLink}>View details</Text>
                </TouchableOpacity>
              </View>
              <View style={s.healthBody}>
                <View style={s.healthRingCol}>
                  <ProfileRing percent={profileChecks.percent} size={76} />
                  <Text style={s.healthRingCaption}>Profile{'\n'}Complete</Text>
                </View>
                <View style={s.healthChecklist}>
                  {profileChecks.items.map((item) => (
                    <View key={item.label} style={s.healthCheckRow}>
                      <Ionicons
                        name={item.done ? 'checkmark-circle' : 'alert-circle'}
                        size={15}
                        color={item.done ? COLORS.success : COLORS.warning}
                      />
                      <Text style={s.healthCheckLabel} numberOfLines={1}>{item.label}</Text>
                      {!item.done && item.pending ? (
                        <Text style={s.healthPending}>{item.pending} pending</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View style={s.homeSplitCard}>
              <View style={s.homeSplitHeader}>
                <Text style={s.homeSplitTitle}>TODAY</Text>
                <TouchableOpacity onPress={onViewAnalytics} hitSlop={8}>
                  <Text style={s.homeSplitLink}>View all</Text>
                </TouchableOpacity>
              </View>
              <View style={s.todayList}>
                {[
                  {
                    icon: 'pricetag' as const,
                    color: '#059669',
                    bg: 'rgba(5,150,105,0.12)',
                    value: dashStats?.todayRedemptions ?? todayRedemptions,
                    label: 'Redemptions',
                  },
                  {
                    icon: 'eye' as const,
                    color: '#2563EB',
                    bg: 'rgba(37,99,235,0.12)',
                    value: dashStats?.totalViews ?? todayVisitors,
                    label: 'Offer Views',
                  },
                  {
                    icon: 'radio' as const,
                    color: '#7C3AED',
                    bg: 'rgba(124,58,237,0.12)',
                    value: activeOffers.length,
                    label: 'Live Offers',
                  },
                ].map((row) => (
                  <View key={row.label} style={s.todayRow}>
                    <View style={[s.todayIcon, { backgroundColor: row.bg }]}>
                      <Ionicons name={row.icon} size={14} color={row.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.todayValue}>{row.value}</Text>
                      <Text style={s.todayLabel}>{row.label}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* 7-day activity */}
          <View style={s.sectionWrap}>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionTitle}>7-day activity</Text>
              <TouchableOpacity style={s.insightsViewAllBtn} onPress={onViewAnalytics}>
                <Text style={s.insightsViewAllText}>Full analytics ›</Text>
              </TouchableOpacity>
            </View>
            <View style={s.insightsCard}>
              <View style={s.activityBody}>
                <View style={s.activityTabs}>
                  {([
                    { key: 'redemptions' as const, label: 'Redemptions' },
                    { key: 'views' as const, label: 'Offer views' },
                    { key: 'customers' as const, label: 'Unique customers' },
                  ]).map((tab) => {
                    const active = activityMetric === tab.key;
                    return (
                      <TouchableOpacity
                        key={tab.key}
                        style={[s.activityTab, active && s.activityTabActive]}
                        onPress={() => setActivityMetric(tab.key)}
                        activeOpacity={0.85}
                      >
                        <Text style={[s.activityTabText, active && s.activityTabTextActive]}>{tab.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={s.activityChartCol}>
                  <ActivityLineChart values={activitySeries} labels={chartDateLabels} />
                </View>
              </View>

              <View style={s.activityKpiRow}>
                {[
                  { icon: 'people-outline' as const, label: 'Total Visitors', value: myRedemptions.length },
                  { icon: 'person-add-outline' as const, label: 'New Visitors', value: Math.max(0, uniqueVisitors - repeatVisitors) },
                  { icon: 'refresh-outline' as const, label: 'Returning', value: repeatVisitors },
                  { icon: 'person-outline' as const, label: 'Unique', value: uniqueVisitors },
                ].map((kpi) => (
                  <View key={kpi.label} style={s.activityKpi}>
                    <Ionicons name={kpi.icon} size={14} color={COLORS.sky} />
                    <Text style={s.activityKpiValue}>{kpi.value}</Text>
                    <Text style={s.activityKpiLabel}>{kpi.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Guidance / next steps */}
          <View style={s.sectionWrap}>
            <View style={s.guideCard}>
              <Text style={s.guideTitle}>Grow with PalSafar</Text>
              <Text style={s.guideText}>
                {myOffers.length === 0
                  ? 'Create your first offer so tourists nearby can discover your business.'
                  : myRedemptions.length === 0
                  ? 'Share your business code so visitors can send you PalPoints instantly.'
                  : 'Keep offers fresh — tourists can also send PalPoints with your business code.'}
              </Text>
              <View style={s.guideActions}>
                <TouchableOpacity style={s.guideBtnPrimary} onPress={onCreateOffer} activeOpacity={0.85}>
                  <Text style={s.guideBtnPrimaryText}>
                    {myOffers.length === 0 ? 'Create first offer' : 'New offer'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

        </ScrollView>
      ) : visibleTab === 'Offers' ? (
        <OffersView
          onCreateOffer={onCreateOffer}
          onEditOffer={onEditOffer}
          totalOffers={myOffers.length}
          activeOffers={activeOffers.length}
          totalRedemptions={myRedemptions.length}
          pointsRedeemed={totalPointsFromUsers}
          offers={myOffers}
          refreshing={refreshing}
          onRefresh={onRefresh}
          scrollPadBottom={screenInsets.scrollPadBottom}
          padTop={screenInsets.headerPadTop}
        />
      ) : null}

      {/* Bottom Navigation — hidden when VendorTabs owns chrome */}
      {!hideBottomNav ? (
      <View style={s.bottomNav}>
        {NAV_ITEMS.map((item) => {
          const isActive = visibleTab === item.key;
          const IconComp =
            item.iconSet === 'Feather' ? Feather :
            item.iconSet === 'Ionicons' ? Ionicons :
            MaterialIcons;
          const onTabPress = () => {
            setActiveTab(item.key as typeof activeTab);
            if (item.key === 'Home') { /* already here */ }
            if (item.key === 'Analytics') onViewAnalytics?.();
            if (item.key === 'Profile') onViewProfile?.();
          };
          return (
            <TouchableOpacity key={item.key} style={s.navItem} onPress={onTabPress}>
              <IconComp
                name={item.icon}
                size={22}
                color={isActive ? COLORS.sky : COLORS.textMuted}
              />
              {isActive && <View style={s.navActiveDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
      ) : null}

    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollView: {
    flex: 1,
  },

  // Header — paddingTop applied at runtime via useSafeAreaInsets
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: VendorUI.space.screen,
    paddingBottom: VendorUI.space.md,
    backgroundColor: COLORS.bg,
    gap: 10,
    zIndex: 10,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: COLORS.sky,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 4,
    letterSpacing: -0.3,
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  handle: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary,
    flexShrink: 1,
  },
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 2,
  },
  notifDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.skyDeep,
    letterSpacing: -0.5,
  },
  vendorText: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.sky,
    letterSpacing: -0.5,
  },


  // Notifications Dropdown
  notifDropdown: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 60,
    right: 16,
    left: 16,
    maxHeight: 420,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  notifHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  notifHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.skyDeep,
  },
  notifBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  notifCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.skyPale,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  notifDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  notifTime: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  notifUnreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginTop: 6,
    marginLeft: 8,
  },
  notifFooter: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notifFooterBtn: {
    paddingVertical: 4,
  },
  notifFooterBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.sky,
  },

  // Hero Card — Creator-style white bordered surface
  heroCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  heroCardInner: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 0,
    backgroundColor: '#FFFFFF',
  },
  heroDecoCircle1: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: COLORS.sky + '0D',
  },
  heroDecoCircle2: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.skyLight + '30',
  },
  heroTopRow: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#B9834B12',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#B9834B28',
    alignSelf: 'flex-start',
  },
  verifiedBadgeApproved: {
    backgroundColor: '#6B8F7112',
    borderColor: '#6B8F7130',
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.sky,
    letterSpacing: 0.2,
  },
  verifiedTextApproved: {
    color: COLORS.success,
  },
  heroBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
  },
  heroBodyLeft: {
    flex: 1,
    marginRight: 12,
    minWidth: 0,
  },
  heroBodyRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPhotoWrap: {
    width: 108,
    height: 108,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  heroAvatarImage: {
    width: '100%',
    height: '100%',
  },
  heroAvatarAdd: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.skyVeryPale,
  },
  editPhotosChip: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(77, 50, 39, 0.88)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
  },
  editPhotosChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF9F2',
  },
  heroBusinessName: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  heroRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  heroRatingText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  heroLocationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginBottom: 14,
  },
  heroLocationText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 17,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.skyDeep,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  editProfileText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroMetaRow: {
    marginTop: 16,
    marginHorizontal: -16,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    gap: 10,
  },
  heroMetaCard: {
    flex: 1,
    backgroundColor: COLORS.skyPale,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  heroMetaLink: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.sky,
    marginTop: 4,
  },
  heroFooterLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 5,
  },
  heroFooterValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  heroFooterValue: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
  heroFooterValueAccent: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.skyDeep,
    letterSpacing: -0.4,
  },
  heroFooterAction: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  homeSplitRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 14,
  },
  homeSplitCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    minHeight: 168,
  },
  homeSplitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 4,
  },
  homeSplitTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  homeSplitTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },
  homeSplitLink: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.sky,
  },
  healthBody: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  healthRingCol: {
    alignItems: 'center',
    width: 78,
  },
  healthRingCaption: {
    marginTop: 6,
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 12,
  },
  healthChecklist: {
    flex: 1,
    gap: 7,
  },
  healthCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  healthCheckLabel: {
    flex: 1,
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  healthPending: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.warning,
  },
  todayList: {
    gap: 10,
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  todayLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  activityBody: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
  },
  activityTabs: {
    width: 86,
    gap: 6,
  },
  activityTab: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: COLORS.skyPale,
  },
  activityTabActive: {
    backgroundColor: 'rgba(166, 124, 82, 0.18)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activityTabText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  activityTabTextActive: {
    color: COLORS.skyDeep,
  },
  activityChartCol: {
    flex: 1,
    minWidth: 0,
  },
  activityKpiRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  activityKpi: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  activityKpiValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  activityKpiLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textMuted,
    textAlign: 'center',
  },

  // Mini Stats Card
  miniStatsCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  miniStatsGradient: {
    paddingVertical: 18,
    paddingHorizontal: 12,
    backgroundColor: COLORS.white,
  },
  miniStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  miniStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  miniStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  miniStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // Sections
  sectionWrap: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.sky,
    backgroundColor: COLORS.skyPale,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.sky,
  },
  createOfferBtn: {
    borderRadius: 24,
    overflow: 'hidden',
    height: 130,
    shadowColor: '#B9834B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
  },
  createOfferGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  coDecoCircle1: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  coDecoCircle2: {
    position: 'absolute',
    bottom: -40,
    left: 80,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  coLeftContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coGiftBox: {
    width: 60,
    height: 60,
    alignItems: 'center',
  },
  coGiftLid: {
    width: 60,
    height: 14,
    backgroundColor: '#8B6B3A',
    borderRadius: 4,
    position: 'relative',
    alignItems: 'center',
  },
  coGiftRibbonH: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: '#FBEFE2',
    borderRadius: 2,
  },
  coGiftBow: {
    position: 'absolute',
    top: -7,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FBEFE2',
  },
  coGiftBody: {
    width: 60,
    height: 46,
    backgroundColor: '#B9834B',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coGiftRibbonV: {
    width: 5,
    height: 46,
    backgroundColor: '#FBEFE2',
    borderRadius: 2,
  },
  coRightContent: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '70%',
  },
  coTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  coTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2C1810',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  coPlus: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8B6B3A',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FBEFE2',
    textAlign: 'center',
    lineHeight: 24,
    overflow: 'hidden',
    marginLeft: 6,
  },
  coSubtitle: {
    fontSize: 12,
    color: '#63300E',
    lineHeight: 16,
    textAlign: 'center',
  },

  // Performance Cards Grid
  perfGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  performanceCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  perfIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  perfValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.skyDeep,
    letterSpacing: -0.5,
  },
  perfLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  // Insights Card
  insightsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  insightsChartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  insightsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  insightsHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.skyPale,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightsTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  insightsChartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.skyDeep,
    letterSpacing: -0.3,
  },
  insightsChartSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  insightsViewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  insightsViewAllText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.sky,
  },
  chartContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    height: 160,
    marginBottom: 8,
  },
  chartYAxis: {
    width: 30,
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  chartYLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#B8A88A',
    textAlign: 'right',
    paddingRight: 8,
  },
  chartArea: {
    flex: 1,
    position: 'relative',
    paddingBottom: 24,
  },
  chartGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#FBEFE2',
  },
  chartDot: {
    position: 'absolute',
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#FFF9F2',
    shadowColor: '#63300E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginLeft: -4,
    marginBottom: -4,
  },
  chartXAxis: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  chartXLabel: {
    fontSize: 9,
    fontWeight: '500',
    color: '#B8A88A',
  },
  chartLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingBottom: 16,
  },
  legendCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FBEFE2',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  insightsDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 20,
  },
  kpiSingleCard: {
    backgroundColor: COLORS.skyPale,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  kpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kpiPartition: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 2,
  },
  kpiDividerVer: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.border,
  },
  kpiDividerHor: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.skyDeep,
    letterSpacing: -0.5,
  },

  // Redemption Cards
  redemptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  redemptionLeft: {
    marginRight: 12,
  },
  touristAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.skyPale,
    justifyContent: 'center',
    alignItems: 'center',
  },
  redemptionCenter: {
    flex: 1,
  },
  touristName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  rewardName: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  redemptionTime: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 3,
  },
  redemptionRight: {
    alignItems: 'flex-end',
  },
  pointsUsed: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.sky,
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyRedemptions: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },

  // Promotion Banner
  promoBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 8,
  },
  promoGradient: {
    padding: 16,
    position: 'relative',
  },
  promoDecoCircle1: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  promoDecoCircle2: {
    position: 'absolute',
    bottom: 80,
    left: -30,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(197,222,222,0.4)',
  },
  promoDecoCircle3: {
    position: 'absolute',
    top: 100,
    right: 40,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  promoIllustrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 16,
  },
  promoPhoneWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  promoPhoneBody: {
    width: 52,
    height: 88,
    borderRadius: 12,
    backgroundColor: '#1A1A2E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2D2D44',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  promoPhoneScreen: {
    width: 44,
    height: 76,
    borderRadius: 8,
    backgroundColor: '#0F0F23',
    overflow: 'hidden',
  },
  promoPhoneNotch: {
    width: 20,
    height: 4,
    backgroundColor: '#1A1A2E',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 4,
  },
  promoPhoneContent: {
    flex: 1,
    padding: 4,
    gap: 3,
    justifyContent: 'center',
  },
  promoPhoneShopIcon: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: '#B9834B',
    alignSelf: 'center',
    marginBottom: 2,
  },
  promoPhoneReelBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D4A87A',
    width: '80%',
    alignSelf: 'center',
  },
  promoPhoneReelBar2: {
    height: 3,
    borderRadius: 2,
    backgroundColor: '#8B6B3A',
    width: '60%',
    alignSelf: 'center',
  },
  promoMegaphone: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  promoFloatingIcons: {
    flexDirection: 'column',
    gap: 6,
  },
  promoFloatIcon: {
    fontSize: 16,
  },
  promoPill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(200,132,24,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(200,132,24,0.15)',
  },
  promoPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.skyDeep,
  },
  promoHeadline: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.skyDeep,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  promoSubtext: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  promoFeatureCards: {
    gap: 6,
    marginBottom: 16,
  },
  promoFeatureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
    padding: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  promoFeatureIcon: {
    fontSize: 18,
  },
  promoFeatureInfo: {
    flex: 1,
  },
  promoFeatureTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.skyDeep,
    marginBottom: 1,
  },
  promoFeatureDesc: {
    fontSize: 10,
    color: COLORS.textMuted,
    lineHeight: 13,
  },
  promoGlassTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B9834B',
    textAlign: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  promoCtaBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: COLORS.sky,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  promoCtaBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF9F2',
    letterSpacing: 0.5,
  },
  promoFooter: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B8A88A',
    textAlign: 'center',
    letterSpacing: 0.3,
    marginTop: 16,
  },

  // Bottom Navigation
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  navActiveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.sky,
    marginTop: 4,
  },

  // Offers View
  OvHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4,
  },
  OvHeaderLeft: { flex: 1, marginRight: 12 },
  OvTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.3, marginBottom: 2 },
  OvSubtitle: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 16 },
  OvCreateBtn: {
    height: 38, borderRadius: 20, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.skyDeep,
  },
  OvCreateBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF9F2' },
  OvStatsGrid: {
    flexDirection: 'row', paddingHorizontal: 16,
    gap: 8, marginTop: 12,
  },
  OvStatCard: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  OvStatCardActive: {
    backgroundColor: 'rgba(5,150,105,0.06)',
    borderColor: 'rgba(5,150,105,0.22)',
  },
  OvStatGradient: {
    padding: 12, alignItems: 'center',
    minHeight: 90,
    backgroundColor: COLORS.white,
  },
  OvStatIcon: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  OvStatValue: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.3 },
  OvStatLabel: { fontSize: 9, fontWeight: '600', color: COLORS.textMuted, marginTop: 2, textAlign: 'center' },

  OvFilterCard: {
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: COLORS.white, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  OvFilterSection: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 4,
  },
  OvFilterRow: { flexDirection: 'row', gap: 2, paddingVertical: 2 },
  OvFilterTab: {
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12,
    position: 'relative',
  },
  OvFilterText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  OvFilterTextActive: { color: COLORS.skyDeep, fontWeight: '800' },
  OvFilterLine: {
    position: 'absolute', bottom: 2, left: 14, right: 14, height: 3,
    backgroundColor: COLORS.sky, borderRadius: 2,
  },
  OvFilterHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 4,
  },
  OvFilterHintDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  OvFilterHint: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  OvFilterBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: COLORS.skyPale, justifyContent: 'center', alignItems: 'center',
    marginLeft: 6,
  },
  filterDescCard: {
    marginHorizontal: 20, marginTop: 16,
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: 14, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1,
  },
  filterDescLeft: { flex: 1, marginRight: 12 },
  filterDescHeading: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  filterDescText: { fontSize: 11, color: COLORS.textMuted, lineHeight: 15 },
  filterDescIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  OvCard: {
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: COLORS.white, borderRadius: 18,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  OvCardMain: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  OvCardRow: { flexDirection: 'row', padding: 16 },
  OvImgWrap: {
    width: 92, height: 92, borderRadius: 14, overflow: 'hidden',
    position: 'relative',
    backgroundColor: COLORS.skyPale,
  },
  OvImg: { width: '100%', height: '100%' },
  OvImgPlaceholder: {
    width: '100%', height: '100%',
    backgroundColor: COLORS.skyPale,
    justifyContent: 'center', alignItems: 'center',
  },
  OvBadge: {
    position: 'absolute', top: 6, left: 6,
    backgroundColor: COLORS.skyDeep,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8,
  },
  OvBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFF9F2', letterSpacing: 0.2 },
  OvCardBody: { flex: 1, minWidth: 0, gap: 8, justifyContent: 'center' },
  OvTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  OvChipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  OvMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  OvMetaSep: { color: COLORS.textMuted, fontSize: 11, marginHorizontal: 2 },
  OvInfo: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, gap: 4 },
  OvChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  OvDot: { width: 7, height: 7, borderRadius: 4 },
  OvChipText: { fontSize: 10, fontWeight: '800' },
  OvCardTitle: {
    flex: 1,
    fontSize: 16, fontWeight: '800', color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  OvMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  OvMetaText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  OvRedeemBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.skyPale,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  OvRedeemBarText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.3,
  },
  OvRedeemBarStrong: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  OvRedeemTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  OvRedeemTimeText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  OvStatsMini: {
    width: 90, alignItems: 'center',
    backgroundColor: COLORS.skyPale,
    borderRadius: 10, paddingVertical: 6, gap: 2,
    borderWidth: 1, borderColor: COLORS.skyLight + '20',
  },
  OvStatsMiniVal: { fontSize: 14, fontWeight: '900', color: COLORS.textPrimary },
  OvStatsMiniLbl: { fontSize: 9, color: COLORS.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  OvActionRow: {
    flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap',
    paddingVertical: 8, paddingHorizontal: 6,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: '#FFFCF8',
    gap: 2,
  },
  OvActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, paddingHorizontal: 8,
    borderRadius: 10,
  },
  OvActionText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },

  // Home dashboard polish
  statusBanner: {
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    borderRadius: 14, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    borderWidth: 1,
  },
  statusBannerPending: { backgroundColor: '#B9834B12', borderColor: '#B9834B40' },
  statusBannerRejected: { backgroundColor: '#FF5A5F12', borderColor: '#FF5A5F40' },
  statusBannerTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  statusBannerText: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17 },
  mapPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.22)',
  },
  mapDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
  },
  mapVisibilityText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.success,
  },
  heroCategoryText: {
    fontSize: 12, color: COLORS.skyDark, fontWeight: '600',
    textTransform: 'capitalize', marginTop: 2, marginBottom: 8,
  },
  snapshotHeading: {
    fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
    marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6,
  },
  guideCard: {
    backgroundColor: COLORS.white, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  guideTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 6 },
  guideText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19, marginBottom: 14 },
  guideActions: { flexDirection: 'row', gap: 10 },
  guideBtnPrimary: {
    flex: 1, backgroundColor: COLORS.skyDeep, borderRadius: 20,
    paddingVertical: 12, alignItems: 'center',
  },
  guideBtnPrimaryText: { color: '#FFF9F2', fontWeight: '700', fontSize: 13 },
  guideBtnSecondary: {
    flex: 1, backgroundColor: COLORS.skyPale, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  guideBtnSecondaryText: { color: COLORS.skyDeep, fontWeight: '700', fontSize: 13 },
  emptyCta: {
    marginTop: 12, backgroundColor: COLORS.skyPale, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  emptyCtaText: { color: COLORS.skyDeep, fontWeight: '700', fontSize: 13 },
});
