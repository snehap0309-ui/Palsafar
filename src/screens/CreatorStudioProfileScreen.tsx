import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useUserContext } from '../context/UserContext';
import { socialApi } from '../services/api/social';
import type { CreatorDashboard } from '../types';
import { useStudioTabScreenInsets } from '../design/tabBarLayout';
import { useBottomSafePadding } from '../design/responsive';

const HERO = require('../assets/settings_cover.png');

const C = {
  bg: '#FDF7F2',
  ink: '#4A3427',
  textSub: '#8B7355',
  textMuted: '#B8A88A',
  border: 'rgba(200, 155, 60, 0.12)',
  card: '#FFFFFF',
  danger: '#DC4C4C',
  dangerSoft: '#FEF2F2',
  bronze: '#A67C52',
};

const compact = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(1)}K` : String(value);

type SettingsRowConfig = {
  key: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle?: string;
  danger?: boolean;
  rightText?: string;
  onPress?: () => void;
};

function SettingsRow({ item, isLast }: { item: SettingsRowConfig; isLast: boolean }) {
  const pressable = !!item.onPress;
  return (
    <TouchableOpacity
      disabled={!pressable}
      onPress={item.onPress}
      activeOpacity={pressable ? 0.75 : 1}
      style={[styles.row, !isLast && styles.rowBorder]}
    >
      <View style={[styles.iconCircle, { backgroundColor: item.iconBg }]}>
        <Icon name={item.icon as any} size={20} color={item.iconColor} />
      </View>
      <View style={styles.rowTextCol}>
        <Text style={[styles.rowTitle, item.danger && styles.rowTitleDanger]} numberOfLines={1}>
          {item.title}
        </Text>
        {!!item.subtitle && (
          <Text style={styles.rowSub} numberOfLines={2}>{item.subtitle}</Text>
        )}
      </View>
      {item.rightText ? (
        <Text style={styles.rowMeta}>{item.rightText}</Text>
      ) : pressable ? (
        <Icon name="chevron-forward" size={18} color={C.textMuted} />
      ) : null}
    </TouchableOpacity>
  );
}

function SettingsSection({ title, items }: { title: string; items: SettingsRowConfig[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.card}>
        {items.map((item, i) => (
          <SettingsRow key={item.key} item={item} isLast={i === items.length - 1} />
        ))}
      </View>
    </View>
  );
}

export default function CreatorStudioProfileScreen() {
  const navigation = useNavigation<any>();
  const studioInsets = useStudioTabScreenInsets();
  const modalPadBottom = useBottomSafePadding(20);
  const { user, onLogout } = useUserContext();
  const [data, setData] = useState<CreatorDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [instagram, setInstagram] = useState('');
  const [youtube, setYoutube] = useState('');
  const [facebook, setFacebook] = useState('');

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const d = (await socialApi.getCreatorDashboard()).data;
      setData(d);
      setFullName(d.profile.fullName || '');
      setBio(d.profile.bio || '');
      setInstagram(d.profile.instagramUrl || '');
      setYoutube(d.profile.youtubeUrl || '');
      setFacebook(d.profile.facebookUrl || '');
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load creator profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    try {
      await socialApi.updateCreatorProfile({
        fullName,
        bio,
        instagramUrl: instagram,
        youtubeUrl: youtube,
        facebookUrl: facebook,
      });
      setEditing(false);
      await load();
    } catch (e: any) {
      Alert.alert('Could not save profile', e?.message || 'Please try again.');
    }
  };

  const handleLogout = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          void onLogout?.();
        },
      },
    ]);
  }, [onLogout]);

  const p = data?.profile;
  const displayName = p?.fullName || p?.username || user.displayName || 'Creator';
  const handle = p?.username ? `@${p.username}` : `@${(user.displayName || 'creator').toLowerCase().replace(/\s+/g, '')}`;

  const sections = useMemo(() => {
    const creatorItems: SettingsRowConfig[] = [
      {
        key: 'edit',
        icon: 'person-outline',
        iconColor: C.ink,
        iconBg: 'rgba(185,131,75,0.14)',
        title: 'Account Information',
        subtitle: 'Edit name, bio and social links',
        onPress: () => setEditing(true),
      },
      {
        key: 'password',
        icon: 'lock-closed-outline',
        iconColor: C.ink,
        iconBg: 'rgba(185,131,75,0.14)',
        title: 'Change Password',
        subtitle: 'Update your password',
        onPress: () => navigation.navigate('ChangePassword'),
      },
      {
        key: 'privacy',
        icon: 'shield-checkmark-outline',
        iconColor: '#3B82F6',
        iconBg: 'rgba(59,130,246,0.12)',
        title: 'Privacy Settings',
        subtitle: 'Manage your privacy preferences',
        onPress: () => navigation.navigate('LegalHub'),
      },
      {
        key: 'delete',
        icon: 'trash-outline',
        iconColor: C.danger,
        iconBg: 'rgba(220,76,76,0.12)',
        title: 'Delete Account',
        subtitle: 'Permanently delete your account',
        danger: true,
        onPress: () => navigation.navigate('DeleteAccount'),
      },
    ];

    const studioItems: SettingsRowConfig[] = [
      {
        key: 'insights',
        icon: 'bar-chart-outline',
        iconColor: '#3B82F6',
        iconBg: 'rgba(59,130,246,0.12)',
        title: 'Insights',
        subtitle: 'Detailed analytics and performance',
        onPress: () => navigation.navigate('CreatorAnalytics'),
      },
      {
        key: 'earnings',
        icon: 'wallet-outline',
        iconColor: C.ink,
        iconBg: 'rgba(185,131,75,0.14)',
        title: 'Earnings',
        subtitle: 'Track your earnings and history',
        onPress: () => navigation.navigate('Wallet'),
      },
      {
        key: 'notifications',
        icon: 'notifications-outline',
        iconColor: '#D97706',
        iconBg: 'rgba(234,179,8,0.14)',
        title: 'Notifications',
        subtitle: 'Alerts and updates',
        onPress: () => navigation.navigate('Notifications'),
      },
    ];

    if (p?.username) {
      studioItems.push({
        key: 'public',
        icon: 'globe-outline',
        iconColor: '#059669',
        iconBg: 'rgba(5,150,105,0.12)',
        title: 'Public Creator Page',
        subtitle: 'View how travelers see your profile',
        onPress: () => navigation.navigate('CreatorProfile', { username: p.username }),
      });
    }

    return [
      { title: 'Account', items: creatorItems },
      { title: 'Creator Studio', items: studioItems },
      {
        title: 'Support',
        items: [
          {
            key: 'terms',
            icon: 'document-text-outline',
            iconColor: C.ink,
            iconBg: 'rgba(185,131,75,0.14)',
            title: 'Terms & Conditions',
            subtitle: 'Read our terms and conditions',
            onPress: () => navigation.navigate('LegalHub'),
          },
          {
            key: 'help',
            icon: 'help-circle-outline',
            iconColor: '#3B82F6',
            iconBg: 'rgba(59,130,246,0.12)',
            title: 'Help Center',
            subtitle: 'Get help and support',
            onPress: () => navigation.navigate('LegalHub'),
          },
        ] as SettingsRowConfig[],
      },
      {
        title: 'About',
        items: [
          {
            key: 'version',
            icon: 'phone-portrait-outline',
            iconColor: '#3B82F6',
            iconBg: 'rgba(59,130,246,0.12)',
            title: 'Version',
            rightText: '2.4.0',
          },
          {
            key: 'licenses',
            icon: 'clipboard-outline',
            iconColor: C.ink,
            iconBg: 'rgba(185,131,75,0.14)',
            title: 'Licenses',
            onPress: () =>
              Alert.alert(
                'Open Source Licenses',
                'This app uses open source software. See the licenses screen for details.',
              ),
          },
          {
            key: 'rate',
            icon: 'star-outline',
            iconColor: '#D97706',
            iconBg: 'rgba(234,179,8,0.14)',
            title: 'Rate the App',
            subtitle: 'Share your feedback with us',
            onPress: () =>
              Linking.openURL('https://play.google.com/store/apps/details?id=com.palsafar'),
          },
        ] as SettingsRowConfig[],
      },
    ];
  }, [navigation, p?.username]);

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={C.bronze} />
      </View>
    );
  }

  if (loadError && !data) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.errorText}>{loadError}</Text>
        <TouchableOpacity
          style={styles.retry}
          onPress={() => {
            setLoading(true);
            void load();
          }}
        >
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: studioInsets.scrollPadBottom }}
      >
        <View style={styles.heroWrap}>
          <Image source={HERO} style={styles.heroImage} resizeMode="cover" />
          <View style={[styles.heroBar, { paddingTop: studioInsets.headerPadTop }]}>
            <View style={styles.backBtn} />
            <Text style={styles.heroTitle}>Settings</Text>
            <View style={styles.backBtn} />
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.profileCard}>
            <View style={styles.avatarWrap}>
              {p?.avatar ? (
                <Image source={{ uri: p.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarLetter}>{displayName.slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
            </View>
            <View style={styles.profileCopy}>
              <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.profileHandle} numberOfLines={1}>
                {handle}{p?.verified ? '  ✓' : ''}
              </Text>
              <Text style={styles.profileRole}>Travel Creator</Text>
            </View>
            <TouchableOpacity style={styles.editChip} onPress={() => setEditing(true)} activeOpacity={0.85}>
              <Icon name="create-outline" size={16} color={C.ink} />
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{compact(p?.totalViews || 0)}</Text>
              <Text style={styles.statLabel}>Views</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{compact(p?.followerCount || 0)}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{String(data?.reelCount || 0)}</Text>
              <Text style={styles.statLabel}>Reels</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{compact(data?.totalLikes || 0)}</Text>
              <Text style={styles.statLabel}>Likes</Text>
            </View>
          </View>

          {sections.map(section => (
            <SettingsSection key={section.title} title={section.title} items={section.items} />
          ))}

          <TouchableOpacity onPress={handleLogout} activeOpacity={0.88} style={styles.signOutBtn}>
            <Icon name="log-out-outline" size={20} color={C.danger} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={editing} transparent animationType="slide" onRequestClose={() => setEditing(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: modalPadBottom }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit profile</Text>
              <TouchableOpacity onPress={() => setEditing(false)}>
                <Icon name="close" size={24} color={C.ink} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Field label="Display name" value={fullName} onChangeText={setFullName} />
              <Field label="Bio" value={bio} onChangeText={setBio} multiline />
              <Field label="Instagram URL" value={instagram} onChangeText={setInstagram} />
              <Field label="YouTube URL" value={youtube} onChangeText={setYoutube} />
              <Field label="Facebook URL" value={facebook} onChangeText={setFacebook} />
              <TouchableOpacity style={styles.saveBtn} onPress={save}>
                <Text style={styles.saveBtnText}>Save profile</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({ label, ...props }: any) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={C.textMuted}
        style={[styles.input, props.multiline && styles.textarea]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: C.textSub,
    textAlign: 'center',
    marginBottom: 14,
    fontWeight: '600',
  },
  retry: {
    backgroundColor: C.bronze,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  retryText: { color: '#fff', fontWeight: '800' },
  heroWrap: {
    height: 228,
    overflow: 'hidden',
    backgroundColor: '#F3EBE0',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 2,
  },
  backBtn: {
    width: 40,
    height: 40,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: C.ink,
    letterSpacing: -0.3,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 22,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(74,52,39,0.08)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  avatarWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  avatarFallback: {
    backgroundColor: 'rgba(185,131,75,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 22,
    fontWeight: '800',
    color: C.ink,
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '800',
    color: C.ink,
  },
  profileHandle: {
    fontSize: 13,
    fontWeight: '500',
    color: C.textSub,
    marginTop: 2,
  },
  profileRole: {
    fontSize: 12,
    fontWeight: '700',
    color: C.bronze,
    marginTop: 4,
  },
  editChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(185,131,75,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: 'rgba(74,52,39,0.12)',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: C.ink,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: C.textSub,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: C.ink,
    paddingLeft: 4,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(74,52,39,0.08)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(74,52,39,0.08)',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.ink,
  },
  rowTitleDanger: {
    color: C.danger,
  },
  rowSub: {
    fontSize: 12,
    fontWeight: '500',
    color: C.textSub,
    lineHeight: 16,
  },
  rowMeta: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textSub,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: C.dangerSoft,
    borderWidth: 1,
    borderColor: 'rgba(220,76,76,0.12)',
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.danger,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(44,24,16,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: C.ink },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: C.ink, marginBottom: 6 },
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 12,
    color: C.ink,
  },
  textarea: { height: 100, textAlignVertical: 'top' },
  saveBtn: {
    backgroundColor: C.bronze,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  saveBtnText: { color: '#fff', fontWeight: '800' },
});
