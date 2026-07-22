import React, { useCallback, useState, useEffect, useRef } from 'react';
import { StyleSheet, Platform, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MAIN_TAB_BAR_HEIGHT,
  MAIN_TAB_FAB_OVERHANG,
  MAIN_TAB_BAR_BOTTOM_GAP,
} from '../design/tabBarLayout';
import { MIN_TOUCH } from '../design/responsive';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MainTabParamList, RootStackParamList } from './types';
import { useUserContext } from '../context/UserContext';
import { useLocationContext } from '../context/LocationContext';
import { useDataContext } from '../context/DataContext';
import { getPlaces, getNearbyPlaces } from '../services/placesService';
import type { TouristSpot } from '../types';
import { useLazyScreen } from '../utils/useLazyScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
type RootNav = NativeStackNavigationProp<RootStackParamList>;
type TabName = 'Home' | 'Explore' | 'Map' | 'Itinerary' | 'Profile';

const TAB_ICONS: Record<TabName, { active: string; inactive: string; label: string }> = {
  Home:      { active: 'home',      inactive: 'home-outline',      label: 'Home' },
  Explore:   { active: 'play-circle', inactive: 'play-circle-outline', label: 'Reels' },
  Map:       { active: 'map',       inactive: 'map-outline',       label: 'Map' },
  Itinerary: { active: 'briefcase', inactive: 'briefcase-outline', label: 'Trips' },
  Profile:   { active: 'person',    inactive: 'person-outline',    label: 'Profile' },
};

function HomeTabWrapper({ places, loading, error, onRefresh }: { places: TouristSpot[]; loading: boolean; error: string | null; onRefresh: () => void }) {
  const { user, isGuest, setUser, setActiveMode, onLogout } = useUserContext();
  const { effectivePosition } = useLocationContext();
  const navigation = useNavigation<RootNav>();

  const HomeScreenComponent = useLazyScreen(() => require('../screens/HomeScreen'));

  const handleSelectSpot = useCallback((spot: { id: string }) => {
    navigation.navigate('MainTabs', {
      screen: 'Map',
      params: { selectedPlaceId: spot.id, selectedPlaceKey: Date.now() },
    });
  }, [navigation]);

  const handleStartTrip = useCallback(async () => {
    try {
      const { resolveTripResume } = require('../utils/resumeTrip') as typeof import('../utils/resumeTrip');
      const target = await resolveTripResume({ isGuest });
      if (target.kind === 'tripDetail') {
        navigation.navigate('TripDetail', { tripId: target.tripId });
        return;
      }
      if (target.kind === 'tripBuilder') {
        navigation.navigate('TripBuilder');
        return;
      }
    } catch (err) {
      console.warn('[MainTabs] resume trip failed:', err);
    }
    navigation.navigate('MainTabs', { screen: 'Itinerary' });
  }, [navigation, isGuest]);

  // Keep local currentItinerary aligned with the server draft/active trip
  useEffect(() => {
    if (isGuest || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const { getActiveItineraryPlaceIds } = require('../utils/resumeTrip') as typeof import('../utils/resumeTrip');
        const ids = await getActiveItineraryPlaceIds();
        if (cancelled || !ids.length) return;
        setUser(prev => {
          const prevIds = prev.currentItinerary || [];
          if (prevIds.length === ids.length && prevIds.every((id, i) => id === ids[i])) return prev;
          return { ...prev, currentItinerary: ids };
        });
      } catch {
        // non-blocking sync
      }
    })();
    return () => { cancelled = true; };
  }, [isGuest, user?.uid, setUser]);

  return (
    <HomeScreenComponent
      user={user}
      position={effectivePosition}
      places={places}
      loading={loading}
      error={error}
      onRefresh={onRefresh}
      onStartTrip={handleStartTrip}
      onSelectSpot={handleSelectSpot}
      onNavigateToSearch={(query?: string) =>
        navigation.navigate('Search', query ? { initialQuery: query } : undefined)
      }
      onNavigateToMap={() => navigation.navigate('MainTabs', { screen: 'Map' })}
      onNavigateToProfile={() => navigation.navigate('MainTabs', { screen: 'Profile' })}
      onNavigateToLeaderboard={() => navigation.navigate('Leaderboard')}
      onNavigateToRewards={() => navigation.navigate('Rewards')}
      onNavigateToWallet={() => navigation.navigate('Wallet')}
      onNavigateToQuest={() => navigation.navigate('Quest')}
      onNavigateToNotifications={() => navigation.navigate('Notifications')}
      onNavigateToAITripPlanner={() => navigation.navigate('AITripPlanner')}
      onNavigateToHiddenGems={() => navigation.navigate('AddHiddenGem')}
      onNavigateToVendors={() =>
        navigation.navigate('MainTabs', {
          screen: 'Map',
          params: { initialMapTab: 'vendors', mapTabKey: Date.now() },
        })
      }
      onNavigateToTrips={() => navigation.navigate('MainTabs', { screen: 'Itinerary' })}
      onNavigateToTreasureHunt={() => navigation.navigate('TreasureHunt')}
      onNavigateToSettings={() => navigation.navigate('Settings')}
      onNavigateToLegal={() => navigation.navigate('LegalHub')}
      onBecomeCreator={() => navigation.navigate('MainTabs', { screen: 'Profile' })}
      onBecomeVendor={() => navigation.navigate('VendorRegister')}
      onOpenCreatorStudio={() => setActiveMode('CONTENT_CREATOR')}
      onOpenVendorWorkspace={() => setActiveMode('VENDOR')}
      onSwitchMode={setActiveMode}
      onLogout={onLogout}
    />
  );
}

