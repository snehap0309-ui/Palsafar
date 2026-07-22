import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar,
  Image, RefreshControl, Animated, FlatList, ActivityIndicator,
  Platform, NativeSyntheticEvent, NativeScrollEvent, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { TouristSpot, UserPosition, UserActiveMode } from '../types';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { isCommercialPlaceCategory } from '../utils/mapMarkerUtils';
import { resolveTripResume, TripResumeTarget } from '../utils/resumeTrip';
import { useUserContext } from '../context/UserContext';
import { useDataContext } from '../context/DataContext';
import { getSwitchableModes } from '../utils/workspaceRoles';
import { DEV_FLAGS } from '../config/devFlags';
import { JABALPUR_MAP_PLACES } from '../data/jabalpurMapPlaces';
import HomeSidebar from '../components/HomeSidebar';
import { loadWishlistIds, toggleWishlistId } from '../utils/homeWishlist';
import { subscribeUnreadBadge } from '../services/notifications/notificationBadgeStore';
import { refreshUnreadBadgeCount } from '../services/notificationService';

import { getMainTabBarClearance } from '../design/tabBarLayout';
import { useResponsive } from '../design/responsive';

const LOGO = require('../../assets/logo.png');
/** Cap content width so phone/tablet layouts match (centered on wide screens). */
const MAX_HOME_CONTENT_W = 560;
const H_PAD = 20;
const CAT_COLS = 6;
const CAT_GAP = 8;

const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

const C = {
  bg: '#FFF9F2',
  surface: '#FBEFE2',
  surfaceAlt: '#F5E6D0',
  gold: '#B9834B',
  goldLight: '#D4A87A',
  ink: '#63300E',
  navy: '#1E2A3A',
  text: '#2C1810',
  textSub: '#8B7355',
  textMuted: '#B8A88A',
  border: 'rgba(200, 155, 60, 0.18)',
  borderSoft: 'rgba(200, 155, 60, 0.1)',
};

const CITY_TAGLINES: Record<string, string> = {
  jabalpur: 'The City of Marble Rocks',
  bhedaghat: 'Marble Gorge on the Narmada',
  nearby: 'Discover wonders around you',
};

const CATEGORIES = [
  { id: 'adventure', name: 'Adventure', query: 'Adventure', icon: 'hiking', lib: 'mci' as const },
  { id: 'heritage', name: 'Heritage', query: 'Heritage', icon: 'bank-outline', lib: 'mci' as const },
  { id: 'nature', name: 'Nature', query: 'Nature', icon: 'leaf-outline', lib: 'ion' as const },
  { id: 'culture', name: 'Culture', query: 'Culture', icon: 'color-palette-outline', lib: 'ion' as const },
  { id: 'food', name: 'Food', query: 'Food', icon: 'restaurant-outline', lib: 'ion' as const },
  { id: 'stay', name: 'Stay', query: 'Hotel', icon: 'bed-outline', lib: 'ion' as const },
];

const DEFAULT_HERO_IMAGE =
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80';

const QUICK_ACTIONS = [
  { id: 'ai', title: 'AI Trip Planner', subtitle: 'Plan smart trips', icon: 'sparkles', action: 'ai' as const },
  { id: 'gems', title: 'Hidden Gems', subtitle: 'Explore offbeat places', icon: 'diamond-stone', lib: 'mci' as const, action: 'gems' as const },
  { id: 'vendors', title: 'Local Vendors', subtitle: 'Support local business', icon: 'storefront-outline', action: 'vendors' as const },
];

type HeroSlide = {
  id: string;
  title: string;
  tagline: string;
  description: string;
  image: string;
  spotId?: string;
  isCity?: boolean;
};

function heroTitleFontSize(title: string): number {
  const len = title.length;
  if (len > 28) return 20;
  if (len > 22) return 22;
  if (len > 16) return 24;
  return 28;
}

function heroPlaceTagline(spot: TouristSpot): string {
  const cat = categorySubtitle(spot);
  const nameLower = spot.name.toLowerCase();
  const catLower = cat.toLowerCase();

  if (nameLower.includes(catLower)) {
    const nearMatch = spot.shortDescription?.match(/near\s+([^.,]+)/i);
    if (nearMatch) return `Near ${nearMatch[1].trim()}`;

    const clause = spot.shortDescription?.split(/[.,]/)[0]?.trim();
    if (clause && clause.length <= 44 && clause.toLowerCase() !== nameLower) {
      return clause;
    }
    if (spot.city) return `${spot.city} Landmark`;
    return 'Must-visit destination';
  }
  return cat;
}

function weatherIconName(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('rain') || l.includes('shower')) return 'rainy-outline';
  if (l.includes('snow')) return 'snow-outline';
  if (l.includes('fog')) return 'cloud-outline';
  if (l.includes('cloud')) return 'partly-sunny-outline';
  return 'sunny-outline';
}

