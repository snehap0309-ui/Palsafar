import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, ImageBackground, StatusBar, TouchableOpacity, useWindowDimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Pal from '../design/DesignSystem';
import { LinearGradient } from '../utils/LinearGradient';
import { useUserContext } from '../context/UserContext';
import { apiClient } from '../services/api';
import { tripsApi, AiGenerateInput } from '../services/api/trips';
import { API_CONFIG } from '../config/api';

const PHASES = [
  'Waking up trip servers...',
  'Understanding your trip...',
  'Finding places across India...',
  'Matching your interests...',
  'Balancing daily pace...',
  'Ordering stops by distance...',
  'Finalizing itinerary...',
];

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

type ScreenState = 'loading' | 'success' | 'error' | 'unauthenticated';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAuthError(err: any): boolean {
  return err?.status === 401;
}

function isRetryableError(err: any): boolean {
  if (!err) return false;
  if (!err.status) return true; // network / abort / parse
  if (err.status === 408 || err.status === 429) return true;
  if (err.status >= 500) return true;
  const msg = String(err.message || '').toLowerCase();
  return msg.includes('timed out') || msg.includes('network') || msg.includes('abort');
}

function friendlyErrorMessage(err: any): string {
  if (err?.message?.includes('timed out')) {
    return 'That took too long. Check your connection and try again.';
  }
  if (err?.status === 422) {
    return err?.message || "We couldn't find enough places for this trip. Try another city or broaden your interests.";
  }
  if (err?.status === 400) {
    return err?.message || 'Some of the trip details look invalid. Please review and try again.';
  }
  if (err?.status === 429) {
    return err?.message || 'Too many trip requests. Please wait a minute and try again.';
  }
  if (err?.status && err.status >= 500) {
    const serverMsg = typeof err?.message === 'string' ? err.message.trim() : '';
    if (serverMsg && !/^internal server error$/i.test(serverMsg) && !/^request failed/i.test(serverMsg)) {
      return serverMsg;
    }
    return 'Trip servers needed a moment to wake up. Tap Try Again — the next attempt usually works.';
  }
  if (!err?.status) {
    return 'Network error. Check your connection and try again.';
  }
  return err?.message || 'Could not generate your trip. Please try again.';
}

/** Drop undefined fields so Zod defaults apply cleanly on the server. */
function cleanAiInput(input: AiGenerateInput): AiGenerateInput {
  const cleaned: Partial<AiGenerateInput> = {};
  for (const [key, value] of Object.entries(input) as [keyof AiGenerateInput, unknown][]) {
    if (value !== undefined && value !== null && value !== '') {
      (cleaned as Record<string, unknown>)[key] = value;
    }
  }
  return {
    destination: cleaned.destination ?? input.destination,
    days: cleaned.days ?? input.days,
    pace: cleaned.pace ?? 'BALANCED',
    travelers: cleaned.travelers ?? 'SOLO',
    budget: cleaned.budget ?? 'MEDIUM',
    interests: Array.isArray(cleaned.interests) ? cleaned.interests : [],
    avoid: Array.isArray(cleaned.avoid) ? cleaned.avoid : [],
    ...(cleaned.tripId !== undefined ? { tripId: cleaned.tripId } : {}),
    ...(cleaned.customBudgetAmount !== undefined ? { customBudgetAmount: cleaned.customBudgetAmount } : {}),
    ...(cleaned.timePreference !== undefined ? { timePreference: cleaned.timePreference } : {}),
    ...(cleaned.prompt !== undefined ? { prompt: cleaned.prompt } : {}),
    ...(cleaned.manualPlaceIds !== undefined ? { manualPlaceIds: cleaned.manualPlaceIds } : {}),
    ...(cleaned.fillWithAi !== undefined ? { fillWithAi: cleaned.fillWithAi } : {}),
    ...(cleaned.startDate !== undefined ? { startDate: cleaned.startDate } : {}),
  };
}

async function wakeTripServers(): Promise<void> {
  try {
    // Cheap ping so a cold Render instance is already waking before ai-generate.
    await apiClient.get(API_CONFIG.endpoints.health);
  } catch {
    // Ignore — generation will still proceed (and retry on failure).
  }
}

