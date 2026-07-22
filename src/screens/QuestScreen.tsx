import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
  Animated,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from '../utils/LinearGradient';
import { Ionicons } from '../utils/Icons';
import { colors, spacing, borderRadius, shadows } from '../config/theme';
import {
  treasureHunts,
  TreasureHunt,
  TreasureCheckpoint,
  completeCheckpoint,
  getUniqueCities,
  filterHuntsByGps,
} from '../data/treasureHunts';
import { useLocationContext } from '../context/LocationContext';
import { useUserContext } from '../context/UserContext';
import { useDataContext } from '../context/DataContext';
import { questsApi } from '../services/api/quests';
import { launchCamera } from 'react-native-image-picker';
import { uploadApi } from '../services/api/upload';
import { haversineDistance, formatDistance } from '../utils/location';
import {
  markCheckpointCompleted,
  loadQuestProgress,
  saveActiveQuestId,
  loadActiveQuestId,
  loadStartedQuests,
  saveStartedQuests,
} from '../services/localStorageService';
import { useHeaderSafePadding, useBottomSafePadding } from '../design/responsive';

const NEARBY_HUNT_RADIUS_KM = 60;

// ─── Tab types ───────────────────────────────────────────────────────────────
type TabKey = 'explore' | 'active' | 'completed';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'explore', label: 'Explore', icon: 'compass-outline' },
  { key: 'active', label: 'Active', icon: 'flame-outline' },
  { key: 'completed', label: 'Completed', icon: 'trophy-outline' },
];

// ─── Difficulty config ────────────────────────────────────────────────────────
const DIFFICULTY: Record<string, { color: string; bg: string; label: string; emoji: string }> = {
  easy:   { color: '#21E58A', bg: 'rgba(33,229,138,0.15)',   label: 'EASY',   emoji: '🌿' },
  medium: { color: '#FF9F1C', bg: 'rgba(255,159,28,0.15)',   label: 'MEDIUM', emoji: '⚡' },
  hard:   { color: '#F44336', bg: 'rgba(244,67,54,0.15)',    label: 'HARD',   emoji: '🔥' },
};

interface QuestScreenProps {
  onBack: () => void;
  initialQuestId?: string;
  initialTab?: TabKey;
}

