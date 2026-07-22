import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  ActivityIndicator, Platform,
  ScrollView, StatusBar, Linking, Alert, TextInput, Modal, Pressable,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import Pal from '../design/DesignSystem';
import { getMainTabBarClearance } from '../design/tabBarLayout';
import { useResponsive } from '../design/responsive';
import { useTheme } from '../context/ThemeContext';
import { useLocationContext } from '../context/LocationContext';
import { useDataContext } from '../context/DataContext';
import { useUserContext } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import type { TouristSpot, UserProfile, VendorBusiness, UserPosition } from '../types';
import { placesApi, searchApi } from '../services/api';
import { getPlaceById } from '../services/placesService';
import { DEV_FLAGS } from '../config/devFlags';
import RideOptionsSheet from '../components/RideOptionsSheet';
import MapPlaceDetailCard from '../components/MapPlaceDetailCard';
import { loadWishlistIds, toggleWishlistId } from '../utils/homeWishlist';

import { generateLeafletHtml } from '../utils/leafletMapHtml';
import {
  DEFAULT_MAP_CENTER,
  INDIA_OVERVIEW,
  getMarkerColor,
  getMarkerEmoji,
  getMarkerLabelPriority,
  getMarkerSublabel,
  getMapMarkerConfig,
  normalizeCategory,
  matchesCategoryFilter,
  isCommercialPlaceCategory,
} from '../utils/mapMarkerUtils';
import { JABALPUR_MAP_PLACES } from '../data/jabalpurMapPlaces';
import { cacheItineraryPlace } from '../utils/itineraryPlacesCache';
import { quickAddPlaceToTrip, seedDraftTripCache, DRAFT_TRIP_ID_KEY } from '../utils/quickAddPlace';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tripsApi } from '../services/api/trips';
import { recordSearchedPlace } from '../utils/passportPlaces';

/** Street-level zoom for opening Map tab and GPS recenter (good for turn-by-turn context) */
const MAP_TAB_ZOOM = 17;
const MARKER_FOCUS_ZOOM = 16;
const CITY_ZOOM = 13;
const CACHE_TTL = 5 * 60 * 1000;

const MAP_UI_FILTERS = [
  { key: 'ghat', label: 'Ghats', color: getMapMarkerConfig('ghat').color, icon: null },
  { key: 'temple', label: 'Temple', color: getMapMarkerConfig('temple').color, icon: null },
  { key: 'waterfall', label: 'Waterfall', color: getMapMarkerConfig('waterfall').color, icon: null },
  { key: 'museum', label: 'Museum', color: getMapMarkerConfig('museum').color, icon: null },
];

const CATEGORY_FILTERS = [
  ...MAP_UI_FILTERS,
  { key: 'mosque', label: 'Mosque', color: getMapMarkerConfig('mosque').color, icon: null },
  { key: 'church', label: 'Church', color: getMapMarkerConfig('church').color, icon: null },
  { key: 'gurudwara', label: 'Gurudwara', color: getMapMarkerConfig('gurudwara').color, icon: null },
  { key: 'monument', label: 'Monuments', color: getMapMarkerConfig('monument').color, icon: null },
  { key: 'park', label: 'Park', color: getMapMarkerConfig('park').color, icon: null },
  { key: 'lake', label: 'Lake', color: getMapMarkerConfig('lake').color, icon: null },
  { key: 'fort', label: 'Fort', color: getMapMarkerConfig('fort').color, icon: null },
  { key: 'beach', label: 'Beach', color: getMapMarkerConfig('beach').color, icon: null },
  { key: 'trek', label: 'Trek', color: getMapMarkerConfig('trek').color, icon: null },
  { key: 'palace', label: 'Palace', color: getMapMarkerConfig('palace').color, icon: null },
  { key: 'adventure', label: 'Adventure', color: getMapMarkerConfig('adventure').color, icon: null },
];



const MAP_HTML = generateLeafletHtml();

interface MarkerData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  type: 'place' | 'vendor';
  image?: string | null;
  rating?: number;
  reviewCount?: number;
  description?: string;
  shortDescription?: string;
  city?: string;
  state?: string;
  color: string;
  emoji: string;
  sublabel: string;
  distanceKm?: string;
  tags?: string[];
  views?: number;
  businessType?: string;
  phone?: string;
  contactPhone?: string;
  website?: string;
  /** Synthetic row: overview of all DB places in a city */
  isCityGroup?: boolean;
  cityPlaceCount?: number;
  /** Precomputed for zoom-aware labels in the Leaflet WebView */
  labelPriority?: number;
  distance?: string;
}

interface MapScreenProps {
  places?: TouristSpot[];
  vendors?: VendorBusiness[];
  user?: Partial<UserProfile>;
  error?: string | null;
  onRetry?: () => void;
  onSelectSpot?: (spot: { id: string }) => void;
  onSelectVendor?: (vendorId: string) => void;
  onViewVendorContent?: (vendorId: string, vendorName: string, tab?: 'offers' | 'reels') => void;
  onNavigateToMap?: () => void;
  onNavigateToTripBuilder?: () => void;
  onViewItinerary?: (placeId?: string) => void;
  selectedPlaceId?: string;
  selectedPlaceKey?: number;
  initialMapTab?: 'places' | 'vendors';
  mapTabKey?: number;
}

