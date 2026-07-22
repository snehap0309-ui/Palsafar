import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  ActivityIndicator,
  Switch,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Geolocation from 'react-native-geolocation-service';
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import { useDataContext } from '../context/DataContext';
import { uploadApi } from '../services/api/upload';
import { useVendorScreenInsets, VendorUI } from '../design/vendorLayout';
import type { RootStackParamList } from '../navigation/types';

const CATEGORIES = [
  'cafe', 'restaurant', 'hotel', 'homestay', 'guide',
  'bike_rental', 'car_rental', 'boating', 'adventure', 'tour_experience',
  'event_organizer',
] as const;

function formatCategory(cat: string) {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function VendorSettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useVendorScreenInsets({ withTabBar: false });
  const { currentVendor, updateVendorProfile } = useDataContext();

  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [address, setAddress] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [showOnMap, setShowOnMap] = useState(true);
  const [showContact, setShowContact] = useState(true);
  const [showWebsite, setShowWebsite] = useState(true);
  const [showImages, setShowImages] = useState(true);
  const [showOffers, setShowOffers] = useState(true);
  const [showReels, setShowReels] = useState(true);
  const [showNavigation, setShowNavigation] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!currentVendor) return;
    setBusinessName(currentVendor.businessName || '');
    setPhone(currentVendor.phone || '');
    setCategory(currentVendor.category || '');
    setCity(currentVendor.city || '');
    setStateName(currentVendor.state || '');
    setAddress(currentVendor.address || '');
    setOpeningHours(currentVendor.openingHours || currentVendor.operatingHours || '');
    setWebsite(currentVendor.website || '');
    setDescription(currentVendor.description || '');
    setImageUrl(currentVendor.imageUrl);
    setLatitude(currentVendor.latitude);
    setLongitude(currentVendor.longitude);
    setShowOnMap(currentVendor.showOnMap !== false);
    setShowContact(currentVendor.showContact !== false);
    setShowWebsite(currentVendor.showWebsite !== false);
    setShowImages(currentVendor.showImages !== false);
    setShowOffers(currentVendor.showOffers !== false);
    setShowReels(currentVendor.showReels !== false);
    setShowNavigation(currentVendor.showNavigation !== false);
  }, [currentVendor]);

  const canSave = useMemo(() => {
    return businessName.trim().length >= 2
      && phone.trim().length >= 10
      && address.trim().length > 0
      && city.trim().length > 0
      && stateName.trim().length > 0
      && !!category;
  }, [businessName, phone, address, city, stateName, category]);

  const pickImage = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      setUploading(true);
      const uploaded = await uploadApi.uploadImage(asset.uri);
      const url = (uploaded as any)?.url || (uploaded as any)?.secure_url || (uploaded as any)?.data?.url;
      if (!url) throw new Error('Upload failed');
      setImageUrl(url);
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message || 'Could not upload image.');
    } finally {
      setUploading(false);
    }
  };

  const useMyLocation = () => {
    setLocating(true);
    Geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        Alert.alert('Location unavailable', err.message || 'Enable GPS and try again.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  };

  const handleSave = async () => {
    if (!canSave) {
      Alert.alert('Missing details', 'Please fill business name, phone, category, address, city, and state.');
      return;
    }
    setSaving(true);
    try {
      await updateVendorProfile({
        businessName: businessName.trim(),
        phone: phone.trim(),
        category: category as any,
        city: city.trim(),
        state: stateName.trim(),
        address: address.trim(),
        openingHours: openingHours.trim() || undefined,
        website: website.trim() || undefined,
        description: description.trim() || undefined,
        imageUrl,
        latitude,
        longitude,
        showOnMap,
        showContact,
        showWebsite,
        showImages,
        showOffers,
        showReels,
        showNavigation,
      });
      Alert.alert('Saved', 'Your business details were updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Update failed', err?.message || 'Could not save business details.');
    } finally {
      setSaving(false);
    }
  };

  if (!currentVendor) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor={VendorUI.colors.bg} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
            <Icon name="arrow-back" size={22} color={VendorUI.colors.primaryDark} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>VENDOR WORKSPACE</Text>
            <Text style={styles.title}>Business settings</Text>
          </View>
          <View style={{ width: 42 }} />
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Vendor profile not loaded yet.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={VendorUI.colors.bg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Icon name="arrow-back" size={22} color={VendorUI.colors.primaryDark} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>VENDOR WORKSPACE</Text>
          <Text style={styles.title}>Business settings</Text>
        </View>
        <View style={{ width: 42 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.scrollPadBottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {currentVendor.vendorCode ? (
            <View style={styles.codeCard}>
              <Text style={styles.label}>Business code</Text>
              <Text style={styles.codeValue} selectable>{currentVendor.vendorCode}</Text>
              <Text style={styles.hint}>Tourists use this code to send you PalPoints.</Text>
            </View>
          ) : null}

          <Text style={styles.section}>Business details</Text>

          <TouchableOpacity style={styles.photoBtn} onPress={pickImage} disabled={uploading}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Icon name="camera-outline" size={28} color={VendorUI.colors.primary} />
              </View>
            )}
            <Text style={styles.photoLabel}>{uploading ? 'Uploading…' : 'Change cover photo'}</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Business name *</Text>
          <TextInput style={styles.input} value={businessName} onChangeText={setBusinessName} placeholder="Your shop name" placeholderTextColor={VendorUI.colors.textMuted} />

          <Text style={styles.label}>Phone *</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="10-digit phone" placeholderTextColor={VendorUI.colors.textMuted} />

          <Text style={styles.label}>Category *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, category === cat && styles.chipActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                  {formatCategory(cat)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Address *</Text>
          <TextInput style={[styles.input, styles.multiline]} value={address} onChangeText={setAddress} multiline placeholder="Street address" placeholderTextColor={VendorUI.colors.textMuted} />

          <Text style={styles.label}>City *</Text>
          <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City" placeholderTextColor={VendorUI.colors.textMuted} />

          <Text style={styles.label}>State *</Text>
          <TextInput style={styles.input} value={stateName} onChangeText={setStateName} placeholder="State" placeholderTextColor={VendorUI.colors.textMuted} />

          <Text style={styles.label}>Opening hours</Text>
          <TextInput style={styles.input} value={openingHours} onChangeText={setOpeningHours} placeholder="e.g. 9 AM – 9 PM" placeholderTextColor={VendorUI.colors.textMuted} />

          <Text style={styles.label}>Website</Text>
          <TextInput style={styles.input} value={website} onChangeText={setWebsite} autoCapitalize="none" placeholder="https://" placeholderTextColor={VendorUI.colors.textMuted} />

          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} multiline placeholder="Tell tourists about your business" placeholderTextColor={VendorUI.colors.textMuted} />

          <View style={styles.locationRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Map pin</Text>
              <Text style={styles.hint}>
                {latitude != null && longitude != null
                  ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
                  : 'Not set'}
              </Text>
            </View>
            <TouchableOpacity style={styles.secondaryBtn} onPress={useMyLocation} disabled={locating}>
              {locating ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Icon name="locate-outline" size={16} color="#fff" />
                  <Text style={styles.secondaryBtnText}>Use GPS</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <Text style={[styles.section, { marginTop: 20 }]}>Listing visibility</Text>
          {[
            { label: 'Show on map', value: showOnMap, set: setShowOnMap },
            { label: 'Show phone', value: showContact, set: setShowContact },
            { label: 'Show website', value: showWebsite, set: setShowWebsite },
            { label: 'Show gallery', value: showImages, set: setShowImages },
            { label: 'Show offers', value: showOffers, set: setShowOffers },
            { label: 'Show reels', value: showReels, set: setShowReels },
            { label: 'Show navigate', value: showNavigation, set: setShowNavigation },
          ].map((row) => (
            <View key={row.label} style={styles.switchRow}>
              <Text style={styles.switchLabel}>{row.label}</Text>
              <Switch
                value={row.value}
                onValueChange={row.set}
                trackColor={{ false: VendorUI.colors.border, true: VendorUI.colors.primary }}
              />
            </View>
          ))}

          <Text style={[styles.section, { marginTop: 20 }]}>Account</Text>
          {[
            { label: 'App notifications', route: 'Notifications' as const },
            { label: 'Change password', route: 'ChangePassword' as const },
            { label: 'Terms & Conditions', route: 'LegalHub' as const },
          ].map((row) => (
            <TouchableOpacity
              key={row.route}
              style={styles.linkRow}
              onPress={() => navigation.navigate(row.route)}
            >
              <Text style={styles.linkLabel}>{row.label}</Text>
              <Icon name="chevron-forward" size={16} color={VendorUI.colors.textMuted} />
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save business details</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VendorUI.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: VendorUI.space.screen,
    paddingVertical: 12,
    gap: 10,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: VendorUI.colors.white,
    borderWidth: 1,
    borderColor: VendorUI.colors.border,
    marginTop: 2,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: VendorUI.colors.primary,
  },
  title: { fontSize: 20, fontWeight: '800', color: VendorUI.colors.text, marginTop: 4, letterSpacing: -0.3 },
  content: { paddingHorizontal: VendorUI.space.screen, paddingTop: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: VendorUI.colors.textMuted },
  section: {
    fontSize: 11,
    fontWeight: '800',
    color: VendorUI.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 8,
  },
  codeCard: {
    backgroundColor: VendorUI.colors.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: VendorUI.colors.border,
    marginBottom: 18,
  },
  codeValue: {
    fontSize: 15,
    fontWeight: '800',
    color: VendorUI.colors.text,
    letterSpacing: 0.3,
    marginTop: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: VendorUI.colors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
  },
  hint: { fontSize: 12, color: VendorUI.colors.textMuted, marginTop: 4 },
  input: {
    backgroundColor: VendorUI.colors.white,
    borderWidth: 1,
    borderColor: VendorUI.colors.border,
    borderRadius: VendorUI.radius.md,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 14,
    fontWeight: '600',
    color: VendorUI.colors.text,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  chips: { gap: 8, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: VendorUI.colors.white,
    borderWidth: 1,
    borderColor: VendorUI.colors.border,
  },
  chipActive: { backgroundColor: VendorUI.colors.primaryDark, borderColor: VendorUI.colors.primaryDark },
  chipText: { fontSize: 12, fontWeight: '700', color: VendorUI.colors.textSecondary },
  chipTextActive: { color: '#FFF9F2' },
  photoBtn: { alignItems: 'center', marginBottom: 8, gap: 8 },
  photo: { width: 96, height: 96, borderRadius: 16 },
  photoPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 16,
    backgroundColor: VendorUI.colors.soft,
    borderWidth: 1,
    borderColor: VendorUI.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoLabel: { fontSize: 13, fontWeight: '700', color: VendorUI.colors.primaryDark },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: VendorUI.colors.primaryDark,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  secondaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: VendorUI.colors.border,
  },
  switchLabel: { fontSize: 14, color: VendorUI.colors.text, fontWeight: '600' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: VendorUI.colors.border,
  },
  linkLabel: { fontSize: 14, fontWeight: '600', color: VendorUI.colors.text },
  saveBtn: {
    marginTop: 24,
    backgroundColor: VendorUI.colors.primaryDark,
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#FFF9F2', fontSize: 15, fontWeight: '800' },
});
