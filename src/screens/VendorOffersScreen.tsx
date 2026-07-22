import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '../utils/Icons';
import { colors, spacing, borderRadius, shadows } from '../config/theme';
import { UserProfile, VendorOffer, VendorBusiness, VendorOfferRedemption } from '../types';
import { TouristSpot } from '../types';
import { getPlaces } from '../services/placesService';
import { getSpotById } from '../utils/placeUtils';
import OfferCard from '../components/OfferCard';
import RedemptionSuccessModal from '../components/RedemptionSuccessModal';
import { useHeaderSafePadding } from '../design/responsive';

interface VendorOffersScreenProps {
  user: UserProfile;
  vendors: VendorBusiness[];
  vendorOffers: VendorOffer[];
  onRedeemOffer: (offerId: string) => Promise<VendorOfferRedemption | null>;
}

const FILTERS = [
  { key: 'all', label: 'All', emoji: '🎯' },
  { key: 'cafe', label: 'Food', emoji: '☕' },
  { key: 'restaurant', label: 'Food', emoji: '🍽️' },
  { key: 'hotel', label: 'Stay', emoji: '🏨' },
  { key: 'homestay', label: 'Stay', emoji: '🏡' },
  { key: 'guide', label: 'Guides', emoji: '🧭' },
  { key: 'bike_rental', label: 'Travel', emoji: '🏍️' },
  { key: 'car_rental', label: 'Travel', emoji: '🚗' },
  { key: 'boating', label: 'Experiences', emoji: '🚤' },
  { key: 'adventure', label: 'Experiences', emoji: '🧗' },
  { key: 'tour_experience', label: 'Experiences', emoji: '🎫' },
];

function getFilterGroup(category: string): string {
  if (['hotel', 'homestay'].includes(category)) return 'stay';
  if (['bike_rental', 'car_rental'].includes(category)) return 'travel';
  if (['cafe', 'restaurant'].includes(category)) return 'food';
  if (['guide'].includes(category)) return 'guides';
  if (['boating', 'adventure', 'tour_experience'].includes(category)) return 'experiences';
  return 'all';
}

function isSameDay(date1: string, date2: string): boolean {
  return date1.slice(0, 10) === date2.slice(0, 10);
}

export default function VendorOffersScreen({
  user,
  vendors,
  vendorOffers,
  onRedeemOffer,
}: VendorOffersScreenProps) {
  const headerPadTop = useHeaderSafePadding(12);
  const [filter, setFilter] = useState<string>('all');
  const [redemptionResult, setRedemptionResult] = useState<{
    redemption: VendorOfferRedemption;
    offer: VendorOffer;
    vendor: VendorBusiness;
  } | null>(null);
  const [allPlaces, setAllPlaces] = useState<TouristSpot[]>([]);

  React.useEffect(() => {
    getPlaces().then(setAllPlaces);
  }, []);

  const today = new Date().toISOString();

  const getVendorById = (id: string) => vendors.find(p => p.id === id);
  const getOfferById = (id: string) => vendorOffers.find(o => o.id === id);

  const filteredOffers = useMemo(() => {
    return vendorOffers.filter(offer => {
      if (!offer.isActive) return false;
      const vendor = getVendorById(offer.vendorId);
      if (!vendor || vendor.verificationStatus !== 'approved') return false;
      if (filter === 'all') return true;
      return getFilterGroup(vendor.category) === filter;
    });
  }, [vendorOffers, vendors, filter]);

  const filterCategories = useMemo(() => {
    const seen = new Set<string>();
    return FILTERS.filter(f => {
      if (f.key === 'all') return true;
      if (seen.has(f.label)) return false;
      seen.add(f.label);
      return true;
    });
  }, []);

  const isRedeemedToday = (offerId: string): boolean => {
    const redeemed = user.redeemedOffers || [];
    return redeemed.some(r => r.offerId === offerId && isSameDay(r.redeemedAt, today));
  };

  const handleRedeem = (offerId: string) => {
    if (isRedeemedToday(offerId)) {
      Alert.alert('Already Redeemed', 'You have already redeemed this offer today.');
      return;
    }

    const offer = getOfferById(offerId);
    if (!offer) return;

    if (user.totalPoints < offer.pointsRequired) {
      const needed = offer.pointsRequired - user.totalPoints;
      Alert.alert('Not Enough Points', `You need ${needed} more Pal Points to redeem this offer.`);
      return;
    }

    Alert.alert(
      'Confirm Redemption',
      `Spend ${offer.pointsRequired} Pal Points to redeem "${offer.offerTitle}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem',
          style: 'default',
          onPress: async () => {
            const result = await onRedeemOffer(offerId);
            if (result) {
              const vendor = getVendorById(offer.vendorId);
              if (vendor) {
                setRedemptionResult({ redemption: result, offer, vendor });
              }
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, { paddingTop: headerPadTop }]}>
        <View>
          <Text style={styles.title}>Vendor Offers</Text>
          <Text style={styles.subtitle}>Redeem Pal Points and save during your trip</Text>
        </View>
      </View>

      <View style={styles.pointsCard}>
        <Ionicons name="trophy" size={24} color={colors.gold} />
        <View style={styles.pointsInfo}>
          <Text style={styles.pointsLabel}>Your Pal Points</Text>
          <Text style={styles.pointsValue}>{user.totalPoints || 0}</Text>
        </View>
      </View>

      <View style={styles.filtersRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {filterCategories.map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.filterChip, (filter === cat.key) && styles.filterChipActive]}
              onPress={() => setFilter(cat.key)}
            >
              <Text style={styles.filterEmoji}>{cat.emoji}</Text>
              <Text style={[styles.filterLabel, (filter === cat.key) && styles.filterLabelActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {filteredOffers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🎁</Text>
            <Text style={styles.emptyTitle}>No Offers Available</Text>
            <Text style={styles.emptyText}>
              Check back later for new vendor offers in this category.
            </Text>
          </View>
        ) : (
          filteredOffers.map(offer => {
            const vendor = getVendorById(offer.vendorId)!;
            const linkedSpot = offer.linkedSpotId ? getSpotById(allPlaces, offer.linkedSpotId) : undefined;
            const alreadyToday = isRedeemedToday(offer.id);

            return (
              <OfferCard
                key={offer.id}
                offer={offer}
                vendor={vendor}
                linkedSpot={linkedSpot}
                userPoints={user.totalPoints || 0}
                onRedeem={() => handleRedeem(offer.id)}
                alreadyRedeemedToday={alreadyToday}
              />
            );
          })
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      <RedemptionSuccessModal
        visible={redemptionResult !== null}
        redemption={redemptionResult?.redemption || null}
        offer={redemptionResult?.offer || null}
        vendor={redemptionResult?.vendor || null}
        onClose={() => setRedemptionResult(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingTop: 0,
    paddingBottom: spacing.xs,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },

  pointsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gold + '40',
    gap: spacing.md,
    ...shadows.sm,
  },
  pointsInfo: {
    flex: 1,
  },
  pointsLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  pointsValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.gold,
  },
  filtersRow: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
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
  filterEmoji: {
    fontSize: 14,
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
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  contentContainer: {
    paddingBottom: spacing.xxl,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  bottomSpacer: {
    height: spacing.xxl,
  },
});
