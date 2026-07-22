import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Image, useWindowDimensions } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import Pal from '../design/DesignSystem';
import { GlassCard } from '../components/ui/GlassCard';
import { Badge } from '../components/ui/Badge';
import { GradientButton } from '../components/ui/GradientButton';
import { tripsApi, TripPlan } from '../services/api/trips';
import { useToast } from '../context/ToastContext';
import { useHeaderSafePadding } from '../design/responsive';
import { getMainTabBarClearance } from '../design/tabBarLayout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const tripEmojis: Record<string, string> = {
  beach: '🏖️', mountain: '⛰️', heritage: '🏛️', adventure: '🧗',
  nature: '🌿', food: '🍜', city: '🌆', religious: '🛕',
  default: '📍',
};

const statusConfig: Record<string, { label: string; color: string; variant: 'primary' | 'success' | 'accent' | 'outline' }> = {
  UPCOMING: { label: 'Upcoming', color: Pal.colors.light.primary, variant: 'primary' },
  DRAFT: { label: 'Draft', color: Pal.colors.light.accent, variant: 'accent' },
  COMPLETED: { label: 'Completed', color: Pal.colors.light.success, variant: 'success' },
  ARCHIVED: { label: 'Archived', color: Pal.colors.light.textMuted, variant: 'outline' },
};