function HeroCardImage({ uri, fallbackUri }: { uri: string; fallbackUri: string }) {
  const [failed, setFailed] = useState(false);
  const source = failed || !uri ? fallbackUri : uri;
  return (
    <Image
      source={{ uri: source }}
      style={styles.heroImage}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

interface HomeScreenProps {
  user: {
    displayName: string;
    totalPoints?: number;
    avatarStyle?: number;
    avatar?: string | null;
    currentItinerary?: string[];
    completedItineraryStops?: string[];
    roles?: string[];
    permission?: string;
    creatorProfile?: { status?: string };
  };
  position: UserPosition | null;
  places: TouristSpot[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onStartTrip: () => void;
  onSelectSpot: (spot: { id: string }) => void;
  onNavigateToMap?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToLeaderboard?: () => void;
  onNavigateToRewards?: () => void;
  onNavigateToWallet?: () => void;
  onNavigateToQuest?: () => void;
  onNavigateToSearch?: (query?: string) => void;
  onNavigateToNotifications?: () => void;
  onNavigateToAITripPlanner?: () => void;
  onNavigateToHiddenGems?: () => void;
  onNavigateToVendors?: () => void;
  onNavigateToTrips?: () => void;
  onNavigateToTreasureHunt?: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToLegal?: () => void;
  onBecomeCreator?: () => void;
  onBecomeVendor?: () => void;
  onOpenCreatorStudio?: () => void;
  onOpenVendorWorkspace?: () => void;
  onLogout?: () => void;
  onSwitchMode?: (mode: UserActiveMode) => Promise<void>;
}

const formatTimeBasedGreeting = (): string => {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good Morning';
  if (h >= 12 && h < 17) return 'Good Afternoon';
  if (h >= 17 && h < 21) return 'Good Evening';
  return 'Good Night';
};

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (km: number) =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${Math.round(km)} km`;

function weatherLabel(code: number): string {
  if (code === 0) return 'Sunny';
  if (code <= 3) return 'Partly Cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 67) return 'Rainy';
  if (code <= 77) return 'Snowy';
  if (code <= 82) return 'Showers';
  return 'Cloudy';
}

async function fetchWeather(lat: number, lon: number): Promise<{ temp: number; label: string } | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      '&current=temperature_2m,weather_code&timezone=auto';
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const temp = Math.round(data?.current?.temperature_2m ?? 0);
    const code = data?.current?.weather_code ?? 0;
    return { temp, label: weatherLabel(code) };
  } catch {
    return null;
  }
}

function categorySubtitle(spot: TouristSpot): string {
  const raw = (spot.category || spot.tags?.[0] || 'Place').toString();
  return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function cityTagline(city: string): string {
  const key = city.toLowerCase().replace(/\s+/g, '');
  return CITY_TAGLINES[key] || CITY_TAGLINES.nearby;
}

function normalizeCity(s: string) {
  return s.trim().toLowerCase();
}

function placeMatchesCity(place: TouristSpot, city: string): boolean {
  const c = normalizeCity(city);
  if (!c || c === 'nearby' || c === '…') return false;
  return normalizeCity(place.city) === c ||
    normalizeCity(place.city).includes(c) ||
    c.includes(normalizeCity(place.city));
}

function formatReviewCount(count?: number): string {
  if (!count) return '';
  if (count >= 1000) return `(${(count / 1000).toFixed(1)}k)`;
  return `(${count})`;
}

function CategoryTile({
  item,
  onPress,
  style,
}: {
  item: typeof CATEGORIES[0];
  onPress: () => void;
  style?: object;
}) {
  const IconComp = item.lib === 'mci' ? MaterialCommunityIcons : Icon;
  return (
    <TouchableOpacity style={[styles.catTile, style]} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.catIconWrap}>
        <IconComp name={item.icon as any} size={18} color={C.gold} />
      </View>
      <Text style={styles.catTileLabel} numberOfLines={1}>{item.name}</Text>
    </TouchableOpacity>
  );
}

function TopPickCard({
  name,
  distance,
  subtitle,
  rating,
  reviewCount,
  image,
  wishlisted,
  onPress,
  onToggleWishlist,
  cardWidth,
}: {
  name: string;
  distance: string;
  subtitle?: string;
  rating?: number;
  reviewCount?: number;
  image?: string | null;
  wishlisted: boolean;
  onPress: () => void;
  onToggleWishlist: () => void;
  cardWidth: number;
}) {
  return (
    <TouchableOpacity style={[styles.placeCard, { width: cardWidth }]} activeOpacity={0.88} onPress={onPress}>
      <View style={[styles.placeImageWrap, { height: cardWidth * 0.72 }]}>
        {image ? (
          <Image source={{ uri: image }} style={styles.placeImage} resizeMode="cover" />
        ) : (
          <LinearGradient colors={['rgba(185,131,75,0.25)', 'rgba(99,48,14,0.65)']} style={styles.placeImageFallback}>
            <Icon name="image-outline" size={28} color={C.goldLight} />
          </LinearGradient>
        )}
        <TouchableOpacity
          style={styles.heartBtn}
          onPress={onToggleWishlist}
          hitSlop={8}
        >
          <Icon name={wishlisted ? 'heart' : 'heart-outline'} size={18} color={wishlisted ? '#EF4444' : '#63300E'} />
        </TouchableOpacity>
      </View>
      <View style={styles.placeInfo}>
        <Text style={styles.placeName} numberOfLines={1}>{name}</Text>
        {!!subtitle && <Text style={styles.placeSub} numberOfLines={1}>{subtitle}</Text>}
        <View style={styles.placeStatsRow}>
          {rating != null && rating > 0 && (
            <View style={styles.ratingPill}>
              <Icon name="star" size={12} color={C.gold} />
              <Text style={styles.ratingText}>
                {rating.toFixed(1)} {formatReviewCount(reviewCount)}
              </Text>
            </View>
          )}
          <View style={styles.distPill}>
            <Icon name="location-outline" size={11} color={C.textSub} />
            <Text style={styles.placeDist}>{distance}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function QuickActionCard({
  title,
  subtitle,
  icon,
  lib,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: string;
  lib?: 'mci';
  onPress: () => void;
}) {
  const IconComp = lib === 'mci' ? MaterialCommunityIcons : Icon;
  return (
    <TouchableOpacity style={styles.quickCard} activeOpacity={0.88} onPress={onPress}>
      <View style={styles.quickIconWrap}>
        <IconComp name={icon as any} size={18} color={C.gold} />
      </View>
      <View style={styles.quickBody}>
        <Text style={styles.quickTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.quickSub} numberOfLines={2}>{subtitle}</Text>
      </View>
      <View style={styles.quickArrow}>
        <Icon name="arrow-forward" size={13} color="#FFF9F2" />
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen({
  user,
  position,
  places,
  loading = false,
  error = null,
  onRefresh,
  onStartTrip,
  onSelectSpot,
  onNavigateToMap,
  onNavigateToProfile,
  onNavigateToLeaderboard,
  onNavigateToRewards,
  onNavigateToWallet,
  onNavigateToQuest,
  onNavigateToSearch,
  onNavigateToNotifications,
  onNavigateToAITripPlanner,
  onNavigateToHiddenGems,
  onNavigateToVendors,
  onNavigateToTrips,
  onNavigateToTreasureHunt,
  onNavigateToSettings,
  onNavigateToLegal,
  onBecomeCreator,
  onBecomeVendor,
  onOpenCreatorStudio,
  onOpenVendorWorkspace,
  onLogout,
  onSwitchMode,
}: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { width: windowW } = useWindowDimensions();
  const responsive = useResponsive();
  const layout = useMemo(() => {
    const maxW = responsive.isTablet ? MAX_HOME_CONTENT_W : 440;
    const layoutW = Math.min(windowW, maxW);
    const heroW = layoutW - H_PAD * 2;
    const catCols = responsive.isSmallPhone ? 4 : CAT_COLS;
    return {
      layoutW,
      heroW,
      heroH: heroW * 0.68,
      placeCardW: layoutW * (responsive.isSmallPhone ? 0.72 : 0.44),
      catCols,
      catW: (layoutW - H_PAD * 2 - CAT_GAP * (catCols - 1)) / catCols,
    };
  }, [windowW, responsive.isTablet, responsive.isSmallPhone]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const heroListRef = useRef<FlatList>(null);
  const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { isGuest, user: ctxUser } = useUserContext();
  const { currentVendor } = useDataContext();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [cityName, setCityName] = useState<string>('Nearby');
  const [locating, setLocating] = useState(true);
  const [resumeTarget, setResumeTarget] = useState<TripResumeTarget | null>(null);
  const [palPoints, setPalPoints] = useState(Number(user?.totalPoints) || 0);
  const [heroIndex, setHeroIndex] = useState(0);
  const [weather, setWeather] = useState<{ temp: number; label: string } | null>(null);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => subscribeUnreadBadge(setUnreadNotifications), []);

  const allPlaces = useMemo(() => {
    const merged = [...places];
    const ids = new Set(merged.map(p => p.id));
    for (const p of JABALPUR_MAP_PLACES) {
      if (!ids.has(p.id)) merged.push(p);
    }
    return merged;
  }, [places]);

  useFocusEffect(
    useCallback(() => {
      setPalPoints(Number(user?.totalPoints) || 0);
      loadWishlistIds().then(setWishlistIds);

      if (isGuest || !DEV_FLAGS.USE_SERVER_API) return;
      let cancelled = false;
      (async () => {
        try {
          const { walletApi } = require('../services/api') as typeof import('../services/api');
          const res = await walletApi.getProfile();
          const profile: any = res?.data ?? res;
          const pts = Number(profile?.palPoints ?? profile?.pointBalance ?? user?.totalPoints ?? 0);
          if (!cancelled && !Number.isNaN(pts)) setPalPoints(pts);
        } catch { /* keep fallback */ }

        try {
          await refreshUnreadBadgeCount();
        } catch { /* offline */ }
      })();
      return () => { cancelled = true; };
    }, [isGuest, user?.totalPoints]),
  );

  const openRewards = onNavigateToRewards || onNavigateToLeaderboard;
  const openWallet = onNavigateToWallet || onNavigateToLeaderboard;

  useEffect(() => {
    if (position?.latitude && position?.longitude) {
      const coords = `${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}`;
      setLocationLabel(coords);
      let cancelled = false;

      fetchWeather(position.latitude, position.longitude).then(w => {
        if (!cancelled && w) setWeather(w);
      });

      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position.latitude}&lon=${position.longitude}&zoom=10&addressdetails=1`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'PalSafar-Mobile/1.0' } },
      )
        .then(r => { if (!r.ok) throw new Error('Geocode failed'); return r.json(); })
        .then(data => {
          if (cancelled) return;
          const addr = data.address || {};
          const city = addr.city || addr.town || addr.village || addr.county || addr.state_district || '';
          const state = addr.state || '';
          setCityName(city || 'Nearby');
          setLocationLabel(city ? (state ? `${city}, ${state}` : city) : coords);
          setLocating(false);
        })
        .catch(() => {
          if (cancelled) return;
          const nearest = [...allPlaces]
            .filter(p => p.latitude && p.longitude)
            .sort((a, b) =>
              haversineKm(position.latitude, position.longitude, a.latitude!, a.longitude!) -
              haversineKm(position.latitude, position.longitude, b.latitude!, b.longitude!),
            )[0];
          if (nearest?.city) {
            setCityName(nearest.city);
            setLocationLabel(nearest.state ? `${nearest.city}, ${nearest.state}` : nearest.city);
          } else {
            setCityName('Nearby');
            setLocationLabel(coords);
          }
          setLocating(false);
        });
      return () => { cancelled = true; };
    }

    setLocationLabel(null);
    setCityName('Nearby');
    setWeather(null);
    const timeout = setTimeout(() => { if (!position) setLocating(false); }, 4000);
    return () => clearTimeout(timeout);
  }, [position, allPlaces]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const loadResume = useCallback(async () => {
    if (isGuest || !DEV_FLAGS.USE_SERVER_API) {
      setResumeTarget(null);
      return;
    }
    try {
      const target = await resolveTripResume({ isGuest });
      setResumeTarget(target.kind === 'hub' && target.stopCount === 0 ? null : target);
    } catch {
      setResumeTarget(null);
    }
  }, [isGuest]);

  useFocusEffect(useCallback(() => { loadResume(); }, [loadResume]));

  const cityPlaces = useMemo(() => {
    const city = cityName;
    const inCity = allPlaces.filter(p =>
      placeMatchesCity(p, city) && !isCommercialPlaceCategory(p.category),
    );
    if (inCity.length >= 3) return inCity;
    return allPlaces.filter(p => !isCommercialPlaceCategory(p.category));
  }, [allPlaces, cityName]);

  const heroSlides = useMemo((): HeroSlide[] => {
    const city = locating ? 'Nearby' : cityName;
    const cityKey = normalizeCity(city);
    const topRated = [...cityPlaces]
      .filter(p => p.imageUrl || p.imageUri)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 3);

    const cityHero: HeroSlide = {
      id: `city-${cityKey}`,
      title: city,
      tagline: cityTagline(city),
      description: topRated[0]?.shortDescription ||
        topRated[0]?.description?.slice(0, 120) ||
        'Explore scenic landmarks, culture, and unforgettable experiences.',
      image: topRated[0]?.imageUrl || topRated[0]?.imageUri || DEFAULT_HERO_IMAGE,
      isCity: true,
      spotId: topRated[0]?.id,
    };

    const placeSlides: HeroSlide[] = topRated.slice(1).map(p => ({
      id: p.id,
      title: p.name,
      tagline: heroPlaceTagline(p),
      description: p.shortDescription || p.description?.slice(0, 120) || 'A must-visit destination nearby.',
      image: p.imageUrl || p.imageUri || DEFAULT_HERO_IMAGE,
      spotId: p.id,
    }));

    return [cityHero, ...placeSlides];
  }, [cityPlaces, cityName, locating]);

  useEffect(() => {
    if (heroSlides.length <= 1) return;
    heroTimerRef.current = setInterval(() => {
      setHeroIndex(prev => {
        const next = (prev + 1) % heroSlides.length;
        heroListRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 5500);
    return () => {
      if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    };
  }, [heroSlides.length]);

  const onHeroScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / layout.layoutW);
    if (idx >= 0 && idx < heroSlides.length) setHeroIndex(idx);
  };

  const topPicks = useMemo(() => {
    if (!position?.latitude) {
      return cityPlaces
        .filter(p => p.latitude && p.longitude)
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, 8)
        .map(p => ({
          id: p.id,
          name: p.name,
          distance: '—',
          subtitle: categorySubtitle(p),
          rating: p.rating,
          reviewCount: p.reviewCount,
          image: p.imageUrl || p.imageUri || null,
          spot: p,
        }));
    }
    return cityPlaces
      .filter(p => p.latitude && p.longitude)
      .map(p => {
        const km = haversineKm(position.latitude, position.longitude, p.latitude!, p.longitude!);
        return {
          id: p.id,
          name: p.name,
          distance: formatDistance(km),
          subtitle: categorySubtitle(p),
          rating: p.rating,
          reviewCount: p.reviewCount,
          image: p.imageUrl || p.imageUri || null,
          _km: km,
          spot: p,
        };
      })
      .sort((a, b) => {
        const ratingDiff = (b.rating ?? 0) - (a.rating ?? 0);
        if (Math.abs(ratingDiff) > 0.3) return ratingDiff;
        return a._km - b._km;
      })
      .slice(0, 8);
  }, [cityPlaces, position]);

  const itineraryPlaces = useMemo(() => {
    if (!user?.currentItinerary?.length) return [] as TouristSpot[];
    return user.currentItinerary
      .map(id => allPlaces.find(p => p.id === id))
      .filter(Boolean) as TouristSpot[];
  }, [user?.currentItinerary, allPlaces]);

  const localStopCount = user?.currentItinerary?.length || 0;
  const resumeStopCount = resumeTarget?.stopCount || localStopCount;
  const progressPct = resumeTarget?.progressPct
    ?? (localStopCount > 0
      ? Math.round(((user?.completedItineraryStops?.length || 0) / localStopCount) * 100)
      : 0);
  const needsResume = resumeStopCount > 0 || !!resumeTarget;
  const resumeTitle =
    resumeTarget && 'title' in resumeTarget && resumeTarget.title
      ? resumeTarget.title
      : itineraryPlaces[0]?.name || 'Your trip';
  const resumeMeta =
    resumeTarget?.kind === 'tripBuilder'
      ? `Draft · ${resumeStopCount} place${resumeStopCount === 1 ? '' : 's'}`
      : resumeTarget?.kind === 'tripDetail' && resumeTarget.status === 'ACTIVE'
        ? `Active · ${progressPct}% complete`
        : resumeTarget?.kind === 'tripDetail'
          ? `Ready · ${resumeStopCount} stop${resumeStopCount === 1 ? '' : 's'}`
          : `Ready · ${resumeStopCount} stop${resumeStopCount === 1 ? '' : 's'}`;
  const resumeImage =
    itineraryPlaces[0]?.imageUrl ||
    itineraryPlaces[0]?.imageUri ||
    topPicks[0]?.image ||
    heroSlides[0]?.image;

  const firstName = user.displayName?.split(' ')[0] || 'Traveler';
  const discoverCity = locating ? '…' : cityName;

  const switchableModes = useMemo(
    (): UserActiveMode[] =>
      getSwitchableModes(ctxUser || user, currentVendor?.verificationStatus),
    [ctxUser, user, currentVendor?.verificationStatus],
  );

  const handleCategoryPress = (item: typeof CATEGORIES[0]) => {
    onNavigateToSearch?.(item.query);
  };

  const handleQuickAction = (action: 'ai' | 'gems' | 'vendors') => {
    if (action === 'ai') { onNavigateToAITripPlanner?.(); return; }
    if (action === 'gems') { onNavigateToHiddenGems?.(); return; }
    onNavigateToVendors?.();
  };

  const handleHeroExplore = (slide: HeroSlide) => {
    if (slide.spotId) {
      const spot = allPlaces.find(p => p.id === slide.spotId);
      if (spot) { onSelectSpot(spot); return; }
    }
    onNavigateToMap?.();
  };

  const handleToggleWishlist = async (id: string) => {
    const next = await toggleWishlistId(id);
    setWishlistIds(next);
  };

  const renderHeroSlide = ({ item }: { item: HeroSlide }) => {
    const titleSize = heroTitleFontSize(item.title);
    return (
    <View style={[styles.heroSlide, { width: layout.layoutW }]}>
      <TouchableOpacity
        style={[styles.heroCard, { width: layout.heroW, height: layout.heroH }]}
        activeOpacity={0.92}
        onPress={() => handleHeroExplore(item)}
      >
      <HeroCardImage uri={item.image} fallbackUri={DEFAULT_HERO_IMAGE} />
      <LinearGradient
        colors={['rgba(10,6,4,0.08)', 'rgba(10,6,4,0.45)', 'rgba(10,6,4,0.88)']}
        locations={[0, 0.45, 1]}
        style={styles.heroGrad}
      />
      <View style={styles.heroInner}>
        <View style={styles.heroTopRow}>
          <View style={styles.exploreTag}>
            <Icon name="location" size={11} color="#FFF9F2" />
            <Text style={styles.exploreTagText}>EXPLORE</Text>
          </View>
          {weather && (
            <View style={styles.weatherTag}>
              <Icon name={weatherIconName(weather.label) as any} size={14} color="#FFF9F2" />
              <Text style={styles.weatherText}>{weather.temp}°C {weather.label}</Text>
            </View>
          )}
        </View>
        <View style={styles.heroContent}>
          <Text
            style={[styles.heroTitle, { fontSize: titleSize, lineHeight: titleSize + 6 }]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {!!item.tagline && (
            <Text style={styles.heroTagline} numberOfLines={1}>{item.tagline}</Text>
          )}
          <Text style={styles.heroDesc} numberOfLines={2}>{item.description}</Text>
          <TouchableOpacity
            style={styles.heroCta}
            activeOpacity={0.88}
            onPress={() => handleHeroExplore(item)}
          >
            <Text style={styles.heroCtaText}>Explore Now</Text>
            <Icon name="arrow-forward" size={16} color={C.ink} />
          </TouchableOpacity>
        </View>
      </View>
      </TouchableOpacity>
    </View>
  );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: getMainTabBarClearance(insets.bottom), paddingTop: insets.top + 8 }}
        refreshControl={
          <RefreshControl
            refreshing={!!loading}
            onRefresh={onRefresh}
            tintColor={C.gold}
            colors={[C.gold]}
            progressBackgroundColor={C.surface}
          />
        }
      >
        <Animated.View style={[styles.contentShell, { width: layout.layoutW, opacity: fadeAnim }]}>
          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setSidebarOpen(true)}
              accessibilityLabel="Open menu"
            >
              <Icon name="menu" size={24} color={C.ink} />
            </TouchableOpacity>
            <View style={styles.logoWrap}>
              <Image source={LOGO} style={styles.logo} resizeMode="contain" />
              <Text style={styles.logoBrand}>PAL SAFAR</Text>
            </View>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={onNavigateToNotifications}
              accessibilityLabel="Notifications"
            >
              <Icon name="notifications-outline" size={24} color={C.ink} />
              {unreadNotifications > 0 && (
                <View style={styles.notifDot} />
              )}
            </TouchableOpacity>
          </View>

          {/* Greeting + location */}
          <View style={styles.greetingRow}>
            <Text style={styles.greeting} numberOfLines={1}>
              {formatTimeBasedGreeting()},{' '}
              <Text style={styles.greetingName}>{firstName}</Text> 👋
            </Text>
            <TouchableOpacity style={styles.locationPill} activeOpacity={0.8} onPress={onNavigateToMap}>
              <Icon name="location" size={14} color={C.gold} />
              <Text style={styles.locationPillText} numberOfLines={1}>{discoverCity}</Text>
              <Icon name="chevron-down" size={14} color={C.ink} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <TouchableOpacity
            onPress={() => onNavigateToSearch?.()}
            activeOpacity={0.9}
            style={styles.searchWrap}
            accessibilityRole="search"
          >
            <View style={styles.searchBar}>
              <Icon name="search" size={18} color={C.textMuted} />
              <Text style={styles.searchPlaceholder}>Search places, experiences, hotels…</Text>
              <TouchableOpacity
                style={styles.filterBtn}
                onPress={() => onNavigateToSearch?.()}
                hitSlop={8}
              >
                <Icon name="options-outline" size={18} color={C.ink} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>

          {/* Hero carousel */}
          <View style={styles.heroWrap}>
            <FlatList
              ref={heroListRef}
              data={heroSlides}
              keyExtractor={item => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={layout.layoutW}
              decelerationRate="fast"
              onMomentumScrollEnd={onHeroScroll}
              renderItem={renderHeroSlide}
              getItemLayout={(_, index) => ({
                length: layout.layoutW,
                offset: layout.layoutW * index,
                index,
              })}
            />
            {heroSlides.length > 1 && (
              <View style={styles.heroDots}>
                {heroSlides.map((s, i) => (
                  <View key={s.id} style={[styles.heroDot, i === heroIndex && styles.heroDotActive]} />
                ))}
              </View>
            )}
          </View>

          {/* Categories */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Explore by Categories</Text>
            <TouchableOpacity onPress={() => onNavigateToSearch?.()} hitSlop={8}>
              <Text style={styles.viewAll}>View All →</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.catGrid, responsive.isSmallPhone && styles.catGridWrap]}>
            {CATEGORIES.map(item => (
              <CategoryTile
                key={item.id}
                item={item}
                onPress={() => handleCategoryPress(item)}
                style={
                  responsive.isSmallPhone
                    ? {
                        width: (layout.layoutW - H_PAD * 2 - CAT_GAP * 2) / 3,
                        flexGrow: 0,
                        flexShrink: 0,
                      }
                    : undefined
                }
              />
            ))}
          </View>

          {!!error && (
            <TouchableOpacity style={styles.errorCard} activeOpacity={0.85} onPress={onRefresh}>
              <Icon name="warning-outline" size={18} color="#C45C26" />
              <View style={{ flex: 1 }}>
                <Text style={styles.errorTitle}>Couldn't load places</Text>
                <Text style={styles.errorSub} numberOfLines={2}>{error}</Text>
              </View>
              <Text style={styles.errorRetry}>Retry</Text>
            </TouchableOpacity>
          )}

          {/* Continue Journey */}
          {needsResume && (
            <TouchableOpacity style={styles.resumeCard} activeOpacity={0.92} onPress={onStartTrip}>
              <Image source={{ uri: resumeImage }} style={styles.resumeImage} resizeMode="cover" />
              <LinearGradient colors={['rgba(20,10,4,0.25)', 'rgba(20,10,4,0.78)']} style={styles.resumeOverlay} />
              <View style={styles.resumeContent}>
                <View style={styles.resumeTextCol}>
                  <Text style={styles.resumeEyebrow}>
                    {resumeTarget?.kind === 'tripBuilder' ? 'Continue Building' : 'Continue Journey'}
                  </Text>
                  <Text style={styles.resumeTitle} numberOfLines={1}>{resumeTitle}</Text>
                  <Text style={styles.resumeMeta} numberOfLines={1}>{resumeMeta}</Text>
                </View>
                <View style={styles.resumePlay}>
                  <Icon
                    name={resumeTarget?.kind === 'tripBuilder' ? 'construct' : 'play'}
                    size={22}
                    color={C.ink}
                  />
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* Top Picks */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top Picks for You</Text>
            <TouchableOpacity onPress={onNavigateToMap} hitSlop={8}>
              <Text style={styles.viewAll}>View All →</Text>
            </TouchableOpacity>
          </View>

          {loading && topPicks.length === 0 ? (
            <View style={styles.emptyBlock}>
              <ActivityIndicator color={C.gold} />
              <Text style={styles.emptyText}>Finding places near you…</Text>
            </View>
          ) : topPicks.length > 0 ? (
            <FlatList
              data={topPicks}
              keyExtractor={item => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.placeList}
              renderItem={({ item }) => (
                <TopPickCard
                  name={item.name}
                  distance={item.distance}
                  subtitle={item.subtitle}
                  rating={item.rating}
                  reviewCount={item.reviewCount}
                  image={item.image}
                  wishlisted={wishlistIds.includes(item.id)}
                  cardWidth={layout.placeCardW}
                  onPress={() => onSelectSpot(item.spot)}
                  onToggleWishlist={() => handleToggleWishlist(item.id)}
                />
              )}
            />
          ) : (
            <TouchableOpacity style={styles.emptyCard} activeOpacity={0.85} onPress={onNavigateToMap}>
              <Icon name="map-outline" size={22} color={C.gold} />
              <View style={{ flex: 1 }}>
                <Text style={styles.emptyTitle}>
                  {position ? 'Browse the map' : 'Enable location'}
                </Text>
                <Text style={styles.emptyText}>
                  {position
                    ? 'Open the map to discover temples, parks, and hidden gems.'
                    : 'Allow GPS so we can show tourist places around you.'}
                </Text>
              </View>
              <Icon name="chevron-forward" size={18} color={C.textMuted} />
            </TouchableOpacity>
          )}

          {/* Quick actions */}
          <View style={styles.quickRow}>
            {QUICK_ACTIONS.map(action => (
              <QuickActionCard
                key={action.id}
                title={action.title}
                subtitle={action.subtitle}
                icon={action.icon}
                lib={'lib' in action ? action.lib : undefined}
                onPress={() => handleQuickAction(action.action)}
              />
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      <HomeSidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={ctxUser || (user as any)}
        palPoints={palPoints}
        activeMode={ctxUser?.activeMode || 'USER'}
        switchableModes={switchableModes}
        onSwitchMode={onSwitchMode}
        onNavigateToWallet={openWallet}
        onNavigateToRewards={openRewards}
        onNavigateToLeaderboard={onNavigateToLeaderboard}
        onNavigateToTreasureHunt={onNavigateToTreasureHunt}
        onNavigateToQuest={onNavigateToQuest}
        onBecomeCreator={onBecomeCreator}
        onBecomeVendor={onBecomeVendor}
        onOpenCreatorStudio={onOpenCreatorStudio}
        onOpenVendorWorkspace={onOpenVendorWorkspace}
        onNavigateToSettings={onNavigateToSettings}
        onNavigateToNotifications={onNavigateToNotifications}
        onNavigateToLegal={onNavigateToLegal}
        onLogout={onLogout}
        isGuest={isGuest}
        vendorVerificationStatus={currentVendor?.verificationStatus}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  contentShell: {
    alignSelf: 'center',
    maxWidth: MAX_HOME_CONTENT_W,
    width: '100%',
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
    marginBottom: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoWrap: { alignItems: 'center', flex: 1 },
  logo: { width: 120, height: 120, marginBottom: -18 },
  logoBrand: {
    fontSize: 15,
    fontWeight: '800',
    color: C.ink,
    letterSpacing: 2.6,
    marginTop: -12,
  },

  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
    borderWidth: 1.5,
    borderColor: C.bg,
  },

  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
    marginBottom: 14,
    gap: 10,
  },
  greeting: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: C.textSub,
  },
  greetingName: {
    fontWeight: '700',
    color: C.ink,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: C.border,
    flexShrink: 0,
  },
  locationPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.ink,
    maxWidth: 88,
  },

  searchWrap: { marginHorizontal: H_PAD, marginBottom: 18 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    paddingHorizontal: 16,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
    shadowColor: 'rgba(30, 16, 8, 0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
    gap: 10,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: C.textMuted,
    fontWeight: '500',
  },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(185,131,75,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  heroWrap: { marginBottom: 20 },
  heroSlide: {
    alignItems: 'center',
  },
  heroCard: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: C.ink,
  },
  heroImage: { ...StyleSheet.absoluteFillObject },
  heroGrad: { ...StyleSheet.absoluteFillObject },
  heroInner: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exploreTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(185,131,75,0.9)',
  },
  exploreTagText: { fontSize: 10, fontWeight: '800', color: '#FFF9F2', letterSpacing: 0.5 },
  weatherTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(30,16,8,0.55)',
  },
  weatherText: { fontSize: 11, fontWeight: '700', color: '#FFF9F2' },
  heroContent: {
    gap: 3,
    paddingTop: 8,
  },
  heroTitle: {
    fontWeight: '800',
    color: '#FFF9F2',
    letterSpacing: -0.4,
    fontFamily: SERIF,
  },
  heroTagline: {
    fontSize: 13,
    fontWeight: '600',
    color: C.goldLight,
    fontStyle: 'italic',
    fontFamily: SERIF,
    marginTop: 1,
  },
  heroDesc: {
    fontSize: 12,
    color: 'rgba(255,249,242,0.82)',
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 10,
  },
  heroCta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: C.gold,
  },
  heroCtaText: { fontSize: 13, fontWeight: '800', color: C.ink },
  heroDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  heroDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(185,131,75,0.3)',
  },
  heroDotActive: {
    width: 20,
    backgroundColor: C.gold,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.3,
    fontFamily: SERIF,
  },
  viewAll: { fontSize: 13, fontWeight: '700', color: C.gold },

  catGrid: {
    flexDirection: 'row',
    paddingHorizontal: H_PAD,
    gap: CAT_GAP,
    marginBottom: 22,
  },
  catGridWrap: {
    flexWrap: 'wrap',
  },
  catTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 2,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: C.borderSoft,
  },
  catIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(185,131,75,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  catTileLabel: { fontSize: 10, fontWeight: '700', color: C.ink, textAlign: 'center' },

  errorCard: {
    marginHorizontal: H_PAD,
    marginBottom: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FFF1E8',
    borderWidth: 1,
    borderColor: 'rgba(196,92,38,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorTitle: { fontSize: 13, fontWeight: '700', color: C.text },
  errorSub: { fontSize: 12, color: C.textSub, marginTop: 2 },
  errorRetry: { fontSize: 13, fontWeight: '700', color: '#C45C26' },

  resumeCard: {
    marginHorizontal: H_PAD,
    marginBottom: 20,
    height: 148,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: C.ink,
  },
  resumeImage: { ...StyleSheet.absoluteFillObject },
  resumeOverlay: { ...StyleSheet.absoluteFillObject },
  resumeContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
  },
  resumeTextCol: { flex: 1, gap: 4 },
  resumeEyebrow: { fontSize: 12, fontWeight: '600', color: 'rgba(255,249,242,0.85)' },
  resumeTitle: { fontSize: 20, fontWeight: '800', color: '#FFF9F2', letterSpacing: -0.3 },
  resumeMeta: { fontSize: 13, color: 'rgba(255,249,242,0.8)', fontWeight: '500', marginTop: 2 },
  resumePlay: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.gold,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 3,
  },

  placeList: { paddingLeft: H_PAD, paddingRight: 24, marginBottom: 16 },
  placeCard: {
    marginRight: 12,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: C.borderSoft,
  },
  placeImageWrap: {
    width: '100%',
    position: 'relative',
  },
  placeImage: { width: '100%', height: '100%' },
  placeImageFallback: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  heartBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeInfo: { paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
  placeName: { fontSize: 14, fontWeight: '800', color: C.ink },
  placeSub: { fontSize: 11, color: C.textSub, fontWeight: '500' },
  placeStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 11, fontWeight: '700', color: C.ink },
  distPill: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  placeDist: { fontSize: 11, fontWeight: '600', color: C.textSub },

  emptyBlock: { alignItems: 'center', gap: 10, paddingVertical: 28, marginBottom: 16 },
  emptyCard: {
    marginHorizontal: H_PAD,
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.borderSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 2 },
  emptyText: { fontSize: 12, color: C.textSub, lineHeight: 17 },

  quickRow: {
    flexDirection: 'row',
    paddingHorizontal: H_PAD,
    gap: 8,
    marginBottom: 12,
  },
  quickCard: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'column',
    paddingTop: 12,
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: C.borderSoft,
    minHeight: 132,
  },
  quickIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(185,131,75,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickBody: {
    flex: 1,
    minHeight: 52,
    paddingRight: 2,
    marginBottom: 8,
  },
  quickTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: C.ink,
    lineHeight: 14,
    letterSpacing: -0.2,
  },
  quickSub: {
    fontSize: 9,
    fontWeight: '500',
    color: C.textSub,
    lineHeight: 13,
    marginTop: 4,
  },
  quickArrow: {
    alignSelf: 'flex-end',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