function ExploreTabWrapper({ mineOnly = false }: { mineOnly?: boolean }) {
  // Creator mode: only this creator's uploads — never the global community feed.
  if (mineOnly) {
    const CreatorReelsScreenComponent = useLazyScreen(() => require('../screens/CreatorReelsScreen'));
    return <CreatorReelsScreenComponent />;
  }
  const ReelsFeedScreenComponent = useLazyScreen(() => require('../screens/ReelsFeedScreen'));
  return <ReelsFeedScreenComponent />;
}

function MapTabWrapper({
  places,
  error,
  onRefresh,
  selectedPlaceId,
  selectedPlaceKey,
  initialMapTab,
  mapTabKey,
}: {
  places: TouristSpot[];
  error: string | null;
  onRefresh: () => void;
  selectedPlaceId?: string;
  selectedPlaceKey?: number;
  initialMapTab?: 'places' | 'vendors';
  mapTabKey?: number;
}) {
  const { user } = useUserContext();
  const { vendors } = useDataContext();
  const navigation = useNavigation<RootNav>();

  const MapScreenComponent = useLazyScreen(() => require('../screens/MapScreen'));

  const handleSelectSpot = useCallback((spot: { id: string }) => {
    navigation.navigate('SpotDetail', { spotId: spot.id });
  }, [navigation]);

  const handleSelectVendor = useCallback((vendorId: string) => {
    navigation.navigate('VendorProfile', { vendorId });
  }, [navigation]);

  const handleViewVendorContent = useCallback((vendorId: string, vendorName: string, tab: 'offers' | 'reels' = 'offers') => {
    if (tab === 'reels') {
      navigation.navigate('VendorReels', { vendorId, vendorName });
      return;
    }
    navigation.navigate('VendorProfile', { vendorId, initialTab: 'offers' });
  }, [navigation]);

  const handleNavigateToTripBuilder = useCallback(() => {
    navigation.navigate('TripBuilder');
  }, [navigation]);

  const handleViewItinerary = useCallback((_placeId?: string) => {
    navigation.navigate('TripBuilder');
  }, [navigation]);

  return (
    <MapScreenComponent
      places={places}
      vendors={vendors}
      user={user}
      error={error}
      onRetry={onRefresh}
      onSelectSpot={handleSelectSpot}
      onSelectVendor={handleSelectVendor}
      onViewVendorContent={handleViewVendorContent}
      onNavigateToMap={() => navigation.navigate('MainTabs', { screen: 'Map' })}
      onNavigateToTripBuilder={handleNavigateToTripBuilder}
      onViewItinerary={handleViewItinerary}
      selectedPlaceId={selectedPlaceId}
      selectedPlaceKey={selectedPlaceKey}
      initialMapTab={initialMapTab}
      mapTabKey={mapTabKey}
    />
  );
}

