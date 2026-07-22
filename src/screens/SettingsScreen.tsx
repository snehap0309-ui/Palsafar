import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Image,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useUserContext } from '../context/UserContext';
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
  dangerBg: '#FEECEC',
  dangerSoft: '#FEF2F2',
};

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

function SettingsRow({
  item,
  isLast,
}: {
  item: SettingsRowConfig;
  isLast: boolean;
}) {
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

function SettingsSection({
  title,
  items,
}: {
  title: string;
  items: SettingsRowConfig[];
}) {
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

export default function SettingsScreen({
  navigation: navigationProp,
  onLogout,
}: {
  navigation?: any;
  onLogout?: () => void;
}) {
  const navigation = useNavigation<any>();
  const nav = navigationProp || navigation;
  const insets = useSafeAreaInsets();
  const scrollPadBottom = useBottomSafePadding(32);
  const { onLogout: contextLogout } = useUserContext();

  const handleDeleteAccount = useCallback(() => {
    nav?.navigate('DeleteAccount');
  }, [nav]);

  const handleChangePassword = useCallback(() => {
    nav?.navigate('ChangePassword');
  }, [nav]);

  const handleLogout = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          void (contextLogout || onLogout)?.();
        },
      },
    ]);
  }, [onLogout, contextLogout]);

  const sections = useMemo(() => [
    {
      title: 'Account',
      items: [
        {
          key: 'password',
          icon: 'person-outline',
          iconColor: C.ink,
          iconBg: 'rgba(185,131,75,0.14)',
          title: 'Change Password',
          subtitle: 'Update your password',
          onPress: handleChangePassword,
        },
        {
          key: 'privacy',
          icon: 'shield-checkmark-outline',
          iconColor: '#3B82F6',
          iconBg: 'rgba(59,130,246,0.12)',
          title: 'Privacy Settings',
          subtitle: 'Manage your privacy preferences',
          onPress: () => nav?.navigate('LegalHub'),
        },
        {
          key: 'delete',
          icon: 'trash-outline',
          iconColor: C.danger,
          iconBg: 'rgba(220,76,76,0.12)',
          title: 'Delete Account',
          subtitle: 'Permanently delete your account',
          danger: true,
          onPress: handleDeleteAccount,
        },
      ] as SettingsRowConfig[],
    },
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
          onPress: () => nav?.navigate('LegalHub'),
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
          onPress: () => Alert.alert(
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
          onPress: () => Linking.openURL('https://play.google.com/store/apps/details?id=com.palsafar'),
        },
      ] as SettingsRowConfig[],
    },
  ], [handleChangePassword, handleDeleteAccount, nav]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: scrollPadBottom }}
      >
        <View style={styles.heroWrap}>
          <Image source={HERO} style={styles.heroImage} resizeMode="cover" />
          <View style={[styles.heroBar, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity
              onPress={() => nav?.goBack()}
              style={styles.backBtn}
              hitSlop={8}
              accessibilityLabel="Go back"
            >
              <Icon name="arrow-back" size={22} color={C.ink} />
            </TouchableOpacity>
            <Text style={styles.heroTitle}>Settings</Text>
            <View style={styles.backBtn} />
          </View>
        </View>

        <View style={styles.body}>
          {sections.map(section => (
            <SettingsSection key={section.title} title={section.title} items={section.items} />
          ))}

          <TouchableOpacity
            onPress={handleLogout}
            activeOpacity={0.88}
            style={styles.signOutBtn}
          >
            <Icon name="log-out-outline" size={20} color={C.danger} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
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
    justifyContent: 'center',
    alignItems: 'flex-start',
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
});
