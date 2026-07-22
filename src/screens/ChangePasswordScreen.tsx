import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useState, useCallback } from 'react';
import { Pal } from '../design/DesignSystem';
import { GlassCard } from '../components/ui/GlassCard';
import { useTheme } from '../context/ThemeContext';
import { authApi } from '../services/api/auth';
import { useUserContext } from '../context/UserContext';
import { useHeaderSafePadding, useBottomSafePadding } from '../design/responsive';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,128}$/;

export default function ChangePasswordScreen({ navigation }: { navigation?: any }) {
  const { theme } = useTheme();
  const headerPadTop = useHeaderSafePadding(12);
  const scrollPadBottom = useBottomSafePadding(24);
  const { onLogout } = useUserContext();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(async () => {
    setError('');
    if (!currentPassword) {
      setError('Enter your current password');
      return;
    }
    if (!PASSWORD_REGEX.test(newPassword)) {
      setError('New password must be 8–128 characters with uppercase, lowercase, number, and special character (@$!%*&)');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (currentPassword === newPassword) {
      setError('New password must be different from your current password');
      return;
    }

    setLoading(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      Alert.alert(
        'Password Updated',
        'Your password was changed. Other devices have been signed out.',
        [
          {
            text: 'OK',
            onPress: () => {
              void onLogout?.();
            },
          },
        ],
      );
    } catch (err: any) {
      setError(err?.message || 'Could not change password. Check your current password and try again.');
    } finally {
      setLoading(false);
    }
  }, [currentPassword, newPassword, confirmPassword, onLogout, navigation]);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: Pal.spacing[5], paddingTop: headerPadTop, paddingBottom: scrollPadBottom, gap: Pal.spacing[5] }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity onPress={() => navigation?.goBack()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.glass, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: theme.text, fontSize: 20 }}>←</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: Pal.typography.fontFamily.bold, fontSize: 22, color: theme.text }}>Change Password</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={{ fontFamily: Pal.typography.fontFamily.regular, fontSize: 14, color: theme.textSecondary, lineHeight: 20 }}>
          Enter your current password, then choose a strong new password. All other sessions will be signed out.
        </Text>

        <GlassCard padding={Pal.spacing[5]}>
          <View style={{ gap: Pal.spacing[4] }}>
            {[
              { label: 'Current password', value: currentPassword, setter: setCurrentPassword },
              { label: 'New password', value: newPassword, setter: setNewPassword },
              { label: 'Confirm new password', value: confirmPassword, setter: setConfirmPassword },
            ].map((field) => (
              <View key={field.label} style={{ gap: 6 }}>
                <Text style={{ fontFamily: Pal.typography.fontFamily.medium, fontSize: 13, color: theme.textMuted }}>{field.label}</Text>
                <TextInput
                  value={field.value}
                  onChangeText={field.setter}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
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
              </View>
            ))}
          </View>
        </GlassCard>

        {!!error && (
          <Text style={{ fontFamily: Pal.typography.fontFamily.medium, fontSize: 13, color: theme.danger }}>{error}</Text>
        )}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          style={{
            padding: Pal.spacing[4],
            borderRadius: Pal.borderRadius.xl,
            backgroundColor: theme.primary,
            alignItems: 'center',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ fontFamily: Pal.typography.fontFamily.semibold, fontSize: 15, color: '#fff' }}>Update Password</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
