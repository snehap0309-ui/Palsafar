import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useUserContext } from '../context/UserContext';
import { useHeaderSafePadding, useBottomSafePadding } from '../design/responsive';
import { tripsApi } from '../services/api/trips';
import { placesApi } from '../services/api';
import { loadItineraryPlaceCache } from '../utils/itineraryPlacesCache';
import {
  loadSearchedPassportPlaces,
  mergePassportPlaces,
  type PassportPlace,
} from '../utils/passportPlaces';

const CITY_REWARDS: Record<string, { points: number; badge: string }> = {
  jabalpur: { points: 150, badge: '👑 Jabalpur Legend' },
  delhi: { points: 200, badge: '🏛️ Mughal Historian' },
  agra: { points: 150, badge: '🕌 Taj Guardian' },
  jaipur: { points: 200, badge: '🏰 Royal Rajput' },
  udaipur: { points: 180, badge: '🏞️ Lake Warden' },
};

function stopToPassportPlace(stop: any): PassportPlace | null {
  const place = stop?.place;
  const id = place?.id || stop?.placeId;
  if (!id) return null;
  return {
    id: String(id),
    name: place?.name || 'Place',
    city: (place?.city || '').trim() || 'Unknown',
    state: (place?.state || '').trim() || 'Unknown',
    category: place?.category,
    isHiddenGem: place?.source === 'HIDDEN_GEM' || place?.category?.toLowerCase?.() === 'hidden_gem',
    source: 'itinerary',
    slug: place?.slug,
  };
}

async function resolvePlaceIds(ids: string[]): Promise<PassportPlace[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  const resolved: PassportPlace[] = [];
  await Promise.all(
    unique.slice(0, 40).map(async (id) => {
      try {
        const res = await placesApi.getById(id);
        const p = (res as any)?.data || res;
        if (!p?.id && !p?.slug) return;
        resolved.push({
          id: String(p.id || p.slug || id),
          name: p.name || 'Place',
          city: (p.city || '').trim() || 'Unknown',
          state: (p.state || '').trim() || 'Unknown',
          category: p.category,
          isHiddenGem: p.source === 'HIDDEN_GEM' || String(p.category || '').toLowerCase() === 'hidden_gem',
          source: 'itinerary',
          slug: p.slug,
        });
      } catch {
        // skip unresolved
      }
    }),
  );
  return resolved;
}

