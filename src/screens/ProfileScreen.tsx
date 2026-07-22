import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Animated,
  Modal,
  TextInput,
  ActivityIndicator,
  Image,
  Dimensions,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useUserContext } from '../context/UserContext';
import { useDataContext } from '../context/DataContext';
import Pal from '../design/DesignSystem';
import { Avatar, Badge, Card, Button } from '../components/ui';
import { LinearGradient } from '../utils/LinearGradient';
import { launchImageLibrary } from 'react-native-image-picker';
import { UserProfile, TouristSpot, VendorBusiness, VendorOffer } from '../types';
import { DEV_FLAGS } from '../config/devFlags';
import { shadows } from '../config/theme';
import { updateUserProfile } from '../services/authService';
import { socialApi, walletApi } from '../services/api';
import { ApiErrorCodes, getApiErrorCode } from '../services/api/client';
import ProfileSection from '../components/ProfileSection';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getSwitchableModes, isCreatorApproved, isVendorApproved } from '../utils/workspaceRoles';
import type { UserActiveMode } from '../types';

const COLORS = {
  primary: '#2563EB',
  secondary: '#63300E',
  accent: '#8B6B3A',
  background: '#FFF9F2',
  card: '#FBEFE2',
  text: '#2C1810',
  textSecondary: '#8B7355',
  textMuted: '#B8A88A',
  border: 'rgba(200, 155, 60, 0.15)',
  danger: '#EF4444',
  gold: '#B9834B',
  purple: '#8B6B3A',
  pink: '#B9834B',
  orange: '#D4A87A',
};

const AVATARS = ['👦', '👧', '👨', '👩', '👶', '👸', '🤴', '🧑', '🧒', '👱'];
const INTEREST_OPTIONS = ['Nature', 'Adventure', 'Heritage', 'Culture', 'Food'];
const CREATOR_CATEGORY_OPTIONS = ['Nature', 'Adventure', 'Heritage', 'Food', 'Culture', 'Hidden Gems', 'Road Trips', 'Spiritual'];



interface ProfileScreenProps {
  user: UserProfile;
  places: TouristSpot[];
  vendors?: VendorBusiness[];
  vendorOffers?: VendorOffer[];
  isGuest?: boolean;
  onSelectSpot: (spot: TouristSpot) => void;
  onNavigateToHome?: () => void;
  onResetProgress?: () => void;
  onLogout?: () => void;
  onAdminVerification?: () => void;
  onAdminHiddenGemReview?: () => void;
  onAdminPlacesReview?: () => void;
  onOpenCredits?: () => void;
  onNavigateToWallet?: () => void;
  onNavigateToRewards?: () => void;
  onRewardsWallet?: () => void;
  onMyContributions?: () => void;
  onNavigateToLeaderboard?: () => void;
  onNavigateToCreateReel?: () => void;
  onBack?: () => void;
  onSettingsPress?: () => void;
  onPremiumPress?: () => void;
  /** When true, open the edit-profile modal on mount (e.g. Settings → Edit Profile). */
  openEdit?: boolean;
  hiddenGemSubmissions?: any[];
  onSubmitHiddenGem?: () => void;
  onRegisterVendor?: () => void;
  onSwitchRole?: (role: string) => Promise<void>;
}

