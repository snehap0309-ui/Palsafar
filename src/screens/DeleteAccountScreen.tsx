import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pal } from '../design/DesignSystem';
import { GlassCard } from '../components/ui/GlassCard';
import { useTheme } from '../context/ThemeContext';
import { authApi, type AccountDeletionInfo } from '../services/api/auth';
import { useUserContext } from '../context/UserContext';
import { useHeaderSafePadding, useBottomSafePadding } from '../design/responsive';

export default function DeleteAccountScreen({ navigation }: { navigation?: any }) {
  const { theme } = useTheme();
  const headerPadTop = useHeaderSafePadding(12);
  const scrollPadBottom = useBottomSafePadding(24);
  const { onLogout } = useUserContext();
  const [info, setInfo] = useState<AccountDeletionInfo | null>(null);
  const [password, setPassword] = useState('');
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await authApi.getDeletionInfo();
        if (!cancelled) setInfo(data);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Could not load account deletion details.');
      } finally {
        if (!cancelled) setLoadingInfo(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const performDelete = useCallback(async () => {
    if (!password.trim()) {
      setError('Enter your password to confirm deletion');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authApi.deleteAccount({ password, confirmDeletion: true });
      Alert.alert('Account Deleted', 'Your PalSafar account has been permanently deleted.', [
        {
          text: 'OK',
          onPress: () => {
            void onLogout?.();
          },
        },
      ]);
    } catch (err: any) {
      setError(err?.message || 'Could not delete account. Check your password and try again.');
    } finally {
      setLoading(false);
    }
  }, [password, onLogout, navigation]);

  const handleDelete = useCallback(() => {
    if (!info?.canSelfDelete) {
      Alert.alert('Not Allowed', 'Admin accounts cannot be deleted from the app.');
      return;
    }
    Alert.alert(
      'Final Warning',
      'This permanently deletes your account, vendor/creator profiles, and forfeits remaining PalPoints and pending reward redemptions. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Forever', style: 'destructive', onPress: () => void performDelete() },
      ],
    );
  }, [info, performDelete]);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: Pal.spacing[5], paddingTop: headerPadTop, paddingBottom: scrollPadBottom, gap: Pal.spacing[5] }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity onPress={() => navigation?.goBack()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.glass, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: theme.text, fontSize: 20 }}>←</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: Pal.typography.fontFamily.bold, fontSize: 22, color: theme.danger }}>Delete Account</Text>
          <View style={{ width: 40 }} />
        </View>

        {loadingInfo ? (
          <ActivityIndicator color={theme.primary} />
        ) : (
          <GlassCard padding={Pal.spacing[5]}>
            <View style={{ gap: Pal.spacing[3] }}>
              <Text style={{ fontFamily: Pal.typography.fontFamily.semibold, fontSize: 15, color: theme.text }}>Before you continue</Text>
              <Text style={{ fontFamily: Pal.typography.fontFamily.regular, fontSize: 14, color: theme.textSecondary, lineHeight: 20 }}>
                PalPoints balance that will be forfeited: {info?.palPoints ?? 0}
              </Text>
              <Text style={{ fontFamily: Pal.typography.fontFamily.regular, fontSize: 14, color: theme.textSecondary, lineHeight: 20 }}>
                Pending reward redemptions that will be cancelled: {info?.pendingRedemptions ?? 0}
              </Text>
              {info?.vendor ? (
                <Text style={{ fontFamily: Pal.typography.fontFamily.regular, fontSize: 14, color: theme.textSecondary, lineHeight: 20 }}>
                  Vendor profile “{info.vendor.businessName}” ({info.vendor.status}) will be removed.
                </Text>
              ) : null}
              {info?.creator ? (
                <Text style={{ fontFamily: Pal.typography.fontFamily.regular, fontSize: 14, color: theme.textSecondary, lineHeight: 20 }}>
                  Creator profile @{info.creator.username} ({info.creator.status}) will be removed.
                </Text>
              ) : null}
            </View>
          </GlassCard>
        )}

        <GlassCard padding={Pal.spacing[5]}>
          <Text style={{ fontFamily: Pal.typography.fontFamily.medium, fontSize: 13, color: theme.textMuted, marginBottom: 6 }}>Confirm with password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Current password"
            placeholderTextColor={theme.textMuted}
            style={{
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: Pal.borderRadius.lg,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: theme.text,
              fontFamily: Pal.typography.fontFamily.regular,
              fontSize: 15,
              backgroundColor: theme.background,
            }}
          />
        </GlassCard>

        {!!error && (
          <Text style={{ fontFamily: Pal.typography.fontFamily.medium, fontSize: 13, color: theme.danger }}>{error}</Text>
        )}

        <TouchableOpacity
          onPress={handleDelete}
          disabled={loading || loadingInfo}
          style={{
            padding: Pal.spacing[4],
            borderRadius: Pal.borderRadius.xl,
            backgroundColor: theme.danger,
            alignItems: 'center',
            opacity: loading || loadingInfo ? 0.7 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ fontFamily: Pal.typography.fontFamily.semibold, fontSize: 15, color: '#fff' }}>Delete My Account</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
