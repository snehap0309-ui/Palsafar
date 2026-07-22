import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { monetizationApi } from '../services/api/monetization';
import { useEntitlements } from '../context/EntitlementContext';
import { useBottomSafePadding } from '../design/responsive';

export default function PremiumUpgradeScreen({ onBack }: { onBack?: () => void }) {
  const navigation = useNavigation<any>();
  const { isPremium, entitlements } = useEntitlements();
  const scrollPadBottom = useBottomSafePadding(24);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await monetizationApi.listPlans('USER_PREMIUM');
      setPlans(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Could not load plans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.back}>
            <Icon name="chevron-back" size={22} color="#63300E" />
          </TouchableOpacity>
        ) : <View style={{ width: 40 }} />}
        <Text style={styles.title}>PalSafar Premium</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('BillingHistory')}
          style={styles.back}
        >
          <Icon name="receipt-outline" size={20} color="#63300E" />
        </TouchableOpacity>
      </View>

      {isPremium ? (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>You are Premium</Text>
          <Text style={styles.bannerSub}>
            {entitlements?.premiumExpiresAt
              ? `Renews / expires ${new Date(entitlements.premiumExpiresAt).toLocaleDateString('en-IN')}`
              : 'Ad-free experience unlocked'}
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#B9834B" /></View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.btn}><Text style={styles.btnText}>Try again</Text></TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.list, { paddingBottom: scrollPadBottom }]}>
          {plans.length === 0 ? (
            <Text style={styles.empty}>No Premium plans published yet.</Text>
          ) : plans.map((plan) => {
            const monthly = plan.prices?.find((p: any) => p.period === 'MONTHLY');
            const yearly = plan.prices?.find((p: any) => p.period === 'YEARLY');
            return (
              <View key={plan.id} style={styles.card}>
                <Text style={styles.planName}>{plan.name}</Text>
                {plan.description ? <Text style={styles.planDesc}>{plan.description}</Text> : null}
                {monthly ? (
                  <View style={styles.btn}>
                    <Text style={styles.btnText}>₹{(monthly.amountPaise / 100).toFixed(0)} / month</Text>
                  </View>
                ) : null}
                {yearly ? (
                  <View style={[styles.btn, styles.btnOutline]}>
                    <Text style={[styles.btnText, styles.btnOutlineText]}>₹{(yearly.amountPaise / 100).toFixed(0)} / year</Text>
                  </View>
                ) : null}
              </View>
            );
          })}

          <Text style={styles.note}>
            Premium is managed on the PalSafar website. Visit the web portal to upgrade or manage your subscription.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF9F2' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: '#63300E' },
  banner: { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#F5DDAE', borderRadius: 14, padding: 14 },
  bannerTitle: { fontWeight: '800', color: '#63300E', fontSize: 16 },
  bannerSub: { color: '#8B7355', marginTop: 4, fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: '#8B7355', marginBottom: 12, textAlign: 'center' },
  list: { padding: 16, gap: 12 },
  empty: { color: '#8B7355', textAlign: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E9D4BE', padding: 16, gap: 10 },
  planName: { fontSize: 18, fontWeight: '800', color: '#63300E' },
  planDesc: { fontSize: 13, color: '#8B7355', lineHeight: 18 },
  btn: { backgroundColor: '#B9834B', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800' },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#B9834B' },
  btnOutlineText: { color: '#63300E' },
  note: { fontSize: 11, color: '#8B7355', lineHeight: 16, marginTop: 8, textAlign: 'center' },
});
