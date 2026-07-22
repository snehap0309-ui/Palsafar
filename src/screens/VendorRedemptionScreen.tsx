import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, StatusBar,
} from 'react-native';
import { colors, spacing, borderRadius } from '../config/theme';
import { MaterialIcons } from '../utils/Icons';
import { useDataContext } from '../context/DataContext';
import type { VendorOfferRedemption } from '../types';
import { syncService } from '../services/syncService';
import { useHeaderSafePadding } from '../design/responsive';

interface VendorRedemptionScreenProps {
  onBack: () => void;
  onVendorLogin?: () => void;
}

export default function VendorRedemptionScreen({ onBack, onVendorLogin }: VendorRedemptionScreenProps) {
  const headerPadTop = useHeaderSafePadding(12);
  const { currentVendor, verifyRedemptionCode, redemptions, getOfferById } = useDataContext();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const myRedemptions = useMemo(() => {
    if (!currentVendor) return [];
    return [...redemptions]
      .filter((r) => r.vendorId === currentVendor.id)
      .sort((a, b) => new Date(b.redeemedAt).getTime() - new Date(a.redeemedAt).getTime())
      .slice(0, 10);
  }, [currentVendor, redemptions]);

  const runVerify = async (raw: string) => {
    setMessage(null);
    const token = raw.trim().toUpperCase();

    if (!currentVendor) {
      setMessage({ type: 'error', text: 'Please login as a vendor first.' });
      return;
    }
    if (token.length < 3) {
      setMessage({ type: 'error', text: 'Please enter a valid verification code.' });
      return;
    }

    let result: VendorOfferRedemption | null;
    try {
      result = await verifyRedemptionCode(token);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('Network request failed') || msg.includes('offline') || e?.status === 0) {
        await syncService.queueAction('VERIFY_REDEMPTION', { code: token });
        setMessage({
          type: 'info',
          text: 'Offline — code queued. It will verify automatically when you are back online.',
        });
        setCode('');
        return;
      }
      setMessage({ type: 'error', text: 'Verification failed. Please try again.' });
      return;
    }

    if (result === null) {
      setMessage({ type: 'error', text: 'Invalid or already-used redemption code.' });
      return;
    }

    const offer = result.offerId ? getOfferById(result.offerId) : null;
    const offerText = offer ? `\nOffer: ${offer.offerTitle}` : '';
    setMessage({
      type: 'success',
      text: `Redemption verified successfully!${offerText}\nPoints: ${result.pointsSpent} | Discount: ₹${result.discountReceived}`,
    });
    setCode('');
  };

  if (!currentVendor) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: headerPadTop }]}>
          <TouchableOpacity onPress={onBack}>
            <MaterialIcons name="arrow-back" size={24} color={colors.primaryLight} />
          </TouchableOpacity>
          <Text style={styles.title}>Verify Redemption</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.notLoggedIn}>
          <Text style={styles.notLoggedInEmoji}>🔒</Text>
          <Text style={styles.notLoggedInText}>No vendor logged in.</Text>
          {onVendorLogin && (
            <TouchableOpacity style={styles.backToHomeBtn} onPress={onVendorLogin}>
              <Text style={styles.backToHomeText}>Vendor Login</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={[styles.header, { paddingTop: headerPadTop }]}>
        <TouchableOpacity onPress={onBack}>
          <MaterialIcons name="arrow-back" size={24} color={colors.primaryLight} />
        </TouchableOpacity>
        <Text style={styles.title}>Verify Redemption</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.instructions}>
          <MaterialIcons name="info-outline" size={20} color={colors.accent} />
          <Text style={styles.instructionText}>
            Enter the tourist's PAL- token to verify. Offline verifications are queued and synced when connectivity returns.
          </Text>
        </View>

        <Text style={styles.label}>Enter verification code</Text>
        <TextInput
          style={styles.codeInput}
          placeholder="PAL-XXXXXXXXXXXX"
          placeholderTextColor={colors.textMuted}
          value={code}
          onChangeText={(v) => setCode(v.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase())}
          autoCapitalize="characters"
          maxLength={16}
        />

        <TouchableOpacity style={styles.verifyButton} onPress={() => runVerify(code)}>
          <MaterialIcons name="check-circle" size={20} color="#fff" />
          <Text style={styles.verifyButtonText}>Verify Token</Text>
        </TouchableOpacity>

        {message && (
          <View style={[
            styles.messageCard,
            message.type === 'success'
              ? styles.messageSuccess
              : message.type === 'info'
                ? styles.messageInfo
                : styles.messageError,
          ]}>
            <MaterialIcons
              name={message.type === 'success' ? 'check-circle' : message.type === 'info' ? 'cloud-queue' : 'error'}
              size={18}
              color={message.type === 'success' ? colors.success : message.type === 'info' ? colors.accent : colors.danger}
            />
            <Text style={[
              styles.messageText,
              {
                color: message.type === 'success'
                  ? colors.success
                  : message.type === 'info'
                    ? colors.accent
                    : colors.danger,
              },
            ]}>
              {message.text}
            </Text>
          </View>
        )}

        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Redemptions</Text>
          {myRedemptions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No redemptions yet</Text>
            </View>
          ) : (
            myRedemptions.map((red) => {
              const offer = red.offerId ? getOfferById(red.offerId) : null;
              return (
                <View key={red.id} style={styles.redemptionCard}>
                  <View style={styles.redemptionHeader}>
                    <Text style={styles.redemptionOfferText}>{offer?.offerTitle || 'Unknown Offer'}</Text>
                    <View style={[
                      styles.statusBadge,
                      red.status === 'verified' ? styles.statusVerifiedBadge : styles.statusPendingBadge,
                    ]}>
                      <Text style={styles.statusBadgeText}>{red.status}</Text>
                    </View>
                  </View>
                  <View style={styles.redemptionDetails}>
                    <Text style={styles.redemptionDetail}>Code: {red.verificationCode}</Text>
                    <Text style={styles.redemptionDetail}>Points: -{red.pointsSpent}</Text>
                    <Text style={styles.redemptionDetail}>{new Date(red.redeemedAt).toLocaleDateString()}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, paddingTop: 0 },
  title: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  notLoggedIn: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  notLoggedInEmoji: { fontSize: 48, marginBottom: spacing.md },
  notLoggedInText: { fontSize: 16, color: colors.textMuted, marginBottom: spacing.lg },
  backToHomeBtn: { backgroundColor: colors.primary, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: borderRadius.md },
  backToHomeText: { color: '#fff', fontWeight: '600' },
  content: { padding: spacing.lg },
  instructions: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.accent + '20', borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.lg, gap: spacing.sm },
  instructionText: { flex: 1, fontSize: 13, color: colors.accent, lineHeight: 18 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  codeInput: { backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, fontSize: 28, fontWeight: 'bold', color: colors.text, textAlign: 'center', letterSpacing: 8, borderWidth: 2, borderColor: colors.primary, marginBottom: spacing.lg },
  verifyButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success, paddingVertical: spacing.md, borderRadius: borderRadius.md, gap: spacing.sm, marginBottom: spacing.xl },
  verifyButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  recentSection: {},
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: spacing.md },
  redemptionCard: { backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  redemptionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  redemptionOfferText: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
  statusVerifiedBadge: { backgroundColor: colors.success + '30' },
  statusPendingBadge: { backgroundColor: colors.warning + '30' },
  statusBadgeText: { fontSize: 11, fontWeight: '600', color: colors.text },
  redemptionDetails: { gap: 2 },
  redemptionDetail: { fontSize: 12, color: colors.textMuted },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl, backgroundColor: colors.surface, borderRadius: borderRadius.md },
  emptyText: { fontSize: 14, color: colors.textMuted },
  messageCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md },
  messageSuccess: { backgroundColor: colors.success + '15', borderWidth: 1, borderColor: colors.success + '40' },
  messageError: { backgroundColor: colors.danger + '15', borderWidth: 1, borderColor: colors.danger + '40' },
  messageInfo: { backgroundColor: colors.accent + '15', borderWidth: 1, borderColor: colors.accent + '40' },
  messageText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