export default function QuestScreen({ onBack, initialQuestId, initialTab = 'explore' }: QuestScreenProps) {
  const { effectivePosition } = useLocationContext();
  const { user, setUser } = useUserContext();
  const { handleCompleteActivity } = useDataContext();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const headerPadTop = useHeaderSafePadding();
  const scrollPadBottom = useBottomSafePadding(40) + 80;

  // ─── State ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [allHunts, setAllHunts] = useState<TreasureHunt[]>([]);
  const [huntProgress, setHuntProgress] = useState<Record<string, string[]>>({}); // huntId -> completedCheckpointIds
  const [startedQuestIds, setStartedQuestIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail modal
  const [selectedHunt, setSelectedHunt] = useState<TreasureHunt | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // Checkpoint verification
  const [activeCheckpoint, setActiveCheckpoint] = useState<TreasureCheckpoint | null>(null);
  const [cpModalVisible, setCpModalVisible] = useState(false);
  const [gpsVerified, setGpsVerified] = useState(false);
  const [verifyingGps, setVerifyingGps] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingCheckpoint, setSavingCheckpoint] = useState(false);

  // Celebration
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{ title: string; points: number; badge?: string } | null>(null);

  // Animations
  const tabIndicatorX = useRef(new Animated.Value(0)).current;
  const celebrationScale = useRef(new Animated.Value(0)).current;
  const celebrationOpacity = useRef(new Animated.Value(0)).current;
  const headerPulse = useRef(new Animated.Value(1)).current;

  const cities = ['All', ...getUniqueCities(allHunts)];
  const difficulties = ['All', 'Easy', 'Medium', 'Hard'];

  // ─── Load data (only hunts near current GPS) ───────────────────────────────
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const localHunts = filterHuntsByGps(
        treasureHunts.filter(h => h.isActive),
        effectivePosition?.latitude,
        effectivePosition?.longitude,
        NEARBY_HUNT_RADIUS_KM,
      );

      // Load persisted progress for each hunt
      const progressMap: Record<string, string[]> = {};
      await Promise.all(
        localHunts.map(async h => {
          const completed = await loadQuestProgress(h.id);
          progressMap[h.id] = completed;
          // Restore completions into the local data
          completed.forEach(cpId => {
            const cp = h.checkpoints.find(c => c.id === cpId);
            if (cp) cp.isCompleted = true;
          });
          const done = h.checkpoints.filter(c => c.isCompleted).length;
          h.progress = Math.round((done / h.checkpoints.length) * 100);
        })
      );
      setHuntProgress(progressMap);

      const started = await loadStartedQuests();
      setStartedQuestIds(started);

      // Try to fetch extra quests from server (still GPS-filtered)
      try {
        const res = await questsApi.listActive({ limit: 50 });
        const serverQ = res.data || [];
        for (const q of serverQ) {
          if (q.type === 'scavenger_hunt' && q.placeIds.length > 0 && !localHunts.find(h => h.id === q.id)) {
            localHunts.push({
              id: q.id,
              title: q.title,
              description: q.description || `${q.type.replace('_', ' ')} adventure`,
              difficulty: (q.difficulty as any) || 'medium',
              estimatedTime: q.estimatedTime || '2-3 hours',
              rewardCoins: q.rewardPoints,
              city: q.city || 'Various',
              checkpoints: (q.checkpoints
                ? q.checkpoints.map((sc: any, i: number): TreasureCheckpoint => ({
                    id: sc.id || `cp_server_${q.id}_${i}`,
                    spotId: sc.id || `${q.id}_${i}`,
                    spotName: sc.name || `Checkpoint ${i + 1}`,
                    clue: sc.clue || `Visit location ${i + 1} to complete this quest.`,
                    isCompleted: false,
                    order: i + 1,
                    lat: sc.lat,
                    lng: sc.lng,
                    verificationMode: sc.verificationMode || 'gps',
                  }))
                : q.placeIds.map((pid, i): TreasureCheckpoint => ({
                    id: `cp_server_${q.id}_${i}`,
                    spotId: pid,
                    spotName: `Checkpoint ${i + 1}`,
                    clue: `Visit location ${i + 1} to complete this quest.`,
                    isCompleted: false,
                    order: i + 1,
                  }))),
              isActive: true,
              progress: 0,
            });
          }
        }
      } catch { /* use local only */ }

      const nearby = filterHuntsByGps(
        localHunts,
        effectivePosition?.latitude,
        effectivePosition?.longitude,
        NEARBY_HUNT_RADIUS_KM,
      );
      setAllHunts(nearby);
      setLoading(false);
    };
    init();

    // Header pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(headerPulse, { toValue: 1.08, duration: 1800, useNativeDriver: true }),
        Animated.timing(headerPulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, [effectivePosition?.latitude, effectivePosition?.longitude]);

  useEffect(() => {
    if (!initialQuestId || !allHunts.length) return;
    const hunt = allHunts.find(h => h.id === initialQuestId);
    if (hunt) {
      setSelectedHunt(hunt);
      setDetailVisible(true);
    }
  }, [initialQuestId, allHunts]);

  // Tab indicator animation
  useEffect(() => {
    const idx = TABS.findIndex(t => t.key === activeTab);
    Animated.spring(tabIndicatorX, {
      toValue: idx * (SCREEN_WIDTH / TABS.length),
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  }, [activeTab, SCREEN_WIDTH]);

  // ─── Derived lists ────────────────────────────────────────────────────────
  const filteredHunts = allHunts.filter(h => {
    const cityMatch = selectedCity === 'All' || h.city === selectedCity;
    const diffMatch = selectedDifficulty === 'All' || h.difficulty === selectedDifficulty.toLowerCase();
    return cityMatch && diffMatch;
  });

  const activeHunts = allHunts.filter(h => startedQuestIds.includes(h.id) && h.progress < 100);
  const completedHunts = allHunts.filter(h => h.progress === 100);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const openHuntDetail = useCallback((hunt: TreasureHunt) => {
    setSelectedHunt(hunt);
    setDetailVisible(true);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailVisible(false);
    setTimeout(() => setSelectedHunt(null), 300);
  }, []);

  const handleStartHunt = useCallback(async (hunt: TreasureHunt) => {
    if (!startedQuestIds.includes(hunt.id)) {
      const updated = [...startedQuestIds, hunt.id];
      setStartedQuestIds(updated);
      await saveStartedQuests(updated);
      await saveActiveQuestId(hunt.id);
    }
  }, [startedQuestIds]);

  const handleOpenCheckpoint = useCallback((cp: TreasureCheckpoint) => {
    if (cp.isCompleted) {
      Alert.alert('Already Done! ✅', 'You have already completed this checkpoint!');
      return;
    }
    setActiveCheckpoint(cp);
    setGpsVerified(false);
    setPhotoUrl(null);
    setCpModalVisible(true);
  }, []);

  const handleVerifyGps = useCallback(() => {
    if (!effectivePosition || !activeCheckpoint) {
      Alert.alert('GPS Error', 'Please enable location services and try again.');
      return;
    }
    if (!activeCheckpoint.lat || !activeCheckpoint.lng) {
      // No coords registered — auto-pass (legacy data)
      setGpsVerified(true);
      Alert.alert('📍 Location Verified!', 'You are at the checkpoint location!');
      return;
    }
    setVerifyingGps(true);
    const dist = haversineDistance(
      effectivePosition.latitude,
      effectivePosition.longitude,
      activeCheckpoint.lat,
      activeCheckpoint.lng
    );
    setTimeout(() => {
      setVerifyingGps(false);
      const passed = dist <= 100 || __DEV__;
      if (passed) {
        setGpsVerified(true);
        Alert.alert('📍 Location Verified!', `You are${__DEV__ ? ' (dev mode)' : ''} at the checkpoint location!`);
      } else {
        Alert.alert(
          '📍 Too Far Away',
          `You are ${formatDistance(dist)} from the checkpoint. Walk closer to verify your location!`
        );
      }
    }, 1200);
  }, [effectivePosition, activeCheckpoint]);

  const handleTakePhoto = useCallback(() => {
    launchCamera({ mediaType: 'photo', quality: 0.7, saveToPhotos: false }, async (response) => {
      if (response.didCancel) return;
      if (response.errorMessage) { Alert.alert('Camera Error', response.errorMessage); return; }
      const asset = response.assets?.[0];
      if (asset?.uri) {
        setUploadingPhoto(true);
        try {
          const res = await uploadApi.uploadImage(asset.uri);
          setPhotoUrl(res.url);
        } catch {
          setPhotoUrl(asset.uri);
        } finally {
          setUploadingPhoto(false);
          Alert.alert('📸 Photo Captured!', 'Photo proof captured successfully.');
        }
      }
    });
  }, []);

  const handleCompleteCheckpoint = useCallback(async () => {
    if (!selectedHunt || !activeCheckpoint) return;
    const needsPhoto = activeCheckpoint.verificationMode === 'gps_photo';
    if (!gpsVerified) { Alert.alert('Incomplete', 'Please verify your GPS location first.'); return; }
    if (needsPhoto && !photoUrl) { Alert.alert('Incomplete', 'Please capture a photo proof first.'); return; }

    setSavingCheckpoint(true);
    try {
      // Persist locally
      const updatedCompleted = await markCheckpointCompleted(selectedHunt.id, activeCheckpoint.id);
      setHuntProgress(prev => ({ ...prev, [selectedHunt.id]: updatedCompleted }));

      // Mutate local data
      completeCheckpoint(selectedHunt.id, activeCheckpoint.id);
      handleCompleteActivity(`checkpoint_${activeCheckpoint.id}`, 25);

      // Sync to server
      try {
        await questsApi.completeCheckpoint(selectedHunt.id, activeCheckpoint.id, photoUrl || undefined);
      } catch { /* offline or local quest — ignore */ }

      // Update hunt list
      setAllHunts(prev => prev.map(h => {
        if (h.id !== selectedHunt.id) return h;
        const done = h.checkpoints.filter(c => c.isCompleted || c.id === activeCheckpoint.id).length;
        return { ...h, progress: Math.round((done / h.checkpoints.length) * 100) };
      }));

      // Auto-start if not already started
      await handleStartHunt(selectedHunt);

      setCpModalVisible(false);
      setActiveCheckpoint(null);

      // Check if full hunt is done
      const hunt = allHunts.find(h => h.id === selectedHunt.id);
      if (hunt) {
        const allDone = hunt.checkpoints.every(c => c.isCompleted || c.id === activeCheckpoint.id);
        if (allDone) {
          // Award points
          setUser(u => ({ ...u, totalPoints: (u.totalPoints || 0) + hunt.rewardCoins }));
          // Sync full completion
          try { await questsApi.complete(hunt.id); } catch { /* ignore duplicate */ }
          // Show celebration
          setTimeout(() => {
            setCelebrationData({ title: hunt.title, points: hunt.rewardCoins, badge: hunt.rewardBadge });
            showCelebration();
          }, 400);
        } else {
          const remaining = hunt.checkpoints.filter(c => !c.isCompleted && c.id !== activeCheckpoint.id).length;
          Alert.alert('✅ Checkpoint Unlocked!', `+25 PalPoints earned!\n${remaining} checkpoint${remaining !== 1 ? 's' : ''} remaining.`);
        }
      }
    } finally {
      setSavingCheckpoint(false);
    }
  }, [selectedHunt, activeCheckpoint, gpsVerified, photoUrl, allHunts, handleStartHunt]);

  const showCelebration = useCallback(() => {
    setCelebrationVisible(true);
    Animated.parallel([
      Animated.spring(celebrationScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(celebrationOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const hideCelebration = useCallback(() => {
    Animated.parallel([
      Animated.timing(celebrationScale, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(celebrationOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setCelebrationVisible(false));
  }, []);

  // ─── Render helpers ────────────────────────────────────────────────────────
  const renderHuntCard = ({ item: hunt }: { item: TreasureHunt }) => {
    const diff = DIFFICULTY[hunt.difficulty] || DIFFICULTY.easy;
    const completed = hunt.checkpoints.filter(c => c.isCompleted).length;
    const isStarted = startedQuestIds.includes(hunt.id);
    const isDone = hunt.progress === 100;

    return (
      <TouchableOpacity
        style={styles.huntCard}
        onPress={() => openHuntDetail(hunt)}
        activeOpacity={0.85}
      >
        {/* Golden glow accent */}
        <LinearGradient
          colors={[colors.gold + '22', 'transparent'] as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        <View style={styles.huntCardTop}>
          <View style={styles.huntCardLeft}>
            <Text style={styles.huntCityChip}>📍 {hunt.city}</Text>
            <Text style={styles.huntCardTitle} numberOfLines={2}>{hunt.title}</Text>
            <Text style={styles.huntCardDesc} numberOfLines={2}>{hunt.description}</Text>
          </View>
          <View style={styles.huntCardRight}>
            <View style={styles.rewardPill}>
              <Text style={styles.rewardPillEmoji}>🏆</Text>
              <Text style={styles.rewardPillText}>+{hunt.rewardCoins}</Text>
            </View>
          </View>
        </View>

        <View style={styles.huntCardMeta}>
          <View style={[styles.diffBadge, { backgroundColor: diff.bg }]}>
            <Text style={[styles.diffBadgeText, { color: diff.color }]}>{diff.emoji} {diff.label}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={12} color={colors.textMuted} />
            <Text style={styles.metaText}>{hunt.estimatedTime}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="flag-outline" size={12} color={colors.textMuted} />
            <Text style={styles.metaText}>{hunt.checkpoints.length} stops</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBarBg}>
          <LinearGradient
            colors={isDone ? ['#21E58A', '#0CB06A'] as any : [colors.gold, colors.orange] as any}
            style={[styles.progressBarFill, { width: `${hunt.progress}%` }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </View>
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>
            {completed}/{hunt.checkpoints.length} checkpoints
            {isDone ? ' 🎉' : ''}
          </Text>
          {isStarted && !isDone && (
            <View style={styles.activePill}>
              <Text style={styles.activePillText}>● ACTIVE</Text>
            </View>
          )}
          {isDone && (
            <View style={[styles.activePill, { backgroundColor: '#21E58A20' }]}>
              <Text style={[styles.activePillText, { color: '#21E58A' }]}>✓ DONE</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderCheckpointStep = (cp: TreasureCheckpoint, idx: number, hunt: TreasureHunt) => {
    const isCompleted = cp.isCompleted;
    const completedIds = huntProgress[hunt.id] || [];
    const done = completedIds.includes(cp.id) || isCompleted;
    const isNext = !done && hunt.checkpoints.slice(0, idx).every(c => c.isCompleted || completedIds.includes(c.id));

    return (
      <TouchableOpacity
        key={cp.id}
        style={[styles.cpStep, done && styles.cpStepDone, isNext && styles.cpStepNext]}
        onPress={() => handleOpenCheckpoint(cp)}
        activeOpacity={done ? 1 : 0.7}
      >
        {/* Connector line */}
        {idx > 0 && <View style={[styles.cpConnector, done && styles.cpConnectorDone]} />}

        <View style={[styles.cpBullet, done && styles.cpBulletDone, isNext && styles.cpBulletNext]}>
          {done ? (
            <Ionicons name="checkmark" size={16} color="#fff" />
          ) : (
            <Text style={[styles.cpBulletText, isNext && { color: '#fff' }]}>{idx + 1}</Text>
          )}
        </View>

        <View style={styles.cpInfo}>
          <Text style={[styles.cpName, done && styles.cpNameDone]}>{cp.spotName}</Text>
          <Text style={styles.cpClueLabel}>🔍 Clue</Text>
          <Text style={styles.cpClue} numberOfLines={2}>{cp.clue}</Text>

          {isNext && !done && (
            <View style={styles.cpActionRow}>
              <Ionicons name="navigate-outline" size={14} color={colors.gold} />
              <Text style={styles.cpActionText}>Tap to verify location</Text>
            </View>
          )}
        </View>

        {done ? (
          <Ionicons name="checkmark-circle" size={24} color="#21E58A" />
        ) : isNext ? (
          <Ionicons name="chevron-forward" size={20} color={colors.gold} />
        ) : (
          <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
        )}
      </TouchableOpacity>
    );
  };

  // ─── Tab content ──────────────────────────────────────────────────────────
  const renderExplore = () => (
    <>
      {/* City filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {cities.map(city => (
          <TouchableOpacity
            key={city}
            style={[styles.filterChip, selectedCity === city && styles.filterChipActive]}
            onPress={() => setSelectedCity(city)}
          >
            <Text style={[styles.filterChipText, selectedCity === city && styles.filterChipTextActive]}>
              {city === 'All' ? '🗺️ All Cities' : city}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Difficulty filter */}
      <View style={styles.diffRow}>
        {difficulties.map(d => (
          <TouchableOpacity
            key={d}
            style={[styles.diffChip, selectedDifficulty === d && styles.diffChipActive]}
            onPress={() => setSelectedDifficulty(d)}
          >
            <Text style={[styles.diffChipText, selectedDifficulty === d && styles.diffChipTextActive]}>
              {d === 'All' ? 'All' : `${DIFFICULTY[d.toLowerCase()]?.emoji} ${d}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={styles.loadingText}>Loading adventures...</Text>
        </View>
      ) : filteredHunts.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>🗺️</Text>
          <Text style={styles.emptyTitle}>No Quests Nearby</Text>
          <Text style={styles.emptyDesc}>
            {!effectivePosition
              ? 'Enable GPS to see treasure hunts at your current location.'
              : 'Treasure hunts only show when you are near their checkpoints. Try a different filter, or travel to a hunt city.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredHunts}
          keyExtractor={h => h.id}
          renderItem={renderHuntCard}
          contentContainerStyle={[styles.huntList, { paddingBottom: scrollPadBottom }]}
          scrollEnabled={false}
        />
      )}
    </>
  );

  const renderActive = () => (
    <View style={{ paddingHorizontal: spacing.md }}>
      {activeHunts.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>🔥</Text>
          <Text style={styles.emptyTitle}>No Active Quests</Text>
          <Text style={styles.emptyDesc}>Head to Explore to start a treasure hunt!</Text>
          <TouchableOpacity style={styles.ctaButton} onPress={() => setActiveTab('explore')}>
            <Text style={styles.ctaButtonText}>Browse Quests →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={activeHunts}
          keyExtractor={h => h.id}
          renderItem={renderHuntCard}
          contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: scrollPadBottom }}
          scrollEnabled={false}
        />
      )}
    </View>
  );

  const renderCompleted = () => (
    <View style={{ paddingHorizontal: spacing.md }}>
      {completedHunts.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>🏆</Text>
          <Text style={styles.emptyTitle}>No Completed Quests Yet</Text>
          <Text style={styles.emptyDesc}>Complete all checkpoints in a quest to earn PalPoints!</Text>
          <TouchableOpacity style={styles.ctaButton} onPress={() => setActiveTab('explore')}>
            <Text style={styles.ctaButtonText}>Start Exploring →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        completedHunts.map(hunt => {
          const diff = DIFFICULTY[hunt.difficulty] || DIFFICULTY.easy;
          return (
            <View key={hunt.id} style={styles.completedCard}>
              <LinearGradient colors={['rgba(33,229,138,0.12)', 'transparent'] as any} style={StyleSheet.absoluteFillObject} />
              <View style={styles.completedHeader}>
                <Text style={styles.completedEmoji}>🏆</Text>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.completedTitle}>{hunt.title}</Text>
                  <Text style={styles.completedCity}>📍 {hunt.city}</Text>
                </View>
                <View style={[styles.diffBadge, { backgroundColor: diff.bg }]}>
                  <Text style={[styles.diffBadgeText, { color: diff.color }]}>{diff.label}</Text>
                </View>
              </View>
              {hunt.rewardBadge && (
                <View style={styles.badgePill}>
                  <Text style={styles.badgePillText}>{hunt.rewardBadge}</Text>
                </View>
              )}
              <View style={styles.completedStats}>
                <View style={styles.completedStat}>
                  <Text style={styles.completedStatVal}>{hunt.checkpoints.length}</Text>
                  <Text style={styles.completedStatLabel}>Checkpoints</Text>
                </View>
                <View style={styles.completedStat}>
                  <Text style={[styles.completedStatVal, { color: colors.gold }]}>+{hunt.rewardCoins}</Text>
                  <Text style={styles.completedStatLabel}>PalPoints</Text>
                </View>
              </View>
            </View>
          );
        })
      )}
      <View style={{ height: scrollPadBottom }} />
    </View>
  );

  // ─── Main render ──────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#0A0A0A', '#121212'] as any} style={[styles.header, { paddingTop: headerPadTop }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Animated.Text style={[styles.headerTitle, { transform: [{ scale: headerPulse }] }]}>
            🏴‍☠️ Quests
          </Animated.Text>
          <Text style={styles.headerSubtitle}>Treasure Hunt Adventures</Text>
        </View>
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsBadgeText}>⭐ {user?.totalPoints ?? 0}</Text>
        </View>
      </LinearGradient>

      {/* Stats strip */}
      <View style={styles.statsStrip}>
        <View style={styles.statItem}>
          <Text style={styles.statVal}>{allHunts.length}</Text>
          <Text style={styles.statLbl}>Hunts</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statVal, { color: '#FF9F1C' }]}>{activeHunts.length}</Text>
          <Text style={styles.statLbl}>Active</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statVal, { color: '#21E58A' }]}>{completedHunts.length}</Text>
          <Text style={styles.statLbl}>Completed</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statVal, { color: colors.gold }]}>
            {allHunts.reduce((s, h) => s + h.rewardCoins, 0)}
          </Text>
          <Text style={styles.statLbl}>Total Pts</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <Animated.View
          style={[
            styles.tabIndicator,
            { width: SCREEN_WIDTH / TABS.length, transform: [{ translateX: tabIndicatorX }] },
          ]}
        />
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={16}
              color={activeTab === tab.key ? colors.gold : colors.textMuted}
            />
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            {tab.key === 'active' && activeHunts.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{activeHunts.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {activeTab === 'explore' && renderExplore()}
        {activeTab === 'active' && renderActive()}
        {activeTab === 'completed' && renderCompleted()}
      </ScrollView>

      {/* ── Hunt Detail Modal ─────────────────────────────────────────────── */}
      <Modal visible={detailVisible} transparent animationType="slide" onRequestClose={closeDetail}>
        <View style={styles.modalOverlay}>
          <View style={styles.detailSheet}>
            <View style={styles.detailHandle} />
            {selectedHunt && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Hero */}
                <LinearGradient
                  colors={[colors.gold + '25', colors.orange + '15', 'transparent'] as any}
                  style={styles.detailHero}
                >
                  <View style={styles.detailHeroRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailHeroEmoji}>
                        {DIFFICULTY[selectedHunt.difficulty]?.emoji ?? '🗺️'}
                      </Text>
                      <Text style={styles.detailHeroTitle}>{selectedHunt.title}</Text>
                      <Text style={styles.detailHeroCity}>📍 {selectedHunt.city}</Text>
                    </View>
                    <TouchableOpacity style={styles.closeBtn} onPress={closeDetail}>
                      <Ionicons name="close" size={22} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.detailHeroDesc}>{selectedHunt.description}</Text>

                  <View style={styles.detailMetaRow}>
                    <View style={[styles.diffBadge, { backgroundColor: DIFFICULTY[selectedHunt.difficulty]?.bg }]}>
                      <Text style={[styles.diffBadgeText, { color: DIFFICULTY[selectedHunt.difficulty]?.color }]}>
                        {DIFFICULTY[selectedHunt.difficulty]?.label}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                      <Text style={styles.metaText}>{selectedHunt.estimatedTime}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="trophy-outline" size={13} color={colors.gold} />
                      <Text style={[styles.metaText, { color: colors.gold }]}>+{selectedHunt.rewardCoins} pts</Text>
                    </View>
                  </View>

                  {/* Progress */}
                  <View style={styles.detailProgress}>
                    <View style={styles.progressRow}>
                      <Text style={styles.progressText}>
                        {selectedHunt.checkpoints.filter(c => c.isCompleted).length}/{selectedHunt.checkpoints.length} checkpoints
                      </Text>
                      <Text style={styles.progressText}>{selectedHunt.progress}%</Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <LinearGradient
                        colors={selectedHunt.progress === 100 ? ['#21E58A', '#0CB06A'] as any : [colors.gold, colors.orange] as any}
                        style={[styles.progressBarFill, { width: `${selectedHunt.progress}%` }]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      />
                    </View>
                  </View>
                </LinearGradient>

                {/* Start button if not started */}
                {!startedQuestIds.includes(selectedHunt.id) && selectedHunt.progress < 100 && (
                  <TouchableOpacity
                    style={styles.startBtn}
                    onPress={() => handleStartHunt(selectedHunt)}
                  >
                    <LinearGradient colors={[colors.gold, colors.orange] as any} style={styles.startBtnGrad}>
                      <Ionicons name="play-circle-outline" size={20} color="#000" />
                      <Text style={styles.startBtnText}>Start This Quest</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                {/* Checkpoints */}
                <View style={styles.cpSection}>
                  <Text style={styles.cpSectionTitle}>🗺️ Checkpoint Route</Text>
                  {selectedHunt.checkpoints
                    .sort((a, b) => a.order - b.order)
                    .map((cp, idx) => renderCheckpointStep(cp, idx, selectedHunt))}
                </View>

                {/* Reward badge */}
                {selectedHunt.rewardBadge && (
                  <View style={styles.rewardBanner}>
                    <LinearGradient colors={[colors.gold + '30', colors.gold + '10'] as any} style={styles.rewardBannerGrad}>
                      <Text style={styles.rewardBannerEmoji}>🎖️</Text>
                      <View>
                        <Text style={styles.rewardBannerTitle}>Completion Reward</Text>
                        <Text style={styles.rewardBannerBadge}>{selectedHunt.rewardBadge}</Text>
                      </View>
                    </LinearGradient>
                  </View>
                )}

                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Checkpoint Verification Modal ─────────────────────────────────── */}
      <Modal visible={cpModalVisible} transparent animationType="slide" onRequestClose={() => setCpModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.cpSheet}>
            <View style={styles.detailHandle} />
            {activeCheckpoint && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.cpSheetHeader}>
                  <View>
                    <Text style={styles.cpSheetStep}>CHECKPOINT {activeCheckpoint.order}</Text>
                    <Text style={styles.cpSheetTitle}>{activeCheckpoint.spotName}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setCpModalVisible(false)}>
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>

                {/* Clue */}
                <View style={styles.clueBox}>
                  <Text style={styles.clueLabel}>🔍 The Mystery Clue</Text>
                  <Text style={styles.clueText}>{activeCheckpoint.clue}</Text>
                </View>

                {/* Verification steps */}
                <Text style={styles.verifyTitle}>🛡️ Verification Required</Text>

                {/* Step 1: GPS */}
                <View style={[styles.verifyStep, gpsVerified && styles.verifyStepDone]}>
                  <View style={styles.verifyStepIcon}>
                    {gpsVerified
                      ? <Ionicons name="checkmark-circle" size={28} color="#21E58A" />
                      : <Ionicons name="navigate-circle-outline" size={28} color={colors.gold} />
                    }
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.verifyStepTitle}>Step 1 · GPS Location</Text>
                    <Text style={styles.verifyStepDesc}>
                      {gpsVerified ? '✅ Location verified!' : 'Be within 100m of the checkpoint.'}
                    </Text>
                    {!gpsVerified && (
                      <TouchableOpacity
                        style={[styles.verifyBtn, verifyingGps && { opacity: 0.6 }]}
                        onPress={handleVerifyGps}
                        disabled={verifyingGps}
                      >
                        {verifyingGps ? (
                          <ActivityIndicator size="small" color="#000" />
                        ) : (
                          <>
                            <Ionicons name="locate-outline" size={16} color="#000" />
                            <Text style={styles.verifyBtnText}>Verify My Location</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Step 2: Photo (only for gps_photo mode) */}
                {activeCheckpoint.verificationMode === 'gps_photo' && (
                  <View style={[styles.verifyStep, photoUrl && styles.verifyStepDone]}>
                    <View style={styles.verifyStepIcon}>
                      {photoUrl
                        ? <Ionicons name="checkmark-circle" size={28} color="#21E58A" />
                        : <Ionicons name="camera-outline" size={28} color={colors.secondary} />
                      }
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.verifyStepTitle}>Step 2 · Photo Proof</Text>
                      <Text style={styles.verifyStepDesc}>
                        {photoUrl ? '✅ Photo captured!' : 'Photograph the landmark as proof.'}
                      </Text>
                      {photoUrl ? (
                        <Image source={{ uri: photoUrl }} style={styles.photoPreview} resizeMode="cover" />
                      ) : (
                        <TouchableOpacity
                          style={[styles.verifyBtn, { backgroundColor: colors.secondary }, uploadingPhoto && { opacity: 0.6 }]}
                          onPress={handleTakePhoto}
                          disabled={uploadingPhoto}
                        >
                          {uploadingPhoto ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="camera-outline" size={16} color="#fff" />
                              <Text style={[styles.verifyBtnText, { color: '#fff' }]}>Take Photo</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}

                {/* Complete button */}
                <TouchableOpacity
                  style={[
                    styles.completeBtn,
                    (!gpsVerified || (activeCheckpoint.verificationMode === 'gps_photo' && !photoUrl)) && styles.completeBtnDisabled,
                  ]}
                  onPress={handleCompleteCheckpoint}
                  disabled={!gpsVerified || (activeCheckpoint.verificationMode === 'gps_photo' && !photoUrl) || savingCheckpoint}
                >
                  {savingCheckpoint ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <LinearGradient
                      colors={[colors.gold, colors.orange] as any}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.completeBtnGrad}
                    >
                      <Ionicons name="unlock-outline" size={20} color="#000" />
                      <Text style={styles.completeBtnText}>Unlock Checkpoint Reward</Text>
                    </LinearGradient>
                  )}
                </TouchableOpacity>
                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Celebration Modal ──────────────────────────────────────────────── */}
      {celebrationVisible && celebrationData && (
        <View style={styles.celebrationOverlay}>
          <Animated.View style={[styles.celebrationCard, { width: SCREEN_WIDTH - 48, opacity: celebrationOpacity, transform: [{ scale: celebrationScale }] }]}>
            <LinearGradient colors={[colors.gold, colors.orange, '#FF6B6B'] as any} style={styles.celebrationGrad}>
              <Text style={styles.celebrationEmoji}>🎉</Text>
              <Text style={styles.celebrationTitle}>Quest Complete!</Text>
              <Text style={styles.celebrationHunt} numberOfLines={2}>{celebrationData.title}</Text>
              <View style={styles.celebrationPoints}>
                <Text style={styles.celebrationPointsText}>+{celebrationData.points}</Text>
                <Text style={styles.celebrationPointsLabel}>PalPoints Earned</Text>
              </View>
              {celebrationData.badge && (
                <View style={styles.celebrationBadge}>
                  <Text style={styles.celebrationBadgeText}>{celebrationData.badge}</Text>
                </View>
              )}
              <TouchableOpacity style={styles.celebrationCloseBtn} onPress={hideCelebration}>
                <Text style={styles.celebrationCloseBtnText}>Awesome! 🚀</Text>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  headerSubtitle: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  pointsBadge: {
    backgroundColor: colors.gold + '20',
    borderWidth: 1, borderColor: colors.gold + '40',
    borderRadius: borderRadius.round,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  pointsBadgeText: { fontSize: 12, fontWeight: '700', color: colors.gold },

  // Stats strip
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '800', color: colors.text },
  statLbl: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
  statDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    backgroundColor: colors.gold,
    borderRadius: 2,
  },
  tabItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: spacing.sm,
  },
  tabLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tabLabelActive: { color: colors.gold },
  tabBadge: {
    backgroundColor: colors.orange,
    borderRadius: 8, minWidth: 16, height: 16,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  tabBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },

  // Filters
  filterScroll: { marginTop: spacing.md },
  filterRow: { paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.sm },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: borderRadius.round,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.gold + '20', borderColor: colors.gold },
  filterChipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  filterChipTextActive: { color: colors.gold },

  diffRow: {
    flexDirection: 'row', paddingHorizontal: spacing.md,
    gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xs,
  },
  diffChip: {
    flex: 1, paddingVertical: 7,
    borderRadius: borderRadius.round,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  diffChipActive: { backgroundColor: colors.gold + '20', borderColor: colors.gold },
  diffChipText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  diffChipTextActive: { color: colors.gold },

  // Hunt list
  huntList: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  huntCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.md,
  },
  huntCardTop: { flexDirection: 'row', padding: spacing.md, paddingBottom: spacing.sm },
  huntCardLeft: { flex: 1, marginRight: spacing.sm },
  huntCardRight: { alignItems: 'flex-end' },
  huntCityChip: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  huntCardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  huntCardDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  rewardPill: {
    backgroundColor: colors.gold + '20', borderWidth: 1, borderColor: colors.gold + '40',
    borderRadius: borderRadius.round, paddingHorizontal: 10, paddingVertical: 5,
    alignItems: 'center',
  },
  rewardPillEmoji: { fontSize: 16 },
  rewardPillText: { fontSize: 13, fontWeight: '800', color: colors.gold },

  huntCardMeta: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
  },
  diffBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: borderRadius.round,
  },
  diffBadgeText: { fontSize: 10, fontWeight: '700' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11, color: colors.textMuted },

  progressBarBg: {
    height: 5, backgroundColor: colors.surfaceLight,
    marginHorizontal: spacing.md, borderRadius: 3, overflow: 'hidden',
  },
  progressBarFill: { height: '100%', borderRadius: 3 },
  progressRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  progressText: { fontSize: 11, color: colors.textSecondary },
  activePill: {
    backgroundColor: colors.orange + '20', borderRadius: borderRadius.round,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  activePillText: { fontSize: 9, fontWeight: '800', color: colors.orange, letterSpacing: 0.5 },

  // Loading / empty
  loadingBox: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { color: colors.textMuted, marginTop: 12, fontSize: 14 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: spacing.xl },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  emptyDesc: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  ctaButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.gold + '20',
    borderWidth: 1, borderColor: colors.gold,
    borderRadius: borderRadius.round,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  ctaButtonText: { fontSize: 14, fontWeight: '700', color: colors.gold },

  // Completed card
  completedCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    marginBottom: spacing.md, borderWidth: 1, borderColor: '#21E58A30',
    overflow: 'hidden', padding: spacing.md,
  },
  completedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  completedEmoji: { fontSize: 28 },
  completedTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  completedCity: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  badgePill: {
    backgroundColor: colors.gold + '20', borderWidth: 1, borderColor: colors.gold + '40',
    borderRadius: borderRadius.round, paddingHorizontal: 12, paddingVertical: 5,
    alignSelf: 'flex-start', marginBottom: spacing.sm,
  },
  badgePillText: { fontSize: 12, color: colors.gold, fontWeight: '600' },
  completedStats: { flexDirection: 'row', gap: spacing.xl },
  completedStat: { alignItems: 'center' },
  completedStatVal: { fontSize: 20, fontWeight: '800', color: colors.text },
  completedStatLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2 },

  // Modals
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  detailSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '94%', minHeight: '60%',
    borderTopWidth: 1, borderColor: colors.border,
  },
  detailHandle: {
    width: 40, height: 4, backgroundColor: colors.border,
    borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },

  // Detail hero
  detailHero: { padding: spacing.lg, paddingBottom: spacing.md },
  detailHeroRow: { flexDirection: 'row', marginBottom: spacing.sm },
  detailHeroEmoji: { fontSize: 36, marginBottom: 4 },
  detailHeroTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 2 },
  detailHeroCity: { fontSize: 12, color: colors.textMuted },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  detailHeroDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.md },
  detailMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  detailProgress: { gap: spacing.xs },

  // Start button
  startBtn: { marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: borderRadius.round, overflow: 'hidden' },
  startBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, gap: 8,
  },
  startBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },

  // Checkpoints in detail
  cpSection: { padding: spacing.lg, paddingTop: spacing.md },
  cpSectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  cpStep: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
    position: 'relative', gap: spacing.sm,
  },
  cpStepDone: { borderColor: '#21E58A40', backgroundColor: 'rgba(33,229,138,0.05)' },
  cpStepNext: { borderColor: colors.gold + '60', backgroundColor: colors.gold + '08' },
  cpConnector: {
    position: 'absolute', top: -spacing.sm, left: spacing.md + 12,
    width: 2, height: spacing.sm, backgroundColor: colors.border,
  },
  cpConnectorDone: { backgroundColor: '#21E58A60' },
  cpBullet: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.surfaceLight, borderWidth: 2, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  cpBulletDone: { backgroundColor: '#21E58A', borderColor: '#21E58A' },
  cpBulletNext: { backgroundColor: colors.gold, borderColor: colors.gold },
  cpBulletText: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  cpInfo: { flex: 1 },
  cpName: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
  cpNameDone: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  cpClueLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, marginBottom: 2 },
  cpClue: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  cpActionRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  cpActionText: { fontSize: 11, color: colors.gold, fontWeight: '600' },

  // Reward banner
  rewardBanner: { marginHorizontal: spacing.lg, marginTop: spacing.sm, borderRadius: borderRadius.md, overflow: 'hidden' },
  rewardBannerGrad: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
  rewardBannerEmoji: { fontSize: 28 },
  rewardBannerTitle: { fontSize: 11, color: colors.textMuted },
  rewardBannerBadge: { fontSize: 14, fontWeight: '700', color: colors.gold },

  // Checkpoint sheet
  cpSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '85%',
    borderTopWidth: 1, borderColor: colors.border,
  },
  cpSheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: spacing.lg, paddingTop: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  cpSheetStep: { fontSize: 10, fontWeight: '700', color: colors.gold, letterSpacing: 1.5 },
  cpSheetTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 2 },

  // Clue box
  clueBox: {
    margin: spacing.lg, backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.gold + '30',
    borderLeftWidth: 3, borderLeftColor: colors.gold,
  },
  clueLabel: { fontSize: 11, fontWeight: '700', color: colors.gold, marginBottom: 6 },
  clueText: { fontSize: 14, color: colors.text, lineHeight: 22, fontStyle: 'italic' },

  // Verification
  verifyTitle: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  verifyStep: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  verifyStepDone: { borderColor: '#21E58A40', backgroundColor: 'rgba(33,229,138,0.05)' },
  verifyStepIcon: { paddingTop: 2 },
  verifyStepTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 3 },
  verifyStepDesc: { fontSize: 12, color: colors.textSecondary, marginBottom: 8 },
  verifyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.gold, borderRadius: borderRadius.round,
    paddingVertical: 10, paddingHorizontal: 16, gap: 6,
  },
  verifyBtnText: { fontSize: 13, fontWeight: '700', color: '#000' },
  photoPreview: { width: '100%', height: 120, borderRadius: borderRadius.sm, marginTop: 4 },

  // Complete button
  completeBtn: { marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: borderRadius.round, overflow: 'hidden' },
  completeBtnDisabled: { opacity: 0.4 },
  completeBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, gap: 8,
  },
  completeBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },

  // Celebration
  celebrationOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center', alignItems: 'center', zIndex: 999,
  },
  celebrationCard: {
    borderRadius: 24, overflow: 'hidden',
    ...shadows.lg,
  },
  celebrationGrad: { alignItems: 'center', padding: 32 },
  celebrationEmoji: { fontSize: 64, marginBottom: 8 },
  celebrationTitle: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 4 },
  celebrationHunt: { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginBottom: 24 },
  celebrationPoints: {
    backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 16,
    paddingHorizontal: 32, paddingVertical: 16, alignItems: 'center', marginBottom: 16,
  },
  celebrationPointsText: { fontSize: 48, fontWeight: '900', color: '#fff' },
  celebrationPointsLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  celebrationBadge: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: borderRadius.round, paddingHorizontal: 20, paddingVertical: 8, marginBottom: 24,
  },
  celebrationBadgeText: { fontSize: 15, color: '#fff', fontWeight: '700' },
  celebrationCloseBtn: {
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: borderRadius.round,
    paddingHorizontal: 32, paddingVertical: 14,
  },
  celebrationCloseBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
