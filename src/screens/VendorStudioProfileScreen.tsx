import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Icon from 'react-native-vector-icons/Ionicons';
import { useDataContext } from '../context/DataContext';
import { useUserContext } from '../context/UserContext';
import { getVendorCategoryEmoji } from '../data/vendors';
import { redemptionsApi, vendorsApi } from '../services/api';
import { DEV_FLAGS } from '../config/devFlags';
import { useVendorScreenInsets } from '../design/vendorLayout';
import type { RootStackParamList } from '../navigation/types';
import { copyToClipboard } from '../utils/clipboard';

const C = {
  bg: '#FFF9F2',
  white: '#FFFFFF',
  soft: '#FBEFE2',
  text: '#4D3227',
  muted: '#8B7355',
  textMuted: '#B8A88A',
  primary: '#A67C52',
  primaryDark: '#63300E',
  border: '#E9D4BE',
  success: '#059669',
};

type RowConfig = {
  key: string;
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
};

function MenuRow({ item, isLast }: { item: RowConfig; isLast: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.row, !isLast && styles.rowBorder]}
      onPress={item.onPress}
      activeOpacity={0.75}
    >
      <View style={styles.rowIcon}>
        <Icon name={item.icon as any} size={18} color={C.primary} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.rowSub}>{item.subtitle}</Text>
      </View>
      <Icon name="chevron-forward" size={16} color={C.textMuted} />
    </TouchableOpacity>
  );
}

function extractList(response: any): any[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
}

