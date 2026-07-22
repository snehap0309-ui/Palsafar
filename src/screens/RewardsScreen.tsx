import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '../utils/Icons';
import { LinearGradient } from '../utils/LinearGradient';
import { colors, spacing, borderRadius, shadows } from '../config/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderSafePadding } from '../design/responsive';
import { DEV_FLAGS } from '../config/devFlags';
import { rewardsApi, walletApi, VendorOfferItem } from '../services/api';
import { UserProfile } from '../types';
import QRCode from 'react-native-qrcode-svg';

const CATEGORIES = [
  { key: 'all', label: 'All', icon: 'apps' },
  { key: 'food', label: 'Food', icon: 'restaurant' },
  { key: 'cafe', label: 'Cafe', icon: 'cafe' },
  { key: 'hotel', label: 'Hotel', icon: 'bed' },
  { key: 'adventure', label: 'Adventure', icon: 'compass' },
  { key: 'shopping', label: 'Shopping', icon: 'cart' },
  { key: 'transport', label: 'Transport', icon: 'car' },
  { key: 'events', label: 'Events', icon: 'calendar' },
  { key: 'featured', label: 'Featured', icon: 'star' },
];

const GRADIENT_PAIRS = [
  ['#6C63FF', '#5A52D5'],
  ['#FF6584', '#E55772'],
  ['#00D2FF', '#00B8E6'],
  ['#FF9F1C', '#E68A00'],
  ['#21E58A', '#1AC87A'],
  ['#D4C4A8', '#C0A880'],
];

interface RewardsScreenProps {
  user: UserProfile;
  onBack: () => void;
  onSelectOffer: (offerId: string) => void;
  onRedeemOffer: (offerId: string) => Promise<any>;
}

