import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Image,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { useUserContext } from '../context/UserContext';
import { useDataContext } from '../context/DataContext';
import { getSwitchableModes } from '../utils/workspaceRoles';
import HomeSidebar from '../components/HomeSidebar';
import { DEV_FLAGS } from '../config/devFlags';
import { tripsApi, TripPlan } from '../services/api/trips';
import { countTripStops, ensureManualDraftTrip } from '../utils/quickAddPlace';
import { subscribeUnreadBadge } from '../services/notifications/notificationBadgeStore';
import { refreshUnreadBadgeCount } from '../services/notificationService';

const HERO = require('../assets/settings_cover.png');
const AI_CARD_IMG = require('../assets/itinerary_ai_card.png');
const MANUAL_CARD_IMG = require('../assets/itinerary_manual_card.png');

const H_PAD = 20;
const CARD_GAP = 12;
const TAB_BAR_RESERVE = 96;
const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

const C = {
  bg: '#FDF7F2',
  ink: '#4A3427',
  text: '#2C1810',
  textSub: '#8B7355',
  textMuted: '#B8A88A',
  border: 'rgba(200, 155, 60, 0.14)',
  gold: '#B9834B',
  ai: '#5B4B8A',
  aiBtn: '#4A3F73',
  green: '#2D6A4F',
  greenBtn: '#1B4332',
};

type ItineraryCard = {
  id: string;
  title: string;
  days: number;
  places: number;
  image: string;
  statusLabel: string;
  statusBg: string;
  statusColor: string;
  dateLabel: string;
  dateColor: string;
  trip?: TripPlan;
};

