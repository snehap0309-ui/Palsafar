import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { monetizationApi } from '../services/api/monetization';
import { useEntitlements } from '../context/EntitlementContext';
import { useUserContext } from '../context/UserContext';
import { useBottomSafePadding } from '../design/responsive';

export default function VendorSubscriptionScreen({ onBack }: { onBack?: () => void }) {
  const navigation = useNavigation<any>();
  const { user } = useUserContext();
  const { entitlements, refreshEntitlements, loading: entLoading } = useEntitlements();
  const scrollPadBottom = useBottomSafePadding(24);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sub = entitlements?.vendorSubscription;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await refreshEntitlements();
      const data = await monetizationApi.listPlans('VENDOR');
      // Touch documents API so vendor document endpoints stay live (list + upload available).
      await monetizationApi.listVendorDocuments().catch(() => []);
      if (data?.[0]?.id) {
        await monetizationApi.getPlan(data[0].id).catch(() => null);
      }
      setPlans(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Could not load vendor plans');
    } finally {
      setLoading(false);
    }
  }, [refreshEntitlements]);

  useEffect(() => { load(); }, [load]);

  const checkout = async (plan: any, period: 'MONTHLY' | 'SEMIANNUAL') => {
    setBusy(true);
    try {
      const order = await monetizationApi.createRazorpayOrder(plan.id, period);
      navigation.navigate('RazorpayCheckout', {
        planId: plan.id,
        period,
        planName: plan.name,
        amountPaise: order.amountPaise,
        orderId: order.orderId,
        keyId: order.keyId,
        currency: order.currency || 'INR',
        prefillEmail: user?.email,
        prefillName: user?.displayName,
      });
    } catch (e: any) {
      Alert.alert('Checkout unavailable', e?.message || 'Configure Razorpay server keys to enable payments.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
          <Icon name="arrow-back" size={22} color="#63300E" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>VENDOR WORKSPACE</Text>
          <Text style={styles.title}>Subscription</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('BillingHistory')} style={styles.iconBtn}>
          <Icon name="receipt-outline" size={20} color="#63300E" />
        </TouchableOpacity>
      </View>

      {loading || entLoading ? (
        <View style={styles.center}><ActivityIndicator color="#B9834B" /></View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{error}</Text>
          <TouchableOpacity style={styles.btn} onPress={load}><Text style={styles.btnText}>Try again</Text></TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: scrollPadBottom }]}>
          <View style={styles.card}>
            <Text style={styles.label}>Current plan</Text>
            <Text style={styles.value}>{sub?.name || 'No active plan'}</Text>
            <Text style={styles.muted}>
              {sub
                ? `Status ${sub.status} · expires ${new Date(sub.expiresAt).toLocaleDateString('en-IN')}${sub.graceEndsAt ? ` · grace until ${new Date(sub.graceEndsAt).toLocaleDateString('en-IN')}` : ''}`
                : 'Upgrade to unlock higher offer limits, analytics, and featured listing.'}
            </Text>
            {sub ? (
              <View style={styles.usageRow}>
                <Usage label="Max offers" value={String(sub.maxOffers ?? '—')} />
                <Usage label="Analytics" value={String(sub.analyticsLevel ?? 'basic')} />
                <Usage label="Featured" value={sub.featuredListing ? 'Yes' : 'No'} />
              </View>
            ) : null}
          </View>

          {__DEV__ ? (
            <>
              <TouchableOpacity
                style={[styles.btn, styles.outline]}
                onPress={async () => {
                  try {
                    await monetizationApi.uploadVendorDocument('GST', 'https://palsafar.com/placeholder-doc', 'gst-placeholder.pdf');
                    Alert.alert('Document recorded', 'Dev placeholder upload only.');
                  } catch (e: any) {
                    Alert.alert('Documents', e?.message || 'Could not register document');
                  }
                }}
              >
                <Text style={[styles.btnText, styles.outlineText]}>Register GST document (dev)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.outline]}
                onPress={async () => {
                  try {
                    const code = `V${Date.now().toString(36).toUpperCase().slice(-6)}`;
                    await monetizationApi.createVendorCoupon({
                      code,
                      type: 'PERCENTAGE',
                      value: 10,
                    });
                    Alert.alert('Coupon', `Created ${code}`);
                  } catch (e: any) {
                    Alert.alert('Coupon', e?.message || 'Could not create coupon');
                  }
                }}
              >
                <Text style={[styles.btnText, styles.outlineText]}>Create vendor coupon (dev)</Text>
              </TouchableOpacity>
            </>
          ) : null}

          <Text style={styles.section}>Upgrade / renew</Text>
          {plans.length === 0 ? (
            <Text style={styles.muted}>No vendor plans published in Admin yet.</Text>
          ) : plans.map((plan) => {
            const monthly = plan.prices?.find((p: any) => p.period === 'MONTHLY');
            const semiannual = plan.prices?.find((p: any) => p.period === 'SEMIANNUAL');
            return (
              <View key={plan.id} style={styles.card}>
                <Text style={styles.value}>{plan.name}</Text>
                {plan.description ? <Text style={styles.muted}>{plan.description}</Text> : null}
                {monthly ? (
                  <TouchableOpacity disabled={busy} style={styles.btn} onPress={() => checkout(plan, 'MONTHLY')}>
                    <Text style={styles.btnText}>₹{(monthly.amountPaise / 100).toFixed(0)} / month</Text>
                  </TouchableOpacity>
                ) : null}
                {semiannual ? (
                  <TouchableOpacity disabled={busy} style={[styles.btn, styles.outline]} onPress={() => checkout(plan, 'SEMIANNUAL')}>
                    <Text style={[styles.btnText, styles.outlineText]}>₹{(semiannual.amountPaise / 100).toFixed(0)} / 6 months</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Usage({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.usage}>
      <Text style={styles.usageValue}>{value}</Text>
      <Text style={styles.usageLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF9F2' },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: '#A67C52' },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E9D4BE', marginTop: 2,
  },
  title: { fontWeight: '800', fontSize: 20, color: '#4D3227', marginTop: 4, letterSpacing: -0.3 },
  content: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E9D4BE', padding: 16, gap: 8 },
  label: { fontSize: 11, fontWeight: '800', color: '#8B7355', textTransform: 'uppercase', letterSpacing: 0.8 },
  value: { fontSize: 18, fontWeight: '800', color: '#4D3227' },
  muted: { fontSize: 13, color: '#8B7355', lineHeight: 18 },
  section: { fontSize: 16, fontWeight: '800', color: '#4D3227', marginTop: 8 },
  btn: { backgroundColor: '#63300E', borderRadius: 20, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#FFF9F2', fontWeight: '800' },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#E9D4BE' },
  outlineText: { color: '#63300E' },
  usageRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  usage: { flex: 1, backgroundColor: '#FBEFE2', borderRadius: 10, padding: 10 },
  usageValue: { fontWeight: '800', color: '#63300E' },
  usageLabel: { fontSize: 11, color: '#8B7355', marginTop: 2 },
});