export default function RewardsScreen({
  user,
  onBack,
  onSelectOffer,
  onRedeemOffer,
}: RewardsScreenProps) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const FEATURED_CARD_WIDTH = SCREEN_WIDTH * 0.72;
  const GRID_CARD_WIDTH = (SCREEN_WIDTH - spacing.md * 3) / 2;
  const headerPadTop = useHeaderSafePadding(12);
  const [offers, setOffers] = useState<VendorOfferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [balance, setBalance] = useState(user.totalPoints || 0);
  const [selectedOffer, setSelectedOffer] = useState<VendorOfferItem | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState<any>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!DEV_FLAGS.USE_SERVER_API) return;
    try {
      const res = await walletApi.getProfile();
      const data: any = res?.data ?? res;
      const pts = Number(data?.palPoints ?? data?.pointBalance ?? 0);
      if (!Number.isNaN(pts)) setBalance(pts);
    } catch {
      // keep fallback from user prop
    }
  }, []);

  const fetchOffers = useCallback(async (pageNum: number, _isRefresh = false) => {
    if (DEV_FLAGS.USE_SERVER_API) {
      try {
        const params: Record<string, any> = { page: pageNum, limit: 20 };
        if (category !== 'all') params.category = category;
        const res = await rewardsApi.listOffers(params);
        const data = res.data || res;
        const items = Array.isArray(data) ? data : (data as any).offers || (data as any).items || [];
        if (pageNum === 1) {
          setOffers(items);
        } else {
          setOffers(prev => [...prev, ...items]);
        }
        setHasMore(items.length >= 20);
      } catch (err: any) {
        if (pageNum === 1) {
          setError(err?.message || 'Failed to load offers');
        }
      }
    } else {
      if (pageNum === 1) {
        setOffers([]);
      }
    }
  }, [category]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPage(1);
    await Promise.all([fetchOffers(1), fetchBalance()]);
    setLoading(false);
  }, [fetchOffers, fetchBalance]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await Promise.all([fetchOffers(1), fetchBalance()]);
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchOffers(nextPage);
    setLoadingMore(false);
  };

  const handleCategoryChange = (key: string) => {
    if (key === category) return;
    setCategory(key);
  };

  const featured = offers.filter(o => o.isFeatured).slice(0, 6);
  const allOffers = offers;

  const getDiscountLabel = (offer: VendorOfferItem): string => {
    if (offer.discountType === 'flat') return `₹${offer.discountValue} OFF`;
    if (offer.discountType === 'percentage') return `${offer.discountValue}% OFF`;
    return offer.discountType;
  };

  const hasEnoughPoints = (offer: VendorOfferItem) => balance >= offer.pointsRequired;

  const handleRedeemPress = (offer: VendorOfferItem) => {
    setSelectedOffer(offer);
    setRedeemError(null);
    setRedeemSuccess(null);
  };

  const handleConfirmRedemption = async () => {
    if (!selectedOffer) return;
    if (!hasEnoughPoints(selectedOffer)) {
      setRedeemError(`Insufficient points. You need ${selectedOffer.pointsRequired - balance} more points.`);
      return;
    }
    setRedeeming(true);
    setRedeemError(null);
    try {
      const result = await onRedeemOffer(selectedOffer.id);
      if (result) {
        setRedeemSuccess(result);
        setBalance(prev => prev - selectedOffer.pointsRequired);
      }
    } catch (err: any) {
      setRedeemError(err?.message || 'Redemption failed. Please try again.');
    } finally {
      setRedeeming(false);
    }
  };

  const renderFeaturedCard = ({ item, index }: { item: VendorOfferItem; index: number }) => {
    const gradient = GRADIENT_PAIRS[index % GRADIENT_PAIRS.length];
    return (
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.featuredCard, { width: FEATURED_CARD_WIDTH }]}
      >
        <TouchableOpacity
          style={styles.featuredTouchable}
          activeOpacity={0.85}
          onPress={() => onSelectOffer(item.id)}
        >
          <View style={styles.featuredBadge}>
            <Ionicons name="star" size={12} color="#fff" />
            <Text style={styles.featuredBadgeText}>Featured</Text>
          </View>

          <View style={styles.featuredContent}>
            <Text style={styles.featuredTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.featuredVendor} numberOfLines={1}>{item.vendor.businessName}</Text>
            <Text style={styles.featuredCity}>{item.vendor.city}</Text>
          </View>

          <View style={styles.featuredFooter}>
            <View style={styles.featuredPointsBadge}>
              <Ionicons name="trophy" size={14} color={colors.gold} />
              <Text style={styles.featuredPointsText}>{item.pointsRequired} pts</Text>
            </View>
            <TouchableOpacity
              style={styles.featuredRedeemBtn}
              onPress={() => handleRedeemPress(item)}
            >
              <Text style={styles.featuredRedeemText}>Redeem</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </LinearGradient>
    );
  };

  const renderGridCard = ({ item }: { item: VendorOfferItem }) => (
    <View style={[styles.gridCard, { width: GRID_CARD_WIDTH }]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onSelectOffer(item.id)}
        style={styles.gridTouchable}
      >
        <View style={styles.gridImagePlaceholder}>
          <Ionicons name="gift" size={24} color={colors.textMuted} />
        </View>
        <View style={styles.gridBody}>
          <Text style={styles.gridTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.gridVendor} numberOfLines={1}>{item.vendor.businessName}</Text>

          <View style={styles.gridDiscountRow}>
            <View style={styles.gridDiscountBadge}>
              <Text style={styles.gridDiscountText}>{getDiscountLabel(item)}</Text>
            </View>
          </View>

          <View style={styles.gridPointsRow}>
            <Ionicons name="trophy" size={14} color={colors.gold} />
            <Text style={styles.gridPointsText}>{item.pointsRequired} pts</Text>
          </View>

          {item.vendor.latitude && item.vendor.longitude && (
            <View style={styles.gridDistanceRow}>
              <Ionicons name="location-outline" size={10} color={colors.textMuted} />
              <Text style={styles.gridDistanceText}>Nearby</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.gridRedeemBtn,
          !hasEnoughPoints(item) && styles.gridRedeemBtnDisabled,
        ]}
        onPress={() => handleRedeemPress(item)}
        disabled={!hasEnoughPoints(item)}
      >
        <Text style={[
          styles.gridRedeemText,
          !hasEnoughPoints(item) && styles.gridRedeemTextDisabled,
        ]}>
          {hasEnoughPoints(item) ? 'Redeem' : 'Locked'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }
    if (!hasMore && allOffers.length > 0) {
      return (
        <View style={styles.footerText}>
          <Text style={styles.footerEndText}>You're all caught up!</Text>
        </View>
      );
    }
    return null;
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <Ionicons name="gift-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No offers found</Text>
        <Text style={styles.emptyText}>Check back later for new rewards in this category.</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: headerPadTop }]}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Rewards & Offers</Text>
          <TouchableOpacity style={styles.searchButton} onPress={() => navigation.navigate('Search')}>
            <Ionicons name="search" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (error && offers.length === 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: headerPadTop }]}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Rewards & Offers</Text>
          <TouchableOpacity style={styles.searchButton} onPress={() => navigation.navigate('Search')}>
            <Ionicons name="search" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadInitial}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: headerPadTop }]}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rewards & Offers</Text>
        <TouchableOpacity style={styles.searchButton} onPress={() => navigation.navigate('Search')}>
          <Ionicons name="search" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={allOffers}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={false}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Points Balance Bar */}
            <View style={styles.pointsCard}>
              <LinearGradient
                colors={[colors.gold, colors.goldDark] as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.pointsGradient}
              >
                <View style={styles.pointsRow}>
                  <Ionicons name="trophy" size={28} color="#000" />
                  <View style={styles.pointsInfo}>
                    <Text style={styles.pointsLabel}>Points Available</Text>
                    <Text style={styles.pointsValue}>{balance.toLocaleString()}</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Category Filter Chips */}
            <View style={styles.filtersRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.key}
                    style={[
                      styles.filterChip,
                      category === cat.key && styles.filterChipActive,
                    ]}
                    onPress={() => handleCategoryChange(cat.key)}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={14}
                      color={category === cat.key ? colors.primaryLight : colors.textSecondary}
                    />
                    <Text style={[
                      styles.filterLabel,
                      category === cat.key && styles.filterLabelActive,
                    ]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Featured Offers Section */}
            {featured.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Featured Offers</Text>
                <FlatList
                  data={featured}
                  renderItem={renderFeaturedCard}
                  keyExtractor={item => `featured-${item.id}`}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.featuredList}
                  snapToInterval={FEATURED_CARD_WIDTH + spacing.md}
                  decelerationRate="fast"
                  snapToAlignment="start"
                />
              </View>
            )}

            {/* All Offers Section Header */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>All Offers</Text>
              {allOffers.length > 0 && (
                <Text style={styles.sectionCount}>{allOffers.length} available</Text>
              )}
            </View>
          </>
        }
        renderItem={renderGridCard}
      />

      {/* Redemption Confirmation Modal */}
      <Modal visible={selectedOffer !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 16) + spacing.lg }]}>
            <View style={styles.modalHandle} />
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => {
                setSelectedOffer(null);
                setRedeemError(null);
                setRedeemSuccess(null);
              }}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>

            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: spacing.sm }}
            >
              {redeemSuccess ? (
                <View style={styles.successContainer}>
                  <View style={styles.successIconWrap}>
                    <Ionicons name="checkmark-circle" size={72} color={colors.success} />
                  </View>
                  <Text style={styles.successTitle}>Redemption Successful!</Text>
                  <View style={styles.successDetail}>
                    <Text style={styles.successOfferTitle}>{selectedOffer?.title}</Text>
                    <Text style={styles.successVendor}>{selectedOffer?.vendor.businessName}</Text>
                  </View>

                  {redeemSuccess?.qrCode ? (
                    <View style={{ alignItems: 'center', marginBottom: 20 }}>
                      <View style={{ padding: 10, backgroundColor: '#fff', borderRadius: 10, marginBottom: 10 }}>
                        <QRCode value={redeemSuccess.qrCode} size={150} />
                      </View>
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>Scan this QR Code at the counter</Text>
                    </View>
                  ) : null}

                  {redeemSuccess?.token ? (
                    <View style={{ alignItems: 'center', marginBottom: 24, padding: 16, backgroundColor: colors.surfaceLight, borderRadius: 12, width: '100%' }}>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Or share this Token Code</Text>
                      <Text style={{ fontSize: 32, fontWeight: 'bold', color: colors.primary, letterSpacing: 4 }}>{redeemSuccess.token}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={styles.successBtn}
                    onPress={() => {
                      setSelectedOffer(null);
                      setRedeemSuccess(null);
                    }}
                  >
                    <Text style={styles.successBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <Text style={styles.modalTitle}>Confirm Redemption</Text>
                  {selectedOffer ? (
                    <>
                      <View style={styles.modalOfferPreview}>
                        <View style={styles.modalOfferIcon}>
                          <Ionicons name="gift" size={32} color={colors.primary} />
                        </View>
                        <View style={styles.modalOfferInfo}>
                          <Text style={styles.modalOfferTitle}>{selectedOffer.title}</Text>
                          <Text style={styles.modalOfferVendor}>{selectedOffer.vendor.businessName}</Text>
                          <Text style={styles.modalOfferDiscount}>{getDiscountLabel(selectedOffer)}</Text>
                        </View>
                      </View>

                      <View style={styles.modalDivider} />

                      <View style={styles.modalBalanceRow}>
                        <Text style={styles.modalBalanceLabel}>Current Balance</Text>
                        <Text style={styles.modalBalanceValue}>{balance.toLocaleString()} pts</Text>
                      </View>
                      <View style={styles.modalBalanceRow}>
                        <Text style={styles.modalBalanceLabel}>Points Required</Text>
                        <Text
                          style={[
                            styles.modalBalanceValue,
                            { color: hasEnoughPoints(selectedOffer) ? colors.gold : colors.danger },
                          ]}
                        >
                          -{selectedOffer.pointsRequired} pts
                        </Text>
                      </View>
                      <View style={styles.modalDivider} />
                      <View style={styles.modalBalanceRow}>
                        <Text style={styles.modalBalanceLabel}>Balance After</Text>
                        <Text
                          style={[
                            styles.modalBalanceValue,
                            { color: hasEnoughPoints(selectedOffer) ? colors.success : colors.danger },
                          ]}
                        >
                          {hasEnoughPoints(selectedOffer)
                            ? `${(balance - selectedOffer.pointsRequired).toLocaleString()} pts`
                            : 'Insufficient'}
                        </Text>
                      </View>

                      {redeemError ? (
                        <View style={styles.modalError}>
                          <Ionicons name="alert-circle" size={16} color={colors.danger} />
                          <Text style={styles.modalErrorText}>{redeemError}</Text>
                        </View>
                      ) : null}

                      <TouchableOpacity
                        style={[
                          styles.modalRedeemBtn,
                          (!hasEnoughPoints(selectedOffer) || redeeming) && styles.modalRedeemBtnDisabled,
                        ]}
                        onPress={handleConfirmRedemption}
                        disabled={!hasEnoughPoints(selectedOffer) || redeeming}
                      >
                        {redeeming ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.modalRedeemBtnText}>Confirm Redemption</Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.modalCancelBtn}
                        onPress={() => {
                          setSelectedOffer(null);
                          setRedeemError(null);
                        }}
                      >
                        <Text style={styles.modalCancelText}>Cancel</Text>
                      </TouchableOpacity>
                    </>
                  ) : null}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
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
    padding: spacing.xl,
  },
  errorText: {
    fontSize: 14,
    color: colors.danger,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  // Points Card
  pointsCard: {
    margin: spacing.lg,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.md,
  },
  pointsGradient: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pointsInfo: {
    flex: 1,
  },
  pointsLabel: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.6)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pointsValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000',
    marginTop: 2,
  },
  // Filters
  filtersRow: {
    paddingLeft: spacing.lg,
    marginBottom: spacing.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDark + '60',
  },
  filterLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  filterLabelActive: {
    color: colors.primaryLight,
    fontWeight: '700',
  },
  // Sections
  section: {
    marginBottom: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionCount: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  // Featured Cards
  featuredList: {
    paddingLeft: spacing.lg,
    paddingRight: spacing.md,
    gap: spacing.md,
  },
  featuredCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginRight: spacing.md,
  },
  featuredTouchable: {
    padding: spacing.md,
    minHeight: 180,
    justifyContent: 'space-between',
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: borderRadius.round,
  },
  featuredBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  featuredContent: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  featuredTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  featuredVendor: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  featuredCity: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  featuredFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featuredPointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: borderRadius.round,
  },
  featuredPointsText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold,
  },
  featuredRedeemBtn: {
    backgroundColor: '#fff',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: borderRadius.round,
  },
  featuredRedeemText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
  },
  // Grid Cards
  gridRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  gridCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  gridTouchable: {
    flex: 1,
  },
  gridImagePlaceholder: {
    height: 80,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridBody: {
    padding: spacing.sm,
  },
  gridTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  gridVendor: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  gridDiscountRow: {
    marginBottom: 4,
  },
  gridDiscountBadge: {
    backgroundColor: colors.gold + '20',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  gridDiscountText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.gold,
  },
  gridPointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gridPointsText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold,
  },
  gridDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  gridDistanceText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  gridRedeemBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    alignItems: 'center',
  },
  gridRedeemBtnDisabled: {
    backgroundColor: colors.surfaceLight,
  },
  gridRedeemText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  gridRedeemTextDisabled: {
    color: colors.textMuted,
  },
  // Pagination
  footerLoader: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  footerEndText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xl,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalCard: {
    backgroundColor: colors.surfaceSolid,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '92%',
    width: '100%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalClose: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.lg,
    zIndex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  modalOfferPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  modalOfferIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOfferInfo: {
    flex: 1,
  },
  modalOfferTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  modalOfferVendor: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalOfferDiscount: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.gold,
    marginTop: 4,
  },
  modalDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  modalBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  modalBalanceLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  modalBalanceValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  modalError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.danger + '15',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  modalErrorText: {
    fontSize: 12,
    color: colors.danger,
    flex: 1,
  },
  modalRedeemBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  modalRedeemBtnDisabled: {
    backgroundColor: colors.surfaceLight,
    opacity: 0.6,
  },
  modalRedeemBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalCancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  modalCancelText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  // Success in modal
  successContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  successIconWrap: {
    marginBottom: spacing.md,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.success,
    marginBottom: spacing.md,
  },
  successDetail: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  successOfferTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  successVendor: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  successBtn: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.xxl,
    width: '100%',
    alignItems: 'center',
  },
  successBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