const SAMPLE_ITINERARIES: ItineraryCard[] = [
  {
    id: 'sample-jabalpur',
    title: 'Jabalpur Highlights',
    days: 3,
    places: 8,
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    statusLabel: 'Upcoming',
    statusBg: '#DBEAFE',
    statusColor: '#2563EB',
    dateLabel: 'Jul 20 - Jul 22, 2025',
    dateColor: '#2563EB',
  },
  {
    id: 'sample-pachmarhi',
    title: 'Pachmarhi Getaway',
    days: 4,
    places: 6,
    image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80',
    statusLabel: 'Saved',
    statusBg: '#DCFCE7',
    statusColor: '#16A34A',
    dateLabel: 'Saved on May 10, 2025',
    dateColor: '#16A34A',
  },
];

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatDateRange(start?: string | null, end?: string | null): string | null {
  if (!start) return null;
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const year = s.getFullYear();
  if (e && !Number.isNaN(e.getTime())) {
    return `${s.toLocaleDateString('en-US', opts)} - ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
  }
  return s.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
}

function countPlaces(trip: TripPlan): number {
  return trip.tripDays?.reduce((sum, d) => sum + (d.stops?.length || 0), 0) || 0;
}

function tripToCard(trip: TripPlan): ItineraryCard {
  const image =
    trip.coverImage ||
    trip.tripDays?.[0]?.stops?.[0]?.place?.thumbnail ||
    trip.tripDays?.[0]?.stops?.[0]?.place?.images?.[0] ||
    SAMPLE_ITINERARIES[0].image;

  const isDraft = trip.status === 'DRAFT';
  const statusLabel = isDraft ? 'Saved' : trip.status === 'COMPLETED' ? 'Completed' : 'Upcoming';
  const statusColor = isDraft ? '#16A34A' : trip.status === 'COMPLETED' ? '#8B7355' : '#2563EB';
  const statusBg = isDraft ? '#DCFCE7' : trip.status === 'COMPLETED' ? '#F5EFE6' : '#DBEAFE';

  const range = formatDateRange(trip.startDate, trip.endDate);
  const dateLabel = isDraft
    ? `Saved on ${formatShortDate(trip.updatedAt || trip.createdAt)}`
    : range || `Updated ${formatShortDate(trip.updatedAt)}`;

  return {
    id: trip.id,
    title: trip.title || trip.destination || 'My Trip',
    days: trip.days || trip.tripDays?.length || 1,
    places: countPlaces(trip) || 1,
    image,
    statusLabel,
    statusBg,
    statusColor,
    dateLabel,
    dateColor: statusColor,
    trip,
  };
}

function PlannerCard({
  variant,
  width,
  onPress,
  loading,
}: {
  variant: 'ai' | 'manual';
  width: number;
  onPress: () => void;
  loading?: boolean;
}) {
  const isAi = variant === 'ai';
  return (
    <View style={[styles.plannerCard, { width }]}>
      <LinearGradient
        colors={isAi ? ['#F3EEFF', '#FFFFFF'] : ['#E8F5EE', '#FFFFFF']}
        style={styles.plannerGrad}
      >
        <View style={[styles.plannerIconWrap, { backgroundColor: isAi ? 'rgba(91,75,138,0.12)' : 'rgba(45,106,79,0.12)' }]}>
          <MaterialCommunityIcons
            name={isAi ? 'creation' : 'map-marker-path'}
            size={20}
            color={isAi ? C.ai : C.green}
          />
        </View>
        <Text style={[styles.plannerTitle, { color: isAi ? C.ai : C.green }]}>
          {isAi ? 'AI Trip Planner' : 'Build Your Own'}
        </Text>
        <Text style={styles.plannerDesc} numberOfLines={3}>
          {isAi
            ? 'Let our AI create the perfect itinerary for you.'
            : 'Create your itinerary by choosing places you love.'}
        </Text>
        <View style={styles.plannerArtWrap}>
          <Image
            source={isAi ? AI_CARD_IMG : MANUAL_CARD_IMG}
            style={styles.plannerArt}
            resizeMode="contain"
          />
        </View>
        <TouchableOpacity
          style={[styles.plannerBtn, { backgroundColor: isAi ? C.aiBtn : C.greenBtn }]}
          activeOpacity={0.88}
          onPress={onPress}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Text style={styles.plannerBtnText}>{isAi ? 'Plan with AI' : 'Build Itinerary'}</Text>
              <Icon name="arrow-forward" size={16} color="#FFF" />
            </>
          )}
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

function ItineraryTripCard({
  item,
  width,
  onPress,
}: {
  item: ItineraryCard;
  width: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.tripCard, { width }]} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.tripImageWrap}>
        <Image source={{ uri: item.image }} style={styles.tripImage} resizeMode="cover" />
        <View style={[styles.tripStatusBadge, { backgroundColor: item.statusBg }]}>
          <Text style={[styles.tripStatusText, { color: item.statusColor }]}>{item.statusLabel}</Text>
        </View>
        <TouchableOpacity style={styles.tripHeart} hitSlop={8}>
          <Icon name="heart-outline" size={18} color={C.ink} />
        </TouchableOpacity>
      </View>
      <View style={styles.tripBody}>
        <Text style={styles.tripTitle} numberOfLines={1}>{item.title}</Text>
        <View style={styles.tripMetaRow}>
          <Icon name="calendar-outline" size={13} color={C.textSub} />
          <Text style={styles.tripMetaText}>{item.days} Days • {item.places} Places</Text>
        </View>
        <View style={styles.tripMetaRow}>
          <Icon name="time-outline" size={13} color={item.dateColor} />
          <Text style={[styles.tripDateText, { color: item.dateColor }]} numberOfLines={1}>
            {item.dateLabel}
          </Text>
        </View>
        <TouchableOpacity style={styles.tripMenuBtn} hitSlop={8}>
          <Icon name="ellipsis-horizontal" size={16} color={C.textMuted} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function ItineraryHubScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const { user, isGuest, setActiveMode, onLogout } = useUserContext();
  const { currentVendor } = useDataContext();

  const plannerW = (screenW - H_PAD * 2 - CARD_GAP) / 2;
  const tripCardW = Math.min(268, screenW * 0.72);
  const bottomPad = Math.max(insets.bottom, 12) + TAB_BAR_RESERVE;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [itineraries, setItineraries] = useState<ItineraryCard[]>(SAMPLE_ITINERARIES);
  const [loading, setLoading] = useState(true);
  const [startingManual, setStartingManual] = useState(false);

  useEffect(() => subscribeUnreadBadge(setUnreadNotifications), []);

  const switchableModes = useMemo(
    () => getSwitchableModes(user, currentVendor?.verificationStatus),
    [user, currentVendor?.verificationStatus],
  );

  const loadTrips = useCallback(async () => {
    setLoading(true);
    if (isGuest || !DEV_FLAGS.USE_SERVER_API) {
      setItineraries(SAMPLE_ITINERARIES);
      setLoading(false);
      return;
    }
    try {
      const aiList = await tripsApi.list({ limit: 12 });
      const cards = (aiList.data || []).slice(0, 8).map(tripToCard);
      setItineraries(cards.length ? cards : SAMPLE_ITINERARIES);
    } catch (err) {
      console.warn('[ItineraryHub] Failed to load trips:', err);
      setItineraries(SAMPLE_ITINERARIES);
    } finally {
      setLoading(false);
    }
  }, [isGuest]);

  useFocusEffect(
    useCallback(() => {
      loadTrips();
      if (isGuest || !DEV_FLAGS.USE_SERVER_API) return;
      void refreshUnreadBadgeCount();
    }, [loadTrips, isGuest]),
  );

  const openTrip = (item: ItineraryCard) => {
    if (item.trip) {
      if (item.trip.status === 'DRAFT') {
        navigation.navigate('TripBuilder');
      } else {
        navigation.navigate('TripDetail', { tripId: item.trip.id });
      }
      return;
    }
    if (item.id.startsWith('sample-')) {
      Alert.alert(
        'Sample itinerary',
        'Sign in and create your own trip, or use AI Planner to generate one.',
      );
      return;
    }
    navigation.navigate('MyTrips');
  };

  const handleOpenAiPlanner = useCallback(() => {
    if (isGuest) {
      Alert.alert('Sign In Required', 'Sign in to use AI Trip Planner.');
      return;
    }
    navigation.navigate('AITripPlanner');
  }, [isGuest, navigation]);

  const handleBuildManual = useCallback(async () => {
    if (isGuest) {
      Alert.alert('Sign In Required', 'Sign in to build and save your own itinerary.');
      return;
    }
    if (!DEV_FLAGS.USE_SERVER_API) {
      navigation.navigate('TripBuilder');
      return;
    }
    setStartingManual(true);
    try {
      const trip = await ensureManualDraftTrip();
      if (countTripStops(trip) > 0) {
        navigation.navigate('TripBuilder');
      } else {
        navigation.navigate('MainTabs', { screen: 'Map' });
      }
    } catch (err: any) {
      Alert.alert(
        'Could not start itinerary',
        err?.message || 'Please check your connection and try again.',
      );
    } finally {
      setStartingManual(false);
    }
  }, [isGuest, navigation]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        <View style={styles.heroWrap}>
          <Image source={HERO} style={styles.heroImage} resizeMode="cover" />
          <View style={[styles.heroBar, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => setSidebarOpen(true)}>
              <Icon name="menu" size={24} color={C.ink} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.navigate('Notifications')}>
              <Icon name="notifications-outline" size={24} color={C.ink} />
              {unreadNotifications > 0 && <View style={styles.notifDot} />}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.pageTitle}>My Trips</Text>
          <Text style={styles.pageSubtitle}>Plan it your way, travel your style.</Text>

          <View style={styles.plannerRow}>
            <PlannerCard
              variant="ai"
              width={plannerW}
              onPress={handleOpenAiPlanner}
            />
            <PlannerCard
              variant="manual"
              width={plannerW}
              loading={startingManual}
              onPress={handleBuildManual}
            />
          </View>

          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Your Itineraries</Text>
            <TouchableOpacity style={styles.viewAllBtn} onPress={() => navigation.navigate('MyTrips')}>
              <Text style={styles.viewAllText}>View all</Text>
              <Icon name="chevron-forward" size={16} color={C.gold} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={C.gold} />
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tripList}
            >
              {itineraries.map((item, i) => (
                <React.Fragment key={item.id}>
                  {i > 0 ? <View style={{ width: 14 }} /> : null}
                  <ItineraryTripCard item={item} width={tripCardW} onPress={() => openTrip(item)} />
                </React.Fragment>
              ))}
            </ScrollView>
          )}

        </View>
      </ScrollView>

      <HomeSidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user as any}
        palPoints={user?.totalPoints ?? 0}
        activeMode={user?.activeMode || 'USER'}
        switchableModes={switchableModes}
        onSwitchMode={setActiveMode}
        onNavigateToWallet={() => navigation.navigate('Wallet')}
        onNavigateToRewards={() => navigation.navigate('Rewards')}
        onNavigateToLeaderboard={() => navigation.navigate('Leaderboard')}
        onNavigateToTreasureHunt={() => navigation.navigate('TreasureHunt')}
        onNavigateToQuest={() => navigation.navigate('Quest')}
        onBecomeCreator={() => navigation.navigate('MainTabs', { screen: 'Profile' })}
        onBecomeVendor={() => navigation.navigate('VendorRegister')}
        onOpenCreatorStudio={() => setActiveMode('CONTENT_CREATOR')}
        onOpenVendorWorkspace={() => setActiveMode('VENDOR')}
        onNavigateToSettings={() => navigation.navigate('Settings')}
        onNavigateToNotifications={() => navigation.navigate('Notifications')}
        onNavigateToLegal={() => navigation.navigate('LegalHub')}
        onLogout={onLogout}
        isGuest={isGuest}
        vendorVerificationStatus={currentVendor?.verificationStatus}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  heroWrap: {
    height: 200,
    overflow: 'hidden',
    backgroundColor: '#E8DDD0',
  },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
    zIndex: 2,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
  },
  body: {
    paddingHorizontal: H_PAD,
    paddingTop: 18,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: C.ink,
    fontFamily: SERIF,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: C.textSub,
    marginTop: 4,
    marginBottom: 20,
  },
  plannerRow: {
    flexDirection: 'row',
    gap: CARD_GAP,
    marginBottom: 26,
  },
  plannerCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 248,
  },
  plannerGrad: {
    flex: 1,
    padding: 14,
  },
  plannerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  plannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  plannerDesc: {
    fontSize: 11,
    lineHeight: 15,
    color: C.textSub,
    fontWeight: '500',
    minHeight: 42,
  },
  plannerArtWrap: {
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  plannerArt: { width: '100%', height: '100%' },
  plannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 22,
    marginTop: 'auto',
  },
  plannerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.ink,
    fontFamily: SERIF,
  },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontSize: 13, fontWeight: '700', color: C.gold },
  loadingWrap: { height: 200, alignItems: 'center', justifyContent: 'center' },
  tripList: { paddingRight: H_PAD, paddingBottom: 4 },
  tripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  tripImageWrap: {
    height: 140,
    position: 'relative',
  },
  tripImage: { width: '100%', height: '100%' },
  tripStatusBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tripStatusText: { fontSize: 11, fontWeight: '700' },
  tripHeart: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripBody: {
    padding: 14,
    paddingRight: 44,
    gap: 6,
    position: 'relative',
  },
  tripTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: C.ink,
    fontFamily: SERIF,
  },
  tripMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tripMetaText: { fontSize: 12, fontWeight: '500', color: C.textSub },
  tripDateText: { fontSize: 12, fontWeight: '600', flex: 1 },
  tripMenuBtn: {
    position: 'absolute',
    right: 10,
    bottom: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F5EFE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
