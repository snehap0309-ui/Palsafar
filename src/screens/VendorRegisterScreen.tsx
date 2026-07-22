import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomSafePadding } from '../design/responsive';
import Icon from 'react-native-vector-icons/Ionicons';
import { useDataContext } from '../context/DataContext';
import { useUserContext } from '../context/UserContext';
import { DEV_FLAGS } from '../config/devFlags';
import type { OwnerIdType, BusinessProofType } from '../types';
import { launchImageLibrary } from 'react-native-image-picker';
import { uploadApi } from '../services/api/upload';
import { ApiErrorCodes, getApiErrorCode } from '../services/api/client';
import Geolocation from 'react-native-geolocation-service';

const COLORS = {
  primary: '#B9834B',
  secondary: '#63300E',
  background: '#FFF9F2',
  card: '#FBEFE2',
  text: '#2C1810',
  textSecondary: '#8B7355',
  textMuted: '#B8A88A',
  border: 'rgba(200, 155, 60, 0.15)',
};

interface VendorRegisterScreenProps {
  onBack: () => void;
}

const CATEGORIES = [
  'cafe', 'restaurant', 'hotel', 'homestay', 'guide',
  'bike_rental', 'car_rental', 'boating', 'adventure', 'tour_experience',
  'event_organizer',
] as const;

const OWNER_ID_TYPES: { key: OwnerIdType; label: string }[] = [
  { key: 'aadhaar', label: 'Aadhaar Card' },
  { key: 'pan', label: 'PAN Card' },
  { key: 'voter_id', label: 'Voter ID' },
  { key: 'driving_license', label: 'Driving License' },
  { key: 'passport', label: 'Passport' },
  { key: 'other', label: 'Other' },
];

const BUSINESS_PROOF_TYPES: { key: BusinessProofType; label: string }[] = [
  { key: 'shop_registration', label: 'Shop Registration' },
  { key: 'gst', label: 'GST Certificate' },
  { key: 'fssai', label: 'FSSAI License' },
  { key: 'hotel_license', label: 'Hotel License' },
  { key: 'tourism_license', label: 'Tourism License' },
  { key: 'local_body_license', label: 'Local Body License' },
  { key: 'event_permission', label: 'Event Permission' },
  { key: 'other', label: 'Other' },
];

