import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GlassCard } from '../components/ui/GlassCard';
import { Badge } from '../components/ui/Badge';
import { useTheme } from '../context/ThemeContext';
import { searchUniversal, UniversalSearchResult } from '../services/searchService';
import { recordSearchedPlace } from '../utils/passportPlaces';
import { useHeaderSafePadding, useBottomSafePadding } from '../design/responsive';

type Tab = never;

const TABS: Tab[] = [];

export default function SearchScreen({
  onBack,
  onSelectSpot,
  initialQuery,
}: {
  onBack?: () => void;
  onSelectSpot?: (spotId: string) => void;
  initialQuery?: string;
}) {
  const { theme } = useTheme();
  const headerPadTop = useHeaderSafePadding(12);
  // Stack screen (RootNavigator Search) — not a MainTabs child
  const scrollPadBottom = useBottomSafePadding(24);
  const [query, setQuery] = useState(initialQuery?.trim() || '');

  const [results, setResults] = useState<UniversalSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initialQuery?.trim()) {
      setQuery(initialQuery.trim());
    }
  }, [initialQuery]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const saved = await AsyncStorage.getItem('@search_history');
      if (saved) setHistory(JSON.parse(saved));
    } catch (e) { console.warn('Caught empty exception', e); }
  };

  const saveToHistory = async (q: string) => {
    const newHist = [q, ...history.filter(h => h !== q)].slice(0, 10);
    setHistory(newHist);
    await AsyncStorage.setItem('@search_history', JSON.stringify(newHist));
  };

  const clearHistory = async () => {
    setHistory([]);
    await AsyncStorage.removeItem('@search_history');
  };

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) {
      setResults(null);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchUniversal(query.trim());
        setResults(data);
        saveToHistory(query.trim());
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  const handleResultPress = (type: string, item: any) => {
    switch (type.toLowerCase()) {
      case 'place':
      case 'hidden gem':
        recordSearchedPlace({
          id: item.id || item.slug,
          name: item.name,
          city: item.city,
          state: item.state,
          category: item.category,
          isHiddenGem: type.toLowerCase() === 'hidden gem' || item.isHiddenGem,
          slug: item.slug,
        } as any);
        onSelectSpot?.(item.id);
        break;
      case 'vendor':
        // Navigate to vendor profile/detail if handler exists, else fall back to place detail
        if ((onBack as any)?.onSelectVendor) {
          (onBack as any).onSelectVendor(item.id);
        } else {
          onSelectSpot?.(item.placeId || item.id);
        }
        break;
      case 'reel':
        // Navigate to reel detail if handler exists
        if ((onBack as any)?.onSelectReel) {
          (onBack as any).onSelectReel(item.id);
        } else {
          onSelectSpot?.(item.placeId || item.id);
        }
        break;
      case 'creator':
        // Navigate to creator profile if handler exists
        if ((onBack as any)?.onSelectCreator) {
          (onBack as any).onSelectCreator(item.id);
        } else {
          // Show an info alert — no place to navigate to without a dedicated handler
          Alert.alert(item.name || item.fullName || 'Creator', item.bio || 'Creator profile');
        }
        break;
      case 'event':
        if (item.placeId) {
          onSelectSpot?.(item.placeId);
        } else {
          Alert.alert(item.name || item.title || 'Event', item.description || '');
        }
        break;
      case 'offer':
        if (item.vendorId || item.placeId) {
          onSelectSpot?.(item.placeId || item.vendorId);
        } else {
          Alert.alert(item.name || item.title || 'Offer', item.description || '');
        }
        break;
      default:
        onSelectSpot?.(item.id);
    }
  };

  const renderItem = (type: string, item: any, icon: string) => (
    <TouchableOpacity
      key={`${type}-${item.id}`}
      onPress={() => handleResultPress(type, item)}
      style={{ flexDirection: 'row', gap: 14, padding: 16, borderRadius: 24, backgroundColor: theme.glass, marginBottom: 12 }}
    >
      <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: theme.primary + '20', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {item.thumbnail || item.imageUrl || item.avatarUrl || item.thumbnailUrl || item.imageUri ? (
          <Image source={{ uri: item.thumbnail || item.imageUrl || item.avatarUrl || item.thumbnailUrl || item.imageUri }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <Text style={{ fontSize: 24 }}>{icon}</Text>
        )}
      </View>
      <View style={{ flex: 1, justifyContent: 'center', gap: 4 }}>
        <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 16, color: theme.text }} numberOfLines={1}>
          {item.name || item.title || item.businessName || item.fullName || item.username}
        </Text>
        {(item.city || item.shortDescription || item.description || item.bio) && (
          <Text style={{ fontSize: 12, color: theme.textMuted }} numberOfLines={1}>
            {item.city || item.shortDescription || item.description || item.bio}
          </Text>
        )}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
          {item.rating && <Badge label={`${item.rating.toFixed(1)}`} variant="primary" size="sm" />}
          <Badge label={type} variant="outline" size="sm" />
          {item.category && <Badge label={item.category} variant="secondary" size="sm" />}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ padding: 24, paddingTop: headerPadTop, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.glass, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: theme.text, fontSize: 20 }}>←</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.glass, borderRadius: 24, paddingHorizontal: 16, height: 52 }}>
            <Text style={{ fontSize: 18 }}>🔍</Text>
            <TextInput
              placeholder="Search PalSafar..."
              placeholderTextColor={theme.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
              style={{ flex: 1, fontSize: 16, color: theme.text }}
            />
            {query.length > 0 && <TouchableOpacity onPress={() => setQuery('')}><Text style={{ fontSize: 18, color: theme.textMuted }}>✕</Text></TouchableOpacity>}
          </View>
        </View>

      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: scrollPadBottom }}>
        {!query.trim() ? (
          <View style={{ gap: 32 }}>
            {history.length > 0 && (
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 15, color: theme.text }}>Recent Searches</Text>
                  <TouchableOpacity onPress={clearHistory}>
                    <Text style={{ color: theme.primary, fontSize: 13 }}>Clear</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {history.map((s) => (
                    <TouchableOpacity key={s} onPress={() => setQuery(s)} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, backgroundColor: theme.glass, borderWidth: 1, borderColor: theme.border }}>
                      <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: theme.textMuted }}>🕒 {s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        ) : loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
        ) : results ? (
          <View>
            <Text style={{ fontFamily: 'Inter-Medium', fontSize: 14, color: theme.textMuted, marginBottom: 16 }}>
              {results.meta.totalResults} results found
            </Text>

            {results.places?.map(p => renderItem('Place', p, '📍'))}
            {results.hiddenGems?.map(g => renderItem('Hidden Gem', g, '💎'))}
            {results.reels?.map(r => renderItem('Reel', r, '🎬'))}
            {results.vendors?.map(v => renderItem('Vendor', v, '🏪'))}
            {results.offers?.map(o => renderItem('Offer', o, '🏷️'))}
            {results.events?.map(e => renderItem('Event', e, '🎟️'))}
            {results.creators?.map(c => renderItem('Creator', c, '👤'))}

            {results.meta.totalResults === 0 && (
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Text style={{ fontSize: 40, marginBottom: 16 }}>🔍</Text>
                <Text style={{ color: theme.text, fontFamily: 'Inter-SemiBold', fontSize: 18 }}>No results found</Text>
                <Text style={{ color: theme.textMuted, marginTop: 8 }}>Try adjusting your search query</Text>
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