export default function VendorStudioProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useVendorScreenInsets();
  const { currentVendor, redemptions, refreshVendorData } = useDataContext();
  const { user } = useUserContext();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [offerViews, setOfferViews] = useState(0);
  const [pointsReceived, setPointsReceived] = useState(0);
  const [visitorCount, setVisitorCount] = useState(0);
  const [uniqueCustomers, setUniqueCustomers] = useState(0);

  const loadStats = useCallback(async () => {
    if (!currentVendor) return;
    const localReds = redemptions.filter((r) => r.vendorId === currentVendor.id);
    const localPoints = localReds.reduce((s, r) => s + (r.pointsSpent || 0), 0);
    const localUnique = new Set(localReds.map((r) => r.userId)).size;

    if (!DEV_FLAGS.USE_SERVER_API) {
      setPointsReceived(localPoints);
      setUniqueCustomers(localUnique);
      setVisitorCount(localReds.length);
      setOfferViews(0);
      return;
    }

    try {
      const [redRes, dashRes] = await Promise.all([
        redemptionsApi.vendorRedemptions(1, 200),
        vendorsApi.getDashboard(),
      ]);
      const list = extractList(redRes);
      const points = list.reduce((s, r) => s + (Number(r.pointsSpent) || 0), 0);
      const unique = new Set(list.map((r) => r.userId).filter(Boolean)).size;
      const dashboard = (dashRes as any)?.data ?? dashRes;
      const views = Number(dashboard?.stats?.totalViews ?? 0) || 0;
      setPointsReceived(points || localPoints);
      setUniqueCustomers(unique || localUnique);
      setVisitorCount(list.length || localReds.length);
      setOfferViews(views);
    } catch {
      setPointsReceived(localPoints);
      setUniqueCustomers(localUnique);
      setVisitorCount(localReds.length);
    }
  }, [currentVendor, redemptions]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          if (DEV_FLAGS.USE_SERVER_API) {
            await refreshVendorData().catch(() => {});
          }
          if (!cancelled) await loadStats();
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [loadStats, refreshVendorData]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (DEV_FLAGS.USE_SERVER_API) await refreshVendorData().catch(() => {});
      await loadStats();
    } finally {
      setRefreshing(false);
    }
  }, [loadStats, refreshVendorData]);

  const vendor = currentVendor;
  const approved = String(vendor?.verificationStatus || '').toLowerCase() === 'approved';
  const category = vendor?.category || 'business';
  const categoryEmoji = getVendorCategoryEmoji(category);
  const displayName = vendor?.businessName || 'Your Business';
  const address = [vendor?.address, vendor?.city, vendor?.state].filter(Boolean).join(', ');
  const phone = vendor?.phone || user?.phoneNumber || '—';
  const email = vendor?.email || user?.email || '—';
  const hours = vendor?.openingHours || (vendor as any)?.operatingHours || 'Hours not set';
  const vendorCode =
    vendor?.vendorCode || (vendor?.id ? `PAL-${vendor.id.slice(0, 6).toUpperCase()}` : '—');
  const maskedCode =
    vendorCode.length > 8 ? `${vendorCode.slice(0, 8)}••••` : `${vendorCode}••••`;
  const memberSince = vendor?.createdAt
    ? new Date(vendor.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : '—';

  const copyCode = async () => {
    const ok = await copyToClipboard(vendorCode, 'Business Code');
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const businessRows: RowConfig[] = useMemo(
    () => [
      {
        key: 'details',
        icon: 'storefront-outline',
        title: 'Business Details',
        subtitle: 'Manage your business information',
        onPress: () => navigation.navigate('VendorSettings'),
      },
      {
        key: 'offers',
        icon: 'pricetag-outline',
        title: 'Offers',
        subtitle: 'Create and manage your offers',
        onPress: () => navigation.navigate('VendorTabs', { screen: 'Offers' }),
      },
      {
        key: 'analytics',
        icon: 'stats-chart-outline',
        title: 'Analytics',
        subtitle: 'View performance and insights',
        onPress: () =>
          navigation.navigate('VendorAnalytics', {
            vendorId: vendor?.id || '',
            vendorName: displayName,
          }),
      },
      {
        key: 'customers',
        icon: 'people-outline',
        title: 'Customers',
        subtitle: 'See your visitors and customers',
        onPress: () => navigation.navigate('VendorCustomers'),
      },
      {
        key: 'subscription',
        icon: 'card-outline',
        title: 'Subscription & Billing',
        subtitle: 'Manage your plan and payments',
        onPress: () => navigation.navigate('VendorSubscription'),
      },
      {
        key: 'billing',
        icon: 'receipt-outline',
        title: 'Billing History',
        subtitle: 'View your all transactions',
        onPress: () => navigation.navigate('BillingHistory'),
      },
    ],
    [navigation, vendor?.id, displayName],
  );

  const accountRows: RowConfig[] = useMemo(
    () => [
      {
        key: 'security',
        icon: 'shield-checkmark-outline',
        title: 'Security',
        subtitle: 'Password & account security',
        onPress: () => navigation.navigate('ChangePassword'),
      },
      {
        key: 'notifications',
        icon: 'notifications-outline',
        title: 'Notifications',
        subtitle: 'Manage notification preferences',
        onPress: () => navigation.navigate('Notifications'),
      },
    ],
    [navigation],
  );

  if (!vendor && loading) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'left', 'right']}>
        <ActivityIndicator color={C.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.scrollPadBottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
      >
        <View style={styles.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.eyebrow}>VENDOR PROFILE</Text>
            <View style={styles.nameRow}>
              <Text style={styles.title} numberOfLines={1}>{displayName}</Text>
              {approved ? (
                <MaterialCommunityIcons name="check-decagram" size={18} color={C.primary} />
              ) : null}
            </View>
            <Text style={styles.category}>
              {String(category).replace(/_/g, ' ')} {categoryEmoji}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.navigate('VendorSettings')}
            accessibilityLabel="Settings"
          >
            <Icon name="settings-outline" size={20} color={C.primaryDark} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.navigate('Notifications')}
            accessibilityLabel="Notifications"
          >
            <Icon name="notifications-outline" size={20} color={C.primaryDark} />
          </TouchableOpacity>
        </View>

        {/* Business info card */}
        <View style={styles.infoCard}>
          <View style={styles.infoTop}>
            <TouchableOpacity
              style={styles.avatarWrap}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('VendorSettings')}
            >
              {vendor?.imageUrl ? (
                <Image source={{ uri: vendor.imageUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarLetter}>{(displayName[0] || 'V').toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Icon name="camera" size={12} color="#FFF9F2" />
              </View>
            </TouchableOpacity>

            <View style={styles.infoMeta}>
              <View style={styles.infoLine}>
                <Icon name="location-outline" size={14} color={C.primary} />
                <Text style={styles.infoText} numberOfLines={2}>{address || 'Address not set'}</Text>
              </View>
              <View style={styles.infoLine}>
                <Icon name="call-outline" size={14} color={C.primary} />
                <Text style={styles.infoText}>{phone}</Text>
              </View>
              <View style={styles.infoLine}>
                <Icon name="mail-outline" size={14} color={C.primary} />
                <Text style={styles.infoText} numberOfLines={1}>{email}</Text>
              </View>
              <View style={styles.infoLine}>
                <Icon name="time-outline" size={14} color={C.primary} />
                <Text style={styles.infoText} numberOfLines={1}>{hours}</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoFooter}>
            <View style={styles.footerBlock}>
              <Text style={styles.footerLabel}>Business Code</Text>
              <View style={styles.codeRow}>
                <Text style={styles.footerValue}>{maskedCode}</Text>
                <TouchableOpacity onPress={copyCode} hitSlop={8}>
                  <Icon
                    name={copied ? 'checkmark' : 'copy-outline'}
                    size={15}
                    color={copied ? C.success : C.muted}
                  />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.footerDivider} />
            <View style={styles.footerBlock}>
              <Text style={styles.footerLabel}>Member since</Text>
              <View style={styles.codeRow}>
                <Icon name="calendar-outline" size={14} color={C.primary} />
                <Text style={styles.footerValue}>{memberSince}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { icon: 'people-outline' as const, value: visitorCount, label: 'Total Visitors' },
            { icon: 'eye-outline' as const, value: offerViews, label: 'Offer Views' },
            { icon: 'star-outline' as const, value: pointsReceived, label: 'PalPoints Received' },
            { icon: 'person-outline' as const, value: uniqueCustomers, label: 'Unique Customers' },
          ].map((s) => (
            <View key={s.label} style={styles.statItem}>
              <Icon name={s.icon} size={16} color={C.primary} />
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Upgrade banner */}
        <TouchableOpacity
          style={styles.upgradeBanner}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('VendorSubscription')}
        >
          <View style={styles.upgradeIcon}>
            <Icon name="diamond" size={18} color="#FFF9F2" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.upgradeTitle}>Upgrade to Pro Plan</Text>
            <Text style={styles.upgradeSub}>Unlock premium features and grow your business faster.</Text>
          </View>
          <View style={styles.upgradeBtn}>
            <Text style={styles.upgradeBtnText}>Upgrade Now</Text>
          </View>
          <Icon name="chevron-forward" size={16} color="#FFF9F2" />
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Business</Text>
        <View style={styles.card}>
          {businessRows.map((item, i) => (
            <MenuRow key={item.key} item={item} isLast={i === businessRows.length - 1} />
          ))}
        </View>

        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          {accountRows.map((item, i) => (
            <MenuRow key={item.key} item={item} isLast={i === accountRows.length - 1} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 4 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 14,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: C.primary,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  category: {
    fontSize: 13,
    color: C.muted,
    marginTop: 2,
    fontWeight: '500',
    textTransform: 'capitalize',
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

  infoCard: {
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 12,
  },
  infoTop: { flexDirection: 'row', gap: 12 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.soft,
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 26, fontWeight: '800', color: C.primary },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.white,
  },
  infoMeta: { flex: 1, minWidth: 0, gap: 6, justifyContent: 'center' },
  infoLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  infoText: { flex: 1, fontSize: 12, color: C.muted, fontWeight: '500', lineHeight: 16 },
  infoFooter: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  footerBlock: { flex: 1 },
  footerDivider: {
    width: 1,
    backgroundColor: C.border,
    marginHorizontal: 12,
  },
  footerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerValue: { fontSize: 13, fontWeight: '700', color: C.text },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 12,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 2,
  },
  statValue: { fontSize: 16, fontWeight: '800', color: C.text },
  statLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: C.textMuted,
    textAlign: 'center',
  },

  upgradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.primary,
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
  },
  upgradeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,249,242,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeTitle: { fontSize: 14, fontWeight: '800', color: '#FFF9F2' },
  upgradeSub: { fontSize: 11, color: 'rgba(255,249,242,0.85)', marginTop: 2, lineHeight: 15 },
  upgradeBtn: {
    backgroundColor: C.primaryDark,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  upgradeBtnText: { fontSize: 11, fontWeight: '800', color: '#FFF9F2' },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: C.text,
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  rowSub: { fontSize: 11, color: C.textMuted, marginTop: 2, fontWeight: '500' },
});