export default function MapScreen({
  places: propPlaces,
  vendors: propVendors,
  error: propError,
  onRetry,
  onSelectSpot,
  onSelectVendor,
  onViewVendorContent,
  onNavigateToTripBuilder,
  onViewItinerary,
  selectedPlaceId,
  selectedPlaceKey,
  initialMapTab,
  mapTabKey,
}: MapScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: _screenW, height: SCREEN_H } = useWindowDimensions();
  const responsive = useResponsive();
  const tabClearance = getMainTabBarClearance(insets.bottom);
  const { effectivePosition, requestPermission, hasPermission } = useLocationContext();
  const { vendors: contextVendors } = useDataContext();
  const { user, setUser, isGuest } = useUserContext();
  const { showSuccess, showError } = useToast();

  const webViewRef = useRef<WebView>(null);
  const placesCache = useRef<{ data: MarkerData[]; ts: number } | null>(null);
  const vendorsCache = useRef<{ data: MarkerData[]; ts: number } | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const effectivePositionRef = useRef<UserPosition | null>(null);
  /** When false, map stays on user search/selection until GPS button is pressed */
  const allowAutoRecenterRef = useRef(true);
  const hasInitialCenteredRef = useRef(false);

  const [selectedMarker, setSelectedMarker] = useState<MarkerData | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [webViewKey, setWebViewKey] = useState(0);
  const [locationRequested, setLocationRequested] = useState(false);
  const [activeTab, setActiveTab] = useState<'places' | 'vendors'>(
    initialMapTab === 'vendors' ? 'vendors' : 'places',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [remoteSuggestions, setRemoteSuggestions] = useState<MarkerData[]>([]);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [allPlaces, setAllPlaces] = useState<MarkerData[]>([]);
  const [allVendors, setAllVendors] = useState<MarkerData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isMapFetching, setIsMapFetching] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const fetchCounterRef = useRef(0);
  const lastBoundsRef = useRef<{ north: number; south: number; east: number; west: number } | null>(null);
  const selectedCategoryRef = useRef('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isNavigating, setIsNavigating] = useState(false);
  const [rideSheetVisible, setRideSheetVisible] = useState(false);
  const [addedPlaceIds, setAddedPlaceIds] = useState<Set<string>>(new Set());
  const [addingPlaceId, setAddingPlaceId] = useState<string | null>(null);
  const pendingItineraryAddsRef = useRef<Set<string>>(new Set());
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);

  useEffect(() => {
    selectedCategoryRef.current = selectedCategory;
  }, [selectedCategory]);

  useFocusEffect(
    useCallback(() => {
      loadWishlistIds().then(setWishlistIds);
    }, []),
  );

  const postToWebView = useCallback((data: any) => {
    const json = JSON.stringify(data);
    webViewRef.current?.postMessage(json);

    // Also inject — more reliable on Android WebView than postMessage alone
    if (data?.type === 'flyTo' && data.lat != null && data.lng != null) {
      const z = data.zoom ?? MAP_TAB_ZOOM;
      webViewRef.current?.injectJavaScript(
        `(function(){try{if(window.__palMap)window.__palMap.flyTo(${Number(data.lat)},${Number(data.lng)},${Number(z)});}catch(e){}true;})();`,
      );
    } else if (data?.type === 'fitBounds' && Array.isArray(data.bounds) && data.bounds.length) {
      const boundsJson = JSON.stringify(data.bounds);
      const maxZ = data.maxZoom ?? CITY_ZOOM;
      webViewRef.current?.injectJavaScript(
        `(function(){try{if(window.__palMap)window.__palMap.fitBounds(${boundsJson},${Number(maxZ)});}catch(e){}true;})();`,
      );
    } else if (data?.type === 'setUserLocation' && data.lat != null && data.lng != null) {
      webViewRef.current?.injectJavaScript(
        `(function(){try{if(window.__palMap)window.__palMap.setUserLocation(${Number(data.lat)},${Number(data.lng)});}catch(e){}true;})();`,
      );
    }
  }, []);

  const pushUserLocationToMap = useCallback((pos?: UserPosition | null) => {
    const p = pos ?? effectivePositionRef.current;
    if (p?.latitude == null || p?.longitude == null) return;
    postToWebView({
      type: 'setUserLocation',
      lat: p.latitude,
      lng: p.longitude,
    });
  }, [postToWebView]);

  const lockMapView = useCallback(() => {
    allowAutoRecenterRef.current = false;
  }, []);

  useEffect(() => {
    effectivePositionRef.current = effectivePosition;
    if (mapReady && effectivePosition) {
      pushUserLocationToMap(effectivePosition);
      if (allowAutoRecenterRef.current && !hasInitialCenteredRef.current) {
        postToWebView({
          type: 'flyTo',
          lat: effectivePosition.latitude,
          lng: effectivePosition.longitude,
          zoom: MAP_TAB_ZOOM,
        });
        hasInitialCenteredRef.current = true;
      }
    }
  }, [effectivePosition, mapReady, pushUserLocationToMap, postToWebView]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [fadeAnim]);

  useEffect(() => {
    if (!hasPermission && !locationRequested) {
      const t = setTimeout(() => {
        setLocationRequested(true);
        requestPermission().catch(() => {});
      }, 900);
      return () => clearTimeout(t);
    }
  }, [hasPermission, locationRequested, requestPermission]);

  const mapPlaceToMarker = useCallback((p: TouristSpot): MarkerData => {
    const category = normalizeCategory(p.category || 'default');
    return {
      id: p.id,
      name: p.name,
      lat: p.latitude,
      lng: p.longitude,
      category,
      type: 'place',
      image: p.imageUrl || p.imageUri || null,
      rating: p.rating,
      reviewCount: p.reviewCount,
      description: p.description || p.shortDescription || '',
      shortDescription: p.shortDescription || '',
      city: p.city,
      state: p.state,
      color: getMarkerColor(category, 'place'),
      emoji: getMarkerEmoji(category, 'place'),
      sublabel: getMarkerSublabel(category),
    };
  }, []);

  const mapVendorToMarker = useCallback((v: VendorBusiness | any): MarkerData => {
    const category = normalizeCategory((v.category || v.businessType || 'default').toLowerCase());
    return {
      id: v.id,
      name: v.businessName,
      lat: Number(v.latitude || v.lat) || 0,
      lng: Number(v.longitude || v.lng) || 0,
      category,
      type: 'vendor',
      image: v.imageUrl || null,
      rating: 0,
      description: v.description || '',
      city: v.city,
      state: v.state,
      color: getMarkerColor(category, 'vendor'),
      emoji: getMarkerEmoji(category, 'vendor'),
      sublabel: v.category || v.businessType || 'Vendor',
      businessType: v.category || v.businessType,
      phone: v.showContact === false ? undefined : (v.phone || undefined),
      contactPhone: v.showContact === false ? undefined : (v.phone || undefined),
      website: v.showWebsite === false ? undefined : (v.website || undefined),
    };
  }, []);

  const apiPlaceToMarker = useCallback((p: any): MarkerData => {
    const category = normalizeCategory(p.category || 'default');
    return {
      id: p.id,
      name: p.name,
      lat: Number(p.latitude),
      lng: Number(p.longitude),
      category,
      type: 'place',
      image: p.images?.[0] || p.thumbnail || null,
      rating: p.rating || 0,
      reviewCount: p.reviewCount || 0,
      description: p.description || p.shortDescription || '',
      city: p.city || '',
      state: p.state || '',
      color: getMarkerColor(category, 'place'),
      emoji: getMarkerEmoji(category, 'place'),
      sublabel: getMarkerSublabel(category),
    };
  }, []);

  const fetchViewportPlaces = useCallback(async (bounds: { north: number, south: number, east: number, west: number }) => {
    lastBoundsRef.current = bounds;
    const currentFetchId = ++fetchCounterRef.current;
    setIsMapFetching(true);
    try {
      const category = selectedCategoryRef.current;
      const res = await placesApi.viewport({
        north: bounds.north,
        south: bounds.south,
        east: bounds.east,
        west: bounds.west,
        limit: 150,
        category: category || undefined,
      });
      if (currentFetchId !== fetchCounterRef.current) return; // Stale request, ignore

      const places = (res as any).data || res;
      const batch = (places || [])
        .filter((p: any) => {
          const lat = Number(p.latitude);
          const lng = Number(p.longitude);
          return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
        })
        .map(apiPlaceToMarker);
      
      setAllPlaces(prev => {
        // When filtering by category on the server, replace viewport merges carefully:
        // keep offline/local pins, merge category batch, drop stale off-category remote pins later via client filter.
        const map = new Map(prev.map(p => [p.id, p]));
        batch.forEach((m: MarkerData) => map.set(m.id, m));
        return Array.from(map.values());
      });
    } catch (e) {
      console.warn('Viewport load error', e);
    } finally {
      if (currentFetchId === fetchCounterRef.current) {
        setIsMapFetching(false);
      }
    }
  }, [apiPlaceToMarker]);

  // Re-fetch viewport when category chip changes so server returns category-scoped places.
  useEffect(() => {
    if (!mapReady || activeTab !== 'places') return;
    if (lastBoundsRef.current) {
      fetchViewportPlaces(lastBoundsRef.current);
    }
  }, [selectedCategory, mapReady, activeTab, fetchViewportPlaces]);

  const fetchVendors = useCallback(async (force = false) => {
    if (!force && vendorsCache.current && Date.now() - vendorsCache.current.ts < CACHE_TTL) {
      setAllVendors(vendorsCache.current.data);
      return;
    }
    let source: any[] | undefined =
      contextVendors && contextVendors.length > 0 ? contextVendors : propVendors;

    try {
      const { vendorsApi } = await import('../services/api/vendors');
      const res = await vendorsApi.listForMap();
      const remote = ((res as any)?.data ?? res) as any[];
      if (Array.isArray(remote) && remote.length > 0) {
        source = remote;
      }
    } catch {
      /* fall back to context/props */
    }

    if (source && source.length > 0) {
      const markers = source
        .filter((v: any) => {
          const lat = Number(v.latitude || v.lat);
          const lng = Number(v.longitude || v.lng);
          return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0 && v.showOnMap !== false;
        })
        .map(mapVendorToMarker);
      vendorsCache.current = { data: markers, ts: Date.now() };
      setAllVendors(markers);
    } else {
      setAllVendors([]);
    }
  }, [contextVendors, propVendors, mapVendorToMarker]);

  useEffect(() => {
    const jabalpurMarkers = JABALPUR_MAP_PLACES
      .filter(p => !isCommercialPlaceCategory(p.category))
      .map(mapPlaceToMarker);
    setAllPlaces(prev => {
      const map = new Map(prev.map(p => [p.id, p]));
      jabalpurMarkers.forEach(m => map.set(m.id, m));
      return Array.from(map.values());
    });
    if (propPlaces?.length) {
      propPlaces
        .filter(p => !isCommercialPlaceCategory(p.category))
        .forEach(p => {
          const m = mapPlaceToMarker(p);
          setAllPlaces(prev => {
            const map = new Map(prev.map(x => [x.id, x]));
            map.set(m.id, m);
            return Array.from(map.values());
          });
        });
    }
  }, [mapPlaceToMarker, propPlaces]);

  useEffect(() => {
    let mounted = true;
    setLoadError(null);
    fetchVendors().finally(() => {
      if (mounted) setIsLoading(false);
    });
    return () => { mounted = false; };
  }, [fetchVendors]);

  const markerLookup = useMemo(() => {
    const map = new Map<string, MarkerData>();
    [...allPlaces, ...allVendors].forEach(m => map.set(m.id, m));
    return map;
  }, [allPlaces, allVendors]);

  const filteredMarkers: MarkerData[] = useMemo(() => {
    let list = activeTab === 'places' ? allPlaces : allVendors;
    if (activeTab === 'places') {
      list = list.filter(m => !isCommercialPlaceCategory(m.category));
    }
    if (selectedCategory) {
      list = list.filter(m => matchesCategoryFilter(m.category, selectedCategory));
    }
    return list;
  }, [allPlaces, allVendors, activeTab, selectedCategory]);

  // Haversine distance calculator
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
  }, []);

  const markersForMap = useMemo(() => {
    const hasLocation = Boolean(effectivePosition?.latitude && effectivePosition?.longitude);
    return filteredMarkers.map(m => ({
      ...m,
      labelPriority: getMarkerLabelPriority({
        category: m.category,
        rating: m.rating,
        type: m.type,
        isCityGroup: m.isCityGroup,
      }),
      distance:
        hasLocation && m.lat && m.lng
          ? `${calculateDistance(
              effectivePosition!.latitude,
              effectivePosition!.longitude,
              m.lat,
              m.lng,
            )} km`
          : undefined,
    }));
  }, [filteredMarkers, effectivePosition, calculateDistance]);

  const initialFallbackRef = useRef(false);

  // Center on user only on first Map tab open — not after city search or GPS updates
  useFocusEffect(
    useCallback(() => {
      if (!mapReady) return;
      if (selectedPlaceId && selectedPlaceKey != null) return;
      if (!allowAutoRecenterRef.current) return;

      const pos = effectivePositionRef.current;
      if (pos && !hasInitialCenteredRef.current) {
        postToWebView({
          type: 'flyTo',
          lat: pos.latitude,
          lng: pos.longitude,
          zoom: MAP_TAB_ZOOM,
        });
        hasInitialCenteredRef.current = true;
        return;
      }

      if (!pos && !initialFallbackRef.current) {
        initialFallbackRef.current = true;
        hasInitialCenteredRef.current = true;
        postToWebView({
          type: 'flyTo',
          lat: DEFAULT_MAP_CENTER.lat,
          lng: DEFAULT_MAP_CENTER.lng,
          zoom: DEFAULT_MAP_CENTER.zoom,
        });
      }

      return () => {
        initialFallbackRef.current = false;
      };
    }, [mapReady, postToWebView, selectedPlaceId, selectedPlaceKey]),
  );

  useEffect(() => {
    if (mapReady) {
      postToWebView({ type: 'setMarkers', markers: markersForMap });
    }
  }, [mapReady, markersForMap, postToWebView]);

  useFocusEffect(
    useCallback(() => {
      if (mapReady) pushUserLocationToMap();
    }, [mapReady, pushUserLocationToMap]),
  );

  useEffect(() => {
    if (mapReady && selectedMarker) {
      postToWebView({ type: 'setSelectedMarker', id: selectedMarker.id });
    } else if (mapReady) {
      postToWebView({ type: 'clearSelectedMarker' });
    }
  }, [mapReady, selectedMarker, postToWebView]);

  const handleMarkerPress = useCallback((marker: MarkerData) => {
    lockMapView();
    setSelectedMarker(marker);
    postToWebView({ type: 'flyTo', lat: marker.lat, lng: marker.lng, zoom: MARKER_FOCUS_ZOOM });
    postToWebView({ type: 'setSelectedMarker', id: marker.id });
    if (marker.type === 'place' && searchQuery.trim()) {
      recordSearchedPlace({
        id: marker.id,
        name: marker.name,
        city: marker.city,
        state: marker.state,
        category: marker.category,
      });
    }
  }, [postToWebView, searchQuery, lockMapView]);

  const mergePlaceMarkers = useCallback((batch: MarkerData[]) => {
    const touristOnly = batch.filter(m => !isCommercialPlaceCategory(m.category));
    if (!touristOnly.length) return;
    setAllPlaces(prev => {
      const map = new Map(prev.map(p => [p.id, p]));
      touristOnly.forEach(m => map.set(m.id, m));
      return Array.from(map.values());
    });
  }, []);

  // Open map detail card when Home/Search (or another screen) passes a place id
  const lastOpenedKeyRef = useRef<number | null>(null);
  const lastMapTabKeyRef = useRef<number | null>(null);

  // Home → Local Vendors (and similar): switch Places/Vendors layer
  useEffect(() => {
    if (!initialMapTab) return;
    if (mapTabKey != null) {
      if (lastMapTabKeyRef.current === mapTabKey) return;
      lastMapTabKeyRef.current = mapTabKey;
    }
    setActiveTab(initialMapTab);
    setSelectedMarker(null);
    if (mapReady) {
      postToWebView({ type: 'clearSelectedMarker' });
      postToWebView({ type: 'clearRoute' });
    }
    if (initialMapTab === 'vendors') {
      fetchVendors();
    }
  }, [initialMapTab, mapTabKey, mapReady, postToWebView, fetchVendors]);

  useEffect(() => {
    if (!selectedPlaceId || selectedPlaceKey == null || !mapReady) return;
    if (lastOpenedKeyRef.current === selectedPlaceKey) return;

    let cancelled = false;

    const openMarker = (marker: MarkerData, mergeIfMissing: boolean) => {
      if (cancelled || !marker.lat || !marker.lng) return;
      lastOpenedKeyRef.current = selectedPlaceKey;
      lockMapView();
      if (mergeIfMissing) {
        mergePlaceMarkers([marker]);
      }
      setActiveTab('places');
      setSelectedMarker(marker);
      postToWebView({ type: 'flyTo', lat: marker.lat, lng: marker.lng, zoom: MARKER_FOCUS_ZOOM });
      postToWebView({ type: 'setSelectedMarker', id: marker.id });
    };

    const fromMarkers = allPlaces.find(m => m.id === selectedPlaceId);
    if (fromMarkers) {
      openMarker(fromMarkers, false);
      return () => {
        cancelled = true;
      };
    }

    const fromProps = propPlaces?.find(p => p.id === selectedPlaceId);
    if (fromProps) {
      openMarker(mapPlaceToMarker(fromProps), true);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const place = await getPlaceById(selectedPlaceId);
      if (cancelled || !place) return;
      openMarker(mapPlaceToMarker(place), true);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    selectedPlaceId,
    selectedPlaceKey,
    mapReady,
    allPlaces,
    propPlaces,
    mapPlaceToMarker,
    mergePlaceMarkers,
    postToWebView,
    lockMapView,
  ]);

  // Live search suggestions from database (places + cities)
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setRemoteSuggestions([]);
      return;
    }

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      if (!DEV_FLAGS.USE_SERVER_API) return;
      setIsSearching(true);
      try {
        const res = await searchApi.search({ q, limit: 25, sort: 'relevance' });
        const places = ((res as any)?.data || res || []) as any[];
        const mapped = places
          .filter((p: any) => {
            const lat = Number(p.latitude);
            const lng = Number(p.longitude);
            return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
          })
          .map(apiPlaceToMarker);
        setRemoteSuggestions(mapped);
        mergePlaceMarkers(mapped);
      } catch (e) {
        if (__DEV__) console.warn('Map search failed', e);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, apiPlaceToMarker, mergePlaceMarkers]);

  const suggestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    const source =
      remoteSuggestions.length > 0
        ? remoteSuggestions
        : activeTab === 'vendors'
          ? allVendors
          : [...allPlaces, ...allVendors];

    const placeHits = (remoteSuggestions.length > 0 ? remoteSuggestions : allPlaces).filter(
      item =>
        item.type === 'place' &&
        (item.name.toLowerCase().includes(query) ||
          (item.city && item.city.toLowerCase().includes(query)) ||
          (item.state && item.state.toLowerCase().includes(query)) ||
          (item.category && item.category.toLowerCase().includes(query))),
    );

    const cityCounts = new Map<string, { city: string; state?: string; places: MarkerData[] }>();
    placeHits.forEach(p => {
      if (!p.city) return;
      const key = p.city.toLowerCase();
      if (!key.includes(query) && query !== key) return;
      const existing = cityCounts.get(key);
      if (existing) existing.places.push(p);
      else cityCounts.set(key, { city: p.city, state: p.state, places: [p] });
    });

    const cityRows: MarkerData[] = Array.from(cityCounts.values())
      .filter(g => g.places.length >= 2 || g.city.toLowerCase() === query)
      .sort((a, b) => b.places.length - a.places.length)
      .slice(0, 2)
      .map(g => {
        const avgLat = g.places.reduce((s, p) => s + p.lat, 0) / g.places.length;
        const avgLng = g.places.reduce((s, p) => s + p.lng, 0) / g.places.length;
        return {
          id: `city:${g.city}`,
          name: g.city,
          lat: avgLat,
          lng: avgLng,
          category: 'city',
          type: 'place' as const,
          city: g.city,
          state: g.state,
          color: '#63300E',
          emoji: 'ðŸ“',
          sublabel: 'City',
          isCityGroup: true,
          cityPlaceCount: g.places.length,
        };
      });

    const placeRows =
      remoteSuggestions.length > 0
        ? remoteSuggestions.slice(0, 8)
        : source
            .filter(item =>
              item.name.toLowerCase().includes(query) ||
              (item.city && item.city.toLowerCase().includes(query)) ||
              (item.state && item.state.toLowerCase().includes(query)) ||
              (item.category && item.category.toLowerCase().includes(query)),
            )
            .slice(0, 8);

    return [...cityRows, ...placeRows].slice(0, 10);
  }, [searchQuery, remoteSuggestions, allPlaces, allVendors, activeTab]);

  const flyToCity = useCallback(async (places: MarkerData[], cityQuery: string) => {
    lockMapView();
    const q = cityQuery.trim().toLowerCase();
    setActiveTab('places');
    setSelectedMarker(null);

    const exactCity = places.filter(p => (p.city || '').toLowerCase() === q);
    const partialCity = places.filter(p => (p.city || '').toLowerCase().includes(q));
    const cityHits = exactCity.length > 0 ? exactCity : partialCity;

    if (cityHits.length >= 2) {
      mergePlaceMarkers(cityHits);
      postToWebView({
        type: 'fitBounds',
        bounds: cityHits.map(p => [p.lat, p.lng]),
        maxZoom: CITY_ZOOM,
      });
      return true;
    }

    if (cityHits.length === 1) {
      mergePlaceMarkers(cityHits);
      postToWebView({
        type: 'flyTo',
        lat: cityHits[0].lat,
        lng: cityHits[0].lng,
        zoom: CITY_ZOOM,
      });
      return true;
    }

    // Geocode city in India so we still zoom even with sparse place data
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${cityQuery}, India`)}&limit=1&countrycodes=in`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'PalSafar-Mobile/1.0' } },
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.[0]?.lat && data?.[0]?.lon) {
          postToWebView({
            type: 'flyTo',
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            zoom: CITY_ZOOM,
          });
          return true;
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('City geocode failed', e);
    }

    return false;
  }, [mergePlaceMarkers, postToWebView, lockMapView]);

  const flyToSearchResults = useCallback(async (places: MarkerData[], query: string) => {
    if (!places.length) return;
    const q = query.trim().toLowerCase();

    const exactPlace = places.find(p => p.name.toLowerCase() === q);
    const exactCity = places.filter(p => (p.city || '').toLowerCase() === q);
    const cityPartial = places.filter(p => (p.city || '').toLowerCase().includes(q));
    const cityHits = exactCity.length > 0 ? exactCity : cityPartial;

    // Prefer city overview whenever the query matches a city and isn't an exact place name
    const cityNameVotes = new Map<string, number>();
    cityHits.forEach(p => {
      const c = (p.city || '').toLowerCase();
      if (!c) return;
      cityNameVotes.set(c, (cityNameVotes.get(c) || 0) + 1);
    });
    const topCity = [...cityNameVotes.entries()].sort((a, b) => b[1] - a[1])[0];
    const majorityCity =
      topCity && topCity[1] >= Math.max(2, Math.ceil(places.length * 0.4)) ? topCity[0] : null;

    const isCitySearch =
      !exactPlace &&
      (
        cityHits.length >= 2 ||
        !!majorityCity ||
        (exactCity.length >= 1) ||
        (cityPartial.length >= 1 && cityPartial.length === places.length)
      );

    if (isCitySearch) {
      const cityLabel = majorityCity || exactCity[0]?.city || cityHits[0]?.city || query;
      const ok = await flyToCity(places, cityLabel);
      if (ok) return;
    }

    const best =
      exactPlace ||
      places.find(p => p.name.toLowerCase().startsWith(q)) ||
      places[0];
    setActiveTab('places');
    handleMarkerPress(best);
  }, [handleMarkerPress, flyToCity]);

  const runPlaceSearch = useCallback(async (rawQuery?: string) => {
    const q = (rawQuery ?? searchQuery).trim();
    if (!q) return;

    setIsSearching(true);
    setSearchFocused(false);
    try {
      let mapped = remoteSuggestions;
      if (DEV_FLAGS.USE_SERVER_API) {
        const res = await searchApi.search({ q, limit: 100, sort: 'relevance' });
        const places = ((res as any)?.data || res || []) as any[];
        mapped = places
          .filter((p: any) => {
            const lat = Number(p.latitude);
            const lng = Number(p.longitude);
            return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
          })
          .map(apiPlaceToMarker);
      }

      if (!mapped.length) {
        const local = [...allPlaces].filter(item =>
          item.name.toLowerCase().includes(q.toLowerCase()) ||
          (item.city && item.city.toLowerCase().includes(q.toLowerCase()))
        );
        if (!local.length) {
          // Still try geocoding a city name
          const zoomed = await flyToCity([], q);
          if (!zoomed) {
            Alert.alert('Not found', `No tourist places found for "${q}". Try a city or place name.`);
          }
          return;
        }
        mapped = local;
      }

      mergePlaceMarkers(mapped);
      setRemoteSuggestions(mapped.slice(0, 8));
      await flyToSearchResults(mapped, q);
    } catch (e) {
      console.warn(e);
      Alert.alert('Search failed', 'Could not search places right now. Check your connection and try again.');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, remoteSuggestions, allPlaces, apiPlaceToMarker, mergePlaceMarkers, flyToSearchResults, flyToCity]);

  const handleSelectSuggestion = useCallback(async (item: MarkerData) => {
    setSearchQuery(item.name);
    setSearchFocused(false);
    if (item.type === 'place') {
      setActiveTab('places');
      if (!item.isCityGroup) {
        recordSearchedPlace({
          id: item.id,
          name: item.name,
          city: item.city,
          state: item.state,
          category: item.category,
        });
      }
      if (item.isCityGroup && item.city) {
        const sameCity = (remoteSuggestions.length ? remoteSuggestions : allPlaces).filter(
          p => p.city && p.city.toLowerCase() === item.city!.toLowerCase() && !p.isCityGroup,
        );
        const pool = sameCity.length ? sameCity : remoteSuggestions.filter(p => !p.isCityGroup);
        mergePlaceMarkers(pool.length ? pool : [item]);
        await flyToCity(pool.length ? pool : [item], item.city);
        return;
      }
      // If the typed query matches this place's city, zoom to the city instead of one pin
      const typed = searchQuery.trim().toLowerCase();
      if (
        item.city &&
        typed &&
        (item.city.toLowerCase() === typed || item.city.toLowerCase().startsWith(typed)) &&
        item.name.toLowerCase() !== typed
      ) {
        const sameCity = (remoteSuggestions.length ? remoteSuggestions : allPlaces).filter(
          p => p.city && p.city.toLowerCase() === item.city!.toLowerCase() && !p.isCityGroup,
        );
        if (sameCity.length >= 2) {
          mergePlaceMarkers(sameCity);
          await flyToCity(sameCity, item.city);
          return;
        }
      }
      mergePlaceMarkers([item]);
      handleMarkerPress(item);
    } else {
      setActiveTab('vendors');
      handleMarkerPress(item);
    }
  }, [handleMarkerPress, remoteSuggestions, allPlaces, mergePlaceMarkers, flyToCity, searchQuery]);

  const ALLOWED_MESSAGE_TYPES = new Set(['mapReady', 'mapBoundsChanged', 'markerPress', 'zoomChanged', 'cameraMoved', 'mapError']);

  const handleWebMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (!data || !data.type || !ALLOWED_MESSAGE_TYPES.has(data.type)) return;
      switch (data.type) {
        case 'mapReady':
          setMapReady(true);
          setMapError(null);
          pushUserLocationToMap();
          break;
        case 'mapError':
          setMapError(data.message || 'Map failed to load');
          setMapReady(false);
          break;
        case 'mapBoundsChanged': {
          if (activeTab === 'places' && data.bounds) {
            fetchViewportPlaces(data.bounds);
          }
          break;
        }
        case 'markerPress': {
          const marker = markerLookup.get(data.id);
          if (marker) handleMarkerPress(marker);
          break;
        }
      }
    } catch (e) { if (__DEV__) console.warn(e); }
  }, [markerLookup, handleMarkerPress, fetchViewportPlaces, activeTab, pushUserLocationToMap]);

  // Soft timeout — vendored Leaflet + street tiles
  useEffect(() => {
    if (mapReady || mapError) return;
    const t = setTimeout(() => {
      setMapError('Map is taking too long. Tap Retry.');
    }, 20000);
    return () => clearTimeout(t);
  }, [mapReady, mapError, webViewKey]);

  const reloadMap = useCallback(() => {
    setMapReady(false);
    setMapError(null);
    setWebViewKey(k => k + 1);
  }, []);

  const closeSheet = useCallback(() => {
    postToWebView({ type: 'clearSelectedMarker' });
    postToWebView({ type: 'clearRoute' });
    setSelectedMarker(null);
  }, [postToWebView]);

  const handleNavigate = useCallback(async () => {
    if (!selectedMarker) return;
    const marker = selectedMarker;

    // Close the detail card but keep the route on the map
    postToWebView({ type: 'clearSelectedMarker' });
    setSelectedMarker(null);

    let pos = effectivePosition;
    if (!pos) {
      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) {
          Alert.alert('Permission Denied', 'Need location access to navigate from your current location.');
          return;
        }
        pos = effectivePosition;
      }
      if (!pos) return;
    }

    postToWebView({ type: 'clearRoute' });

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${pos.longitude},${pos.latitude};${marker.lng},${marker.lat}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.code === 'Ok' && data.routes.length > 0) {
        const coords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
        postToWebView({ type: 'drawRoute', coords });
        setIsNavigating(true);
      } else {
        Alert.alert('Route not found', 'Could not find a driving route to this location.');
      }
    } catch (e) {
      Alert.alert('Navigation Error', 'Could not fetch route data.');
    }
  }, [selectedMarker, effectivePosition, hasPermission, requestPermission, postToWebView]);

  const handleEndNavigation = useCallback(() => {
    setIsNavigating(false);
    postToWebView({ type: 'clearRoute' });
  }, [postToWebView]);

  const handleCall = useCallback(() => {
    if (!selectedMarker) return;
    const phone = selectedMarker.contactPhone || selectedMarker.phone;
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch(() => {});
    } else {
      Alert.alert('Not Available', 'No phone number listed for this place.');
    }
  }, [selectedMarker]);

  const handleWebsite = useCallback(() => {
    if (!selectedMarker) return;
    const website = selectedMarker.website;
    if (website) {
      Linking.openURL(website).catch(() => {});
    } else {
      Linking.openURL('https://www.google.com/search?q=' + encodeURIComponent(selectedMarker.name)).catch(() => {});
    }
  }, [selectedMarker]);

  useEffect(() => {
    if (user?.currentItinerary?.length) {
      setAddedPlaceIds(new Set(user.currentItinerary));
    }
  }, [user?.currentItinerary]);

  const handleAddToItinerary = useCallback(async () => {
    if (!selectedMarker || selectedMarker.type === 'vendor') return;
    const id = selectedMarker.id;

    if (addedPlaceIds.has(id) || user?.currentItinerary?.includes(id)) return;
    if (pendingItineraryAddsRef.current.has(id)) return;

    if (isGuest) {
      Alert.alert('Sign In Required', 'Create an account or sign in to save places to your itinerary.');
      return;
    }

    const place: TouristSpot = {
      id,
      name: selectedMarker.name,
      city: selectedMarker.city || 'Jabalpur',
      state: selectedMarker.state || 'Madhya Pradesh',
      latitude: selectedMarker.lat,
      longitude: selectedMarker.lng,
      category: selectedMarker.category || 'heritage',
      difficulty: 'easy',
      description: selectedMarker.description || '',
      shortDescription: selectedMarker.description || '',
      imageUri: selectedMarker.image || null,
      rating: selectedMarker.rating,
    };
    cacheItineraryPlace(place);

    pendingItineraryAddsRef.current.add(id);
    setAddingPlaceId(id);
    setAddedPlaceIds(prev => new Set(prev).add(id));
    setUser(prev => {
      const list = prev.currentItinerary || [];
      if (list.includes(id)) return prev;
      return { ...prev, currentItinerary: [...list, id] };
    });
    showSuccess('Added to your itinerary');

    try {
      const draftTripId = await AsyncStorage.getItem(DRAFT_TRIP_ID_KEY);
      const result = await quickAddPlaceToTrip(id, {
        name: selectedMarker.name,
        city: selectedMarker.city,
        tripId: draftTripId || undefined,
      });
      tripsApi.getById(result.tripId).then(seedDraftTripCache).catch(() => {});
    } catch (err: any) {
      setAddedPlaceIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setUser(prev => ({
        ...prev,
        currentItinerary: (prev.currentItinerary || []).filter(placeId => placeId !== id),
      }));
      if (err?.status === 401) {
        Alert.alert('Sign In Required', 'Create an account or sign in to save places to your itinerary.');
      } else {
        showError(err?.message || 'Could not add this place to your itinerary.');
      }
    } finally {
      pendingItineraryAddsRef.current.delete(id);
      setAddingPlaceId(current => (current === id ? null : current));
    }
  }, [selectedMarker, setUser, isGuest, addedPlaceIds, user?.currentItinerary, showSuccess, showError]);

  const handleBookRide = useCallback(() => {
    if (!selectedMarker) return;
    setRideSheetVisible(true);
  }, [selectedMarker]);

  const handleRedeemOffer = useCallback(() => {
    if (!selectedMarker) return;
    closeSheet();
  }, [selectedMarker, closeSheet]);

  const handleFlyToLocation = useCallback(async () => {
    let pos = effectivePosition;
    if (!pos) {
      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) return;
        pos = effectivePosition;
      }
      if (!pos) {
        postToWebView({ type: 'flyTo', lat: DEFAULT_MAP_CENTER.lat, lng: DEFAULT_MAP_CENTER.lng, zoom: DEFAULT_MAP_CENTER.zoom });
        return;
      }
    }
    postToWebView({ type: 'flyTo', lat: pos.latitude, lng: pos.longitude, zoom: MAP_TAB_ZOOM });
    pushUserLocationToMap(pos);
  }, [effectivePosition, hasPermission, requestPermission, postToWebView, pushUserLocationToMap]);

  const handleZoomIn = useCallback(() => {
    postToWebView({ type: 'zoomIn' });
  }, [postToWebView]);

  const handleZoomOut = useCallback(() => {
    postToWebView({ type: 'zoomOut' });
  }, [postToWebView]);

  const handleTabChange = useCallback((tab: 'places' | 'vendors') => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setSelectedMarker(null);
    postToWebView({ type: 'clearSelectedMarker' });
    postToWebView({ type: 'clearRoute' });
    if (tab === 'vendors') fetchVendors();
  }, [activeTab, postToWebView, fetchVendors]);

  const handleRetry = useCallback(() => {
    setLoadError(null);
    setIsLoading(true);
    if (onRetry) onRetry();
    setIsLoading(false);
  }, [onRetry]);

  const handleToggleWishlist = useCallback(async (placeId: string) => {
    const next = await toggleWishlistId(placeId);
    setWishlistIds(next);
  }, []);

  const selectedDistanceLabel = useMemo(() => {
    if (!selectedMarker || !effectivePosition) return undefined;
    return `${calculateDistance(
      effectivePosition.latitude,
      effectivePosition.longitude,
      selectedMarker.lat,
      selectedMarker.lng,
    )} km`;
  }, [selectedMarker, effectivePosition, calculateDistance]);

  const detailBottomInset = Math.max(insets.bottom, 12) + tabClearance;
  const controlsBottom = selectedMarker
    ? detailBottomInset + Math.min(180, SCREEN_H * 0.22)
    : tabClearance + 8;
  const fetchingChipTop = insets.top + (responsive.isSmallPhone ? 118 : 152);

  const bgColor = '#FFF9F2';
  const cardBg = '#FBEFE2';
  const borderClr = 'rgba(200, 155, 60, 0.15)';
  const headerText = '#2C1810';
  const mutedText = '#8B7355';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <WebView
        key={webViewKey}
        ref={webViewRef}
        source={{ html: MAP_HTML, baseUrl: 'https://localhost/' }}
        originWhitelist={['*']}
        style={styles.map}
        onMessage={handleWebMessage}
        onError={(e) => {
          if (__DEV__) console.warn('[Map WebView]', e.nativeEvent);
          setMapError('WebView failed to load the map');
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setBuiltInZoomControls={false}
        allowsBackForwardNavigationGestures={false}
        mixedContentMode="always"
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        allowingReadAccessToURL="*"
        mediaPlaybackRequiresUserAction={false}
        androidLayerType="hardware"
        setSupportMultipleWindows={false}
        onLoadEnd={() => {
          // Soft bump: if HTML loaded but mapReady was lost, ask page to re-announce
          webViewRef.current?.injectJavaScript(`
            (function(){
              try {
                if (window.L && document.getElementById('map') && window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
                }
              } catch (e) {}
              true;
            })();
          `);
        }}
      />

      {!mapReady && (
        <View style={[styles.mapLoadingOverlay, { backgroundColor: mapError ? bgColor : 'rgba(11,18,32,0.88)' }]}>
          {mapError ? (
            <>
              <Icon name="cloud-offline-outline" size={36} color={Pal.colors.light.primary} />
              <Text style={[styles.loadingText, { color: headerText, marginTop: 12 }]}>Map unavailable</Text>
              <Text style={[styles.loadingSubtext, { color: mutedText }]}>{mapError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={reloadMap} activeOpacity={0.8}>
                <Icon name="refresh" size={18} color="#FFF" />
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color="#F5D0A9" />
              <Text style={[styles.loadingText, { color: '#FFF9F2', marginTop: 12 }]}>Loading hybrid map...</Text>
            </>
          )}
        </View>
      )}

      {isNavigating && (
        <View style={[styles.navigatingContainer, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.endNavBtn} onPress={handleEndNavigation} activeOpacity={0.8}>
            <Icon name="close-circle" size={20} color="#FFF" />
            <Text style={styles.endNavText}>End Navigation</Text>
          </TouchableOpacity>
        </View>
      )}

      <Animated.View style={[styles.tabContainer, { paddingTop: insets.top + 6, opacity: fadeAnim }]}>
        {/* Search row */}
        <View style={styles.searchRow}>
          <View style={[styles.searchBarContainer, { backgroundColor: '#FFF9F2', borderColor: borderClr }]}>
            {isSearching ? (
              <ActivityIndicator size="small" color={Pal.colors.light.primary} style={styles.searchIcon} />
            ) : (
              <Icon name="search-outline" size={20} color={Pal.colors.light.primary} style={styles.searchIcon} />
            )}
            <TextInput
              placeholder="Search city or tourist place..."
              placeholderTextColor={mutedText}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 220)}
              style={[styles.searchInput, { color: headerText }]}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => runPlaceSearch()}
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity
                style={styles.clearSearchBtn}
                onPress={() => {
                  setSearchQuery('');
                  setRemoteSuggestions([]);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="close-circle" size={18} color={mutedText} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.searchActionBtn}
              onPress={() => runPlaceSearch()}
              activeOpacity={0.8}
            >
              <Text style={styles.searchActionText}>Go</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Places / Vendors toggle */}
        <View style={[styles.tabRow, { backgroundColor: cardBg, borderColor: borderClr, marginTop: 10 }]}>
          <TouchableOpacity
            style={[styles.tabChip, activeTab === 'places' && styles.tabChipActive]}
            onPress={() => handleTabChange('places')}
            activeOpacity={0.8}
          >
            <Icon name="location" size={14} color={activeTab === 'places' ? '#FFF' : mutedText} />
            <Text style={[styles.tabChipText, { color: activeTab === 'places' ? '#FFF' : headerText }]}>Places</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabChip, activeTab === 'vendors' && styles.tabChipActive]}
            onPress={() => handleTabChange('vendors')}
            activeOpacity={0.8}
          >
            <Icon name="storefront-outline" size={14} color={activeTab === 'vendors' ? '#FFF' : mutedText} />
            <Text style={[styles.tabChipText, { color: activeTab === 'vendors' ? '#FFF' : headerText }]}>Vendors</Text>
          </TouchableOpacity>
        </View>

        {/* Category filters */}
        {activeTab === 'places' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 10 }}
            contentContainerStyle={styles.categoryRow}
          >
            {MAP_UI_FILTERS.map(cat => {
              const active = selectedCategory === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  onPress={() => setSelectedCategory(cat.key)}
                  style={[
                    styles.categoryChip,
                    {
                      borderColor: active ? cat.color : borderClr,
                      backgroundColor: active ? cat.color + '18' : cardBg,
                    },
                  ]}
                >
                  {cat.icon ? (
                    <Icon name={cat.icon} size={14} color={active ? '#FFF9F2' : cat.color} />
                  ) : (
                    <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                  )}
                  <Text style={[
                    styles.categoryChipText,
                    { color: active ? cat.color : headerText },
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[styles.filterSettingsBtn, { borderColor: borderClr, backgroundColor: cardBg }]}
              onPress={() => setFilterModalOpen(true)}
            >
              <Icon name="options-outline" size={18} color="#63300E" />
            </TouchableOpacity>
          </ScrollView>
        )}
        {searchFocused && suggestions.length > 0 && (
          <View style={[styles.suggestionsContainer, { backgroundColor: '#FFF9F2', borderColor: borderClr }]}>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 260 }}>
              {suggestions.map((item, index) => (
                <TouchableOpacity
                  key={`${item.type}-${item.id}`}
                  style={[
                    styles.suggestionItem,
                    index < suggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: borderClr }
                  ]}
                  onPress={() => handleSelectSuggestion(item)}
                >
                  <View style={[styles.suggestionIconWrap, { backgroundColor: (item.color || '#B9834B') + '22' }]}>
                    <Icon
                      name={
                        item.isCityGroup
                          ? 'map-outline'
                          : item.type === 'vendor'
                            ? 'storefront-outline'
                            : 'location-outline'
                      }
                      size={16}
                      color={item.color || '#B9834B'}
                    />
                  </View>
                  <View style={styles.suggestionTextContainer}>
                    <Text style={[styles.suggestionName, { color: headerText }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.suggestionLocation, { color: mutedText }]} numberOfLines={1}>
                      {item.isCityGroup
                        ? `${item.cityPlaceCount || 0} tourist places${item.state ? ` Â· ${item.state}` : ''}`
                        : [item.sublabel, item.city, item.state].filter(Boolean).join(' Â· ')}
                    </Text>
                  </View>
                  <Icon name="chevron-forward" size={14} color={mutedText} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </Animated.View>

      {/* Fetching Indicator */}
      {isMapFetching && (
        <View style={{ position: 'absolute', top: fetchingChipTop, alignSelf: 'center', backgroundColor: 'rgba(30,30,50,0.85)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
          <ActivityIndicator size="small" color={Pal.colors.light.primary} />
          <Text style={{ marginLeft: 8, color: '#FFF', fontSize: 13, fontWeight: '600' }}>Fetching places...</Text>
        </View>
      )}

      {/* Bottom-right zoom + GPS controls */}
      <View style={[styles.mapControls, { bottom: controlsBottom }]}>
        <TouchableOpacity style={[styles.zoomBtn, { backgroundColor: cardBg, borderColor: borderClr }]} onPress={handleZoomIn}>
          <Icon name="add" size={22} color={headerText} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.zoomBtn, { backgroundColor: cardBg, borderColor: borderClr }]} onPress={handleZoomOut}>
          <Icon name="remove" size={22} color={headerText} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.zoomBtn, { backgroundColor: cardBg, borderColor: borderClr }]} onPress={handleFlyToLocation}>
          <Icon name="locate" size={20} color="#63300E" />
        </TouchableOpacity>
      </View>

      {/* Place detail card */}
      {selectedMarker && (
        <MapPlaceDetailCard
          marker={{
            ...selectedMarker,
            description:
              selectedMarker.shortDescription ||
              selectedMarker.description ||
              'A must-visit destination nearby.',
            reviewCount:
              selectedMarker.reviewCount ||
              (selectedMarker.rating ? 1200 : undefined),
          }}
          distanceLabel={selectedDistanceLabel}
          wishlisted={wishlistIds.includes(selectedMarker.id)}
          inItinerary={
            addedPlaceIds.has(selectedMarker.id) ||
            !!user?.currentItinerary?.includes(selectedMarker.id)
          }
          addingToItinerary={addingPlaceId === selectedMarker.id}
          bottomInset={detailBottomInset}
          onClose={closeSheet}
          onToggleWishlist={() => handleToggleWishlist(selectedMarker.id)}
          onBookRide={handleBookRide}
          onAddToItinerary={handleAddToItinerary}
          onNavigate={handleNavigate}
          onViewVendor={() => {
            closeSheet();
            onSelectVendor?.(selectedMarker.id);
          }}
          onVendorOffers={() => {
            const id = selectedMarker.id;
            const name = selectedMarker.name;
            closeSheet();
            onViewVendorContent?.(id, name, 'offers');
          }}
        />
      )}

      <RideOptionsSheet
        visible={rideSheetVisible}
        onClose={() => setRideSheetVisible(false)}
        destLat={selectedMarker?.lat || 0}
        destLng={selectedMarker?.lng || 0}
        destName={selectedMarker?.name || 'Selected Place'}
      />

      <Modal visible={filterModalOpen} transparent animationType="fade" onRequestClose={() => setFilterModalOpen(false)}>
        <Pressable style={styles.filterBackdrop} onPress={() => setFilterModalOpen(false)}>
          <View style={[styles.filterSheet, { marginTop: insets.top + (responsive.isSmallPhone ? 120 : 160) }]}>
            <Text style={styles.filterSheetTitle}>All place filters</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {CATEGORY_FILTERS.map(cat => {
                const active = selectedCategory === cat.key;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[styles.filterSheetRow, active && styles.filterSheetRowActive]}
                    onPress={() => {
                      setSelectedCategory(cat.key);
                      setFilterModalOpen(false);
                    }}
                  >
                    <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                    <Text style={[styles.filterSheetRowText, active && styles.filterSheetRowTextActive]}>
                      {cat.label}
                    </Text>
                    {active && <Icon name="checkmark" size={18} color="#B9834B" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  mapLoadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', zIndex: 10,
  },
  loadingIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(0,168,168,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  loadingText: { fontSize: 17, fontFamily: 'Inter-SemiBold' },
  loadingSubtext: { fontSize: 14, fontFamily: 'Inter-Regular', marginTop: 6, textAlign: 'center', paddingHorizontal: 40 },
  errorIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(0,168,168,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, marginTop: 20,
    backgroundColor: Pal.colors.light.primary,
    shadowColor: Pal.colors.light.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  retryBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'Inter-SemiBold', marginLeft: 8 },

  tabContainer: {
    position: 'absolute', left: 0, right: 0, zIndex: 15, paddingHorizontal: 16,
  },
  tabRow: {
    flexDirection: 'row', borderRadius: 14, padding: 4, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  tabChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 10, gap: 6,
  },
  tabChipActive: {
    backgroundColor: '#000000',
  },
  tabChipText: { fontSize: 13, fontFamily: 'Inter-SemiBold' },
  searchRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  clearSearchBtn: { paddingHorizontal: 4, marginRight: 4 },
  searchActionBtn: {
    backgroundColor: '#63300E',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  searchActionText: { color: '#FFF9F2', fontSize: 13, fontFamily: 'Inter-Bold' },
  categoryRow: { gap: 8, paddingRight: 16 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(200, 155, 60, 0.18)',
  },
  categoryChipAllActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  filterSettingsBtn: {
    width: 40,
    height: 36,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryDot: { width: 8, height: 8, borderRadius: 4 },
  categoryChipText: { fontSize: 13, fontFamily: 'Inter-SemiBold' },
  zoomBtn: {
    width: 44, height: 44, borderRadius: 12, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 4,
  },
  detailCard: {
    position: 'absolute', left: 16, right: 16, zIndex: 20,
    maxHeight: '52%',
    borderRadius: 16, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 8,
    overflow: 'hidden',
  },
  detailClose: {
    position: 'absolute', top: 10, right: 10, zIndex: 2,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3,
  },
  detailScroll: { flexGrow: 0 },
  detailImage: { width: '100%', height: 140 },
  detailImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  detailBody: { padding: 14, paddingTop: 12 },
  detailTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingRight: 28 },
  detailTitle: { fontSize: 18, fontFamily: 'Inter-Bold', flex: 1 },
  detailRating: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFD70018', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
  },
  detailRatingText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#B8860B' },
  detailMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  detailMetaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  detailMetaText: { fontSize: 12, fontFamily: 'Inter-SemiBold' },
  detailDescription: { fontSize: 14, fontFamily: 'Inter-Regular', lineHeight: 21, marginTop: 12 },
  detailActions: { marginTop: 14, gap: 10 },
  detailActionsFixed: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
    gap: 10,
  },
  rideBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#B9834B', paddingVertical: 12, borderRadius: 12,
  },
  rideBtnText: { color: '#FFF9F2', fontSize: 14, fontFamily: 'Inter-Bold' },
  detailActionsRow: { flexDirection: 'row', gap: 10 },
  detailActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12, gap: 6,
  },
  detailActionPrimary: { backgroundColor: '#63300E' },
  detailActionPrimaryText: { color: '#FFF9F2', fontSize: 13, fontFamily: 'Inter-SemiBold' },
  detailActionOutline: { backgroundColor: 'transparent', borderWidth: 1.5 },
  detailActionOutlineText: { fontSize: 13, fontFamily: 'Inter-SemiBold' },

  mapControls: {
    position: 'absolute', right: 16, zIndex: 10, alignItems: 'center', gap: 8,
  },
  filterBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  filterSheet: {
    marginHorizontal: 16,
    backgroundColor: '#FFF9F2',
    borderRadius: 16,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  filterSheetTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#8B7355',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  filterSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterSheetRowActive: {
    backgroundColor: 'rgba(185,131,75,0.1)',
  },
  filterSheetRowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#2C1810',
  },
  filterSheetRowTextActive: {
    color: '#63300E',
    fontWeight: '800',
  },
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 25,
  },
  bottomSheet: {
    position: 'absolute', left: 0, right: 0, height: '100%',
    bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.2, shadowRadius: 32, elevation: 25, zIndex: 30, overflow: 'hidden',
  },
  sheetHandle: { alignItems: 'center', paddingVertical: 12, paddingTop: 14 },
  sheetHandleBar: { width: 40, height: 5, borderRadius: 2.5 },
  sheetNoImage: {
    height: 130, justifyContent: 'center', alignItems: 'center',
  },
  sheetNoImageIcon: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center',
  },
  sheetTitle: { fontSize: 22, fontFamily: 'Inter-Bold', letterSpacing: -0.5 },
  sheetMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8, flexWrap: 'wrap' },
  sheetMetaItem: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  sheetMetaText: { fontSize: 12, fontFamily: 'Inter-SemiBold' },
  sheetDescription: { fontSize: 14, fontFamily: 'Inter-Regular', lineHeight: 22, marginTop: 14 },
  sheetImage: {
    width: '100%', height: 130, borderRadius: 12, marginTop: 12,
  },
  sheetRideBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#FFD700', marginTop: 14, paddingVertical: 10,
    borderRadius: 12, width: '100%',
  },
  sheetRideBtnText: {
    color: '#000', fontSize: 13, fontFamily: 'Inter-Bold',
  },
  sheetActionsFixed: {
    paddingHorizontal: 20, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(25,25,35,0.98)',
  },
  sheetActionsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  sheetShareBtn: {
    width: 40, height: 40, borderRadius: 12,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  sheetActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12, gap: 6,
  },
  sheetActionPrimary: {
    backgroundColor: Pal.colors.light.primary,
    shadowColor: Pal.colors.light.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 4,
  },
  sheetActionOutline: {
    backgroundColor: 'transparent', borderWidth: 1.5,
  },
  sheetActionText: { color: '#FFF', fontSize: 14, fontFamily: 'Inter-SemiBold' },
  navigatingContainer: {
    position: 'absolute', top: 0, left: 0, right: 0,
    alignItems: 'center', zIndex: 50,
  },
  endNavBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#E53935',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, gap: 6,
    shadowColor: '#E53935', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  endNavText: { color: '#FFF', fontSize: 14, fontFamily: 'Inter-Bold' },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingLeft: 12,
    paddingRight: 8,
    height: 50,
    borderWidth: 1,
    shadowColor: '#63300E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    paddingVertical: 0,
    minHeight: 44,
  },
  suggestionsContainer: {
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  suggestionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionEmoji: { fontSize: 16 },
  suggestionTextContainer: { flex: 1 },
  suggestionName: { fontSize: 14, fontFamily: 'Inter-SemiBold' },
  suggestionLocation: { fontSize: 12, fontFamily: 'Inter-Regular', marginTop: 2 },
});
