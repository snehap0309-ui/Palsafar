import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { colors, spacing, borderRadius } from '../config/theme';
import { MaterialIcons } from '../utils/Icons';
import { HiddenGemCategory, HiddenGemSubmission } from '../types';
import Geolocation from 'react-native-geolocation-service';
import { hiddenGemsApi } from '../services/api';
import { uploadApi } from '../services/api/upload';
import { apiClient } from '../services/api/client';
import { useUserContext } from '../context/UserContext';
import * as ImagePicker from 'react-native-image-picker';
import { useHeaderSafePadding } from '../design/responsive';

interface AddHiddenGemScreenProps {
  onBack: () => void;
  onSubmit: (input: Omit<HiddenGemSubmission, 'id' | 'status' | 'submittedAt' | 'pointsReward'>) => void;
  userId: string;
  userName: string;
}

const CATEGORIES: { value: HiddenGemCategory; label: string; emoji: string }[] = [
  { value: 'waterfall', label: 'Waterfall', emoji: '💧' },
  { value: 'sunset_point', label: 'Sunset Point', emoji: '🌅' },
  { value: 'old_temple', label: 'Old Temple', emoji: '🛕' },
  { value: 'local_viewpoint', label: 'Viewpoint', emoji: '🏔️' },
  { value: 'photo_spot', label: 'Photo Spot', emoji: '📸' },
  { value: 'river_ghat', label: 'River Ghat', emoji: '🌊' },
  { value: 'small_fort', label: 'Small Fort', emoji: '🏰' },
  { value: 'nature_trail', label: 'Nature Trail', emoji: '🌲' },
  { value: 'cultural_place', label: 'Cultural Place', emoji: '🎭' },
  { value: 'lake', label: 'Lake', emoji: '🏞️' },
  { value: 'cave', label: 'Cave', emoji: '🕳️' },
  { value: 'wildlife', label: 'Wildlife', emoji: '🦌' },
  { value: 'heritage', label: 'Heritage', emoji: '🏛️' },
  { value: 'other', label: 'Other', emoji: '📍' },
];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Puducherry',
];

const STATE_ALIASES: Record<string, string> = {
  'nct of delhi': 'Delhi',
  'national capital territory of delhi': 'Delhi',
  delhi: 'Delhi',
  pondicherry: 'Puducherry',
  orissa: 'Odisha',
  uttaranchal: 'Uttarakhand',
  // ISO 3166-2 codes from Nominatim
  'in-ap': 'Andhra Pradesh',
  'in-ar': 'Arunachal Pradesh',
  'in-as': 'Assam',
  'in-br': 'Bihar',
  'in-ct': 'Chhattisgarh',
  'in-ga': 'Goa',
  'in-gj': 'Gujarat',
  'in-hr': 'Haryana',
  'in-hp': 'Himachal Pradesh',
  'in-jh': 'Jharkhand',
  'in-ka': 'Karnataka',
  'in-kl': 'Kerala',
  'in-mp': 'Madhya Pradesh',
  'in-mh': 'Maharashtra',
  'in-mn': 'Manipur',
  'in-ml': 'Meghalaya',
  'in-mz': 'Mizoram',
  'in-nl': 'Nagaland',
  'in-or': 'Odisha',
  'in-pb': 'Punjab',
  'in-rj': 'Rajasthan',
  'in-sk': 'Sikkim',
  'in-tn': 'Tamil Nadu',
  'in-tg': 'Telangana',
  'in-tr': 'Tripura',
  'in-up': 'Uttar Pradesh',
  'in-ut': 'Uttarakhand',
  'in-wb': 'West Bengal',
  'in-dl': 'Delhi',
  'in-py': 'Puducherry',
};

function normalizeStateKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^state of\s+/i, '')
    .replace(/\s+/g, ' ');
}

function matchIndianState(...candidates: Array<string | undefined>): string {
  for (const raw of candidates) {
    if (!raw?.trim()) continue;
    const n = normalizeStateKey(raw);
    if (STATE_ALIASES[n]) return STATE_ALIASES[n];
    const exact = INDIAN_STATES.find(s => s.toLowerCase() === n);
    if (exact) return exact;
    const partial = INDIAN_STATES.find(
      s => n.includes(s.toLowerCase()) || s.toLowerCase().includes(n),
    );
    if (partial) return partial;
  }
  return '';
}

