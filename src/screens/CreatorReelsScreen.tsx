import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { socialApi } from '../services/api/social';
import { useUserContext } from '../context/UserContext';
import type { Reel } from '../types';
import { useStudioTabScreenInsets } from '../design/tabBarLayout';

const C = {
  bg: '#FDFBF8',
  surface: '#FFFFFF',
  bronze: '#A67C52',
  deep: '#4D3227',
  muted: '#8B7355',
  border: '#E9D4BE',
  soft: '#FBEFE2',
};

const H_PAD = 20;
const GAP = 10;
const COLS = 3;

type SortKey = 'latest' | 'oldest' | 'views' | 'likes';
type StatusFilter = 'HIDDEN' | 'PENDING' | 'REJECTED' | 'APPROVED';

const SORT_LABELS: Record<SortKey, string> = {
  latest: 'Latest',
  oldest: 'Oldest',
  views: 'Most views',
  likes: 'Most likes',
};

const compact = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v));

type CreatorReelRow = Reel & { commentsCount: number };

function unwrapMyReels(payload: unknown): CreatorReelRow[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as CreatorReelRow[];
  const page = payload as { items?: CreatorReelRow[]; data?: CreatorReelRow[] };
  if (Array.isArray(page.items)) return page.items;
  if (Array.isArray(page.data)) return page.data;
  return [];
}