function formatCategory(cat: string) {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function VendorRegisterScreen({ onBack }: VendorRegisterScreenProps) {
  const bottomPad = useBottomSafePadding(24);
  const { registerVendor, currentVendor } = useDataContext();
  const { user, isAuthenticated } = useUserContext();
  const isResubmission = currentVendor?.verificationStatus === 'rejected' || currentVendor?.verificationStatus === 'changes_requested';

  const [businessName, setBusinessName] = useState(currentVendor?.businessName || '');
  const [ownerName, setOwnerName] = useState('');
  const [email] = useState(user.email || '');
  const [phone, setPhone] = useState(currentVendor?.phone || '');
  const [category, setCategory] = useState(currentVendor?.category || '');
  const [city, setCity] = useState(currentVendor?.city || '');
  const [state, setState] = useState(currentVendor?.state || 'Madhya Pradesh');
  const [address, setAddress] = useState(currentVendor?.address || '');
  const [openingHours, setOpeningHours] = useState(currentVendor?.openingHours || '');
  const [website, setWebsite] = useState(currentVendor?.website || '');
  const [description, setDescription] = useState(currentVendor?.description || '');
  const [latitude, setLatitude] = useState<number | undefined>(currentVendor?.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(currentVendor?.longitude);
  const [capturingLocation, setCapturingLocation] = useState(false);
  const [ownerIdType, setOwnerIdType] = useState<OwnerIdType | ''>('');
  const [ownerIdNumber, setOwnerIdNumber] = useState('');
  const [businessProofType, setBusinessProofType] = useState<BusinessProofType | ''>('');
  const [businessProofNumber, setBusinessProofNumber] = useState('');
  const [ownerProofUri, setOwnerProofUri] = useState<string | null>(null);
  const [businessProofUri, setBusinessProofUri] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  const pickOwnerProof = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
      if (!result.didCancel && result.assets?.[0]?.uri) {
        setOwnerProofUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'Could not open photo library.');
    }
  };

  const pickBusinessProof = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
      if (!result.didCancel && result.assets?.[0]?.uri) {
        setBusinessProofUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'Could not open photo library.');
    }
  };

  const captureMapLocation = () => {
    setCapturingLocation(true);
    Geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setCapturingLocation(false);
        Alert.alert('Location captured', 'Your map pin will use this GPS position after registration.');
      },
      (err) => {
        setCapturingLocation(false);
        Alert.alert('Location unavailable', err.message || 'Enable GPS and try again.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  };

  const handleRegister = async () => {
    if (!isAuthenticated || user.uid === 'guest-user') {
      Alert.alert('Sign in required', 'Sign in with your existing PalSafar account before registering a business.');
      return;
    }
    const errors: string[] = [];
    if (!businessName.trim()) errors.push('Business name is required');
    if (!ownerName.trim()) errors.push('Owner name is required');
    if (!email.trim()) errors.push('Email is required');
    else if (!email.includes('@')) errors.push('Invalid email format');
    if (!category) errors.push('Business category is required');
    if (!city.trim()) errors.push('City is required');
    if (!address.trim()) errors.push('Address is required');
    if (!ownerIdType) errors.push('Owner ID type is required for verification');
    if (!ownerIdNumber.trim()) errors.push('Owner ID number is required');
    if (!businessProofType) errors.push('Business proof type is required');
    if (!businessProofNumber.trim()) errors.push('Business proof number is required');

    const websiteTrimmed = website.trim();
    if (websiteTrimmed && !/^https?:\/\//i.test(websiteTrimmed)) {
      errors.push('Website must start with http:// or https://');
    }

    if (errors.length > 0) {
      Alert.alert('Please fix these issues:', '• ' + errors.slice(0, 5).join('\n• '));
      return;
    }

    setRegistering(true);
    try {
      const uploadedImages: string[] = [];

      if (ownerProofUri) {
        try {
          const res = await uploadApi.uploadImage(ownerProofUri);
          if (res.url) uploadedImages.push(res.url);
        } catch (e) {
          console.error('Failed to upload owner proof:', e);
        }
      }

      if (businessProofUri) {
        try {
          const res = await uploadApi.uploadImage(businessProofUri);
          if (res.url) uploadedImages.push(res.url);
        } catch (e) {
          console.error('Failed to upload business proof:', e);
        }
      }

      const vendorId = `vendor_${Date.now()}`;
      const now = new Date().toISOString();

      const vendor = {
        id: vendorId,
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
        email: email.trim(),
        phone,
        category: category as any,
        city: city.trim(),
        state: state.trim(),
        address: address.trim(),
        latitude,
        longitude,
        openingHours,
        website: websiteTrimmed || undefined,
        description,
        linkedSpotIds: [] as string[],
        verificationStatus: 'pending' as const,
        qrCodeValue: `PS_VENDOR_${vendorId}`,
        createdAt: now,
        ownerIdType: ownerIdType || undefined,
        ownerIdNumber: ownerIdNumber.trim() || undefined,
        businessProofType: businessProofType || undefined,
        businessProofNumber: businessProofNumber.trim() || undefined,
        images: uploadedImages,
        imageUrl: uploadedImages[0],
      };

      const submit = async (confirmSwitch: boolean) => {
        const result = await registerVendor(vendor, confirmSwitch ? { confirmSwitch } : undefined);
        if (result) {
          Alert.alert(
            'Registration Submitted',
            DEV_FLAGS.USE_SERVER_API
              ? 'Your vendor account is submitted for verification.\n\nOnce an admin approves, you can start creating offers.'
              : 'Your vendor account is submitted for verification.',
          );
          onBack();
        } else {
          Alert.alert('Registration Failed', 'Could not complete registration. Please check your details and try again.');
        }
      };

      try {
        await submit(false);
      } catch (err: any) {
        if (getApiErrorCode(err) === ApiErrorCodes.SWITCH_CONFIRMATION_REQUIRED) {
          Alert.alert(
            'Switch to Vendor?',
            'You already have a Creator workspace.\nYou must deactivate Creator before activating Vendor.\n\nContinuing will retire your Creator role.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Continue',
                style: 'destructive',
                onPress: () => {
                  submit(true).catch((retryErr: any) => {
                    Alert.alert('Registration Failed', retryErr?.message || 'Could not complete registration.');
                  });
                },
              },
            ],
          );
        } else {
          Alert.alert('Registration Failed', err?.message || 'Could not complete registration. Please check your details and try again.');
        }
      }
    } finally {
      setRegistering(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.card} />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>Vendor Application</Text>
          <TouchableOpacity onPress={onBack} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="close" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.appNotice}>
              <Icon name="information-circle" size={18} color={COLORS.primary} />
              <Text style={styles.appNoticeText}>
                {isResubmission
                  ? 'Update your details and resubmit for verification.'
                  : 'Fill in your business details to apply as a vendor. Required fields are marked with *.'}
              </Text>
            </View>

            <Text style={styles.fieldLabel}>Business Name *</Text>
            <TextInput
              style={styles.fieldInput}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Your business name"
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={[styles.fieldLabel, styles.fieldGap]}>Owner Name *</Text>
            <TextInput
              style={styles.fieldInput}
              value={ownerName}
              onChangeText={setOwnerName}
              placeholder="Owner full name"
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={[styles.fieldLabel, styles.fieldGap]}>Account Email</Text>
            <TextInput
              style={[styles.fieldInput, styles.fieldInputDisabled]}
              value={email}
              editable={false}
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={[styles.fieldLabel, styles.fieldGap]}>Phone</Text>
            <TextInput
              style={styles.fieldInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="Contact number"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="phone-pad"
            />

            <Text style={[styles.fieldLabel, styles.fieldGap]}>Business Category *</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((cat) => {
                const selected = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {formatCategory(cat)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, styles.fieldGap]}>City *</Text>
            <TextInput
              style={styles.fieldInput}
              value={city}
              onChangeText={setCity}
              placeholder="City name"
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={[styles.fieldLabel, styles.fieldGap]}>State</Text>
            <TextInput
              style={styles.fieldInput}
              value={state}
              onChangeText={setState}
              placeholder="State"
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={[styles.fieldLabel, styles.fieldGap]}>Full Address *</Text>
            <TextInput
              style={[styles.fieldInput, styles.fieldMultiline]}
              value={address}
              onChangeText={setAddress}
              placeholder="Complete address"
              placeholderTextColor={COLORS.textMuted}
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={captureMapLocation}
              disabled={capturingLocation}
              activeOpacity={0.85}
            >
              <Icon name="locate-outline" size={18} color={COLORS.primary} />
              <Text style={styles.secondaryBtnText}>
                {capturingLocation
                  ? 'Capturing…'
                  : latitude != null
                    ? `Pinned (${latitude.toFixed(4)}, ${longitude?.toFixed(4)})`
                    : 'Pin my location on map'}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.fieldLabel, styles.fieldGap]}>Website (optional)</Text>
            <TextInput
              style={styles.fieldInput}
              value={website}
              onChangeText={setWebsite}
              placeholder="https://your-business.com"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              keyboardType="url"
            />

            <Text style={[styles.fieldLabel, styles.fieldGap]}>Opening Hours (optional)</Text>
            <TextInput
              style={styles.fieldInput}
              value={openingHours}
              onChangeText={setOpeningHours}
              placeholder="e.g. 9:00 AM - 9:00 PM"
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={[styles.fieldLabel, styles.fieldGap]}>Description (optional)</Text>
            <TextInput
              style={[styles.fieldInput, styles.fieldMultiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your business"
              placeholderTextColor={COLORS.textMuted}
              multiline
              textAlignVertical="top"
            />

            <Text style={[styles.fieldLabel, styles.fieldGap]}>Owner ID Type *</Text>
            <View style={styles.chipRow}>
              {OWNER_ID_TYPES.map((item) => {
                const selected = ownerIdType === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setOwnerIdType(item.key)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, styles.fieldGap]}>Owner ID Number *</Text>
            <TextInput
              style={styles.fieldInput}
              value={ownerIdNumber}
              onChangeText={setOwnerIdNumber}
              placeholder="ID number"
              placeholderTextColor={COLORS.textMuted}
            />

            <TouchableOpacity
              style={[styles.uploadBtn, ownerProofUri ? styles.uploadBtnDone : null]}
              onPress={pickOwnerProof}
              activeOpacity={0.85}
            >
              <Icon
                name={ownerProofUri ? 'checkmark-circle' : 'cloud-upload-outline'}
                size={18}
                color={ownerProofUri ? COLORS.primary : COLORS.textSecondary}
              />
              <Text style={[styles.uploadBtnText, ownerProofUri ? { color: COLORS.primary } : null]}>
                {ownerProofUri ? 'Owner proof selected' : 'Upload owner proof image (optional)'}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.fieldLabel, styles.fieldGap]}>Business Proof Type *</Text>
            <View style={styles.chipRow}>
              {BUSINESS_PROOF_TYPES.map((item) => {
                const selected = businessProofType === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setBusinessProofType(item.key)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, styles.fieldGap]}>Business Proof Number *</Text>
            <TextInput
              style={styles.fieldInput}
              value={businessProofNumber}
              onChangeText={setBusinessProofNumber}
              placeholder="Proof number"
              placeholderTextColor={COLORS.textMuted}
            />

            <TouchableOpacity
              style={[styles.uploadBtn, businessProofUri ? styles.uploadBtnDone : null]}
              onPress={pickBusinessProof}
              activeOpacity={0.85}
            >
              <Icon
                name={businessProofUri ? 'checkmark-circle' : 'cloud-upload-outline'}
                size={18}
                color={businessProofUri ? COLORS.primary : COLORS.textSecondary}
              />
              <Text style={[styles.uploadBtnText, businessProofUri ? { color: COLORS.primary } : null]}>
                {businessProofUri ? 'Business proof selected' : 'Upload business proof image (optional)'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, registering && styles.submitBtnDisabled]}
              onPress={handleRegister}
              disabled={registering}
              activeOpacity={0.85}
            >
              {registering ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {isResubmission ? 'Resubmit Application' : 'Submit Application'}
                </Text>
              )}
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.card },
  safe: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 20 },
  appNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    backgroundColor: COLORS.primary + '08',
    borderColor: COLORS.primary + '20',
  },
  appNoticeText: { fontSize: 13, fontWeight: '600', flex: 1, color: COLORS.primary, lineHeight: 18 },
  fieldLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8, color: COLORS.textSecondary },
  fieldGap: { marginTop: 16 },
  fieldInput: {
    height: 50,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
  },
  fieldInputDisabled: { opacity: 0.7 },
  fieldMultiline: { height: 90, paddingTop: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
  },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  chipTextSelected: { color: '#fff' },
  secondaryBtn: {
    marginTop: 14,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '40',
    backgroundColor: COLORS.primary + '10',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  uploadBtn: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  uploadBtnDone: { borderStyle: 'solid', borderColor: COLORS.primary + '50' },
  uploadBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  submitBtn: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
    backgroundColor: COLORS.primary,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