async function reverseGeocodeCityState(lat: number, lng: number): Promise<{ city: string; state: string }> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`,
    { headers: { 'Accept-Language': 'en', 'User-Agent': 'PalSafar-Mobile/1.0' } },
  );
  const data = await res.json();
  const addr = data?.address || {};
  const city =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.suburb ||
    addr.municipality ||
    addr.county ||
    addr.state_district ||
    '';
  const state = matchIndianState(
    addr.state,
    addr['ISO3166-2-lvl4'],
    addr['ISO3166-2-lvl3'],
    addr.region,
  );
  return { city: String(city || '').trim(), state };
}

const TIME_PERIODS = [
  { value: 'Morning', label: 'Morning' },
  { value: 'Afternoon', label: 'Afternoon' },
  { value: 'Evening', label: 'Evening' },
  { value: 'Night', label: 'Night' },
  { value: 'Sunrise', label: 'Sunrise' },
  { value: 'Sunset', label: 'Sunset' },
  { value: 'Monsoon', label: 'Monsoon' },
  { value: 'Any', label: 'Any Time' },
] as const;

const PERIOD_TIME_DEFAULTS: Record<string, { from: string; to: string }> = {
  Morning: { from: '08:00 AM', to: '11:00 AM' },
  Afternoon: { from: '12:00 PM', to: '04:00 PM' },
  Evening: { from: '04:00 PM', to: '07:00 PM' },
  Night: { from: '07:00 PM', to: '11:00 PM' },
  Sunrise: { from: '05:00 AM', to: '07:00 AM' },
  Sunset: { from: '05:00 PM', to: '07:00 PM' },
  Monsoon: { from: '08:00 AM', to: '06:00 PM' },
  Any: { from: '08:00 AM', to: '08:00 PM' },
};

export default function AddHiddenGemScreen({ onBack, onSubmit, userId, userName }: AddHiddenGemScreenProps) {
  const headerPadTop = useHeaderSafePadding(12);
  const { isGuest, onLogout } = useUserContext();
  const [placeName, setPlaceName] = useState('');
  const [category, setCategory] = useState<HiddenGemCategory | null>(null);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [description, setDescription] = useState('');
  const [bestTimeLabel, setBestTimeLabel] = useState('Morning');
  const [bestTimeFrom, setBestTimeFrom] = useState('08:00 AM');
  const [bestTimeTo, setBestTimeTo] = useState('11:00 AM');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [safetyTip, setSafetyTip] = useState('');
  const [worthVisiting, setWorthVisiting] = useState('');
  const [locationMethod, setLocationMethod] = useState<'gps' | 'map_pick' | 'manual'>('gps');
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const stateScrollRef = useRef<ScrollView>(null);
  const stateChipXRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!state) return;
    const x = stateChipXRef.current[state];
    if (x == null) return;
    const t = setTimeout(() => {
      stateScrollRef.current?.scrollTo({ x: Math.max(0, x - 12), animated: true });
    }, 80);
    return () => clearTimeout(t);
  }, [state]);

  const handlePeriodSelect = (period: string) => {
    setBestTimeLabel(period);
    const defaults = PERIOD_TIME_DEFAULTS[period];
    if (defaults) {
      setBestTimeFrom(defaults.from);
      setBestTimeTo(defaults.to);
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
    });
    if (result.assets && result.assets[0].uri) {
      setImageUri(result.assets[0].uri);
    }
  };

  const useCurrentLocation = () => {
    setLoadingLocation(true);
    setLocationMethod('gps');
    Geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLatitude(lat.toFixed(6));
        setLongitude(lng.toFixed(6));
        try {
          const { city: geoCity, state: geoState } = await reverseGeocodeCityState(lat, lng);
          if (geoCity) setCity(geoCity);
          if (geoState) {
            setState(geoState);
          } else {
            Alert.alert(
              'Location found',
              'Coordinates and city filled where possible. Please select your state from the list.',
            );
          }
        } catch {
          Alert.alert(
            'Location found',
            'Coordinates filled. Could not detect city/state automatically — please enter them manually.',
          );
        } finally {
          setLoadingLocation(false);
        }
      },
      () => {
        setLoadingLocation(false);
        Alert.alert('Location Error', 'Could not get current location. Please try again or enter manually.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  const validateCoordinates = (): boolean => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) return false;
    if (lat < 6 || lat > 37) return false;
    if (lng < 68 || lng > 98) return false;
    return true;
  };

  const getValidationErrors = (): string[] => {
    const errors: string[] = [];
    if (!placeName.trim()) errors.push('Place name is required');
    if (placeName.trim().length < 3) errors.push('Place name must be at least 3 characters');
    if (!category) errors.push('Category is required');
    if (!city.trim()) errors.push('City is required');
    if (!state) errors.push('State is required');
    if (!latitude || !longitude) errors.push('Location coordinates are required');
    else if (!validateCoordinates()) errors.push('Invalid coordinates - must be within India');
    if (!description.trim()) errors.push('Description is required');
    if (description.trim().length < 20) errors.push('Description must be at least 20 characters');
    if (!worthVisiting.trim()) errors.push('Explain why this place is worth visiting');
    if (worthVisiting.trim().length < 30) errors.push('Please provide more details (at least 30 characters)');
    
    if (!bestTimeLabel.trim()) errors.push('Time period is required');
    const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM|am|pm)$/i;
    if (!bestTimeFrom.trim()) errors.push('Start time is required');
    else if (!timeRegex.test(bestTimeFrom.trim())) errors.push('Start time must be in HH:MM AM/PM format (e.g., 08:00 AM)');
    if (!bestTimeTo.trim()) errors.push('End time is required');
    else if (!timeRegex.test(bestTimeTo.trim())) errors.push('End time must be in HH:MM AM/PM format (e.g., 11:00 AM)');
    
    return errors;
  };

  const requireSignedIn = (): boolean => {
    if (isGuest || !userId || userId === 'guest-user') {
      Alert.alert(
        'Sign In Required',
        'Sign in with your PalSafar account to submit a hidden gem for review.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => onLogout() },
        ],
      );
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (!requireSignedIn()) return;

    const errors = getValidationErrors();
    if (errors.length > 0) {
      Alert.alert('Please fix the following:', '• ' + errors.slice(0, 3).join('\n• ') + (errors.length > 3 ? `\n\n...and ${errors.length - 3} more` : ''));
      return;
    }

    Alert.alert(
      'Submit Hidden Gem?',
      'Your submission will be reviewed by admin. You\'ll earn Pal Points only after approval!\n\n💎 Higher quality submissions (with details) earn more points.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setSubmitting(true);
            try {
              const ok = await apiClient.ensureAuth();
              if (!ok || !apiClient.getToken()) {
                Alert.alert(
                  'Sign In Required',
                  'Your session expired or is missing. Please sign in again to submit.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign In', onPress: () => onLogout() },
                  ],
                );
                return;
              }

              let uploadedUrl = '';
              if (imageUri) {
                const uploadRes = await uploadApi.uploadImage(imageUri);
                uploadedUrl = uploadRes.url;
              }

              await hiddenGemsApi.create({
                placeName: placeName.trim(),
                category: category!,
                city: city.trim(),
                state,
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                imageUri: uploadedUrl || undefined,
                description: description.trim(),
                bestTimeToVisit: {
                  from: bestTimeFrom.trim(),
                  to: bestTimeTo.trim(),
                  label: bestTimeLabel,
                },
                estimatedCost: estimatedCost.trim() || 'Free',
                safetyTip: safetyTip.trim() || 'None',
                worthVisitingReason: worthVisiting.trim(),
                locationMethod,
              });
              // Also call parent prop for any local state updates
              onSubmit({
                userId,
                userName,
                placeName: placeName.trim(),
                category: category!,
                city: city.trim(),
                state,
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                description: description.trim(),
                bestTimeToVisit: { from: bestTimeFrom.trim(), to: bestTimeTo.trim(), label: bestTimeLabel },
                estimatedCost: estimatedCost.trim() || 'Free',
                safetyTip: safetyTip.trim() || 'None',
                worthVisitingReason: worthVisiting.trim(),
                locationMethod,
              });
              Alert.alert('🎉 Submitted!', 'Your hidden gem has been submitted for review. You\'ll earn PalPoints once it\'s approved!', [
                { text: 'Great!', onPress: () => onBack() },
              ]);
            } catch (err: any) {
              const msg = String(err?.message || '');
              if (err?.status === 401 || /auth|token|sign in|login/i.test(msg)) {
                Alert.alert(
                  'Sign In Required',
                  'Please sign in with your PalSafar account to submit a hidden gem.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign In', onPress: () => onLogout() },
                  ],
                );
              } else {
                Alert.alert('Submission Failed', msg || 'Failed to submit your hidden gem. Please check your connection and try again.');
              }
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: headerPadTop }]}>
        <TouchableOpacity onPress={onBack}>
          <MaterialIcons name="arrow-back" size={24} color={colors.primaryLight} />
        </TouchableOpacity>
        <Text style={styles.title}>Add Hidden Gem</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {isGuest && (
          <TouchableOpacity
            style={styles.signInBanner}
            onPress={() =>
              Alert.alert(
                'Sign In Required',
                'Sign in with your PalSafar account to submit a hidden gem for review.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign In', onPress: () => onLogout() },
                ],
              )
            }
            activeOpacity={0.85}
          >
            <MaterialIcons name="lock-outline" size={18} color="#92400E" />
            <Text style={styles.signInBannerText}>Sign in to submit — tap here</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>📍 Location</Text>
        
        <View style={styles.locationButtons}>
          <TouchableOpacity 
            style={[styles.locationBtn, locationMethod === 'gps' && styles.locationBtnActive]}
            onPress={useCurrentLocation}
            disabled={loadingLocation}
          >
            <MaterialIcons name="my-location" size={20} color={locationMethod === 'gps' ? '#fff' : colors.primaryLight} />
            <Text style={[styles.locationBtnText, locationMethod === 'gps' && styles.locationBtnTextActive]}>
              {loadingLocation ? 'Getting...' : 'Use GPS'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.locationBtn, locationMethod === 'manual' && styles.locationBtnActive]}
            onPress={() => setLocationMethod('manual')}
          >
            <MaterialIcons name="edit" size={20} color={locationMethod === 'manual' ? '#fff' : colors.primaryLight} />
            <Text style={[styles.locationBtnText, locationMethod === 'manual' && styles.locationBtnTextActive]}>Manual</Text>
          </TouchableOpacity>
        </View>

        {(locationMethod === 'gps' || locationMethod === 'manual') && (
          <View style={styles.coordRow}>
            <View style={styles.coordInput}>
              <Text style={styles.coordLabel}>Latitude</Text>
              <TextInput
                style={styles.input}
                value={latitude}
                onChangeText={setLatitude}
                placeholder="23.123456"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.coordInput}>
              <Text style={styles.coordLabel}>Longitude</Text>
              <TextInput
                style={styles.input}
                value={longitude}
                onChangeText={setLongitude}
                placeholder="79.123456"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        )}
        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>📸 Photo (Optional but recommended)</Text>
        <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <MaterialIcons name="add-a-photo" size={32} color={colors.primaryLight} />
              <Text style={styles.imagePlaceholderText}>Tap to add a photo</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>💡 Tips & Details</Text>

        <Text style={styles.label}>Place Name *</Text>
        <TextInput
          style={styles.input}
          value={placeName}
          onChangeText={setPlaceName}
          placeholder="Enter the place name"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Category *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          <View style={styles.categoryRow}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.value}
                style={[styles.categoryChip, category === cat.value && styles.categoryChipActive]}
                onPress={() => setCategory(cat.value)}
              >
                <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                <Text style={[styles.categoryLabel, category === cat.value && styles.categoryLabelActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <Text style={styles.label}>City *</Text>
        <TextInput
          style={styles.input}
          value={city}
          onChangeText={setCity}
          placeholder="e.g., Jabalpur"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>State *</Text>
        {!!state && (
          <Text style={styles.selectedStateHint}>Selected: {state}</Text>
        )}
        <ScrollView
          ref={stateScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.stateScroll}
        >
          <View style={styles.stateRow}>
            {INDIAN_STATES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.stateChip, state === s && styles.stateChipActive]}
                onPress={() => setState(s)}
                onLayout={(e) => {
                  stateChipXRef.current[s] = e.nativeEvent.layout.x;
                }}
              >
                <Text style={[styles.stateLabel, state === s && styles.stateLabelActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <Text style={styles.sectionTitle}>📝 Description</Text>

        <Text style={styles.label}>Short Description *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="What makes this place special?"
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={3}
        />

        <Text style={styles.label}>Why is this place worth visiting? *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={worthVisiting}
          onChangeText={setWorthVisiting}
          placeholder="What can visitors expect? What makes it a hidden gem?"
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={3}
        />

        <Text style={styles.sectionTitle}>🕒 Best Time to Visit</Text>
        
        <Text style={styles.label}>Select Period</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stateScroll}>
          <View style={styles.stateRow}>
            {TIME_PERIODS.map((period) => (
              <TouchableOpacity
                key={period.value}
                style={[styles.stateChip, bestTimeLabel === period.value && styles.stateChipActive]}
                onPress={() => handlePeriodSelect(period.value)}
              >
                <Text style={[styles.stateLabel, bestTimeLabel === period.value && styles.stateLabelActive]}>
                  {period.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View style={styles.coordRow}>
          <View style={styles.coordInput}>
            <Text style={styles.label}>From Time</Text>
            <TextInput
              style={styles.input}
              value={bestTimeFrom}
              onChangeText={setBestTimeFrom}
              placeholder="e.g., 08:00 AM"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.coordInput}>
            <Text style={styles.label}>To Time</Text>
            <TextInput
              style={styles.input}
              value={bestTimeTo}
              onChangeText={setBestTimeTo}
              placeholder="e.g., 11:00 AM"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        <Text style={styles.label}>Estimated Cost / Entry Fee</Text>
        <TextInput
          style={styles.input}
          value={estimatedCost}
          onChangeText={setEstimatedCost}
          placeholder="e.g., Free, ₹50, ₹100"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Safety Tip</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={safetyTip}
          onChangeText={setSafetyTip}
          placeholder="Any safety advice for visitors?"
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={2}
        />

        <TouchableOpacity
          style={[styles.submitButton, submitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <MaterialIcons name="send" size={20} color="#fff" />
          )}
          <Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Submit for Review'}</Text>
        </TouchableOpacity>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, paddingTop: 0 },
  title: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  content: { flex: 1, padding: spacing.lg, paddingTop: 0 },
  signInBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  signInBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: spacing.md, marginTop: spacing.md },
  label: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.sm },
  selectedStateHint: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryLight,
    marginBottom: spacing.xs,
  },
  input: { backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.border },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  imagePicker: {
    width: '100%',
    height: 160,
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  imagePlaceholderText: {
    fontSize: 14,
    color: '#64748B',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  locationButtons: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  locationBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, gap: spacing.xs, borderWidth: 1, borderColor: colors.primary },
  locationBtnActive: { backgroundColor: colors.primary },
  locationBtnText: { color: colors.primaryLight, fontSize: 13, fontWeight: '600' },
  locationBtnTextActive: { color: '#fff' },
  coordRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  coordInput: { flex: 1 },
  coordLabel: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs },
  categoryScroll: { marginBottom: spacing.sm },
  categoryRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  categoryChip: { alignItems: 'center', padding: spacing.sm, backgroundColor: colors.surface, borderRadius: borderRadius.md, minWidth: 70, borderWidth: 1, borderColor: colors.border },
  categoryChipActive: { backgroundColor: colors.primary + '30', borderColor: colors.primary },
  categoryEmoji: { fontSize: 20, marginBottom: 2 },
  categoryLabel: { fontSize: 10, color: colors.textSecondary },
  categoryLabelActive: { color: colors.primaryLight, fontWeight: '600' },
  stateScroll: { marginBottom: spacing.sm },
  stateRow: { flexDirection: 'row', gap: spacing.xs, paddingVertical: spacing.xs },
  stateChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: colors.surface, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border },
  stateChipActive: { backgroundColor: colors.primary + '30', borderColor: colors.primary },
  stateLabel: { fontSize: 11, color: colors.textSecondary },
  stateLabelActive: { color: colors.primaryLight, fontWeight: '600' },
  submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, padding: spacing.md, borderRadius: borderRadius.md, marginTop: spacing.lg, gap: spacing.sm },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});