export default function GenerateLoadingScreen({ route: propRoute }: { navigation?: any; route?: any }) {
  const navigation = useNavigation<any>();
  const hookRoute = useRoute<any>();
  const { isGuest } = useUserContext();
  const { width: W, height: H } = useWindowDimensions();
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const cancelledRef = useRef(false);
  const phaseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptRef = useRef(0);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const params = propRoute?.params || hookRoute?.params || {};

  const startPhaseAnimation = useCallback(() => {
    setPhaseIndex(0);
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      // Match typical cold-start + generate window so the bar doesn't "finish" early.
      duration: 90_000,
      useNativeDriver: false,
    }).start();

    if (phaseIntervalRef.current) clearInterval(phaseIntervalRef.current);
    phaseIntervalRef.current = setInterval(() => {
      setPhaseIndex(prev => {
        if (prev >= PHASES.length - 1) {
          if (phaseIntervalRef.current) clearInterval(phaseIntervalRef.current);
          return prev;
        }
        return prev + 1;
      });
    }, 12_000);
  }, [progressAnim]);

  const runGeneration = useCallback(async () => {
    setScreenState('loading');
    setErrorMessage('');
    startPhaseAnimation();
    attemptRef.current = 0;

    await apiClient.init();
    if (isGuest || !apiClient.getToken()) {
      setScreenState('unauthenticated');
      return;
    }

    const destination: string = params.destination || params.location;
    if (!destination) {
      setScreenState('error');
      setErrorMessage('No destination was provided. Please go back and choose a city.');
      return;
    }

    const input = cleanAiInput({
      destination,
      days: Number(params.days) || 3,
      pace: params.pace,
      travelers: params.travelers,
      budget: params.budget,
      customBudgetAmount: params.customBudgetAmount,
      interests: params.interests || [],
      timePreference: params.timePreference,
      avoid: params.avoid || [],
      prompt: params.prompt,
      tripId: params.tripId,
      manualPlaceIds: Array.isArray(params.manualPlaceIds) ? params.manualPlaceIds : undefined,
      fillWithAi: params.fillWithAi === true ? true : undefined,
    });

    let lastError: any;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (cancelledRef.current) return;
      attemptRef.current = attempt;

      try {
        if (attempt === 1 || attempt > 1) {
          await wakeTripServers();
        }
        if (attempt > 1) {
          await delay(RETRY_DELAY_MS * (attempt - 1));
        }

        const result = await tripsApi.aiGenerate(input);
        if (cancelledRef.current) return;
        setScreenState('success');
        navigation.replace('TripDetail', {
          tripId: result.trip.id,
          warnings: result.warnings,
          note: result.note,
        });
        return;
      } catch (err: any) {
        lastError = err;
        console.warn(`[GenerateLoadingScreen] aiGenerate attempt ${attempt}/${MAX_ATTEMPTS} failed:`, err?.status, err?.message);
        if (isAuthError(err)) {
          if (cancelledRef.current) return;
          setScreenState('unauthenticated');
          return;
        }
        if (!isRetryableError(err) || attempt === MAX_ATTEMPTS) {
          break;
        }
      }
    }

    if (cancelledRef.current) return;
    setScreenState('error');
    setErrorMessage(friendlyErrorMessage(lastError));
  }, [params, isGuest, navigation, startPhaseAnimation]);

  useEffect(() => {
    cancelledRef.current = false;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();

    runGeneration();

    return () => {
      cancelledRef.current = true;
      if (phaseIntervalRef.current) clearInterval(phaseIntervalRef.current);
    };
  }, []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const handleRetry = () => {
    cancelledRef.current = false;
    runGeneration();
  };

  const handleSignIn = () => {
    navigation.goBack();
  };

  return (
    <ImageBackground source={require('../assets/map_preview_bg.jpg')} style={[styles.container, { width: W, height: H }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['rgba(10,37,64,0.85)', 'rgba(10,37,64,0.98)']} style={StyleSheet.absoluteFillObject} />

      <View style={styles.content}>
        {screenState === 'loading' && (
          <>
            <Animated.View style={[styles.robotCircle, { transform: [{ scale: pulseAnim }] }]}>
              <Icon name="logo-android" size={64} color="#FFF" />
              <View style={styles.sparkle1}><Icon name="sparkles" size={24} color="#F59E0B" /></View>
              <View style={styles.sparkle2}><Icon name="sparkles" size={16} color="#00E676" /></View>
            </Animated.View>

            <Text style={styles.title}>Building Your Trip</Text>
            <Text style={styles.phaseText}>{PHASES[phaseIndex]}</Text>

            <View style={styles.progressContainer}>
              <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
            </View>

            <View style={styles.routeDecor}>
              <Icon name="location" size={24} color={Pal.colors.light.primary} />
              <View style={styles.dashLine} />
              <Icon name="navigate" size={24} color="#00E676" />
            </View>
          </>
        )}

        {screenState === 'unauthenticated' && (
          <>
            <View style={[styles.robotCircle, { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.5)' }]}>
              <Icon name="lock-closed" size={56} color="#F59E0B" />
            </View>
            <Text style={styles.title}>Sign In Required</Text>
            <Text style={styles.errorText}>
              Sign in to generate and save your itinerary. Your trip will sync across devices once you're logged in.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSignIn} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Go Back to Sign In</Text>
            </TouchableOpacity>
          </>
        )}

        {screenState === 'error' && (
          <>
            <View style={[styles.robotCircle, { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.5)' }]}>
              <Icon name="alert-circle" size={56} color="#EF4444" />
            </View>
            <Text style={styles.title}>Couldn't Build Your Trip</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleRetry} activeOpacity={0.85}>
              <Icon name="refresh" size={18} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
              <Text style={styles.secondaryBtnText}>Go Back</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center', width: '100%', paddingHorizontal: 40 },

  robotCircle: { width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(47,128,237,0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(47,128,237,0.5)', marginBottom: 40 },
  sparkle1: { position: 'absolute', top: 10, right: 10 },
  sparkle2: { position: 'absolute', bottom: 20, left: 10 },

  title: { fontSize: 24, fontFamily: 'Inter-Black', color: '#FFF', marginBottom: 12, textAlign: 'center' },
  phaseText: { fontSize: 16, fontFamily: 'Inter-Medium', color: '#94A3B8', marginBottom: 40 },
  errorText: { fontSize: 15, fontFamily: 'Inter-Regular', color: '#94A3B8', textAlign: 'center', marginBottom: 28, lineHeight: 22 },

  progressContainer: { width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 40 },
  progressFill: { height: '100%', backgroundColor: '#00E676', borderRadius: 3 },

  routeDecor: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dashLine: { width: 80, height: 2, backgroundColor: 'rgba(255,255,255,0.2)', borderStyle: 'dashed' },

  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#C4A484', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 28, minWidth: 200, marginBottom: 12 },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Inter-Bold' },
  secondaryBtn: { paddingVertical: 10 },
  secondaryBtnText: { color: '#94A3B8', fontSize: 15, fontFamily: 'Inter-Medium' },
});
