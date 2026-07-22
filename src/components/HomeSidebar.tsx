import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
  Image,
  ScrollView,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { UserActiveMode, UserProfile } from '../types';
import { getSwitchableModes, isCreatorApproved, isVendorApproved } from '../utils/workspaceRoles';
import { useSidebarWidth } from '../design/responsive';

const C = {
  bg: '#FFF9F2',
  ink: '#63300E',
  text: '#2C1810',
  textSub: '#8B7355',
  gold: '#B9834B',
  border: 'rgba(200, 155, 60, 0.18)',
  danger: '#EF4444',
  navy: '#1E2A3A',
};

type SidebarItem = {
  icon: string;
  lib?: 'ion' | 'mci';
  label: string;
  onPress?: () => void;
  danger?: boolean;
  badge?: string;
};

type SidebarSection = {
  title: string;
  items: SidebarItem[];
};

type Props = {
  visible: boolean;
  onClose: () => void;
  user: UserProfile;
  palPoints: number;
  activeMode?: string;
  switchableModes?: UserActiveMode[];
  onSwitchMode?: (mode: UserActiveMode) => Promise<void>;
  onNavigateToWallet?: () => void;
  onNavigateToRewards?: () => void;
  onNavigateToLeaderboard?: () => void;
  onNavigateToTreasureHunt?: () => void;
  onNavigateToQuest?: () => void;
  onBecomeCreator?: () => void;
  onBecomeVendor?: () => void;
  onOpenCreatorStudio?: () => void;
  onOpenVendorWorkspace?: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToNotifications?: () => void;
  onNavigateToLegal?: () => void;
  onLogout?: () => void;
  isGuest?: boolean;
  /** Vendor record verification (from DataContext) when not on user.vendor yet */
  vendorVerificationStatus?: string | null;
};

const MODE_LABELS: Record<string, string> = {
  USER: 'Tourist Mode',
  VENDOR: 'Switch as Vendor',
  CONTENT_CREATOR: 'Switch as Creator',
};

