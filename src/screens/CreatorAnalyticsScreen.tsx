import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { socialApi } from '../services/api/social';
import type { CreatorAnalytics } from '../types';
import { useBottomSafePadding } from '../design/responsive';

const C = {
  bg: '#FFF9F2',
  surface: '#fff',
  bronze: '#B9834B',
  deep: '#63300E',
  muted: '#8B7355',
  border: '#E9D4BE',
};

const compact = (v: number) =>
  v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v);

export default function CreatorAnalyticsScreen({ onBack }: { onBack?: () => void }) {
  const scrollPadBottom = useBottomSafePadding(24);
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('7d');
  const [data, setData] = useState<CreatorAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        setData((await socialApi.getCreatorAnalytics(period)).data);
      } catch (e: any) {
        setError(e?.message || 'Could not load analytics.');
        if (!refresh) setData(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period],
  );

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={C.bronze} />
      </SafeAreaView>
    );
  }

  if (error && !data) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retry} onPress={() => load()}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const kpis = data?.kpis;
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <FlatList
        data={data?.topReels || []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[styles.list, { paddingBottom: scrollPadBottom }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.bronze} />
        }
        ListHeaderComponent={
          <>
            {onBack ? (
              <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                <Icon name="arrow-back" size={22} color={C.deep} />
              </TouchableOpacity>
            ) : null}
            <Text style={styles.eyebrow}>CREATOR STUDIO</Text>
            <Text style={styles.title}>Analytics</Text>
            {error ? <Text style={styles.inlineError}>{error}</Text> : null}
            <View style={styles.chips}>
              {(['7d', '30d', 'all'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.chip, period === p && styles.chipActive]}
                  onPress={() => setPeriod(p)}
                >
                  <Text style={[styles.chipText, period === p && styles.chipTextActive]}>
                    {p === 'all' ? 'All time' : p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.grid}>
              {[
                { l: 'Views', v: compact(kpis?.views || 0), i: 'eye-outline' },
                { l: 'Likes', v: compact(kpis?.likes || 0), i: 'heart-outline' },
                { l: 'Comments', v: compact(kpis?.comments || 0), i: 'chatbubble-outline' },
                { l: 'Saves', v: compact(kpis?.saves || 0), i: 'bookmark-outline' },
              ].map((x) => (
                <View style={styles.card} key={x.l}>
                  <Icon name={x.i} size={18} color={C.bronze} />
                  <Text style={styles.value}>{x.v}</Text>
                  <Text style={styles.label}>{x.l}</Text>
                </View>
              ))}
            </View>
            <View style={styles.engagement}>
              <Text style={styles.engagementLabel}>Engagement rate</Text>
              <Text style={styles.engagementValue}>{kpis?.engagementRate || 0}%</Text>
            </View>
            <Text style={styles.note}>{data?.note}</Text>
            <Text style={styles.section}>Top reels</Text>
          </>
        }
        renderItem={({ item, index }) => (
          <View style={styles.reel}>
            <Text style={styles.rank}>#{index + 1}</Text>
            <View style={styles.play}>
              <Icon name="play" color="#fff" size={16} />
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.reelTitle}>
                {item.title || 'Untitled reel'}
              </Text>
              <Text style={styles.meta}>
                {compact(item.views)} views · {compact(item.likes)} likes
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Publish reels to see your best performers.</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: { color: C.muted, textAlign: 'center', marginBottom: 14, fontWeight: '600' },
  inlineError: { color: '#A84032', fontSize: 12, fontWeight: '600', marginTop: 8 },
  retry: {
    backgroundColor: C.bronze,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  retryText: { color: '#fff', fontWeight: '800' },
  list: { padding: 20 },
  backBtn: { marginBottom: 8, alignSelf: 'flex-start' },
  eyebrow: { fontSize: 11, letterSpacing: 1.4, color: C.bronze, fontWeight: '800' },
  title: { fontSize: 27, fontWeight: '800', color: C.deep, marginTop: 4 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 18, marginBottom: 16 },
  chip: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: C.surface,
  },
  chipActive: { backgroundColor: C.bronze, borderColor: C.bronze },
  chipText: { fontWeight: '700', fontSize: 12, color: C.muted },
  chipTextActive: { color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '47.8%',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 15,
    padding: 14,
  },
  value: { fontSize: 21, fontWeight: '800', color: C.deep, marginTop: 7 },
  label: { fontSize: 12, color: C.muted },
  engagement: {
    backgroundColor: '#F5DDAE',
    borderRadius: 15,
    padding: 15,
    marginTop: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  engagementLabel: { color: C.deep, fontWeight: '700' },
  engagementValue: { color: C.deep, fontWeight: '800', fontSize: 22 },
  note: { fontSize: 11, color: C.muted, lineHeight: 16, marginTop: 12 },
  section: { color: C.deep, fontWeight: '800', fontSize: 18, marginTop: 24, marginBottom: 10 },
  reel: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 9,
  },
  rank: { color: C.bronze, fontWeight: '800', width: 25 },
  play: {
    height: 36,
    width: 36,
    borderRadius: 8,
    backgroundColor: C.deep,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reelTitle: { fontWeight: '800', color: C.deep },
  meta: { fontSize: 11, color: C.muted, marginTop: 3 },
  empty: { color: C.muted, textAlign: 'center', paddingVertical: 25 },
});