function ItineraryTabWrapper() {
  const ScreenComponent = useLazyScreen(() => require('../screens/ItineraryHubScreen'));
  return <ScreenComponent />;
}

function ProfileTabWrapper({ places }: { places: TouristSpot[] }) {
  const { user, isGuest, onLogout, setActiveMode } = useUserContext();
  const { vendors, vendorOffers, hiddenGemSubmissions } = useDataContext();
  const navigation = useNavigation<RootNav>();
  const ProfileScreenComponent = useLazyScreen(() => require('../screens/ProfileScreen'));
  
  if (!user) return null;

  return (
    <ProfileScreenComponent 
      user={user} 
      isGuest={isGuest} 
      onLogout={onLogout} 
      places={places} 
      vendors={vendors} 
      vendorOffers={vendorOffers}
      hiddenGemSubmissions={hiddenGemSubmissions}
      onSettingsPress={() => navigation.navigate('Settings')}
      onPremiumPress={() => navigation.navigate('PremiumUpgrade')}
      onNavigateToWallet={() => navigation.navigate('Wallet')}
      onNavigateToRewards={() => navigation.navigate('Rewards')}
      onRewardsWallet={() => navigation.navigate('RewardsWallet')}
      onMyContributions={() => navigation.navigate('MyContributions')}
      onAdminVerification={() => navigation.navigate('AdminVendorVerification')}
      onAdminHiddenGemReview={() => navigation.navigate('AdminHiddenGemReview')}
      onAdminPlacesReview={() => navigation.navigate('AdminPlacesReview')}
      onNavigateToLeaderboard={() => navigation.navigate('Leaderboard')}
      onNavigateToCreateReel={() => navigation.navigate('CreateReel')}
      onOpenCredits={() => navigation.navigate('Credits')}
      onSelectSpot={(spot: any) => navigation.navigate('SpotDetail', { spotId: spot.id })}
      onNavigateToHome={() => navigation.navigate('MainTabs', { screen: 'Home' })}
      onNavigateToMap={() => navigation.navigate('MainTabs', { screen: 'Map' })}
      onSubmitHiddenGem={() => navigation.navigate('AddHiddenGem')}
      onRegisterVendor={() => navigation.navigate('VendorRegister')}
      onSwitchRole={setActiveMode}
      onBack={() => navigation.goBack()}
    />
  );
}

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, MAIN_TAB_BAR_BOTTOM_GAP);

  return (
    <View style={[styles.customTabBar, { bottom, height: MAIN_TAB_BAR_HEIGHT }]}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const name = route.name as TabName;
        
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const config = TAB_ICONS[name] || { active: 'help-circle', inactive: 'help-circle-outline', label: name };
        const iconName = isFocused ? config.active : config.inactive;
        const color = isFocused ? '#B9834B' : '#8B7355';

        if (name === 'Map') {
          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={styles.centerButtonWrap}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Map"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={[styles.centerButton, { top: -MAIN_TAB_FAB_OVERHANG }]}>
                <Icon name="map" size={26} color="#FFF9F2" />
              </View>
              <Text style={styles.centerLabel}>Map</Text>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={styles.tabItem}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={config.label}
            accessibilityState={{ selected: isFocused }}
          >
            <View style={styles.tabContentInner}>
              <Icon name={iconName} size={22} color={color} />
              <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
                {config.label}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function MainTabs() {
  const { requestPermission, effectivePosition, hasPermission } = useLocationContext();
  const [places, setPlaces] = useState<TouristSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchGenRef = useRef(0);

  const lat = effectivePosition?.latitude != null
    ? Math.round(effectivePosition.latitude * 100) / 100
    : null;
  const lng = effectivePosition?.longitude != null
    ? Math.round(effectivePosition.longitude * 100) / 100
    : null;

  const fetchPlaces = useCallback(() => {
    const gen = ++fetchGenRef.current;
    setLoading(true);
    setError(null);

    const finish = (data: TouristSpot[]) => {
      if (fetchGenRef.current !== gen) return;
      setPlaces(data);
      setLoading(false);
    };

    const fail = (err: any) => {
      if (fetchGenRef.current !== gen) return;
      setError(err?.message || 'Failed to load places');
      setLoading(false);
    };

    if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
      // 100km radius so sparse cities still get results; sorted by distance on server
      getNearbyPlaces(lat, lng, 100000)
        .then(async (nearby) => {
          if (fetchGenRef.current !== gen) return;
          if (nearby.length > 0) {
            finish(nearby);
            return;
          }
          // Empty nearby: sort global list by distance and keep only within ~150km
          try {
            const all = await getPlaces();
            if (fetchGenRef.current !== gen) return;
            const withDist = all
              .filter(p => p.latitude && p.longitude)
              .map(p => {
                const R = 6371;
                const dLat = (p.latitude! - lat) * Math.PI / 180;
                const dLon = (p.longitude! - lng) * Math.PI / 180;
                const a =
                  Math.sin(dLat / 2) ** 2 +
                  Math.cos(lat * Math.PI / 180) * Math.cos(p.latitude! * Math.PI / 180) *
                  Math.sin(dLon / 2) ** 2;
                const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                return { p, km };
              })
              .filter(x => x.km <= 150)
              .sort((a, b) => a.km - b.km)
              .map(x => x.p);
            finish(withDist);
          } catch (e) {
            fail(e);
          }
        })
        .catch(fail);
      return () => { fetchGenRef.current += 1; };
    }

    // No GPS yet — do not load a random global/Jabalpur-biased list for Home
    finish([]);
    return () => { fetchGenRef.current += 1; };
  }, [lat, lng]);

  // Ask for location once Home is on-screen, not during early boot
  useEffect(() => {
    const t = setTimeout(() => {
      requestPermission().catch(() => {});
    }, 700);
    return () => clearTimeout(t);
  }, [requestPermission]);

  // Refetch when GPS arrives / moves meaningfully
  useEffect(() => {
    const cleanup = fetchPlaces();
    return cleanup;
  }, [fetchPlaces, hasPermission]);

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home">
        {() => <HomeTabWrapper places={places} loading={loading} error={error} onRefresh={fetchPlaces} />}
      </Tab.Screen>
      <Tab.Screen name="Explore">
        {() => <ExploreTabWrapper mineOnly={false} />}
      </Tab.Screen>
      <Tab.Screen name="Map">
        {({ route }) => (
          <MapTabWrapper
            places={places}
            error={error}
            onRefresh={fetchPlaces}
            selectedPlaceId={route.params?.selectedPlaceId}
            selectedPlaceKey={route.params?.selectedPlaceKey}
            initialMapTab={route.params?.initialMapTab}
            mapTabKey={route.params?.mapTabKey}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Itinerary">
        {() => <ItineraryTabWrapper />}
      </Tab.Screen>
      <Tab.Screen name="Profile">
        {() => <ProfileTabWrapper places={places} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  customTabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    height: MAIN_TAB_BAR_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(200, 155, 60, 0.15)',
    shadowColor: 'rgba(30, 16, 8, 0.12)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: MIN_TOUCH,
  },
  tabContentInner: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
  },
  centerButtonWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    height: '100%',
    paddingTop: 0,
    minHeight: MIN_TOUCH,
  },
  centerButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#63300E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#63300E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  centerLabel: {
    marginTop: -10,
    fontSize: 10,
    fontWeight: '600',
    color: '#8B7355',
    textAlign: 'center',
  },
});
