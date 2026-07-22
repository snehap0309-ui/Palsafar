import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { LinearGradient } from '../utils/LinearGradient';
import { Ionicons } from '../utils/Icons';
import { colors, spacing, borderRadius, shadows } from '../config/theme';
import { treasureHunts, TreasureHunt, TreasureCheckpoint, completeCheckpoint, filterHuntsByGps } from '../data/treasureHunts';
import { useLocationContext } from '../context/LocationContext';
import { useUserContext } from '../context/UserContext';
import { useDataContext } from '../context/DataContext';
import { placesApi } from '../services/api/places';
import { uploadApi } from '../services/api/upload';
import { questsApi } from '../services/api/quests';
import { launchCamera } from 'react-native-image-picker';
import { haversineDistance, formatDistance } from '../utils/location';
import { useHeaderSafePadding } from '../design/responsive';

const NEARBY_HUNT_RADIUS_KM = 60;

interface TreasureHuntScreenProps {
  onBack: () => void;
}

export default function TreasureHuntScreen({ onBack }: TreasureHuntScreenProps) {
  const headerPadTop = useHeaderSafePadding(12);
  const { effectivePosition } = useLocationContext();
  const { user, setUser } = useUserContext();
  const { handleCompleteActivity } = useDataContext();

  const [activeHunts, setActiveHunts] = useState<TreasureHunt[]>([]);
  const [serverQuests, setServerQuests] = useState<Record<string, number>>({});
  const [loadingQuests, setLoadingQuests] = useState(true);

  // Load local treasure hunts + server quests, then keep only hunts near current GPS
  useEffect(() => {
    const loadHunts = async () => {
      setLoadingQuests(true);
      const localHunts = [...treasureHunts.filter(h => h.isActive)];

      try {
        const res = await questsApi.listActive({ limit: 50 });
        const serverQ = res.data || [];
        const rewardMap: Record<string, number> = {};
        for (const q of serverQ) {
          rewardMap[q.id] = q.rewardPoints;
          if (q.type === 'scavenger_hunt' && q.placeIds.length > 0) {
            const existing = localHunts.find(h => h.id === q.id);
            if (!existing) {
              localHunts.push({
                id: q.id,
                title: q.title,
                description: q.description || `${q.type.replace('_', ' ')} adventure`,
                difficulty: 'medium',
                estimatedTime: '2-3 hours',
                rewardCoins: q.rewardPoints,
                city: 'Various',
                checkpoints: q.placeIds.map((pid, i) => ({
                  id: `cp_server_${q.id}_${i}`,
                  spotId: pid,
                  spotName: `Checkpoint ${i + 1}`,
                  clue: `Visit location ${i + 1} to complete this quest.`,
                  isCompleted: false,
                  order: i + 1,
                })),
                isActive: true,
                progress: 0,
              });
            }
          }
        }
        setServerQuests(rewardMap);
      } catch {
        // Server quests unavailable, use local only
      }

      const nearby = filterHuntsByGps(
        localHunts,
        effectivePosition?.latitude,
        effectivePosition?.longitude,
        NEARBY_HUNT_RADIUS_KM,
      );
      setActiveHunts(nearby);
      setLoadingQuests(false);
    };
    loadHunts();
  }, [effectivePosition?.latitude, effectivePosition?.longitude]);

  // Modal State
  const [selectedHunt, setSelectedHunt] = useState<TreasureHunt | null>(null);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<TreasureCheckpoint | null>(null);
  const [loadingCheckpoint, setLoadingCheckpoint] = useState(false);
  const [loadedSpot, setLoadedSpot] = useState<any | null>(null);

  // Verification state for current active checkpoint
  const [gpsVerified, setGpsVerified] = useState(false);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [verifyingGps, setVerifyingGps] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const handleOpenCheckpoint = async (hunt: TreasureHunt, cp: TreasureCheckpoint) => {
    if (cp.isCompleted) {
      Alert.alert('Completed', 'You have already completed this checkpoint!');
      return;
    }
    setSelectedHunt(hunt);
    setSelectedCheckpoint(cp);
    setLoadingCheckpoint(true);
    setLoadedSpot(null);
    setGpsVerified(false);
    setUploadedPhotoUrl(null);

    try {
      const spotDetails = await placesApi.getById(cp.spotId);
      setLoadedSpot(spotDetails);
    } catch {
      setLoadedSpot({
        id: cp.spotId,
        name: cp.spotName,
        latitude: effectivePosition?.latitude ?? 23.18,
        longitude: effectivePosition?.longitude ?? 79.98,
        description: 'Details loaded from treasure hunt archives.'
      });
    } finally {
      setLoadingCheckpoint(false);
    }
  };

  const handleVerifyGps = () => {
    if (!effectivePosition || !loadedSpot) {
      Alert.alert('GPS Error', 'Please enable location services and try again.');
      return;
    }
    setVerifyingGps(true);

    const dist = haversineDistance(
      effectivePosition.latitude,
      effectivePosition.longitude,
      loadedSpot.latitude,
      loadedSpot.longitude
    );

    setTimeout(() => {
      setVerifyingGps(false);
      const allowed = dist <= 100 || __DEV__;
      if (allowed) {
        setGpsVerified(true);
        Alert.alert('GPS Match!', 'Great job! You have reached the correct checkpoint coordinates.');
      } else {
        Alert.alert(
          'Too Far',
          `You are currently ${formatDistance(dist)} away from the checkpoint. Walk closer to verify!`
        );
      }
    }, 1000);
  };

  const handleTakePhoto = () => {
    launchCamera({ mediaType: 'photo', quality: 0.7, saveToPhotos: false }, async (response) => {
      if (response.didCancel) return;
      if (response.errorMessage) {
        Alert.alert('Camera Error', response.errorMessage);
        return;
      }
      const asset = response.assets?.[0];
      if (asset?.uri) {
        setUploadingPhoto(true);
        try {
          const res = await uploadApi.uploadImage(asset.uri);
          setUploadedPhotoUrl(res.url);
          Alert.alert('Success', 'Photo uploaded and verified successfully!');
        } catch {
          setUploadedPhotoUrl(asset.uri);
          Alert.alert('Photo Verified', 'Verification photo captured successfully.');
        } finally {
          setUploadingPhoto(false);
        }
      }
    });
  };

  const handleCompleteCheckpointVerification = () => {
    if (!selectedHunt || !selectedCheckpoint) return;

    const isHard = selectedHunt.difficulty === 'hard' || selectedHunt.difficulty === 'medium';
    if (!gpsVerified) {
      Alert.alert('Incomplete', 'Please verify your GPS location first.');
      return;
    }
    if (isHard && !uploadedPhotoUrl) {
      Alert.alert('Incomplete', 'This challenge requires a verified photo upload as proof.');
      return;
    }

    completeCheckpoint(selectedHunt.id, selectedCheckpoint.id);
    handleCompleteActivity(`checkpoint_${selectedCheckpoint.id}`, 25);
    placesApi.recordStat(selectedCheckpoint.spotId, 'quest_complete').catch(console.warn);

    const updatedHunts = [...treasureHunts.filter(h => h.isActive)];
    setActiveHunts(updatedHunts);

    const currentHunt = updatedHunts.find(h => h.id === selectedHunt.id);
    if (currentHunt) {
      const completedAll = currentHunt.checkpoints.every(c => c.isCompleted);

      if (completedAll) {
        const rewardPoints = currentHunt.rewardCoins;
        setUser(u => ({
          ...u,
          totalPoints: (u.totalPoints || 0) + rewardPoints,
        }));

        // If this matches a server quest, mark it complete on server
        if (serverQuests[selectedHunt.id] !== undefined) {
          questsApi.complete(selectedHunt.id).catch(() => {});
        }

        Alert.alert(
          '🎉 Hunt Completed!',
          `Congratulations! You have completed the entire "${currentHunt.title}"!\n\nEarned: +${rewardPoints} Points${currentHunt.rewardBadge ? `\nNew Badge: ${currentHunt.rewardBadge.replace('_', ' ').toUpperCase()}` : ''}`
        );
      }
    }

    setSelectedCheckpoint(null);
  };

  const renderHuntCard = (hunt: TreasureHunt) => {
    const difficultyColors: Record<string, string[]> = {
      easy: [colors.green, '#1B9B4A'],
      medium: [colors.orange, '#E68A00'],
      hard: [colors.danger, '#D32F2F'],
    };
    const diffColors = difficultyColors[hunt.difficulty] || difficultyColors.easy;
    const completedCount = hunt.checkpoints.filter(c => c.isCompleted).length;

    return (
      <View key={hunt.id} style={styles.huntCard}>
        <View style={styles.huntHeader}>
          <View style={styles.huntInfo}>
            <Text style={styles.huntTitle}>{hunt.title}</Text>
            <Text style={styles.huntDesc} numberOfLines={2}>{hunt.description}</Text>
            <View style={styles.huntMeta}>
              <View style={[styles.difficultyBadge, { backgroundColor: diffColors[0] + '20' }]}>
                <Text style={[styles.difficultyText, { color: diffColors[0] }]}>
                  {hunt.difficulty.toUpperCase()}
                </Text>
              </View>
              <View style={styles.timeRow}>
                <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                <Text style={styles.timeText}>{hunt.estimatedTime}</Text>
              </View>
            </View>
          </View>
          <View style={styles.rewardBadge}>
            <Text style={styles.rewardEmoji}>🏆</Text>
            <Text style={styles.rewardValue}>+{hunt.rewardCoins}</Text>
          </View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progress</Text>
            <Text style={styles.progressValue}>{completedCount}/{hunt.checkpoints.length} checkpoints</Text>
          </View>
          <View style={styles.progressBar}>
            <LinearGradient
              colors={[colors.gold, colors.orange] as any}
              style={[styles.progressFill, { width: `${hunt.progress}%` }]}
            />
          </View>
        </View>

        <View style={styles.checkpointsSection}>
          <Text style={styles.checkpointsTitle}>Checkpoints (Tap to open/verify)</Text>
          {hunt.checkpoints.map((checkpoint, index) => (
            <TouchableOpacity
              key={checkpoint.id}
              style={styles.checkpointItem}
              onPress={() => handleOpenCheckpoint(hunt, checkpoint)}
              activeOpacity={0.8}
            >
              <View style={[
                styles.checkpointNumber,
                checkpoint.isCompleted && styles.checkpointCompleted
              ]}>
                {checkpoint.isCompleted ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : (
                  <Text style={styles.checkpointNumberText}>{index + 1}</Text>
                )}
              </View>
              <View style={styles.checkpointInfo}>
                <Text style={[
                  styles.checkpointName,
                  checkpoint.isCompleted && styles.checkpointCompletedText
                ]}>
                  {checkpoint.spotName}
                </Text>
                <Text style={styles.checkpointClue} numberOfLines={1}>
                  🔍 Clue: {checkpoint.clue}
                </Text>
              </View>
              {checkpoint.isCompleted ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              ) : (
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {hunt.rewardBadge && (
          <View style={styles.badgeReward}>
            <Text style={styles.badgeRewardText}>
              🎖️ Reward Badge: {hunt.rewardBadge.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: headerPadTop }]}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Treasure Hunts</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <LinearGradient
            colors={[colors.gold + '30', colors.orange + '30'] as any}
            style={styles.heroGradient}
          >
            <Text style={styles.heroEmoji}>🏴‍☠️</Text>
            <Text style={styles.heroTitle}>Adventure Awaits!</Text>
            <Text style={styles.heroSubtitle}>
              Complete checkpoints to uncover treasures and earn PalPoints!
            </Text>
          </LinearGradient>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{activeHunts.length}</Text>
            <Text style={styles.statLabel}>Active Hunts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {activeHunts.reduce((sum, h) => sum + h.checkpoints.filter(c => c.isCompleted).length, 0)}
            </Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {activeHunts.reduce((sum, h) => sum + h.rewardCoins, 0)}
            </Text>
            <Text style={styles.statLabel}>Total Rewards</Text>
          </View>
        </View>

        {loadingQuests ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : activeHunts.length === 0 ? (
          <View style={{ paddingVertical: 40, paddingHorizontal: spacing.lg, alignItems: 'center' }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📍</Text>
            <Text style={[styles.sectionTitle, { textAlign: 'center' }]}>
              {effectivePosition
                ? 'No treasure hunts near you'
                : 'Location needed'}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 }}>
              {effectivePosition
                ? 'Treasure hunts only appear when you are in the same city area as the hunt checkpoints. Travel closer to unlock them.'
                : 'Enable GPS so we can show treasure hunts available at your current location.'}
            </Text>
          </View>
        ) : (
          <View style={styles.huntsList}>
            <Text style={styles.sectionTitle}>Available near you</Text>
            {activeHunts.map((hunt) => renderHuntCard(hunt))}
          </View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Checkpoint Detail Modal */}
      <Modal
        visible={selectedCheckpoint !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedCheckpoint(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {loadingCheckpoint ? (
              <View style={{ height: 200, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ marginTop: 12, color: colors.textSecondary }}>Checking secret map...</Text>
              </View>
            ) : selectedCheckpoint && loadedSpot ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle} numberOfLines={1}>{selectedCheckpoint.spotName}</Text>
                  <TouchableOpacity onPress={() => setSelectedCheckpoint(null)}>
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSubtitle}>🔍 The Mystery Clue</Text>
                  <Text style={styles.modalClueText}>{selectedCheckpoint.clue}</Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSubtitle}>🛠️ Verification Required</Text>

                  <View style={styles.verificationRow}>
                    <View style={styles.stepIndicator}>
                      {gpsVerified ? (
                        <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                      ) : (
                        <View style={styles.dotIndicator} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stepTitle}>1. GPS Location Matching</Text>
                      <Text style={styles.stepDesc}>Verify you are within 100 meters of the secret spot.</Text>

                      {!gpsVerified && (
                        <TouchableOpacity
                          style={[styles.verifyBtn, verifyingGps && { opacity: 0.7 }]}
                          onPress={handleVerifyGps}
                          disabled={verifyingGps}
                        >
                          {verifyingGps ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.verifyBtnText}>Verify GPS Position</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {(selectedHunt?.difficulty === 'hard' || selectedHunt?.difficulty === 'medium') && (
                    <View style={styles.verificationRow}>
                      <View style={styles.stepIndicator}>
                        {uploadedPhotoUrl ? (
                          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                        ) : (
                          <View style={styles.dotIndicator} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.stepTitle}>2. Upload Photo Proof</Text>
                        <Text style={styles.stepDesc}>Take a photo of the landmark to prove your discovery.</Text>

                        {uploadedPhotoUrl ? (
                          <Image
                            source={{ uri: uploadedPhotoUrl }}
                            style={styles.proofPreview}
                            resizeMode="cover"
                          />
                        ) : (
                          <TouchableOpacity
                            style={[styles.verifyBtn, { backgroundColor: colors.secondary }, uploadingPhoto && { opacity: 0.7 }]}
                            onPress={handleTakePhoto}
                            disabled={uploadingPhoto}
                          >
                            {uploadingPhoto ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Text style={styles.verifyBtnText}>Capture Landmark Photo</Text>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[
                    styles.completeBtn,
                    (!gpsVerified || ((selectedHunt?.difficulty === 'hard' || selectedHunt?.difficulty === 'medium') && !uploadedPhotoUrl)) && styles.completeBtnDisabled
                  ]}
                  onPress={handleCompleteCheckpointVerification}
                  disabled={!gpsVerified || ((selectedHunt?.difficulty === 'hard' || selectedHunt?.difficulty === 'medium') && !uploadedPhotoUrl)}
                >
                  <Text style={styles.completeBtnText}>Unlock Checkpoint Reward</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 0,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  heroSection: {
    margin: spacing.lg,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  heroGradient: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  heroEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.gold,
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.accent,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  huntsList: {
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  huntCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  huntHeader: {
    flexDirection: 'row',
    padding: spacing.lg,
    backgroundColor: colors.surfaceLight,
  },
  huntInfo: {
    flex: 1,
  },
  huntTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  huntDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  huntMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  rewardBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  rewardEmoji: {
    fontSize: 28,
  },
  rewardValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gold,
  },
  progressSection: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  progressLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  progressValue: {
    fontSize: 13,
    color: colors.gold,
    fontWeight: '600',
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  checkpointsSection: {
    padding: spacing.lg,
  },
  checkpointsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  checkpointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  checkpointNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkpointCompleted: {
    backgroundColor: colors.success,
  },
  checkpointNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  checkpointInfo: {
    flex: 1,
  },
  checkpointName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  checkpointCompletedText: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  checkpointClue: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  badgeReward: {
    backgroundColor: colors.gold + '10',
    padding: spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.gold + '30',
  },
  badgeRewardText: {
    fontSize: 13,
    color: colors.gold,
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 100,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.lg,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    marginRight: 12,
  },
  modalSection: {
    marginBottom: spacing.md,
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  modalClueText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    backgroundColor: colors.surfaceLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontStyle: 'italic',
  },
  verificationRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepIndicator: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 2,
  },
  dotIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.textMuted,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  verifyBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  proofPreview: {
    width: '100%',
    height: 140,
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
  },
  completeBtn: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  completeBtnDisabled: {
    backgroundColor: colors.surfaceLight,
    opacity: 0.5,
  },
  completeBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
