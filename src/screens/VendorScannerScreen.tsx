import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Ionicons, MaterialIcons } from '../utils/Icons';
import { redemptionsApi } from '../services/api/redemptions';
import type { ServerRedemption } from '../services/api/redemptions';
import { useDataContext } from '../context/DataContext';
import { useUserContext } from '../context/UserContext';
import { DEV_FLAGS } from '../config/devFlags';
import { useVendorScreenInsets, VendorUI } from '../design/vendorLayout';
import type { RootStackParamList } from '../navigation/types';
import { copyToClipboard } from '../utils/clipboard';
import VendorWorkspaceSidebar from '../components/VendorWorkspaceSidebar';

const C = VendorUI.colors;

interface VendorScannerScreenProps {
  vendorName: string;
}

function extractRedemptionList(response: any): ServerRedemption[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.redemptions)) return response.redemptions;
  return [];
}

function mapLocalRedemptions(
  redemptions: any[],
  vendorId?: string,
): ServerRedemption[] {
  return redemptions
    .filter((item) => !vendorId || item.vendorId === vendorId)
    .map((item) => ({
      id: item.id,
      userId: item.userId,
      vendorId: item.vendorId,
      offerId: item.offerId,
      pointsSpent: Number(item.pointsSpent) || 0,
      discountValue: item.discountReceived || 0,
      discountType: 'FLAT' as const,
      qrCode: item.verificationCode || '',
      receiptNumber: null,
      status: item.status === 'verified' ? 'VERIFIED' : item.status === 'cancelled' ? 'CANCELLED' : 'PENDING',
      verifiedAt: item.verifiedAt || null,
      verifiedById: null,
      refundedAt: null,
      notes: null,
      createdAt: item.redeemedAt,
      updatedAt: item.redeemedAt,
      offerTitle: item.offerTitle || 'Points Transfer',
      user: item.userName ? { name: item.userName } : undefined,
    } as ServerRedemption))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export default function VendorScannerScreen({ vendorName }: VendorScannerScreenProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const screenInsets = useVendorScreenInsets();
  const { currentVendor, redemptions, vendorOffers, refreshVendorData } = useDataContext();
  const { user, setActiveMode, onLogout } = useUserContext();
  const [history, setHistory] = useState<ServerRedemption[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedReceipt, setCopiedReceipt] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const redemptionsRef = useRef(redemptions);
  const vendorIdRef = useRef(currentVendor?.id);
  redemptionsRef.current = redemptions;
  vendorIdRef.current = currentVendor?.id;

  const loadHistory = useCallback(async () => {
    const local = mapLocalRedemptions(redemptionsRef.current, vendorIdRef.current);
    try {
      if (!DEV_FLAGS.USE_SERVER_API) {
        setHistory(local);
        return;
      }
      const response = await redemptionsApi.vendorRedemptions(1, 100);
      const list = extractRedemptionList(response);
      setHistory(list.length > 0 ? list : local);
    } catch {
      setHistory(local);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (DEV_FLAGS.USE_SERVER_API) {
        await refreshVendorData().catch(() => {});
      }
      await loadHistory();
    } finally {
      setRefreshing(false);
    }
  }, [loadHistory, refreshVendorData]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setHistoryLoading(true);
        try {
          if (DEV_FLAGS.USE_SERVER_API) {
            await refreshVendorData().catch(() => {});
          }
          if (!cancelled) await loadHistory();
        } finally {
          if (!cancelled) setHistoryLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [loadHistory, refreshVendorData]),
  );

  const totalPoints = useMemo(
    () => history.reduce((sum, item) => sum + (Number(item.pointsSpent) || 0), 0),
    [history],
  );

  const uniqueTourists = useMemo(
    () => new Set(history.map((item) => item.userId).filter(Boolean)).size,
    [history],
  );

  const vendorCode =
    currentVendor?.vendorCode ||
    (currentVendor?.id ? `PAL-${currentVendor.id.slice(0, 6).toUpperCase()}` : '—');
  const maskedCode =
    vendorCode.length > 8
      ? `${vendorCode.slice(0, Math.min(8, vendorCode.length))}••••`
      : `${vendorCode}••••`;
  const approved = String(currentVendor?.verificationStatus || '').toLowerCase() === 'approved';
  const visibleHistory = showAllHistory ? history : history.slice(0, 8);

  const copyCode = async () => {
    const ok = await copyToClipboard(vendorCode, 'Business Code');
    if (ok) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1500);
    }
  };

  const copyReceipt = async (value: string) => {
    const ok = await copyToClipboard(value, 'Receipt');
    if (ok) {
      setCopiedReceipt(value);
      setTimeout(() => setCopiedReceipt(null), 1500);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setSidebarOpen(true)}
          accessibilityLabel="Open menu"
        >
          <Ionicons name="menu" size={24} color={C.primaryDark} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>VENDOR WORKSPACE</Text>
          <Text style={styles.title}>PalPoints</Text>
          <View style={styles.handleRow}>
            <Text style={styles.subtitle} numberOfLines={1}>{vendorName}</Text>
            {approved ? (
              <MaterialCommunityIcons name="check-decagram" size={15} color={C.primary} style={{ marginLeft: 4 }} />
            ) : null}
          </View>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.navigate('Notifications')}
          accessibilityLabel="Notifications"
        >
          <Ionicons name="notifications-outline" size={22} color={C.primaryDark} />
        </TouchableOpacity>
      </View>

      <VendorWorkspaceSidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        vendor={currentVendor}
        offerCount={vendorOffers.filter((o) => o.vendorId === currentVendor?.id && o.isActive).length}
        redemptionCount={history.length}
        onNavigateOffers={() => navigation.navigate('VendorTabs', { screen: 'Offers' })}
        onNavigateCreateOffer={() => navigation.navigate('CreateOffer', {})}
        onNavigateAnalytics={() =>
          navigation.navigate('VendorAnalytics', {
            vendorId: currentVendor?.id || '',
            vendorName,
          })
        }
        onNavigateProfile={() =>
          navigation.navigate('VendorProfile', {
            vendorId: currentVendor?.id || 'me',
            self: true,
          })
        }
        onNavigateCustomers={() => navigation.navigate('VendorCustomers')}
        onNavigateRedemption={() => navigation.navigate('VendorRedemption')}
        onNavigateSubscription={() => navigation.navigate('VendorSubscription')}
        onNavigateNotifications={() => navigation.navigate('Notifications')}
        onNavigateSettings={() => navigation.navigate('VendorSettings')}
        onNavigateLegal={() => navigation.navigate('LegalHub')}
        onSwitchToUser={() => setActiveMode('USER')}
        onLogout={() => { void onLogout(); }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: screenInsets.scrollPadBottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={C.primary}
            colors={[C.primary]}
          />
        }
      >
        {/* Hero summary */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroLeft}>
              <View style={styles.starOrb}>
                <MaterialIcons name="star" size={22} color="#FFF9F2" />
                <View style={[styles.sparkle, { top: -2, right: -2 }]}>
                  <Ionicons name="flash" size={10} color={C.bronze} />
                </View>
              </View>
              <Text style={styles.heroLabel}>PalPoints received from tourists</Text>
              <Text style={styles.heroValue}>{totalPoints} pts</Text>
              <Text style={styles.heroHint}>
                Tourists send points using your business code — no QR scan needed.
              </Text>
            </View>
            <View style={styles.heroArt}>
              <View style={styles.giftBox}>
                <MaterialCommunityIcons name="gift" size={42} color={C.primary} />
                <View style={styles.coinBadge}>
                  <Text style={styles.coinBadgeText}>P</Text>
                </View>
              </View>
              <MaterialCommunityIcons name="circle" size={16} color="#D4A017" style={styles.coinFloat1} />
              <MaterialCommunityIcons name="circle" size={12} color="#E8C547" style={styles.coinFloat2} />
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaCard}>
              <View style={styles.metaIconWrap}>
                <Ionicons name="qr-code-outline" size={16} color={C.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.metaLabel}>Your Business Code</Text>
                <Text style={styles.metaValue} numberOfLines={1}>
                  {showCode ? vendorCode : maskedCode}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowCode((v) => !v)} hitSlop={8} style={styles.metaAction}>
                <Ionicons name={showCode ? 'eye-off-outline' : 'eye-outline'} size={16} color={C.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={copyCode} hitSlop={8} style={styles.metaAction}>
                <Ionicons
                  name={copiedCode ? 'checkmark' : 'copy-outline'}
                  size={16}
                  color={copiedCode ? '#059669' : C.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.metaCard}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('VendorCustomers')}
            >
              <View style={[styles.metaIconWrap, { backgroundColor: 'rgba(5,150,105,0.12)' }]}>
                <Ionicons name="people-outline" size={16} color="#059669" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.metaLabel}>Total Tourists</Text>
                <Text style={styles.metaValue}>{uniqueTourists}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.verifyCta}
          activeOpacity={0.88}
          onPress={() => navigation.navigate('VendorRedemption')}
        >
          <Ionicons name="scan-outline" size={20} color="#fff" />
          <Text style={styles.verifyCtaText}>Verify offer redemption (PAL- code)</Text>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>

        {/* History */}
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>PalPoints history</Text>
          {history.length > 8 ? (
            <TouchableOpacity
              style={styles.viewAllBtn}
              onPress={() => setShowAllHistory((v) => !v)}
              hitSlop={8}
            >
              <Text style={styles.viewAllText}>{showAllHistory ? 'Show less' : 'View all'}</Text>
              <Ionicons name={showAllHistory ? 'chevron-up' : 'chevron-forward'} size={14} color={C.primary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {historyLoading && history.length === 0 ? (
          <View style={styles.historyLoading}>
            <ActivityIndicator size="large" color={C.primary} />
          </View>
        ) : history.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="star-outline" size={48} color={C.textMuted} />
            <Text style={styles.emptyTitle}>No PalPoints received yet</Text>
            <Text style={styles.emptySubtitle}>
              Share your business code. When a tourist sends PalPoints, it appears here instantly.
            </Text>
          </View>
        ) : (
          visibleHistory.map((item) => {
            const tourist = (item as any).user?.name || 'Tourist';
            const offer = item.offerTitle || item.offer?.title || 'Points Transfer';
            const receipt = item.receiptNumber || item.qrCode || null;
            const pts = Number(item.pointsSpent) || 0;
            return (
              <View key={item.id} style={styles.historyCard}>
                <View style={styles.historyRow}>
                  <View style={styles.receiveIcon}>
                    <Ionicons name="arrow-up" size={16} color="#FFF9F2" />
                  </View>
                  <View style={styles.historyMain}>
                    <View style={styles.historyTitleRow}>
                      <Text style={styles.historyOfferName} numberOfLines={1}>{offer}</Text>
                      <View style={styles.receivedPill}>
                        <Text style={styles.receivedPillText}>Received</Text>
                      </View>
                    </View>
                    <Text style={styles.historyDetail}>From {tourist}</Text>
                    <Text style={styles.historyDetail}>
                      {new Date(item.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                    {receipt ? (
                      <TouchableOpacity
                        style={styles.receiptPill}
                        onPress={() => copyReceipt(String(receipt))}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.receiptPillText} numberOfLines={1}>
                          Receipt · {String(receipt).slice(0, 14)}
                        </Text>
                        <Ionicons
                          name={copiedReceipt === String(receipt) ? 'checkmark' : 'copy-outline'}
                          size={12}
                          color={C.textSecondary}
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <View style={styles.historyRight}>
                    <Text style={styles.pointsBadge}>+{pts} pts</Text>
                    <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
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
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: C.primary,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: C.text,
    marginTop: 4,
    letterSpacing: -0.3,
  },
  handleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  subtitle: {
    fontSize: 13,
    color: C.textSecondary,
    fontWeight: '500',
    flexShrink: 1,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: VendorUI.space.screen,
    gap: 10,
  },

  heroCard: {
    backgroundColor: C.soft || '#FBEFE2',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row',
    gap: 8,
  },
  heroLeft: { flex: 1, minWidth: 0 },
  starOrb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  sparkle: { position: 'absolute' },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textSecondary,
  },
  heroValue: {
    fontSize: 32,
    fontWeight: '800',
    color: C.text,
    marginTop: 4,
    letterSpacing: -0.6,
  },
  heroHint: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 8,
    lineHeight: 17,
  },
  heroArt: {
    width: 96,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  giftBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#D4A017',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.white,
  },
  coinBadgeText: { color: '#FFF9F2', fontWeight: '800', fontSize: 12 },
  coinFloat1: { position: 'absolute', top: 8, left: 4 },
  coinFloat2: { position: 'absolute', bottom: 14, right: 0 },

  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  metaCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minWidth: 0,
  },
  metaIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(166,124,82,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textMuted,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '800',
    color: C.text,
    marginTop: 1,
  },
  metaAction: {
    padding: 2,
  },

  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 2,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.text,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.primary,
  },
  historyLoading: { paddingTop: 48, alignItems: 'center' },
  emptyState: { paddingTop: 40, alignItems: 'center', paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginTop: 12 },
  emptySubtitle: {
    fontSize: 13,
    color: C.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  historyCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  receiveIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  historyMain: { flex: 1, minWidth: 0 },
  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  historyOfferName: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    flexShrink: 1,
  },
  receivedPill: {
    backgroundColor: 'rgba(5,150,105,0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  receivedPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  historyDetail: {
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 2,
  },
  receiptPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: C.soft || '#FBEFE2',
    borderWidth: 1,
    borderColor: C.border,
    maxWidth: '100%',
  },
  receiptPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textSecondary,
    flexShrink: 1,
  },
  historyRight: {
    alignItems: 'flex-end',
    gap: 10,
    paddingTop: 2,
  },
  pointsBadge: {
    fontSize: 14,
    fontWeight: '800',
    color: '#059669',
  },
  verifyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: C.primary,
  },
  verifyCtaText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