function SidebarRow({ item, onClose }: { item: SidebarItem; onClose: () => void }) {
  const IconComp = item.lib === 'mci' ? MaterialCommunityIcons : Icon;
  return (
    <TouchableOpacity
      style={sb.row}
      activeOpacity={0.7}
      onPress={() => {
        onClose();
        item.onPress?.();
      }}
    >
      <View style={[sb.rowIcon, item.danger && { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
        <IconComp name={item.icon as any} size={20} color={item.danger ? C.danger : C.gold} />
      </View>
      <Text style={[sb.rowLabel, item.danger && { color: C.danger }]}>{item.label}</Text>
      {!!item.badge && (
        <View style={sb.badge}>
          <Text style={sb.badgeText}>{item.badge}</Text>
        </View>
      )}
      <Icon name="chevron-forward" size={16} color={C.textSub} />
    </TouchableOpacity>
  );
}

export default function HomeSidebar({
  visible,
  onClose,
  user,
  palPoints,
  activeMode = 'USER',
  switchableModes = ['USER'],
  onSwitchMode,
  onNavigateToWallet,
  onNavigateToRewards,
  onNavigateToLeaderboard,
  onNavigateToTreasureHunt,
  onNavigateToQuest,
  onBecomeCreator,
  onBecomeVendor,
  onOpenCreatorStudio,
  onOpenVendorWorkspace,
  onNavigateToSettings,
  onNavigateToNotifications,
  onNavigateToLegal,
  onLogout,
  isGuest,
  vendorVerificationStatus,
}: Props) {
  const insets = useSafeAreaInsets();
  const sidebarW = useSidebarWidth();
  const slideAnim = useRef(new Animated.Value(sidebarW)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : sidebarW,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, sidebarW, slideAnim]);

  const firstName = user.displayName?.split(' ')[0] || 'Traveler';
  const initial = (firstName[0] || 'P').toUpperCase();
  const current = String(activeMode).toUpperCase();

  const profileUser = user;
  const hasVendorRole = isVendorApproved(profileUser, vendorVerificationStatus);
  const hasCreatorRole = isCreatorApproved(profileUser);
  const resolvedSwitchable = switchableModes.length > 1
    ? switchableModes
    : getSwitchableModes(profileUser, vendorVerificationStatus);

  const modeItems: SidebarItem[] = [
    {
      icon: 'compass-outline',
      label: MODE_LABELS.USER,
      badge: current === 'USER' ? 'Active' : undefined,
      onPress: () => onSwitchMode?.('USER'),
    },
  ];
  if (hasVendorRole) {
    modeItems.push({
      icon: 'storefront-outline',
      label: MODE_LABELS.VENDOR,
      badge: current === 'VENDOR' ? 'Active' : undefined,
      onPress: () => {
        if (current === 'VENDOR') onOpenVendorWorkspace?.();
        else onSwitchMode?.('VENDOR');
      },
    });
  }
  if (hasCreatorRole) {
    modeItems.push({
      icon: 'videocam-outline',
      label: MODE_LABELS.CONTENT_CREATOR,
      badge: current === 'CONTENT_CREATOR' ? 'Active' : undefined,
      onPress: () => {
        if (current === 'CONTENT_CREATOR') onOpenCreatorStudio?.();
        else onSwitchMode?.('CONTENT_CREATOR');
      },
    });
  }

  const communityItems: SidebarItem[] = [];
  if (!hasCreatorRole && !hasVendorRole && onBecomeCreator) {
    communityItems.push({ icon: 'sparkles-outline', label: 'Become a Creator', onPress: onBecomeCreator });
  }
  if (!hasVendorRole && !hasCreatorRole && onBecomeVendor) {
    communityItems.push({ icon: 'storefront-outline', label: 'Become a Vendor', onPress: onBecomeVendor });
  }
  communityItems.push(
    { icon: 'gift-outline', label: 'Refer & Earn', onPress: onNavigateToRewards },
    { icon: 'podium-outline', label: 'Leaderboard', onPress: onNavigateToLeaderboard },
    { icon: 'flag-outline', label: 'Treasure Hunt', onPress: onNavigateToTreasureHunt },
  );

  const sections: SidebarSection[] = [
    ...(resolvedSwitchable.length > 1 ? [{ title: 'SWITCH MODE', items: modeItems }] : []),
    {
      title: 'COMMUNITY',
      items: communityItems,
    },
    {
      title: 'REWARDS',
      items: [
        { icon: 'wallet-outline', label: 'PalPoints Wallet', onPress: onNavigateToWallet },
        { icon: 'gift', label: 'Rewards Store', onPress: onNavigateToRewards },
        { icon: 'trophy-outline', label: 'Challenges', onPress: onNavigateToQuest },
      ],
    },
    {
      title: 'SUPPORT',
      items: [
        { icon: 'help-circle-outline', label: 'Help Center', onPress: onNavigateToLegal },
        { icon: 'chatbubble-ellipses-outline', label: 'FAQs', onPress: () => onNavigateToLegal?.() },
        { icon: 'mail-outline', label: 'Feedback', onPress: () => onNavigateToLegal?.() },
        { icon: 'alert-circle-outline', label: 'Report Issue', onPress: () => onNavigateToLegal?.() },
      ],
    },
    {
      title: 'SETTINGS',
      items: [
        { icon: 'language-outline', label: 'Language', onPress: onNavigateToSettings },
        { icon: 'notifications-outline', label: 'Notifications', onPress: onNavigateToNotifications },
        { icon: 'shield-checkmark-outline', label: 'Privacy & Security', onPress: onNavigateToSettings },
        { icon: 'settings-outline', label: 'App Settings', onPress: onNavigateToSettings },
      ],
    },
  ];

  const handleLogout = () => {
    onClose();
    Alert.alert('Logout', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => onLogout?.() },
    ]);
  };

  const handleRateApp = () => {
    onClose();
    const url = Platform.select({
      ios: 'https://apps.apple.com/app/id0000000000',
      android: 'market://details?id=com.palsafar',
      default: 'https://palsafar.com',
    });
    Linking.openURL(url!).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={sb.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View
        style={[
          sb.panel,
          { width: sidebarW, paddingTop: insets.top + 12, transform: [{ translateX: slideAnim }] },
        ]}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          <View style={sb.profileHeader}>
            <View style={sb.avatar}>
              {user.avatar ? (
                <Image source={{ uri: user.avatar }} style={sb.avatarImg} />
              ) : (
                <Text style={sb.avatarLetter}>{initial}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={sb.profileName} numberOfLines={1}>{user.displayName}</Text>
              <View style={sb.pointsRow}>
                <MaterialCommunityIcons name="circle-multiple" size={14} color={C.gold} />
                <Text style={sb.pointsText}>{palPoints.toLocaleString()} PalPoints</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Icon name="close" size={22} color={C.ink} />
            </TouchableOpacity>
          </View>

          {sections.map(section => (
            <View key={section.title} style={sb.section}>
              <Text style={sb.sectionTitle}>{section.title}</Text>
              {section.items.map(item => (
                <SidebarRow key={item.label} item={item} onClose={onClose} />
              ))}
            </View>
          ))}

          <View style={sb.footer}>
            <TouchableOpacity style={sb.footerBtn} onPress={() => { onClose(); onNavigateToLegal?.(); }}>
              <Text style={sb.footerBtnText}>Terms & Privacy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={sb.footerBtn} onPress={handleRateApp}>
              <Text style={sb.footerBtnText}>Rate App</Text>
            </TouchableOpacity>
          </View>

          {!isGuest && (
            <TouchableOpacity style={sb.logoutBtn} activeOpacity={0.85} onPress={handleLogout}>
              <Icon name="log-out-outline" size={20} color="#FFF" />
              <Text style={sb.logoutText}>Logout</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const sb = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.bg,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.ink,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { fontSize: 22, fontWeight: '700', color: C.gold, fontFamily: 'serif' },
  profileName: { fontSize: 17, fontWeight: '800', color: C.text },
  pointsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  pointsText: { fontSize: 13, fontWeight: '700', color: C.gold },
  section: { paddingHorizontal: 16, paddingTop: 18 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: C.textSub,
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 4,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(185,131,75,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: C.text },
  badge: {
    backgroundColor: 'rgba(185,131,75,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: C.gold },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(185,131,75,0.1)',
    alignItems: 'center',
  },
  footerBtnText: { fontSize: 12, fontWeight: '700', color: C.ink },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: C.danger,
  },
  logoutText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
});