export default function TravelPassportScreen({ onBack }: { onBack: () => void }) {
  const headerPadTop = useHeaderSafePadding(12);
  const bottomPad = useBottomSafePadding(24);
  const { theme } = useTheme();
  const { user } = useUserContext();
  const [places, setPlaces] = useState<PassportPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'cities' | 'states' | 'gems'>('cities');

  const loadPassportPlaces = useCallback(async () => {
    setLoading(true);
    try {
      const searched = await loadSearchedPassportPlaces();
      const cache = await loadItineraryPlaceCache();

      const itineraryFromCache: PassportPlace[] = Object.values(cache).map((p) => ({
        id: p.id,
        name: p.name,
        city: (p.city || '').trim() || 'Unknown',
        state: (p.state || '').trim() || 'Unknown',
        category: p.category,
        isHiddenGem: !!(p.isHiddenGem || p.category?.toLowerCase() === 'hidden_gem'),
        source: 'itinerary' as const,
      }));

      const localItineraryIds = user.currentItinerary || [];
      const tripPlaces: PassportPlace[] = [];
      try {
        const listRes = await tripsApi.list({ limit: 30 });
        const trips = (listRes as any)?.data || listRes || [];
        const tripList = Array.isArray(trips) ? trips : [];
        const detailed = await Promise.all(
          tripList.slice(0, 20).map(async (t: any) => {
            try {
              return await tripsApi.getById(t.id);
            } catch {
              return t;
            }
          }),
        );
        for (const trip of detailed) {
          for (const day of trip?.tripDays || []) {
            for (const stop of day?.stops || []) {
              const mapped = stopToPassportPlace(stop);
              if (mapped) tripPlaces.push(mapped);
            }
          }
        }
      } catch {
        // guest / offline — still use local itinerary ids
      }

      const knownIds = new Set(
        [...searched, ...itineraryFromCache, ...tripPlaces].map((p) => p.id),
      );
      const missingLocal = localItineraryIds.filter((id) => !knownIds.has(id));
      const resolvedLocal = missingLocal.length ? await resolvePlaceIds(missingLocal) : [];

      const merged = mergePassportPlaces([
        ...searched,
        ...itineraryFromCache,
        ...tripPlaces,
        ...resolvedLocal,
        ...localItineraryIds
          .filter((id) => !knownIds.has(id) && !resolvedLocal.some((r) => r.id === id))
          .map((id) => ({
            id,
            name: 'Place',
            city: 'Unknown',
            state: 'Unknown',
            category: 'general',
            source: 'itinerary' as const,
          })),
      ]).filter((p) => p.name !== 'Place' || p.city !== 'Unknown');

      setPlaces(merged);
    } catch (err) {
      console.warn('Failed to load passport places:', err);
      setPlaces([]);
    } finally {
      setLoading(false);
    }
  }, [user.currentItinerary]);

  useFocusEffect(
    useCallback(() => {
      loadPassportPlaces();
    }, [loadPassportPlaces]),
  );

  const visitedSet = useMemo(() => {
    const set = new Set<string>(user.visitedSpots || []);
    return set;
  }, [user.visitedSpots]);

  const isVisited = useCallback(
    (place: PassportPlace) =>
      visitedSet.has(place.id) || (!!place.slug && visitedSet.has(place.slug)),
    [visitedSet],
  );

  const stats = useMemo(() => {
    if (places.length === 0) return { cityProgress: [], stateProgress: [], gemCount: 0, totalGems: 0 };

    const citiesMap: Record<string, { total: number; visited: number; state: string }> = {};
    const statesMap: Record<string, { total: number; visited: number; cities: Set<string> }> = {};
    let gemCount = 0;
    let totalGems = 0;

    places.forEach((spot) => {
      const city = spot.city || 'Unknown';
      const state = spot.state || 'Unknown';
      const visited = isVisited(spot);

      if (spot.isHiddenGem || spot.category?.toLowerCase() === 'hidden_gem') {
        totalGems++;
        if (visited) gemCount++;
      }

      if (!citiesMap[city]) citiesMap[city] = { total: 0, visited: 0, state };
      citiesMap[city].total++;
      if (visited) citiesMap[city].visited++;

      if (!statesMap[state]) statesMap[state] = { total: 0, visited: 0, cities: new Set() };
      statesMap[state].total++;
      statesMap[state].cities.add(city);
      if (visited) statesMap[state].visited++;
    });

    const cityProgress = Object.entries(citiesMap)
      .map(([name, data]) => ({
        name,
        ...data,
        percent: Math.round((data.visited / data.total) * 100),
        isCompleted: data.visited === data.total && data.total > 0,
      }))
      .sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name));

    const stateProgress = Object.entries(statesMap)
      .map(([name, data]) => ({
        name,
        total: data.total,
        visited: data.visited,
        cityCount: data.cities.size,
        percent: Math.round((data.visited / data.total) * 100),
        isCompleted: data.visited === data.total && data.total > 0,
      }))
      .sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name));

    return { cityProgress, stateProgress, gemCount, totalGems };
  }, [places, isVisited]);

  const visitedInPassport = useMemo(
    () => places.filter((p) => isVisited(p)).length,
    [places, isVisited],
  );

  const overallCompletion = useMemo(() => {
    if (places.length === 0) return 0;
    return Math.round((visitedInPassport / places.length) * 100);
  }, [places.length, visitedInPassport]);

  const renderCityItem = ({ item }: { item: (typeof stats.cityProgress)[0] }) => {
    const rewardInfo = CITY_REWARDS[item.name.toLowerCase()];
    return (
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>{item.name}</Text>
            <Text style={[styles.cardSubtitle, { color: theme.textMuted }]}>{item.state}</Text>
          </View>
          <View style={[styles.stampPill, { backgroundColor: item.isCompleted ? theme.success + '20' : theme.primary + '10' }]}>
            <Text style={{ fontSize: 20, marginRight: 4 }}>{item.isCompleted ? '👑' : '✈️'}</Text>
            <Text style={[styles.stampText, { color: item.isCompleted ? theme.success : theme.primary }]}>
              {item.visited}/{item.total} Stamps
            </Text>
          </View>
        </View>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBarBg, { backgroundColor: theme.border }]}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${item.percent}%`, backgroundColor: item.isCompleted ? theme.success : theme.primary },
              ]}
            />
          </View>
          <Text style={[styles.progressPercent, { color: theme.text }]}>{item.percent}%</Text>
        </View>
        {rewardInfo ? (
          <View style={[styles.rewardBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Icon name="gift-outline" size={18} color={theme.gold} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rewardTitle, { color: theme.text }]}>Reward: {rewardInfo.badge}</Text>
                <Text style={{ fontSize: 10, color: theme.textMuted }}>
                  Complete all spots for +{rewardInfo.points} pts
                </Text>
              </View>
            </View>
            <View style={[styles.claimBadge, { backgroundColor: item.isCompleted ? theme.success : theme.textMuted + '15' }]}>
              <Text style={{ fontSize: 10, color: item.isCompleted ? '#fff' : theme.textMuted, fontWeight: '700' }}>
                {item.isCompleted ? 'DONE' : 'IN PROGRESS'}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const renderStateItem = ({ item }: { item: (typeof stats.stateProgress)[0] }) => (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{item.name}</Text>
          <Text style={[styles.cardSubtitle, { color: theme.textMuted }]}>{item.cityCount} Cities</Text>
        </View>
        <View style={[styles.stampPill, { backgroundColor: item.isCompleted ? theme.success + '20' : theme.accent + '10' }]}>
          <Text style={[styles.stampText, { color: item.isCompleted ? theme.success : theme.accent }]}>
            {item.visited}/{item.total} Visited
          </Text>
        </View>
      </View>
      <View style={styles.progressContainer}>
        <View style={[styles.progressBarBg, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${item.percent}%`, backgroundColor: item.isCompleted ? theme.success : theme.accent },
            ]}
          />
        </View>
        <Text style={[styles.progressPercent, { color: theme.text }]}>{item.percent}%</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.background} />

      <View style={[styles.header, { paddingTop: headerPadTop }]}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Icon name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Digital Travel Passport</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.overviewCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 44, marginRight: 16 }}>📖</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.overviewTitle, { color: theme.text }]}>Your Explorer Passport</Text>
            <Text style={[styles.overviewSubtitle, { color: theme.textMuted }]}>
              Issued to: {user.displayName || 'Pal Explorer'}
            </Text>
            <Text style={[styles.overviewStamps, { color: theme.primary }]}>
              🇮🇳 {visitedInPassport} / {places.length} stamps from your searches & trips
            </Text>
          </View>
        </View>
        <View style={[styles.progressContainer, { marginTop: 16 }]}>
          <View style={[styles.progressBarBg, { backgroundColor: theme.border, height: 8 }]}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${overallCompletion}%`, backgroundColor: theme.primary, height: 8 },
              ]}
            />
          </View>
          <Text style={[styles.progressPercent, { color: theme.text, fontWeight: '800' }]}>
            {overallCompletion}%
          </Text>
        </View>
      </View>

      <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
        {(['cities', 'states', 'gems'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && [styles.activeTab, { borderBottomColor: theme.primary }]]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab ? { color: theme.primary, fontWeight: '700' } : { color: theme.textMuted },
              ]}
            >
              {tab === 'cities' ? 'Cities' : tab === 'states' ? 'States' : 'Hidden Gems'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : places.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🗺️</Text>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No passport places yet</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
            Search places on the map or Search tab, or add stops to an itinerary. Only those places appear here.
          </Text>
        </View>
      ) : activeTab === 'cities' ? (
        <FlatList
          data={stats.cityProgress}
          keyExtractor={(item) => item.name}
          renderItem={renderCityItem}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
        />
      ) : activeTab === 'states' ? (
        <FlatList
          data={stats.stateProgress}
          keyExtractor={(item) => item.name}
          renderItem={renderStateItem}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <ScrollView contentContainerStyle={[styles.gemScroll, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
          <View style={[styles.gemBigCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={{ fontSize: 64, textAlign: 'center', marginBottom: 12 }}>💎</Text>
            <Text style={[styles.gemBigTitle, { color: theme.text }]}>Hidden Gem Hunter</Text>
            <Text style={[styles.gemBigSubtitle, { color: theme.textMuted }]}>
              Hidden gems from places you searched or added to trips.
            </Text>
            <View style={styles.gemCounterBox}>
              <View style={styles.gemCountItem}>
                <Text style={[styles.gemCountNum, { color: theme.cyan }]}>{stats.gemCount}</Text>
                <Text style={{ fontSize: 11, color: theme.textMuted }}>Visited</Text>
              </View>
              <View style={[styles.gemDivider, { backgroundColor: theme.border }]} />
              <View style={styles.gemCountItem}>
                <Text style={[styles.gemCountNum, { color: theme.text }]}>{stats.totalGems}</Text>
                <Text style={{ fontSize: 11, color: theme.textMuted }}>In your list</Text>
              </View>
            </View>
            <View style={[styles.badgeUnlockCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Text style={{ fontSize: 24, marginRight: 12 }}>🎖️</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.badgeTitle, { color: theme.text }]}>Hidden Gem Enthusiast</Text>
                <Text style={{ fontSize: 11, color: theme.textMuted }}>
                  Visit 3 hidden gems from your list. Status:{' '}
                  {stats.gemCount >= 3 ? '✅ UNLOCKED' : `❌ LOCKED (${stats.gemCount}/3)`}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  overviewCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  overviewTitle: { fontSize: 18, fontWeight: '800' },
  overviewSubtitle: { fontSize: 12, marginTop: 2 },
  overviewStamps: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  tabBar: { flexDirection: 'row', marginTop: 20, borderBottomWidth: 1, paddingHorizontal: 8 },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomWidth: 2 },
  tabText: { fontSize: 14, fontWeight: '500' },
  list: { padding: 16, gap: 16 },
  card: { borderRadius: 16, padding: 16, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardSubtitle: { fontSize: 11, marginTop: 2 },
  stampPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  stampText: { fontSize: 12, fontWeight: '700' },
  progressContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 10 },
  progressBarBg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  progressPercent: { fontSize: 12, fontWeight: '700', width: 36, textAlign: 'right' },
  rewardBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  rewardTitle: { fontSize: 12, fontWeight: '700' },
  claimBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  gemScroll: { padding: 16 },
  gemBigCard: { borderRadius: 24, padding: 24, borderWidth: 1, alignItems: 'center' },
  gemBigTitle: { fontSize: 22, fontWeight: '800' },
  gemBigSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  gemCounterBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 30,
    width: '100%',
  },
  gemCountItem: { alignItems: 'center' },
  gemCountNum: { fontSize: 28, fontWeight: '800' },
  gemDivider: { width: 1, height: 40 },
  badgeUnlockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 32,
    width: '100%',
  },
  badgeTitle: { fontSize: 13, fontWeight: '700' },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
