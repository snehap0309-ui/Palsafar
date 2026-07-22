import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  StatusBar,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useUserContext } from '../context/UserContext';
import { CreatorProfile } from '../types';
import { socialApi } from '../services/api';
import { DEV_FLAGS } from '../config/devFlags';
import { GridSkeleton } from '../components/reels/GridSkeleton';
import { useHeaderSafePadding } from '../design/responsive';

interface CreatorProfileScreenProps {
  username: string;
  onBack?: () => void;
}

function formatCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}

export default function CreatorProfileScreen({
  username,
  onBack,
}: CreatorProfileScreenProps) {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { user } = useUserContext();
  const { width: WINDOW_WIDTH } = useWindowDimensions();
  const GRID_ITEM_SIZE = (WINDOW_WIDTH - 4) / 3;
  const headerPadTop = useHeaderSafePadding();

  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followingState, setFollowingState] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);

  const loadProfile = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      if (DEV_FLAGS.USE_SERVER_API) {
        const res = await socialApi.getCreatorProfile(username);
        if (res.data) {
          setProfile(res.data);
          setFollowingState(!!res.data.isFollowing);
          setFollowersCount(res.data.followerCount || 0);
        }
      } else {
        // Fallback for local mock data
        await new Promise(resolve => setTimeout(resolve, 800));
        // Find reels containing the username from local feed
        const { getReelsFeed } = require('../services/reelService');
        const feed = await getReelsFeed(0, 100);
        const userReels = feed.items.filter((r: any) => 
          (r.creator?.username || r.userName || '').toLowerCase() === username.toLowerCase()
        );

        const mockProfile: CreatorProfile = {
          id: `creator_${username}`,
          userId: userReels[0]?.creatorId || userReels[0]?.userId || 'mock-user-id',
          username: username,
          bio: `Travel & Adventure Creator. Exploring the hidden treasures of Jabalpur. Join me on my journeys! 🗺️✈️`,
          avatar: null,
          followerCount: 342,
          totalViews: userReels.reduce((sum: number, r: any) => sum + (r.views || 0), 0) || 1240,
          verified: username.toLowerCase().includes('palsafar') || username.toLowerCase().includes('explorer'),
          status: 'APPROVED',
          isFollowing: false,
          followingCount: 89,
          reels: userReels,
          createdAt: new Date().toISOString(),
        };

        setProfile(mockProfile);
        setFollowingState(false);
        setFollowersCount(mockProfile.followerCount);
      }
    } catch {
      Alert.alert('Error', 'Unable to fetch creator details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [username]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleFollowToggle = async () => {
    if (!profile) return;
    const previousState = followingState;
    const previousCount = followersCount;

    // Optimistic UI updates
    setFollowingState(!previousState);
    setFollowersCount(prev => previousState ? prev - 1 : prev + 1);

    try {
      if (DEV_FLAGS.USE_SERVER_API) {
        if (previousState) {
          await socialApi.unfollowCreator(profile.id);
        } else {
          await socialApi.followCreator(profile.id);
        }
      } else {
        // Local simulation delay
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch {
      setFollowingState(previousState);
      setFollowersCount(previousCount);
      Alert.alert('Error', 'Could not update follow status.');
    }
  };

  const handleReelPress = (reelId: string, index: number) => {
    navigation.navigate('ReelDetail', { 
      reelId,
      reels: profile?.reels || [],
      initialIndex: index 
    });
  };

  const handleBackPress = () => {
    if (onBack) {
      onBack();
    } else {
      navigation.goBack();
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <StatusBar barStyle="light-content" backgroundColor={theme.background} />
        {/* Header Skeleton */}
        <View style={{ height: 180, width: '100%', backgroundColor: theme.surfaceLight }} />
        {/* Grid Skeleton */}
        <View style={{ flex: 1, width: '100%' }}>
          <GridSkeleton count={12} />
        </View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.background }]}>
        <StatusBar barStyle="light-content" backgroundColor={theme.background} />
        <Icon name="alert-circle-outline" size={64} color={theme.textMuted} />
        <Text style={[styles.errorTitle, { color: theme.text }]}>Creator Profile Not Found</Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: theme.primary }]} onPress={() => loadProfile()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isSelf = profile.userId === user?.uid;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.background} />
      
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border, paddingTop: headerPadTop }]}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBackPress}>
          <Icon name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          @{profile.username}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadProfile(true)}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        {/* Profile Card & Info */}
        <View style={styles.profileSection}>
          <View style={styles.avatarRow}>
            {profile.avatar ? (
              <Image source={{ uri: profile.avatar }} style={[styles.avatar, { borderColor: theme.border }]} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}>
                <Text style={[styles.avatarText, { color: theme.primary }]}>
                  {profile.username.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.profileMeta}>
              <View style={styles.usernameRow}>
                <Text style={[styles.usernameText, { color: theme.text }]}>
                  {profile.username}
                </Text>
                {profile.verified && (
                  <Icon name="checkmark-circle" size={18} color="#1DA1F2" style={styles.verifiedIcon} />
                )}
              </View>
              {profile.bio && (
                <Text style={[styles.bioText, { color: theme.textSecondary }]}>
                  {profile.bio}
                </Text>
              )}
            </View>
          </View>

          {/* Stats Bar */}
          <View style={[styles.statsRow, { backgroundColor: theme.backgroundLight, borderColor: theme.border }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {formatCount(followersCount)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Followers</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {formatCount(profile.followingCount || 0)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Following</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {formatCount(profile.totalViews)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Total Views</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {profile.reels?.length || 0}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Reels</Text>
            </View>
          </View>

          {/* Follow / Edit Button */}
          {isSelf ? (
            <View style={[styles.selfPill, { backgroundColor: theme.success + '15', borderColor: theme.success + '30' }]}>
              <Icon name="checkmark-circle-outline" size={16} color={theme.success} />
              <Text style={[styles.selfText, { color: theme.success }]}>Your Creator Profile</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                followingState
                  ? [styles.followingBtn, { borderColor: theme.primary }]
                  : [styles.followBtn, { backgroundColor: theme.primary }],
              ]}
              onPress={handleFollowToggle}
            >
              <Icon
                name={followingState ? 'person-remove-outline' : 'person-add-outline'}
                size={16}
                color={followingState ? theme.primary : '#fff'}
              />
              <Text style={[styles.actionBtnText, { color: followingState ? theme.primary : '#fff' }]}>
                {followingState ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Reels Grid Title */}
        <View style={styles.gridHeader}>
          <Icon name="grid-outline" size={18} color={theme.text} />
          <Text style={[styles.gridTitle, { color: theme.text }]}>All Uploads</Text>
        </View>

        {/* Reels Grid */}
        {profile.reels && profile.reels.length > 0 ? (
          <View style={styles.gridContainer}>
            {profile.reels.map((reel, index) => (
              <TouchableOpacity
                key={reel.id}
                style={[styles.gridCell, { width: GRID_ITEM_SIZE, height: GRID_ITEM_SIZE * 1.3 }]}
                onPress={() => handleReelPress(reel.id, index)}
              >
                {reel.thumbnail ? (
                  <Image source={{ uri: reel.thumbnail }} style={styles.gridThumbnail} />
                ) : (
                  <View style={[styles.gridThumbnailPlaceholder, { backgroundColor: theme.primary + '10' }]}>
                    <Icon name="play-circle-outline" size={32} color={theme.primary + '50'} />
                  </View>
                )}
                {/* Views Overlay */}
                <View style={styles.viewsOverlay}>
                  <Icon name="play-outline" size={12} color="#fff" />
                  <Text style={styles.viewsText}>{formatCount(reel.views)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyGrid}>
            <Icon name="videocam-outline" size={48} color={theme.textMuted} />
            <Text style={[styles.emptyGridText, { color: theme.textMuted }]}>No reels uploaded yet</Text>
          </View>
        )}
        
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 24,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  profileSection: {
    padding: 20,
    alignItems: 'center',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
  },
  profileMeta: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  usernameText: {
    fontSize: 20,
    fontWeight: '700',
  },
  verifiedIcon: {
    marginLeft: 6,
  },
  bioText: {
    fontSize: 13,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 24,
    alignSelf: 'center',
  },
  selfPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  selfText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 160,
  },
  followBtn: {},
  followingBtn: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  badgesSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  badgesScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  badgeEmoji: {
    fontSize: 14,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  gridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  gridTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 1,
  },
  gridCell: {
    margin: 0.5,
    position: 'relative',
  },
  gridThumbnail: {
    width: '100%',
    height: '100%',
  },
  gridThumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewsOverlay: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  viewsText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  emptyGrid: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyGridText: {
    fontSize: 14,
  },
});
