import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Share, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { monetizationApi } from '../services/api/monetization';
import { useVendorScreenInsets, VendorUI } from '../design/vendorLayout';

type Customer = {
  userId: string;
  name: string;
  email: string;
  visits: number;
  palPointsRedeemed: number;
  lastVisitAt: string;
  firstVisitAt: string;
  recentOffers: string[];
};

export default function VendorCustomersScreen({ onBack }: { onBack?: () => void }) {
  const insets = useVendorScreenInsets();
  const [q, setQ] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res: any = await monetizationApi.vendorCustomers(q.trim() || undefined, 1);
      const payload = res?.data ?? res;
      setCustomers(payload?.data || []);
      setSummary(payload?.summary || null);
    } catch (e: any) {
      setError(e?.message || 'Could not load customers');
      setCustomers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [q]);

  useEffect(() => {
    const t = setTimeout(() => { load(); }, 250);
    return () => clearTimeout(t);
  }, [load]);

  const exportCsv = async () => {
    try {
      const res = await monetizationApi.exportVendorCustomersCsv();
      const body = typeof res === 'string' ? res : (res as any)?.data ?? JSON.stringify(res);
      await Share.share({ message: String(body), title: 'customers.csv' });
    } catch {
      const header = 'Name,Email,Visits,PalPoints,LastVisit';
      const rows = customers.map((c) =>
        [JSON.stringify(c.name), JSON.stringify(c.email), c.visits, c.palPointsRedeemed, c.lastVisitAt].join(','),
      );
      await Share.share({ message: [header, ...rows].join('\n'), title: 'customers.csv' });
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={VendorUI.colors.bg} />
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Icon name="arrow-back" size={22} color={VendorUI.colors.primaryDark} />
          </TouchableOpacity>
        ) : <View style={{ width: 42 }} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.eyebrow}>VENDOR WORKSPACE</Text>
          <Text style={styles.title}>Customers</Text>
          <Text style={styles.sub}>From offer redemptions</Text>
        </View>
        <TouchableOpacity onPress={exportCsv} style={styles.exportBtn}>
          <Icon name="download-outline" size={18} color={VendorUI.colors.primaryDark} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Icon name="search" size={18} color={VendorUI.colors.textMuted} />
        <TextInput
          style={styles.search}
          placeholder="Search name or email"
          placeholderTextColor={VendorUI.colors.textMuted}
          value={q}
          onChangeText={setQ}
        />
      </View>

      {summary ? (
        <View style={styles.summaryRow}>
          <SummaryChip label="Customers" value={String(summary.totalCustomers || 0)} />
          <SummaryChip label="Repeat" value={String(summary.repeatVisitors || 0)} />
          <SummaryChip label="PalPoints" value={String(summary.totalPalPoints || 0)} />
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={VendorUI.colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity onPress={() => load()} style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.scrollPadBottom, gap: 10 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={VendorUI.colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>No customers yet</Text>
              <Text style={styles.emptySub}>When tourists redeem your offers, they appear here.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.email}>{item.email}</Text>
              <Text style={styles.meta}>
                {item.visits} visit{item.visits === 1 ? '' : 's'} · {item.palPointsRedeemed} pts · last{' '}
                {new Date(item.lastVisitAt).toLocaleDateString('en-IN')}
              </Text>
              {item.visits > 1 ? <Text style={styles.repeat}>Repeat visitor</Text> : null}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipValue}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: VendorUI.colors.bg },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  backBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    backgroundColor: VendorUI.colors.white, borderWidth: 1, borderColor: VendorUI.colors.border, marginTop: 2,
  },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: VendorUI.colors.primary },
  title: { fontSize: 20, fontWeight: '800', color: VendorUI.colors.text, marginTop: 4, letterSpacing: -0.3 },
  sub: { fontSize: 13, color: VendorUI.colors.textSecondary, marginTop: 2, fontWeight: '500' },
  exportBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    backgroundColor: VendorUI.colors.white, borderWidth: 1, borderColor: VendorUI.colors.border, marginTop: 2,
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 10,
    backgroundColor: VendorUI.colors.white, borderRadius: 14, borderWidth: 1, borderColor: VendorUI.colors.border, paddingHorizontal: 12,
  },
  search: { flex: 1, paddingVertical: 10, color: VendorUI.colors.text },
  summaryRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  chip: { flex: 1, backgroundColor: VendorUI.colors.white, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: VendorUI.colors.border },
  chipValue: { fontWeight: '800', color: VendorUI.colors.primaryDark, fontSize: 16 },
  chipLabel: { fontSize: 11, color: VendorUI.colors.textMuted, marginTop: 2 },
  center: { padding: 40, alignItems: 'center' },
  error: { color: VendorUI.colors.textMuted, textAlign: 'center', marginBottom: 12 },
  retry: { backgroundColor: VendorUI.colors.primaryDark, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  retryText: { color: '#FFF9F2', fontWeight: '700' },
  emptyTitle: { fontWeight: '800', color: VendorUI.colors.text, fontSize: 16 },
  emptySub: { color: VendorUI.colors.textMuted, textAlign: 'center', marginTop: 6 },
  card: { backgroundColor: VendorUI.colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: VendorUI.colors.border },
  name: { fontWeight: '800', color: VendorUI.colors.text, fontSize: 15 },
  email: { color: VendorUI.colors.textMuted, fontSize: 12, marginTop: 2 },
  meta: { color: VendorUI.colors.textSecondary, fontSize: 12, marginTop: 8 },
  repeat: { marginTop: 6, color: VendorUI.colors.primaryDark, fontWeight: '700', fontSize: 11 },
});
