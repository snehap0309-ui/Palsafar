import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useLocationContext } from '../context/LocationContext';
import { ridesApi, RideEstimate } from '../services/api/rides';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PROVIDER_CONFIG: Record<string, { name: string; color: string; icon: string }> = {
  uber: { name: 'Uber', color: '#000000', icon: 'car-sport-outline' },
  ola: { name: 'Ola', color: '#4CAF50', icon: 'car-outline' },
  rapido: { name: 'Rapido', color: '#FF5722', icon: 'bicycle-outline' },
};

const TYPE_ICONS: Record<string, string> = {
  bike: 'bicycle-outline',
  auto: 'car-sport-outline',
  cab: 'car-outline',
  xl: 'car-outline',
};

interface RideOptionsSheetProps {
  visible: boolean;
  onClose: () => void;
  destLat: number;
  destLng: number;
  destName: string;
}

export default function RideOptionsSheet({
  visible,
  onClose,
  destLat,
  destLng,
  destName,
}: RideOptionsSheetProps) {
  const { theme } = useTheme();
  const colors = theme;
  const insets = useSafeAreaInsets();
  const { effectivePosition } = useLocationContext();
  const [estimates, setEstimates] = useState<RideEstimate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !effectivePosition) return;

    const fetchEstimates = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await ridesApi.getEstimates(
          effectivePosition.latitude,
          effectivePosition.longitude,
          destLat,
          destLng,
        );
        setEstimates(res.data.estimates || []);
      } catch {
        setError('Could not fetch ride estimates. Using offline calculation.');
        const dist = haversineDistance(
          effectivePosition.latitude,
          effectivePosition.longitude,
          destLat,
          destLng,
        );
        setEstimates(getOfflineEstimates(dist));
      } finally {
        setLoading(false);
      }
    };

    fetchEstimates();
  }, [visible, effectivePosition, destLat, destLng]);

  const handleOpenApp = async (deepLink: string, provider: string) => {
    const appSchemes: Record<string, string> = {
      uber: 'uber://',
      ola: 'olacabs://',
      rapido: 'rapido://',
    };

    const scheme = appSchemes[provider];
    if (scheme) {
      const supported = await Linking.canOpenURL(scheme);
      if (supported) {
        await Linking.openURL(scheme);
        return;
      }
    }
    Linking.openURL(deepLink).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`);
    });
  };

  const grouped = estimates.reduce<Record<string, RideEstimate[]>>((acc, e) => {
    if (!acc[e.provider]) acc[e.provider] = [];
    acc[e.provider].push(e);
    return acc;
  }, {});

  const sortedProviders = ['uber', 'ola', 'rapido'].filter((p) => grouped[p]);

  const cheapest = estimates.length
    ? estimates.reduce((a, b) => (a.estimatedPrice < b.estimatedPrice ? a : b))
    : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 16) + 14 }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Ride Options</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>to {destName}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                Fetching ride estimates...
              </Text>
            </View>
          ) : error && estimates.length === 0 ? (
            <View style={styles.center}>
              <Icon name="alert-circle-outline" size={40} color={colors.textMuted} />
              <Text style={[styles.errorText, { color: colors.textMuted }]}>{error}</Text>
            </View>
          ) : (
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              {estimates.length > 0 && (
                <View style={[styles.bestBadge, { backgroundColor: colors.glass }]}>
                  <Icon name="flash" size={16} color={colors.primary} />
                  <Text style={[styles.bestText, { color: colors.primary }]}>
                    Best price: {cheapest?.displayName} — ₹{cheapest?.estimatedPrice}
                  </Text>
                </View>
              )}

              {sortedProviders.map((provider) => {
                const cfg = PROVIDER_CONFIG[provider];
                const options = grouped[provider];
                const min = Math.min(...options.map((o) => o.estimatedPrice));
                return (
                  <View key={provider} style={[styles.providerSection, { borderColor: colors.border }]}>
                    <View style={styles.providerHeader}>
                      <View style={[styles.providerDot, { backgroundColor: cfg?.color }]} />
                      <Text style={[styles.providerName, { color: colors.text }]}>
                        {cfg?.name || provider}
                      </Text>
                      <Text style={[styles.fromPrice, { color: colors.primary }]}>
                        from ₹{min}
                      </Text>
                    </View>

                    {options.map((option, idx) => (
                      <TouchableOpacity
                        key={`${provider}-${idx}`}
                        style={[styles.optionRow, { borderColor: colors.glass }]}
                        onPress={() => handleOpenApp(option.deepLink, option.provider)}
                        activeOpacity={0.7}
                      >
                        <Icon
                          name={TYPE_ICONS[option.type] || 'car-outline'}
                          size={20}
                          color={colors.textSecondary}
                          style={styles.optionIcon}
                        />
                        <View style={styles.optionInfo}>
                          <Text style={[styles.optionName, { color: colors.text }]}>
                            {option.displayName}
                          </Text>
                          <Text style={[styles.optionDur, { color: colors.textMuted }]}>
                            {option.distanceKm} km · {option.durationMinutes} mins
                          </Text>
                        </View>
                        <View style={styles.optionPrice}>
                          <Text style={[styles.priceMain, { color: colors.text }]}>
                            ₹{option.estimatedPrice}
                          </Text>
                          <Text style={[styles.priceRange, { color: colors.textMuted }]}>
                            ₹{option.priceRange.low}–₹{option.priceRange.high}
                          </Text>
                        </View>
                        <Icon name="open-outline" size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}

              <View style={[styles.disclaimer, { borderColor: colors.border }]}>
                <Icon name="information-circle-outline" size={14} color={colors.textMuted} />
                <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
                  Prices are estimates based on distance. Actual fares may vary due to surge pricing,
                  traffic, and availability. Tap a ride to open the app.
                </Text>
              </View>

            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getOfflineEstimates(distanceMeters: number): RideEstimate[] {
  const km = Math.round((distanceMeters / 1000) * 10) / 10;
  const base = (rate: number, baseFare: number, min: number) =>
    Math.max(Math.round(baseFare + rate * km), min);

  return [
    { provider: 'uber', displayName: 'Uber Moto', type: 'bike', estimatedPrice: base(5, 15, 25), priceRange: { low: base(5, 12, 22), high: base(7, 18, 32) }, currency: 'INR', durationMinutes: Math.round(km / 25 * 60), distanceKm: km, deepLink: '' },
    { provider: 'uber', displayName: 'Uber Go', type: 'cab', estimatedPrice: base(12, 25, 50), priceRange: { low: base(10, 22, 45), high: base(15, 30, 60) }, currency: 'INR', durationMinutes: Math.round(km / 25 * 60), distanceKm: km, deepLink: '' },
    { provider: 'ola', displayName: 'Ola Bike', type: 'bike', estimatedPrice: base(5, 15, 25), priceRange: { low: base(4, 13, 22), high: base(7, 18, 32) }, currency: 'INR', durationMinutes: Math.round(km / 25 * 60), distanceKm: km, deepLink: '' },
    { provider: 'ola', displayName: 'Ola Auto', type: 'auto', estimatedPrice: base(10, 20, 35), priceRange: { low: base(8, 18, 30), high: base(13, 25, 45) }, currency: 'INR', durationMinutes: Math.round(km / 25 * 60), distanceKm: km, deepLink: '' },
    { provider: 'ola', displayName: 'Ola Mini', type: 'cab', estimatedPrice: base(12, 25, 50), priceRange: { low: base(10, 22, 45), high: base(15, 30, 65) }, currency: 'INR', durationMinutes: Math.round(km / 25 * 60), distanceKm: km, deepLink: '' },
    { provider: 'rapido', displayName: 'Rapido Bike', type: 'bike', estimatedPrice: base(4, 12, 20), priceRange: { low: base(3, 10, 18), high: base(6, 16, 28) }, currency: 'INR', durationMinutes: Math.round(km / 25 * 60), distanceKm: km, deepLink: '' },
    { provider: 'rapido', displayName: 'Rapido Auto', type: 'auto', estimatedPrice: base(9, 18, 30), priceRange: { low: base(7, 15, 27), high: base(12, 22, 40) }, currency: 'INR', durationMinutes: Math.round(km / 25 * 60), distanceKm: km, deepLink: '' },
    { provider: 'rapido', displayName: 'Rapido Cab', type: 'cab', estimatedPrice: base(13, 25, 50), priceRange: { low: base(11, 22, 45), high: base(17, 30, 65) }, currency: 'INR', durationMinutes: Math.round(km / 25 * 60), distanceKm: km, deepLink: '' },
  ];
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  closeBtn: {
    padding: 6,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  scroll: {
    paddingHorizontal: 20,
  },
  bestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  bestText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  providerSection: {
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 14,
    overflow: 'hidden',
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  providerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  fromPrice: {
    fontSize: 14,
    fontWeight: '700',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  optionIcon: {
    marginRight: 10,
  },
  optionInfo: {
    flex: 1,
  },
  optionName: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionDur: {
    fontSize: 11,
    marginTop: 1,
  },
  optionPrice: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  priceMain: {
    fontSize: 15,
    fontWeight: '700',
  },
  priceRange: {
    fontSize: 11,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
  },
  disclaimerText: {
    fontSize: 11,
    marginLeft: 6,
    flex: 1,
    lineHeight: 16,
  },

});
