import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, StatusBar, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';

import { resetPassword } from '../../services/authService';

const C = {
  bg: '#FFF9F2',
  cardBg: '#FBEFE2',
  gold: '#B9834B',
  goldDark: '#8B6B3A',
  dark: '#63300E',
  text: '#2C1810',
  textSub: '#8B7355',
  textMuted: '#B8A88A',
  border: 'rgba(200, 155, 60, 0.15)',
  shadow: 'rgba(200, 155, 60, 0.15)',
  white: '#FFFFFF',
  danger: '#EF4444',
};

interface ForgotPasswordScreenProps {
  onBack: () => void;
  onResetPassword: (email: string) => Promise<boolean>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen({ onBack, onResetPassword }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'email' | 'code' | 'success'>('email');

  const handleSendCode = useCallback(async () => {
    if (!email.trim()) { setError('Email is required'); return; }
    if (!EMAIL_REGEX.test(email.trim())) { setError('Enter a valid email'); return; }
    setLoading(true);
    try {
      const success = await onResetPassword(email.trim().toLowerCase());
      if (success) { setStep('code'); Alert.alert('Code Sent!', 'Check your email for the 8-character verification code.'); }
      else { setError('No account found with this email'); }
    } catch { setError('Something went wrong. Please try again.'); }
    finally { setLoading(false); }
  }, [email, onResetPassword]);

  const handleResetPassword = useCallback(async () => {
    const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,128}$/;
    if (!code.trim() || code.trim().length < 8) { setError('Please enter the 8-character verification code'); return; }
    if (!password.trim() || !PASSWORD_REGEX.test(password)) { setError('Password must be at least 8 characters with uppercase, lowercase, number & special character (@$!%*&)'); return; }
    setLoading(true);
    try {
      const success = await resetPassword({ email: email.trim().toLowerCase(), token: code.trim(), passwordStr: password });
      if (success) { setStep('success'); }
      else { setError('Invalid or expired verification code'); }
    } catch { setError('Failed to reset password. Please check the code.'); }
    finally { setLoading(false); }
  }, [email, code, password]);

  if (step === 'success') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <View style={styles.successContainer}>
          <View style={styles.iconCircle}>
            <Icon name="checkmark-circle" size={64} color="#2ECC71" />
          </View>
          <Text style={styles.successTitle}>Success!</Text>
          <Text style={styles.successDesc}>
            Your password has been successfully reset. You can now log in with your new password.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={onBack} activeOpacity={0.85}>
            <LinearGradient colors={['#63300E', '#B9834B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Text style={styles.buttonText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={step === 'code' ? () => setStep('email') : onBack}>
          <Icon name="arrow-back" size={22} color={C.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reset Password</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.iconCircle}>
            <Icon name="key-outline" size={40} color={C.gold} />
          </View>
          <Text style={styles.title}>
            {step === 'email' ? 'Forgot Password?' : 'Enter Verification Code'}
          </Text>
          <Text style={styles.desc}>
            {step === 'email'
              ? "Enter your email and we'll send you a verification code to reset your password."
              : `Enter the 8-character code sent to ${email} along with your new password.`}
          </Text>

          {step === 'email' ? (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={[styles.inputContainer, { borderColor: error ? C.danger : C.border }]}>
                <View style={styles.inputIconBox}>
                  <Icon name="mail-outline" size={22} color={C.dark} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="your@email.com"
                  placeholderTextColor={C.textMuted}
                  value={email}
                  onChangeText={(text) => { setEmail(text); setError(''); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>
          ) : (
            <View style={{ width: '100%' }}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Verification Code</Text>
                <View style={[styles.inputContainer, { borderColor: error ? C.danger : C.border }]}>
                  <View style={styles.inputIconBox}>
                    <Icon name="lock-closed-outline" size={22} color={C.dark} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="8-character code"
                    placeholderTextColor={C.textMuted}
                    value={code}
                    onChangeText={(text) => { setCode(text); setError(''); }}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>New Password</Text>
                <View style={[styles.inputContainer, { borderColor: error ? C.danger : C.border }]}>
                  <View style={styles.inputIconBox}>
                    <Icon name="lock-closed-outline" size={22} color={C.dark} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="At least 8 characters"
                    placeholderTextColor={C.textMuted}
                    value={password}
                    onChangeText={(text) => { setPassword(text); setError(''); }}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, { marginTop: 12 }]}
            onPress={step === 'email' ? handleSendCode : handleResetPassword}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#63300E', '#B9834B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Text style={styles.buttonText}>
              {loading ? 'Processing...' : step === 'email' ? 'Send Code' : 'Update Password'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.cardBg,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.dark },
  content: { flex: 1, paddingHorizontal: 24, alignItems: 'center', paddingTop: 24 },
  iconCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(185, 131, 75, 0.1)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  title: { fontSize: 24, fontWeight: '800', color: C.dark, marginBottom: 8, textAlign: 'center' },
  desc: { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 20, marginBottom: 32 },
  inputGroup: { width: '100%', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: C.textSub, marginBottom: 8 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1,
    height: 42, overflow: 'hidden',
    backgroundColor: 'rgba(99, 48, 14, 0.04)',
    paddingLeft: 0, paddingRight: 10,
  },
  inputIconBox: {
    width: 42, height: 42,
    backgroundColor: 'rgba(99, 48, 14, 0.1)',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 10,
  },
  input: { flex: 1, fontSize: 12, color: C.text, padding: 0 },
  errorText: { fontSize: 12, color: C.danger, marginTop: 4 },
  primaryButton: {
    width: '100%', height: 42, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  successContainer: {
    flex: 1, paddingHorizontal: 24, alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { fontSize: 22, fontWeight: '800', color: C.dark, marginBottom: 12, textAlign: 'center' },
  successDesc: { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 20, marginBottom: 32 },
});