function filterOwnReels(items: CreatorReelRow[], creatorProfileId?: string | null, userId?: string | null) {
  return items.filter((reel) => {
    if (userId && reel.creator?.userId && reel.creator.userId !== userId) return false;
    if (
      creatorProfileId
      && reel.creatorId
      && reel.creatorId !== creatorProfileId
      && reel.creator?.id
      && reel.creator.id !== creatorProfileId
    ) {
      return false;
    }
    return true;
  });
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return '1 day ago';
  if (diffDay < 7) return `${diffDay} days ago`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek === 1) return '1 week ago';
  if (diffWeek < 5) return `${diffWeek} weeks ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth <= 1) return '1 month ago';
  return `${diffMonth} months ago`;
}

function sortReels(items: CreatorReelRow[], sort: SortKey): CreatorReelRow[] {
  const copy = [...items];
  switch (sort) {
    case 'oldest':
      return copy.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    case 'views':
      return copy.sort((a, b) => b.views - a.views);
    case 'likes':
      return copy.sort((a, b) => b.likes - a.likes);
    default:
      return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export default function CreatorReelsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useUserContext();
  const studioInsets = useStudioTabScreenInsets();
  const { width: SCREEN_W } = useWindowDimensions();
  const TILE_W = (SCREEN_W - H_PAD * 2 - GAP * (COLS - 1)) / COLS;
  const TILE_H = TILE_W * 1.35;
  const creatorProfileId = user?.creatorProfile?.id;
  const userId = user?.uid;

  const [reels, setReels] = useState<CreatorReelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<CreatorReelRow | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [sort, setSort] = useState<SortKey>('latest');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    route.params?.initialTab || 'APPROVED',
  );

  useEffect(() => {
    if (route.params?.initialTab) setStatusFilter(route.params.initialTab);
  }, [route.params?.initialTab]);

  const filtered = useMemo(() => {
    const byStatus = reels.filter((r) => String(r.status || 'APPROVED').toUpperCase() === statusFilter);
    return sortReels(byStatus, sort);
  }, [reels, statusFilter, sort]);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await socialApi.getMyReels(1, 50);
        const items = filterOwnReels(unwrapMyReels(res.data), creatorProfileId, userId);
        setReels(items);
        setError('');
      } catch (e: any) {
        setReels([]);
        setError(e?.message || 'Could not load your reels.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [creatorProfileId, userId],
  );

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (reel: CreatorReelRow) => {
    setSelected(reel);
    setTitle(reel.title || '');
    setDescription(reel.description || '');
  };

  const save = async () => {
    if (!selected) return;
    try {
      const res = await socialApi.updateReel(selected.id, {
        title: title.trim() || undefined,
        description: description.trim() || undefined,
      });
      setReels((prev) => prev.map((r) => (r.id === selected.id ? { ...r, ...res.data } : r)));
      setSelected(null);
    } catch (e: any) {
      Alert.alert('Could not update reel', e?.message || 'Please try again.');
    }
  };

  const remove = (reel: Reel) =>
    Alert.alert('Delete reel?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await socialApi.deleteReel(reel.id);
            setReels((prev) => prev.filter((r) => r.id !== reel.id));
          } catch (e: any) {
            Alert.alert('Could not delete reel', e?.message || 'Please try again.');
          }
        },
      },
    ]);

  const onReelMenu = (reel: CreatorReelRow) => {
    Alert.alert(reel.title || 'Reel', 'Choose an action', [
      { text: 'Edit', onPress: () => openEdit(reel) },
      {
        text: 'Report issue',
        onPress: () => {
          socialApi.reportReel(reel.id, 'CREATOR_SELF_FLAG').catch((e: any) =>
            Alert.alert('Report failed', e?.message || 'Try again'),
          );
        },
      },
      { text: 'Delete', style: 'destructive', onPress: () => remove(reel) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const openSortMenu = () => {
    Alert.alert('Sort reels', undefined, [
      ...(Object.keys(SORT_LABELS) as SortKey[]).map((key) => ({
        text: SORT_LABELS[key],
        onPress: () => setSort(key),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const openFilterMenu = () => {
    const draftCount = reels.filter((r) => String(r.status || '').toUpperCase() === 'HIDDEN').length;
    Alert.alert('Show reels', undefined, [
      { text: 'Published', onPress: () => setStatusFilter('APPROVED') },
      { text: `Drafts (${draftCount})`, onPress: () => setStatusFilter('HIDDEN') },
      { text: 'Pending review', onPress: () => setStatusFilter('PENDING') },
      { text: 'Rejected', onPress: () => setStatusFilter('REJECTED') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const filterLabel =
    statusFilter === 'APPROVED'
      ? SORT_LABELS[sort]
      : statusFilter === 'HIDDEN'
        ? 'Drafts'
        : statusFilter === 'PENDING'
          ? 'Pending'
          : 'Rejected';

  const renderTile = ({ item }: { item: CreatorReelRow }) => (
    <TouchableOpacity
      style={{ width: TILE_W }}
      activeOpacity={0.9}
      onPress={() => navigation.navigate('ReelDetail', { reelId: item.id, reels: filtered })}
      onLongPress={() => openEdit(item)}
    >
      <View style={[styles.thumbWrap, { width: TILE_W, height: TILE_H }]}>
        {item.thumbnail ? (
          <Image source={{ uri: item.thumbnail }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <Icon name="play" size={26} color="#fff" />
          </View>
        )}
        <View style={styles.viewsOverlay}>
          <Icon name="play" size={10} color="#fff" />
          <Text style={styles.viewsText}>{compact(item.views)}</Text>
        </View>
        <TouchableOpacity style={styles.menuBtn} hitSlop={8} onPress={() => onReelMenu(item)}>
          <Icon name="ellipsis-horizontal" size={14} color="#fff" />
        </TouchableOpacity>
      </View>
      <Text numberOfLines={2} style={styles.tileTitle}>
        {item.title || 'Untitled reel'}
      </Text>
      <Text style={styles.tileTime}>{formatRelativeTime(item.createdAt)}</Text>
    </TouchableOpacity>
  );

  const listHeader = (
    <View style={styles.header}>
      <Text style={styles.title}>My Reels</Text>
      <TouchableOpacity style={styles.sortBtn} onPress={statusFilter === 'APPROVED' ? openSortMenu : openFilterMenu}>
        <Text style={styles.sortLabel}>Sort by: {filterLabel}</Text>
        <Icon name="chevron-down" size={14} color={C.bronze} />
      </TouchableOpacity>
    </View>
  );

  const createCard = (
    <View style={styles.createCard}>
      <View style={styles.createIconWrap}>
        <MaterialCommunityIcons name="movie-open-outline" size={22} color={C.bronze} />
      </View>
      <View style={styles.createCopy}>
        <Text style={styles.createTitle}>Create a new reel</Text>
        <Text style={styles.createSub}>Share your journey and inspire the world.</Text>
      </View>
      <TouchableOpacity style={styles.createBtn} onPress={() => navigation.navigate('CreateReel')}>
        <Text style={styles.createBtnText}>+ Create Reel</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={C.bronze} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        numColumns={COLS}
        renderItem={renderTile}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.bronze} />
        }
        contentContainerStyle={[styles.list, { paddingBottom: studioInsets.scrollPadBottom }]}
        columnWrapperStyle={filtered.length > 0 ? styles.row : undefined}
        ListHeaderComponent={listHeader}
        ListFooterComponent={
          <>
            {error && filtered.length === 0 ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
                  <Text style={styles.retryText}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {createCard}
          </>
        }
        ListEmptyComponent={
          !error ? (
            <View style={styles.empty}>
              <Icon name="videocam-outline" size={40} color={C.bronze} />
              <Text style={styles.emptyTitle}>
                {statusFilter === 'HIDDEN' ? 'No drafts yet' : 'Your story starts here'}
              </Text>
              <Text style={styles.emptyText}>
                {statusFilter === 'HIDDEN'
                  ? 'Save a reel as draft while editing.'
                  : 'Publish your first travel reel for your audience.'}
              </Text>
            </View>
          ) : null
        }
      />

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Edit reel</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor={C.muted}
              style={styles.input}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Description"
              placeholderTextColor={C.muted}
              multiline
              style={[styles.input, styles.textarea]}
            />
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={styles.cancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.save} onPress={save}>
                <Text style={styles.saveText}>Save changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: H_PAD },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 4,
  },
  title: { fontSize: 22, fontWeight: '800', color: C.deep },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortLabel: { fontSize: 12, fontWeight: '700', color: C.bronze },
  row: { gap: GAP, marginBottom: GAP },
  thumbWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: C.deep,
  },
  thumb: { width: '100%', height: '100%' },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.deep },
  viewsOverlay: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  viewsText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  menuBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: { fontSize: 11, fontWeight: '800', color: C.deep, marginTop: 8, lineHeight: 14 },
  tileTime: { fontSize: 10, color: C.muted, marginTop: 3 },
  createCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginTop: 8,
  },
  createIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createCopy: { flex: 1, minWidth: 0 },
  createTitle: { fontSize: 14, fontWeight: '800', color: C.deep },
  createSub: { fontSize: 11, color: C.muted, marginTop: 3, lineHeight: 15 },
  createBtn: {
    backgroundColor: C.deep,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  createBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: C.deep, marginTop: 10 },
  emptyText: { color: C.muted, textAlign: 'center', marginTop: 5, fontSize: 12, lineHeight: 17 },
  errorBox: { alignItems: 'center', paddingVertical: 24 },
  errorText: { color: '#A84032', textAlign: 'center', fontSize: 12, marginBottom: 10 },
  retryBtn: { backgroundColor: C.bronze, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '800' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(44,24,16,.42)',
    justifyContent: 'center',
    padding: 24,
  },
  modal: { backgroundColor: C.bg, borderRadius: 18, padding: 20 },
  modalTitle: { color: C.deep, fontSize: 20, fontWeight: '800', marginBottom: 14 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 12,
    color: C.deep,
    marginBottom: 10,
  },
  textarea: { height: 100, textAlignVertical: 'top' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 20,
    marginTop: 4,
  },
  cancel: { color: C.muted, fontWeight: '700' },
  save: {
    backgroundColor: C.bronze,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  saveText: { color: '#fff', fontWeight: '800' },
});