export default function MyTripsScreen({
  onNavigate,
  initialTab,
}: {
  onNavigate?: (screen: string, params?: any) => void;
  initialTab?: 'UPCOMING' | 'DRAFT' | 'COMPLETED';
}) {
  const headerPadTop = useHeaderSafePadding(12);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [trips, setTrips] = useState<TripPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'DRAFT' | 'COMPLETED'>(initialTab ?? 'UPCOMING');
  const { showSuccess, showError } = useToast();

  const fetchTrips = useCallback(async (status?: string) => {
    try {
      const res = await tripsApi.list({ status });
      setTrips(res?.data || []);
    } catch (err: any) {
      console.warn('Failed to fetch trips:', err);
      showError(err?.message || 'Failed to load trips');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showError]);

  useEffect(() => {
    setLoading(true);
    fetchTrips(activeTab === 'UPCOMING' ? undefined : activeTab);
  }, [activeTab, fetchTrips]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTrips(activeTab === 'UPCOMING' ? undefined : activeTab);
  }, [activeTab, fetchTrips]);

  const handleDelete = (id: string, title: string) => {
    Alert.alert('Delete Trip', `Delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await tripsApi.delete(id);
          showSuccess('Trip deleted successfully');
          fetchTrips(activeTab === 'UPCOMING' ? undefined : activeTab);
        } catch (err: any) {
          showError(err?.message || 'Failed to delete trip');
        }
      }},
    ]);
  };

  const handleDuplicate = async (id: string) => {
    try {
      await tripsApi.duplicate(id);
      showSuccess('Trip duplicated successfully');
      fetchTrips(activeTab === 'UPCOMING' ? undefined : activeTab);
    } catch (err: any) {
      showError(err?.message || 'Failed to duplicate trip');
    }
  };

  const tabs = [
    { key: 'UPCOMING' as const, label: 'Upcoming' },
    { key: 'DRAFT' as const, label: 'Drafts' },
    { key: 'COMPLETED' as const, label: 'Completed' },
  ];

  const filteredTrips = trips.filter(t => {
    if (activeTab === 'UPCOMING') return t.status === 'UPCOMING' || !t.status || t.status === 'DRAFT';
    return t.status === activeTab;
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Pal.colors.light.background }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Pal.colors.light.primary} />}
    >
      <View style={{ padding: Pal.spacing[5], paddingTop: headerPadTop, gap: Pal.spacing[5] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => onNavigate?.('goBack')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Pal.colors.light.surface, borderWidth: 1, borderColor: Pal.colors.light.border, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: Pal.colors.light.text, fontSize: 20 }}>←</Text>
          </TouchableOpacity>
          <Text style={{
            fontFamily: Pal.typography.fontFamily.bold, fontSize: Pal.typography.fontSize['3xl'],
            color: Pal.colors.light.text, letterSpacing: -0.5,
            flex: 1,
          }}>
            My Trips
          </Text>
          <Badge label={`${trips.length} total`} variant="primary" size="sm" />
        </View>

        <GradientButton
          title="+ Create New Trip"
          onPress={() => onNavigate?.('CreateTrip')}
          size="md"
          fullWidth
        />

        <View style={{ flexDirection: 'row', backgroundColor: Pal.colors.light.surfaceSoft, borderRadius: Pal.borderRadius.full, padding: 3 }}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: Pal.borderRadius.full,
                backgroundColor: activeTab === tab.key ? Pal.colors.light.surface : 'transparent',
                alignItems: 'center',
                ...(activeTab === tab.key ? Pal.shadows.sm : {}),
              }}
            >
              <Text style={{
                fontFamily: Pal.typography.fontFamily.semibold, fontSize: 13,
                color: activeTab === tab.key ? Pal.colors.light.text : Pal.colors.light.textMuted,
              }}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={{ paddingVertical: 60, alignItems: 'center', gap: 12 }}>
            <ActivityIndicator size="large" color={Pal.colors.light.primary} />
            <Text style={{ color: Pal.colors.light.textMuted, fontSize: 13 }}>Loading your trips...</Text>
          </View>
        ) : filteredTrips.length === 0 ? (
          <View style={{ paddingVertical: 60, alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 48 }}>🗺️</Text>
            <Text style={{ fontFamily: Pal.typography.fontFamily.semibold, fontSize: 17, color: Pal.colors.light.text }}>
              No {activeTab.toLowerCase()} trips
            </Text>
            <Text style={{ color: Pal.colors.light.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 40 }}>
              {activeTab === 'UPCOMING' ? 'Start planning your next adventure!' : activeTab === 'DRAFT' ? 'Save a trip as draft to see it here.' : 'Completed trips will appear here.'}
            </Text>
            {activeTab === 'UPCOMING' && (
              <GradientButton title="Plan a Trip" onPress={() => onNavigate?.('TripBuilder')} size="sm" />
            )}
          </View>
        ) : filteredTrips.map(trip => {
          const cfg = statusConfig[trip.status || 'DRAFT'] || statusConfig.DRAFT;
          const emoji = trip.interests?.length ? tripEmojis[trip.interests[0]?.toLowerCase()] || tripEmojis.default : tripEmojis.default;
          const place = trip.tripDays?.[0]?.stops?.[0]?.place;
          const firstImage = place?.thumbnail || place?.images?.[0] || trip.coverImage || null;
          return (
            <TouchableOpacity
              key={trip.id}
              onPress={() => onNavigate?.('TripDetail', { tripId: trip.id })}
              onLongPress={() => {
                Alert.alert(trip.title, '', [
                  { text: 'View', onPress: () => onNavigate?.('TripDetail', { tripId: trip.id }) },
                  { text: 'Duplicate', onPress: () => handleDuplicate(trip.id) },
                  { text: 'Delete', style: 'destructive', onPress: () => handleDelete(trip.id, trip.title) },
                  { text: 'Cancel', style: 'cancel' },
                ]);
              }}
              style={{
                borderRadius: Pal.borderRadius['2xl'],
                backgroundColor: Pal.colors.light.surface,
                overflow: 'hidden',
                ...Pal.shadows.md,
              }}
            >
              {firstImage ? (
                <Image
                  source={{ uri: firstImage }}
                  style={{ width: '100%', height: 120, opacity: 1 }}
                  resizeMode="cover"
                />
              ) : (
                <View style={{ height: 120, backgroundColor: Pal.colors.light.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 40 }}>{emoji}</Text>
                </View>
              )}
              <View style={{ padding: Pal.spacing[5], gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: Pal.typography.fontFamily.semibold, fontSize: 17, color: Pal.colors.light.text }}>
                      {trip.title}
                    </Text>
                    {trip.destination && (
                      <Text style={{ fontSize: 13, color: Pal.colors.light.textSecondary, marginTop: 2 }}>
                        {trip.destination}
                      </Text>
                    )}
                  </View>
                  <Badge label={cfg.label} variant={cfg.variant} size="sm" />
                </View>

                <View style={{ flexDirection: 'row', gap: 16 }}>
                  {trip.startDate && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: 11 }}>📅</Text>
                      <Text style={{ fontSize: 11, color: Pal.colors.light.textSecondary }}>
                        {new Date(trip.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {trip.endDate ? ` - ${new Date(trip.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
                      </Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 11 }}>📍</Text>
                    <Text style={{ fontSize: 11, color: Pal.colors.light.textSecondary }}>{trip.days} days</Text>
                  </View>
                </View>

                {trip.totalDistance ? (
                  <Text style={{ fontSize: 11, color: Pal.colors.light.textMuted }}>
                    🛣️ {trip.totalDistance.toFixed(1)} km · {Math.floor((trip.totalTravelTime || 0) / 60)}h travel
                  </Text>
                ) : null}

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <TouchableOpacity
                    onPress={() => onNavigate?.('TripDetail', { tripId: trip.id })}
                    style={{ flex: 1, height: 36, borderRadius: Pal.borderRadius.full, backgroundColor: Pal.colors.light.primary, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontFamily: Pal.typography.fontFamily.semibold, fontSize: 12, color: '#fff' }}>View</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onNavigate?.('TripDetail', { tripId: trip.id })}
                    style={{ flex: 1, height: 36, borderRadius: Pal.borderRadius.full, backgroundColor: Pal.colors.light.surface, borderWidth: 1, borderColor: Pal.colors.light.border, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontFamily: Pal.typography.fontFamily.semibold, fontSize: 12, color: Pal.colors.light.text }}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(trip.title, '', [
                        { text: 'Duplicate', onPress: () => handleDuplicate(trip.id) },
                        { text: 'Delete', style: 'destructive', onPress: () => handleDelete(trip.id, trip.title) },
                        { text: 'Cancel', style: 'cancel' },
                      ]);
                    }}
                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Pal.colors.light.surface, borderWidth: 1, borderColor: Pal.colors.light.border, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontSize: 16 }}>⋯</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={{ paddingBottom: getMainTabBarClearance(insets.bottom) }} />
      </View>
    </ScrollView>
  );
}
