import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Share,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useUserContext } from '../context/UserContext';
import { useLocationContext } from '../context/LocationContext';
import Pal from '../design/DesignSystem';
import {
  tripsApi,
  TripPlan,
  TripPlanStop,
  TravelPace,
  BudgetTier,
  AvoidOption,
} from '../services/api/trips';
import { useToast } from '../context/ToastContext';
import TripItineraryView, { ItineraryTab } from '../components/trip/TripItineraryView';
import { loadBestDraftTrip, countTripStops, loadDraftSnapshot, seedDraftTripCache, invalidateDraftTripCache, ensureManualDraftTrip } from '../utils/quickAddPlace';
import { normalizeTripDays, normalizeTripPlan, stopListKey } from '../utils/normalizeTripPlan';

function applyTrip(trip: TripPlan): TripPlan {
  return normalizeTripPlan(trip);
}

function pickPrimaryDayIndex(trip: TripPlan): number {
  const days = trip.tripDays || [];
  const withStops = days.findIndex(d => (d.stops?.length || 0) > 0);
  return withStops >= 0 ? withStops : 0;
}

export default function TripBuilderScreen() {
  const navigation = useNavigation<any>();
  const { isGuest, user } = useUserContext();
  const { effectivePosition } = useLocationContext();
  const { showSuccess, showError } = useToast();

  const [trip, setTrip] = useState<TripPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [currentDay, setCurrentDay] = useState(0);
  const [activeTab, setActiveTab] = useState<ItineraryTab>('itinerary');
  const [noteModal, setNoteModal] = useState<{ stop: TripPlanStop; text: string } | null>(null);
  const [refineModalVisible, setRefineModalVisible] = useState(false);
  const [refining, setRefining] = useState(false);
  const [refinePace, setRefinePace] = useState<TravelPace>('BALANCED');
  const [refineBudget, setRefineBudget] = useState<BudgetTier>('MEDIUM');
  const [refineAvoid, setRefineAvoid] = useState<AvoidOption[]>([]);
  const [refineNotes, setRefineNotes] = useState('');
  const tripRef = useRef<TripPlan | null>(null);
  tripRef.current = trip;

  const loadDraftTrip = useCallback(async (mode: 'initial' | 'background' = 'initial') => {
    if (isGuest) {
      setLoading(false);
      return;
    }

    const existing = tripRef.current;
    const hasExistingStops = countTripStops(existing) > 0;

    if (mode === 'initial' && !hasExistingStops) {
      const snapshot = await loadDraftSnapshot();
      if (snapshot) {
        setTrip(applyTrip(snapshot));
        setCurrentDay(pickPrimaryDayIndex(snapshot));
        setLoading(false);
      } else {
        setLoading(true);
      }
    }

    try {
      let draft = await loadBestDraftTrip(user?.currentItinerary, {
        skipResync: hasExistingStops || mode === 'background',
      });
      if (!draft && mode === 'initial' && !hasExistingStops && !isGuest) {
        draft = await ensureManualDraftTrip();
      }
      if (draft) {
        draft = applyTrip(draft);
        setTrip(draft);
        seedDraftTripCache(draft);
        setCurrentDay(prev => {
          const tripForDay = draft;
          if (!tripForDay) return prev;
          const currentStops = tripForDay.tripDays?.[prev]?.stops?.length || 0;
          if (mode === 'initial' || currentStops === 0) return pickPrimaryDayIndex(tripForDay);
          return prev;
        });
      } else if (!hasExistingStops) {
        setTrip(null);
      }
    } catch (err) {
      console.warn('[TripBuilder] Failed to load draft trip:', err);
      if (!hasExistingStops) setTrip(null);
    } finally {
      setLoading(false);
    }
  }, [isGuest, user?.currentItinerary]);

  useFocusEffect(
    useCallback(() => {
      const hasStops = countTripStops(tripRef.current) > 0;
      loadDraftTrip(hasStops ? 'background' : 'initial');
    }, [loadDraftTrip]),
  );

  const fetchTrip = useCallback(async () => {
    if (!trip?.id) return;
    try {
      const full = await tripsApi.getById(trip.id);
      setTrip(applyTrip(full));
      seedDraftTripCache(full);
      setCurrentDay(pickPrimaryDayIndex(full));
    } catch (err: any) {
      showError(err?.message || 'Failed to refresh itinerary');
    }
  }, [trip?.id, showError]);

  const handleShareTrip = async () => {
    if (!trip) return;
    try {
      const dayCount = trip.tripDays?.length || 0;
      const stopCount = trip.tripDays?.reduce((sum, d) => sum + d.stops.length, 0) || 0;
      await Share.share({
        message: `🗺️ Check out my trip "${trip.title}" to ${trip.destination} on PalSafar!\n📅 ${dayCount} days · 📍 ${stopCount} stops`,
      });
    } catch (e) {
      console.warn('Share failed', e);
    }
  };

  const handleOptimize = async () => {
    if (!trip || reviewSaving) return;
    setReviewSaving(true);
    try {
      const startLocation = effectivePosition
        ? { latitude: effectivePosition.latitude, longitude: effectivePosition.longitude }
        : undefined;
      const updated = await tripsApi.optimizeRoute(trip.id, { strategy: 'scenic', startLocation });
      setTrip(applyTrip(updated));
      seedDraftTripCache(updated);
      showSuccess('Itinerary optimized!');
    } catch (err: any) {
      showError(err?.message || 'Failed to optimize itinerary');
    } finally {
      setReviewSaving(false);
    }
  };

  const ensureTimedItinerary = async (draft: TripPlan) => {
    const hasScheduledStops = draft.tripDays?.some(d => d.stops?.some(s => s.startTime));
    if (hasScheduledStops) return draft;
    const startLocation = effectivePosition
      ? { latitude: effectivePosition.latitude, longitude: effectivePosition.longitude }
      : undefined;
    return tripsApi.optimizeRoute(draft.id, { strategy: 'scenic', startLocation });
  };

  const openRefineModal = () => {
    if (!trip) return;
    setRefinePace(trip.pace || 'BALANCED');
    setRefineBudget((trip.budget as BudgetTier) || 'MEDIUM');
    setRefineAvoid(trip.avoid || []);
    setRefineNotes('');
    setRefineModalVisible(true);
  };

  const handleAiRefine = async () => {
    if (!trip) return;
    setRefining(true);
    try {
      const result = await tripsApi.aiGenerate({
        tripId: trip.id,
        destination: trip.destination || trip.title,
        days: trip.days,
        pace: refinePace,
        travelers: (trip.travelers as any) || 'SOLO',
        budget: refineBudget,
        interests: trip.interests || [],
        timePreference: trip.timePreference || undefined,
        avoid: refineAvoid,
        prompt: refineNotes || trip.aiPrompt || undefined,
      });
      setTrip(applyTrip(result.trip));
      setRefineModalVisible(false);
      showSuccess('Itinerary refined with AI!');
    } catch (err: any) {
      showError(err?.message || 'Failed to refine itinerary');
    }
    setRefining(false);
  };

  const handleRemoveStop = (stopId: string) => {
    Alert.alert('Remove Stop', 'Remove this stop from the itinerary?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await tripsApi.deleteStop(stopId);
            fetchTrip();
            showSuccess('Stop removed from itinerary');
          } catch (err: any) {
            showError(err?.message || 'Failed to remove stop');
          }
        },
      },
    ]);
  };

  const handleSaveNotes = async () => {
    if (!noteModal) return;
    try {
      await tripsApi.updateStop(noteModal.stop.id, { notes: noteModal.text });
      setNoteModal(null);
      fetchTrip();
      showSuccess('Notes saved successfully');
    } catch (err: any) {
      showError(err?.message || 'Failed to save notes');
    }
  };

  const handleShowJourney = async () => {
    if (!trip || reviewSaving) return;
    if (countTripStops(trip) === 0) {
      showError('Add at least one place from the map first.');
      return;
    }
    setReviewSaving(true);
    try {
      const timedTrip = await ensureTimedItinerary(trip);
      setTrip(applyTrip(timedTrip));
      seedDraftTripCache(timedTrip);
      setCurrentDay(pickPrimaryDayIndex(timedTrip));
      setActiveTab('itinerary');
      showSuccess('Your journey is ready — times, route & costs updated.');
    } catch (err: any) {
      showError(err?.message || 'Could not build your journey. Try again.');
    } finally {
      setReviewSaving(false);
    }
  };

  const handleSaveTrip = async () => {
    if (!trip || reviewSaving) return;
    if (countTripStops(trip) === 0) {
      showError('Add at least one place before saving.');
      return;
    }
    setReviewSaving(true);
    try {
      let draft = trip;
      const hasScheduledStops = draft.tripDays?.some(d => d.stops?.some(s => s.startTime));
      if (!hasScheduledStops) {
        draft = applyTrip(await ensureTimedItinerary(trip));
        setTrip(draft);
      }
      const updated = await tripsApi.update(draft.id, { status: 'UPCOMING' });
      setTrip(applyTrip(updated));
      invalidateDraftTripCache();
      showSuccess('Trip saved! Ready for your journey.');
      navigation.navigate('TripDetail', { tripId: updated.id });
    } catch (err: any) {
      showError(err?.message || 'Failed to save trip');
    } finally {
      setReviewSaving(false);
    }
  };

  const handleTripMenu = () => {
    Alert.alert('Trip options', undefined, [
      { text: 'Save trip', onPress: handleSaveTrip },
      { text: 'Share trip', onPress: handleShareTrip },
      { text: 'Optimize route', onPress: handleOptimize },
      { text: 'AI refine', onPress: openRefineModal },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleStopMenu = (stop: TripPlanStop) => {
    Alert.alert(stop.place?.name || 'Stop', undefined, [
      { text: 'Add notes', onPress: () => setNoteModal({ stop, text: stop.notes || '' }) },
      { text: 'Remove', style: 'destructive', onPress: () => handleRemoveStop(stop.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  if (isGuest) {
    return (
      <View style={styles.centered}>
        <Icon name="lock-closed-outline" size={48} color="#CBD5E1" />
        <Text style={styles.emptyTitle}>Sign In Required</Text>
        <Text style={styles.emptySubtitle}>Sign in to build and save your itinerary.</Text>
        <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.emptyBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Pal.colors.light.primary} />
        <Text style={styles.loadingText}>Loading your itinerary...</Text>
      </View>
    );
  }

  if (!trip) {
    const hasLocalPlaces = (user?.currentItinerary?.length || 0) > 0;
    return (
      <View style={styles.emptyContainer}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={22} color="#2C1810" />
        </TouchableOpacity>
        <View style={styles.centered}>
          <Icon name="map-outline" size={48} color="#B8A88A" />
          <Text style={styles.emptyTitle}>Could not load your trip</Text>
          <Text style={styles.emptySubtitle}>
            {hasLocalPlaces
              ? 'Syncing your saved places… Tap Retry in a moment.'
              : 'Check your connection and try again, or add places from the map.'}
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => (hasLocalPlaces ? loadDraftTrip() : navigation.navigate('MainTabs', { screen: 'Map' }))}
          >
            <Text style={styles.emptyBtnText}>{hasLocalPlaces ? 'Retry' : 'Explore Map'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const days = normalizeTripDays(trip.tripDays);
  const currentDayData = days[currentDay];
  const stops = currentDayData?.stops || [];

  const mapTabContent = (
    <View style={{ marginHorizontal: 16, marginBottom: 20 }}>
      <View style={styles.mapPanel}>
        <Text style={styles.mapPanelTitle}>Route — Day {currentDay + 1}</Text>
        {stops.map((stop, i) => (
          <View key={stopListKey(stop, i)} style={styles.mapStopRow}>
            <View style={styles.mapStopDot}>
              <Text style={styles.mapStopDotText}>{i + 1}</Text>
            </View>
            <Text style={styles.mapStopName} numberOfLines={1}>{stop.place?.name || 'Place'}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFF9F2' }}>
      <TripItineraryView
        trip={trip}
        currentDay={currentDay}
        onDayChange={setCurrentDay}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onBack={() => navigation.goBack()}
        onEditTrip={() => navigation.navigate('MainTabs', { screen: 'Map' })}
        onMenu={handleTripMenu}
        onReviewSave={handleShowJourney}
        onViewInsights={openRefineModal}
        onAddDay={() => Alert.alert('Add Day', 'Day management will be available in a future update.')}
        onAddPlace={() => navigation.navigate('MainTabs', { screen: 'Map' })}
        onStopMenu={handleStopMenu}
        onToggleBookmark={() => showSuccess('Saved to bookmarks')}
        renderMapTab={() => mapTabContent}
        reviewSaving={reviewSaving}
        showDestinationCard={false}
        headerTitle="My Journey"
        primaryActionLabel="Show Journey"
        footerNote="Builds your route with times & costs — save from the menu when ready"
        showFooterOnBudget
      />

      <Modal visible={!!noteModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Notes — {noteModal?.stop.place?.name || 'Stop'}</Text>
            <TextInput
              style={styles.notesInput}
              value={noteModal?.text || ''}
              onChangeText={(text) => setNoteModal(prev => (prev ? { ...prev, text } : null))}
              placeholder="Add notes, tips, or reminders..."
              placeholderTextColor={Pal.colors.light.textMuted}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnSecondary} onPress={() => setNoteModal(null)}>
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnPrimary} onPress={handleSaveNotes}>
                <Text style={styles.modalBtnPrimaryText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={refineModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>🪄 AI Refine Itinerary</Text>
            <Text style={styles.modalSub}>Keeps your pinned stops and re-generates the rest.</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnSecondary} onPress={() => setRefineModalVisible(false)} disabled={refining}>
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnPrimary} onPress={handleAiRefine} disabled={refining}>
                {refining ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Refine with AI</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
    backgroundColor: '#FFF9F2',
  },
  emptyContainer: { flex: 1, backgroundColor: '#FFF9F2' },
  backBtn: {
    position: 'absolute',
    top: 52,
    left: 16,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200, 155, 60, 0.18)',
  },
  loadingText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#8B7355' },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#2C1810', marginTop: 8 },
  emptySubtitle: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#8B7355', textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 12,
    backgroundColor: '#63300E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyBtnText: { color: '#FFF9F2', fontFamily: 'Inter-Bold', fontSize: 14 },
  mapPanel: {
    minHeight: 280,
    borderRadius: 16,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: 'rgba(200, 155, 60, 0.18)',
    padding: 16,
  },
  mapPanelTitle: { fontFamily: 'Inter-Bold', fontSize: 15, color: '#2C1810', marginBottom: 12 },
  mapStopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  mapStopDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#63300E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapStopDotText: { color: '#FFF9F2', fontSize: 10, fontFamily: 'Inter-Bold' },
  mapStopName: { marginLeft: 8, fontSize: 12, color: '#2C1810', flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    gap: 12,
  },
  modalTitle: { fontFamily: 'Inter-Bold', fontSize: 17, color: '#2C1810' },
  modalSub: { fontSize: 12, color: '#8B7355' },
  notesInput: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: 'rgba(200, 155, 60, 0.18)',
    borderRadius: 12,
    padding: 14,
    color: '#2C1810',
    fontSize: 14,
    textAlignVertical: 'top',
    backgroundColor: '#FBEFE2',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalBtnSecondary: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: 'rgba(200, 155, 60, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnSecondaryText: { color: '#2C1810', fontFamily: 'Inter-SemiBold', fontSize: 13 },
  modalBtnPrimary: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#63300E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnPrimaryText: { color: '#FFF9F2', fontFamily: 'Inter-SemiBold', fontSize: 13 },
});