export default function ProfileScreen({
  user: initialUser,
  places,
  vendors,
  vendorOffers,
  isGuest = false,
  onSelectSpot,
  onLogout,
  onAdminVerification,
  onAdminHiddenGemReview,
  onAdminPlacesReview,
  onNavigateToWallet,
  onNavigateToRewards,
  onRewardsWallet,
  onMyContributions,
  onNavigateToLeaderboard,
  onNavigateToCreateReel,
  onBack,
  onSettingsPress,
  onPremiumPress,
  openEdit = false,
  hiddenGemSubmissions,
  onSubmitHiddenGem,
  onRegisterVendor,
  onSwitchRole,
}: ProfileScreenProps) {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { setUser: setContextUser, user: contextUser, refreshSession } = useUserContext();
  const { currentVendor: ownedVendor } = useDataContext();
  
  const [user, setUser] = useState<UserProfile>(initialUser);

  const [showEditModal, setShowEditModal] = useState(!!openEdit);
  const [showCreatorAppModal, setShowCreatorAppModal] = useState(false);

  const [editName, setEditName] = useState(user.displayName);
  const [editBio, setEditBio] = useState(user.bio || '');
  const [editAvatarStyle, setEditAvatarStyle] = useState(user.avatarStyle || 0);
  const [editAvatarUri, setEditAvatarUri] = useState<string | null>(user.avatar || null);
  const [editInterests, setEditInterests] = useState<string[]>(user.interests || user.travelInterests || []);
  const [updatingProfile, setUpdatingProfile] = useState(false);

  const [creatorUsername, setCreatorUsername] = useState('');
  const [creatorFullName, setCreatorFullName] = useState(user.displayName);
  const [creatorBio, setCreatorBio] = useState('');
  const [creatorCategories, setCreatorCategories] = useState<string[]>(['Nature']);
  const [creatorInstagram, setCreatorInstagram] = useState('');
  const [creatorYoutube, setCreatorYoutube] = useState('');
  const [creatorSampleReel, setCreatorSampleReel] = useState('');
  const [creatorReason, setCreatorReason] = useState('');
  const [applyingCreator, setApplyingCreator] = useState(false);
  const [palPoints, setPalPoints] = useState(initialUser.totalPoints || 0);

  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (openEdit) {
      setShowEditModal(true);
      setEditName(user.displayName);
      setEditBio(user.bio || '');
      setEditAvatarStyle(user.avatarStyle || 0);
      setEditAvatarUri(user.avatar || null);
      setEditInterests(user.interests || user.travelInterests || []);
    }
  }, [openEdit]);

  const openCreatorApplicationForm = () => {
    const profile = user.creatorProfile;
    if (profile) {
      setCreatorUsername(profile.username);
      setCreatorFullName(profile.fullName || user.displayName);
      setCreatorBio(profile.bio || '');
      setCreatorCategories(profile.travelCategories?.length ? profile.travelCategories : ['Nature']);
      setCreatorInstagram(profile.instagramUrl || '');
      setCreatorYoutube(profile.youtubeUrl || '');
      setCreatorSampleReel(profile.sampleReelUrl || '');
      setCreatorReason(profile.applicationReason || '');
    }
    setShowCreatorAppModal(true);
  };

  const promptGuestSignIn = (actionLabel: string) => {
    Alert.alert(
      'Sign In Required',
      `Create an account or sign in to ${actionLabel}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        ...(onLogout ? [{ text: 'Sign In', onPress: () => { void onLogout(); } }] : []),
      ],
    );
  };

  const openCreatorApplication = (isSwitch = false) => {
    if (isGuest) {
      promptGuestSignIn('apply as a creator');
      return;
    }
    if (isSwitch) {
      Alert.alert(
        'Switch to Creator?',
        'You already have a Vendor workspace.\nYou must deactivate Vendor before activating Creator.\n\nContinuing will retire your Vendor role and start Creator onboarding.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', style: 'destructive', onPress: () => openCreatorApplicationForm() },
        ],
      );
      return;
    }
    openCreatorApplicationForm();
  };

  const handleBecomeVendor = () => {
    if (isGuest) {
      promptGuestSignIn('register as a vendor');
      return;
    }
    // Same exclusivity rule as Creator apply: confirm before retiring Creator workspace
    if (vendorApplyIsSwitch) {
      Alert.alert(
        'Switch to Vendor?',
        'You already have a Creator workspace.\nYou must deactivate Creator before activating Vendor.\n\nContinuing will retire your Creator role and start Vendor onboarding.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', style: 'destructive', onPress: () => onRegisterVendor?.() },
        ],
      );
      return;
    }
    onRegisterVendor?.();
  };

  const loadWalletPoints = useCallback(async () => {
    if (!DEV_FLAGS.USE_SERVER_API || isGuest) {
      setPalPoints(initialUser.totalPoints || 0);
      return;
    }
    try {
      const res = await walletApi.getProfile();
      const data: any = res?.data ?? res;
      const pts = Number(data?.palPoints ?? data?.pointBalance ?? initialUser.totalPoints ?? 0) || 0;
      setPalPoints(pts);
      setUser(prev => (prev.totalPoints === pts ? prev : { ...prev, totalPoints: pts }));
      // Update context outside the local setState updater — nested setState during
      // an updater runs as part of render and triggers "Cannot update UserProvider while rendering ProfileScreen".
      setContextUser(prev => (prev.totalPoints === pts ? prev : { ...prev, totalPoints: pts }));
    } catch {
      setPalPoints(initialUser.totalPoints || 0);
    }
  }, [initialUser.totalPoints, isGuest, setContextUser]);

  useEffect(() => {
    loadWalletPoints();
  }, [loadWalletPoints]);

  // Re-pull roles + vendor status when opening Profile (covers admin approval while app stayed open)
  useFocusEffect(
    useCallback(() => {
      if (isGuest || !DEV_FLAGS.USE_SERVER_API) return;
      refreshSession().catch(() => undefined);
    }, [isGuest, refreshSession]),
  );

  useEffect(() => {
    setUser(initialUser);
    setEditName(initialUser.displayName);
    setEditBio(initialUser.bio || '');
    setEditAvatarStyle(initialUser.avatarStyle || 0);
    setEditAvatarUri(initialUser.avatar || null);
    setEditInterests(initialUser.interests || initialUser.travelInterests || []);
    setCreatorFullName(initialUser.displayName);
  }, [initialUser]);

  // Keep local profile in sync when workspace mode / roles / vendor status change from context
  useEffect(() => {
    if (!contextUser?.uid || contextUser.uid === 'guest-user') return;
    if (contextUser.uid !== user.uid) return;
    setUser(prev => ({
      ...prev,
      ...contextUser,
      activeMode: contextUser.activeMode || prev.activeMode,
      activeRole: contextUser.activeRole || prev.activeRole,
      roles: contextUser.roles || prev.roles,
      permission: contextUser.permission || prev.permission,
      vendor: (contextUser as any).vendor ?? (prev as any).vendor,
      creatorProfile: contextUser.creatorProfile ?? prev.creatorProfile,
    }));
  }, [
    contextUser.activeMode,
    contextUser.activeRole,
    contextUser.roles,
    contextUser.permission,
    contextUser.uid,
    (contextUser as any)?.vendor?.status,
    contextUser.creatorProfile?.status,
  ]);

  const visitedCount = user.visitedSpots?.length || 0;
  const totalPoints = user.totalPoints || 0;

  const getVendorById = (id: string) => vendors?.find(p => p.id === id);
  const getOfferById = (id: string) => vendorOffers?.find(o => o.id === id);

  const visitedSpots = places.filter((spot) => user.visitedSpots?.includes(spot.id));
  const citiesExplored = useMemo(() => {
    const cities = new Set(visitedSpots.filter(s => s.city).map(s => s.city));
    return cities.size;
  }, [visitedSpots]);

  const hiddenGemsSubmitted = useMemo(() => {
    return hiddenGemSubmissions?.filter(s => s.userId === user.uid).length || 0;
  }, [hiddenGemSubmissions, user.uid]);

  const hiddenGemsPending = useMemo(() => {
    return hiddenGemSubmissions?.filter(s => s.userId === user.uid && s.status === 'pending').length || 0;
  }, [hiddenGemSubmissions, user.uid]);

  const hiddenGemsPoints = useMemo(() => {
    return hiddenGemSubmissions?.filter(s => s.userId === user.uid && s.status === 'approved')
      .reduce((sum, s) => sum + (s.pointsReward || 0), 0) || 0;
  }, [hiddenGemSubmissions, user.uid]);

  const cityCompletionStats = useMemo(() => {
    const cityCounts: Record<string, number> = {};
    visitedSpots.forEach(s => {
      const city = s.city || 'Unknown';
      cityCounts[city] = (cityCounts[city] || 0) + 1;
    });
    
    let topCity = '';
    let maxCount = 0;
    Object.entries(cityCounts).forEach(([city, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topCity = city;
      }
    });

    if (!topCity) {
      return { name: 'N/A', visited: 0, total: 0, percent: 0 };
    }

    const spotsInCity = places.filter(s => s.city?.toLowerCase() === topCity.toLowerCase());
    const total = spotsInCity.length || 1;
    const visitedInCity = spotsInCity.filter(s => user.visitedSpots?.includes(s.id)).length;
    const percent = Math.round((visitedInCity / total) * 100);
    return { name: topCity, visited: visitedInCity, total, percent };
  }, [places, visitedSpots, user.visitedSpots]);

  const handleEditProfileSave = async () => {
    if (!editName.trim()) {
      Alert.alert('Validation Error', 'Display Name is required');
      return;
    }
    setUpdatingProfile(true);
    try {
      const updates: Record<string, any> = {
        displayName: editName.trim(),
        city: user.city,
        avatarStyle: editAvatarStyle,
        avatar: editAvatarUri || null,
      };
      await updateUserProfile(user.uid, updates);
      
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      setContextUser(updatedUser);
      
      setShowEditModal(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const submitCreatorApplication = async (confirmSwitch: boolean) => {
    setApplyingCreator(true);
    try {
      const res = await socialApi.applyCreator({
        username: creatorUsername.trim().toLowerCase(),
        fullName: creatorFullName.trim(),
        bio: creatorBio.trim(),
        travelCategories: creatorCategories,
        instagramUrl: creatorInstagram.trim(),
        youtubeUrl: creatorYoutube.trim() || undefined,
        sampleReelUrl: creatorSampleReel.trim() || undefined,
        applicationReason: creatorReason.trim(),
        confirmSwitch: confirmSwitch || undefined,
      });
      const data = res.data || res;

      const updatedUser: UserProfile = {
        ...user,
        // Switching retires the Vendor role server-side; drop stale local vendor capability.
        ...(confirmSwitch ? { roles: (user.roles || []).filter(r => String(r) !== 'VENDOR') } : {}),
        creatorProfile: {
          id: data.id,
          username: data.username,
          fullName: data.fullName,
          bio: data.bio || '',
          travelCategories: data.travelCategories || [],
          instagramUrl: data.instagramUrl,
          youtubeUrl: data.youtubeUrl,
          sampleReelUrl: data.sampleReelUrl,
          applicationReason: data.applicationReason,
          status: 'PENDING',
          followerCount: 0,
          totalViews: 0,
          verified: false,
        }
      };
      setUser(updatedUser);
      setContextUser(updatedUser);

      setShowCreatorAppModal(false);
      Alert.alert('Application Submitted', 'Your application to become a Content Creator is under review.');
    } catch (err: any) {
      if (!confirmSwitch && getApiErrorCode(err) === ApiErrorCodes.SWITCH_CONFIRMATION_REQUIRED) {
        Alert.alert(
          'Switch to Creator?',
          'You already have a Vendor workspace.\nYou must deactivate Vendor before activating Creator.\n\nContinuing will retire your Vendor role.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Continue',
              style: 'destructive',
              onPress: () => { void submitCreatorApplication(true); },
            },
          ],
        );
        return;
      }
      Alert.alert('Application Failed', err?.message || 'Failed to submit application.');
    } finally {
      setApplyingCreator(false);
    }
  };

  const handleCreatorApply = async () => {
    const username = creatorUsername.trim().toLowerCase();
    const fullName = creatorFullName.trim();
    const bio = creatorBio.trim();
    const reason = creatorReason.trim();
    const instagram = creatorInstagram.trim();

    if (!username) {
      Alert.alert('Validation Error', 'Please enter a creator username.');
      return;
    }
    if (username.length < 3) {
      Alert.alert('Validation Error', 'Username must be at least 3 characters.');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      Alert.alert('Validation Error', 'Username can only use letters, numbers, and underscores (no spaces or @).');
      return;
    }
    if (fullName.length < 2) {
      Alert.alert('Validation Error', 'Please enter your full name.');
      return;
    }
    if (bio.length < 20) {
      Alert.alert('Validation Error', `Bio must be at least 20 characters (currently ${bio.length}).`);
      return;
    }
    if (creatorCategories.length === 0) {
      Alert.alert('Validation Error', 'Select at least one travel category.');
      return;
    }
    if (!instagram) {
      Alert.alert('Validation Error', 'Instagram link is required.');
      return;
    }
    if (reason.length < 20) {
      Alert.alert('Validation Error', `Please tell us why you want to join — at least 20 characters (currently ${reason.length}).`);
      return;
    }
    await submitCreatorApplication(false);
  };

  const listedVendor = user.vendor?.id ? vendors?.find(v => v.id === user.vendor?.id) : undefined;
  const currentVendor = ownedVendor || listedVendor;
  // Prefer context for workspace capability — local `user` can lag behind setActiveMode
  const roles = (contextUser.roles || user.roles || []).map(String);
  const permission = contextUser.permission || user.permission || (
    roles.includes('VENDOR') ? 'VENDOR'
      : roles.includes('CONTENT_CREATOR') ? 'CONTENT_CREATOR'
      : roles.includes('ADMIN') ? 'ADMIN'
      : 'USER'
  );
  const creatorStatus = contextUser.creatorProfile?.status || user.creatorProfile?.status;
  const creatorPending = creatorStatus === 'PENDING';
  const creatorApproved = isCreatorApproved(contextUser) || isCreatorApproved(user);
  const authVendorStatus = String(
    (contextUser as any)?.vendor?.status || (user as any)?.vendor?.status || '',
  ).toUpperCase();
  const vendorStatusRaw = String(
    currentVendor?.verificationStatus || authVendorStatus || '',
  ).toUpperCase();
  const vendorPending = vendorStatusRaw === 'PENDING' || authVendorStatus === 'PENDING';
  const vendorApproved = isVendorApproved(contextUser, currentVendor?.verificationStatus)
    || isVendorApproved(user, currentVendor?.verificationStatus);

  // A professional role is "held" while its application/assignment is live in any of these
  // states. REJECTED and RETIRED relinquish the role, so they do not block the other role.
  const vendorHeld = vendorApproved || vendorPending
    || ['CHANGES_REQUESTED', 'SUSPENDED', 'PAUSED'].includes(vendorStatusRaw);
  const creatorHeld = creatorApproved || creatorPending
    || creatorStatus === 'CHANGES_REQUESTED' || creatorStatus === 'SUSPENDED' || creatorStatus === 'PAUSED';

  // ONE specialty workspace per account (Creator XOR Vendor).
  // Once either is approved, hide Become / Switch CTA cards entirely.
  // Pending / suspended / changes-requested also block the other role's apply cards.
  const hasApprovedWorkspace = creatorApproved || vendorApproved;
  const showCreatorApplication = !hasApprovedWorkspace && !creatorHeld && !vendorHeld;
  const showVendorApplicationCard = !hasApprovedWorkspace && !vendorHeld && !creatorHeld;
  const creatorApplyIsSwitch = false;
  const vendorApplyIsSwitch = false;

  const switchableModes = useMemo(
    (): UserActiveMode[] => getSwitchableModes(contextUser || user, currentVendor?.verificationStatus),
    [contextUser, user, currentVendor?.verificationStatus],
  );

  const toggleInterest = (interest: string) => {
    setEditInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  const toggleCreatorCategory = (category: string) => {
    setCreatorCategories(prev =>
      prev.includes(category)
        ? prev.filter(item => item !== category)
        : [...prev, category]
    );
  };

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.98, friction: 8, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
  };

  return (
    <View style={[styles.container, { backgroundColor: COLORS.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={styles.profileBody}>
      <ProfileSection
        user={user}
        isGuest={isGuest}
        onEditProfile={() => setShowEditModal(true)}
        onAvatarChange={(uri) => {
          const updated = { ...user, avatar: uri };
          setUser(updated);
          setContextUser(updated);
        }}
        onSettingsPress={onSettingsPress}
        onRewardCampaignsPress={onNavigateToLeaderboard || onNavigateToRewards}
        onPremiumPress={onPremiumPress}
        citiesExplored={citiesExplored}
        location={user.city || 'Jabalpur, Madhya Pradesh'}
        onRewardsWallet={onRewardsWallet || onNavigateToWallet}
        onExploreRewards={onNavigateToRewards || onNavigateToWallet}
        onMyContributions={onMyContributions}
        palPoints={palPoints}
        onBecomeCreator={showCreatorApplication ? () => openCreatorApplication(creatorApplyIsSwitch) : undefined}
        onBecomeVendor={showVendorApplicationCard ? handleBecomeVendor : undefined}
        creatorApplyIsSwitch={creatorApplyIsSwitch}
        vendorApplyIsSwitch={vendorApplyIsSwitch}
        vendorApplicationStatus={currentVendor?.verificationStatus ?? null}
        vendorRejectionReason={currentVendor?.rejectedReason ?? null}
        onLogoutAction={onLogout}
        hiddenGemsSubmitted={hiddenGemsSubmitted}
        hiddenGemsPending={hiddenGemsPending}
        hiddenGemsPoints={hiddenGemsPoints}
        onSubmitHiddenGem={onSubmitHiddenGem}
        switchableModes={switchableModes}
        activeMode={contextUser.activeMode || user.activeMode || 'USER'}
        onSwitchMode={onSwitchRole}
      />

      {roles.includes('ADMIN') && (onAdminVerification || onAdminHiddenGemReview || onAdminPlacesReview) ? (
        <View style={{ paddingHorizontal: 20, paddingBottom: 24, gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 4 }}>
            Admin moderation
          </Text>
          {onAdminVerification ? (
            <TouchableOpacity
              style={[styles.adminCard, { backgroundColor: theme.surface }]}
              onPress={onAdminVerification}
            >
              <View style={[styles.adminCardIcon, { backgroundColor: COLORS.primary + '18' }]}>
                <Icon name="storefront-outline" size={22} color={COLORS.primary} />
              </View>
              <View style={styles.adminInfo}>
                <Text style={[styles.adminTitle, { color: theme.text }]}>Vendor verification</Text>
                <Text style={[styles.adminDesc, { color: theme.textSecondary }]}>Approve or reject vendor applications</Text>
              </View>
              <Icon name="chevron-forward" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          ) : null}
          {onAdminHiddenGemReview ? (
            <TouchableOpacity
              style={[styles.adminCard, { backgroundColor: theme.surface }]}
              onPress={onAdminHiddenGemReview}
            >
              <View style={[styles.adminCardIcon, { backgroundColor: COLORS.primary + '18' }]}>
                <Icon name="diamond-outline" size={22} color={COLORS.primary} />
              </View>
              <View style={styles.adminInfo}>
                <Text style={[styles.adminTitle, { color: theme.text }]}>Hidden gems</Text>
                <Text style={[styles.adminDesc, { color: theme.textSecondary }]}>Review community place submissions</Text>
              </View>
              <Icon name="chevron-forward" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          ) : null}
          {onAdminPlacesReview ? (
            <TouchableOpacity
              style={[styles.adminCard, { backgroundColor: theme.surface }]}
              onPress={onAdminPlacesReview}
            >
              <View style={[styles.adminCardIcon, { backgroundColor: COLORS.primary + '18' }]}>
                <Icon name="map-outline" size={22} color={COLORS.primary} />
              </View>
              <View style={styles.adminInfo}>
                <Text style={[styles.adminTitle, { color: theme.text }]}>Places review</Text>
                <Text style={[styles.adminDesc, { color: theme.textSecondary }]}>Approve curated place listings</Text>
              </View>
              <Icon name="chevron-forward" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      </View>

      {/* Edit Profile Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalBar}>
              <Text style={[styles.modalBarTitle, { color: theme.text }]}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)} style={styles.modalCloseBtn}>
                <Icon name="close" size={22} color={theme.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Display Name</Text>
              <TextInput
                style={[styles.fieldInput, { color: theme.text, backgroundColor: theme.backgroundLight, borderColor: theme.border }]}
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter your name"
                placeholderTextColor={theme.textMuted}
              />

              <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 20 }]}>Choose Avatar</Text>
              <View style={styles.avatarGrid}>
                {AVATARS.map((av, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.avatarOption,
                      {
                        backgroundColor: editAvatarStyle === idx && !editAvatarUri ? theme.primary + '15' : theme.backgroundLight,
                        borderColor: editAvatarStyle === idx && !editAvatarUri ? theme.primary : theme.border,
                      }
                    ]}
                    onPress={() => { setEditAvatarStyle(idx); setEditAvatarUri(null); }}
                  >
                    <Text style={{ fontSize: 26 }}>{av}</Text>
                    {editAvatarStyle === idx && !editAvatarUri && (
                      <View style={[styles.avatarSelected, { backgroundColor: theme.primary }]}>
                        <Icon name="checkmark" size={10} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
                {/* Gallery option */}
                <TouchableOpacity
                  style={[
                    styles.avatarOption,
                    {
                      backgroundColor: editAvatarUri ? theme.primary + '15' : theme.backgroundLight,
                      borderColor: editAvatarUri ? theme.primary : theme.border,
                      borderStyle: editAvatarUri ? 'solid' : 'dashed',
                    }
                  ]}
                  onPress={() => {
                    launchImageLibrary(
                      { mediaType: 'photo', quality: 0.7, selectionLimit: 1 },
                      (response) => {
                        if (response.didCancel || response.errorCode) return;
                        const uri = response.assets?.[0]?.uri;
                        if (uri) { setEditAvatarUri(uri); setEditAvatarStyle(-1); }
                      },
                    );
                  }}
                >
                  {editAvatarUri ? (
                    <Image source={{ uri: editAvatarUri }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                  ) : (
                    <Icon name="camera-outline" size={22} color={theme.textSecondary} />
                  )}
                  {editAvatarUri && (
                    <View style={[styles.avatarSelected, { backgroundColor: theme.primary }]}>
                      <Icon name="checkmark" size={10} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 20 }]}>Travel Interests</Text>
              <View style={styles.chipRow}>
                {INTEREST_OPTIONS.map((interest) => {
                  const isSelected = editInterests.includes(interest.toLowerCase());
                  return (
                    <TouchableOpacity
                      key={interest}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSelected ? theme.primary : theme.backgroundLight,
                          borderColor: isSelected ? theme.primary : theme.border,
                        }
                      ]}
                      onPress={() => toggleInterest(interest.toLowerCase())}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? '#fff' : theme.textSecondary }}>
                        {interest}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: theme.primary }]}
                onPress={handleEditProfileSave}
                disabled={updatingProfile}
              >
                {updatingProfile ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Creator Application Modal */}
      <Modal visible={showCreatorAppModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: COLORS.card }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalBar}>
              <Text style={[styles.modalBarTitle, { color: COLORS.text }]}>Creator Application</Text>
              <TouchableOpacity onPress={() => setShowCreatorAppModal(false)} style={styles.modalCloseBtn}>
                <Icon name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={[styles.appNotice, { backgroundColor: COLORS.primary + '08', borderColor: COLORS.primary + '20' }]}>
                <Icon name="information-circle" size={18} color={COLORS.primary} />
                <Text style={[styles.appNoticeText, { color: COLORS.primary }]}>
                  Fill in your details to apply as a travel content creator. Instagram is required; YouTube and sample reel are optional.
                </Text>
              </View>

              <Text style={[styles.fieldLabel, { color: COLORS.textSecondary }]}>Full Name</Text>
              <TextInput
                style={[styles.fieldInput, { color: COLORS.text, backgroundColor: COLORS.background, borderColor: COLORS.border }]}
                value={creatorFullName}
                onChangeText={setCreatorFullName}
                placeholder="Your full name"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={[styles.fieldLabel, { color: COLORS.textSecondary, marginTop: 16 }]}>Creator Username</Text>
              <TextInput
                style={[styles.fieldInput, { color: COLORS.text, backgroundColor: COLORS.background, borderColor: COLORS.border }]}
                value={creatorUsername}
                onChangeText={setCreatorUsername}
                placeholder="creator_handle (letters, numbers, _)"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
              />

              <Text style={[styles.fieldLabel, { color: COLORS.textSecondary, marginTop: 16 }]}>Bio / Intro (min 20 chars)</Text>
              <TextInput
                style={[styles.fieldInput, { color: COLORS.text, backgroundColor: COLORS.background, borderColor: COLORS.border, height: 90, textAlignVertical: 'top', paddingTop: 12 }]}
                value={creatorBio}
                onChangeText={setCreatorBio}
                placeholder="What niche of travel do you focus on?"
                placeholderTextColor={COLORS.textMuted}
                multiline
              />

              <Text style={[styles.fieldLabel, { color: COLORS.textSecondary, marginTop: 16 }]}>Travel Categories</Text>
              <View style={styles.chipRow}>
                {CREATOR_CATEGORY_OPTIONS.map((category) => {
                  const isSel = creatorCategories.includes(category);
                  return (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSel ? COLORS.primary : COLORS.background,
                          borderColor: isSel ? COLORS.primary : COLORS.border,
                        }
                      ]}
                      onPress={() => toggleCreatorCategory(category)}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: isSel ? '#fff' : COLORS.textSecondary }}>{category}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.fieldLabel, { color: COLORS.textSecondary, marginTop: 16 }]}>Instagram Link *</Text>
              <TextInput
                style={[styles.fieldInput, { color: COLORS.text, backgroundColor: COLORS.background, borderColor: COLORS.border }]}
                value={creatorInstagram}
                onChangeText={setCreatorInstagram}
                placeholder="https://instagram.com/yourhandle"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                keyboardType="url"
              />

              <Text style={[styles.fieldLabel, { color: COLORS.textSecondary, marginTop: 16 }]}>YouTube Link (optional)</Text>
              <TextInput
                style={[styles.fieldInput, { color: COLORS.text, backgroundColor: COLORS.background, borderColor: COLORS.border }]}
                value={creatorYoutube}
                onChangeText={setCreatorYoutube}
                placeholder="https://youtube.com/@yourchannel"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                keyboardType="url"
              />

              <Text style={[styles.fieldLabel, { color: COLORS.textSecondary, marginTop: 16 }]}>Sample Reel Link (optional)</Text>
              <TextInput
                style={[styles.fieldInput, { color: COLORS.text, backgroundColor: COLORS.background, borderColor: COLORS.border }]}
                value={creatorSampleReel}
                onChangeText={setCreatorSampleReel}
                placeholder="Video, drive, or social reel link"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                keyboardType="url"
              />

              <Text style={[styles.fieldLabel, { color: COLORS.textSecondary, marginTop: 16 }]}>Why do you want to join? (min 20 chars)</Text>
              <TextInput
                style={[styles.fieldInput, { color: COLORS.text, backgroundColor: COLORS.background, borderColor: COLORS.border, height: 100, textAlignVertical: 'top', paddingTop: 12 }]}
                value={creatorReason}
                onChangeText={setCreatorReason}
                placeholder="Tell us what kind of travel stories you want to share."
                placeholderTextColor={COLORS.textMuted}
                multiline
              />

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: COLORS.primary, marginTop: 24 }]}
                onPress={handleCreatorApply}
                disabled={applyingCreator}
              >
                {applyingCreator ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Application</Text>
                )}
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  profileBody: { flex: 1 },
  roleSwitcher: { backgroundColor: '#FFF9F2', paddingTop: 0, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(200,155,60,0.15)' },
  roleSwitcherLabel: { color: '#8B7355', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 7 },
  roleChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleChoice: { borderWidth: 1, borderColor: '#D9B88C', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#FBEFE2' },
  roleChoiceActive: { backgroundColor: '#B9834B', borderColor: '#B9834B' },
  roleChoiceText: { color: '#63300E', fontSize: 12, fontWeight: '700' },
  roleChoiceTextActive: { color: '#fff' },
  applicationUnavailable: { color: '#8B7355', fontSize: 12, fontWeight: '600', marginTop: 8 },
  content: { flex: 1 },

  // Hero Section
  heroSection: {
    paddingTop: 0,
    paddingBottom: 10,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  heroActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroProfile: {
    alignItems: 'center',
    marginBottom: 10,
  },
  heroAvatarWrap: {
    position: 'relative',
    marginBottom: 6,
  },
  heroAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  heroAvatarEmoji: { fontSize: 28 },
  heroAvatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#D4AF37',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  heroName: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 2 },
  heroBio: { fontSize: 12, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginBottom: 6, lineHeight: 16, paddingHorizontal: 20 },
  heroLevelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  heroLevelText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  heroStatsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 1 },
  heroStatLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  heroStatDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center' },

  // Section Containers
  sectionContainer: { paddingHorizontal: 20, marginBottom: 24 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  sectionCount: { fontSize: 13, fontWeight: '600' },
  sectionLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionLinkText: { fontSize: 13, fontWeight: '600', color: '#D4AF37' },

  // Progress Cards
  progressCard: {
    padding: 18,
    borderRadius: 20,
  },
  progressCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  progressLevelName: { fontSize: 16, fontWeight: '700' },
  progressLevelNum: { fontSize: 12, marginTop: 2 },
  xpPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  xpPillText: { fontSize: 13, fontWeight: '800' },
  xpNextLabel: { fontSize: 12, marginTop: 10, fontWeight: '500' },

  // Badges Grid
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  // Creator Card
  creatorCard: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
  },
  creatorCardIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  creatorCardContent: { flex: 1 },
  creatorCardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  creatorCardDesc: { fontSize: 12, lineHeight: 17, marginBottom: 12 },
  creatorCardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  creatorCardActionText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Status Card
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.5,
  },
  statusIconWrap: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  statusInfo: { flex: 1 },
  statusTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  statusDesc: { fontSize: 12, lineHeight: 17 },

  // Admin Card
  adminCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, marginBottom: 8 },
  adminCardIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  adminInfo: { flex: 1 },
  adminTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  adminDesc: { fontSize: 12 },

  // Offer Card
  offerCard: { borderRadius: 16, padding: 16, marginBottom: 10 },
  offerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  offerVendorInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  offerVendorDot: { width: 8, height: 8, borderRadius: 4 },
  offerVendor: { fontSize: 14, fontWeight: '600' },
  offerStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  offerStatusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  offerTitle: { fontSize: 12, marginBottom: 10, marginLeft: 16 },
  offerFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 16 },
  pointsUsedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  pointsUsedText: { fontSize: 12, fontWeight: '700' },
  offerCodeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  offerCode: { fontSize: 12, fontWeight: '600' },

  // Empty State
  emptyState: { alignItems: 'center', padding: 32, borderRadius: 20 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  emptyText: { fontSize: 13, textAlign: 'center' },

  // Spot Card
  spotCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, marginBottom: 8 },
  spotEmojiWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  spotEmoji: { fontSize: 22 },
  spotInfo: { flex: 1 },
  spotName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  spotLocation: { fontSize: 12 },

  // Sign In Card
  signInCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 18 },
  signInIconWrap: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  signInInfo: { flex: 1, marginRight: 8 },
  signInTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  signInDesc: { fontSize: 12, lineHeight: 18 },

  // Logout Button
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1.5, borderRadius: 16, paddingVertical: 16 },
  logoutIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  logoutText: { fontSize: 15, fontWeight: '700' },

  bottomSpacing: { height: 100 },

  // Modals
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, height: '82%', paddingBottom: 30 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.15)', alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  modalBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  modalBarTitle: { fontSize: 18, fontWeight: '800' },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center' },
  modalScroll: { flex: 1, padding: 20 },

  // Form Fields
  fieldLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  fieldInput: { height: 50, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 16, fontSize: 15 },

  // Avatar Selector
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  avatarOption: { width: 54, height: 54, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, position: 'relative' },
  avatarSelected: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5 },

  // Submit Button
  submitBtn: { height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 28 },
  locBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // App Notice
  appNotice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 20 },
  appNoticeText: { fontSize: 13, fontWeight: '600', flex: 1 },
});
