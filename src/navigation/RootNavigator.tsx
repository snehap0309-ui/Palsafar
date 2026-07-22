import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { linking } from './linking';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import { useUserContext } from '../context/UserContext';
import { useDataContext } from '../context/DataContext';
import { RootStackParamList } from './types';
import type { RouteProp } from '@react-navigation/native';
import AuthNavigator from './AuthNavigator';
import MainTabs from './MainTabs';
import VendorTabs from './VendorTabs';
import CreatorTabs from './CreatorTabs';
import { getPlaces } from '../services/placesService';
import { isOnboardingCompleted, setOnboardingCompleted, resetOnboardingCompleted } from '../services/localStorageService';
import { DEV_FLAGS } from '../config/devFlags';
import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';

import { useLazyScreen } from '../utils/useLazyScreen';
import OfflineBanner from '../components/OfflineBanner';
import { navigationRef } from './navigationRef';
import {
  navigationIntegration,
  trackScreen,
  isMonitoringEnabled,
} from '../services/monitoring';
import { MONITORING_CONFIG } from '../config/monitoringConfig';
import type { NavigationState, PartialState } from '@react-navigation/native';

function getActiveRouteName(
  state: NavigationState | PartialState<NavigationState> | undefined,
): string | undefined {
  if (!state || !state.routes?.length) return undefined;
  const index = state.index ?? state.routes.length - 1;
  const route = state.routes[index];
  if (route.state) return getActiveRouteName(route.state as NavigationState);
  return route.name;
}

function MonitoredNavigation({ children, linkingConfig }: { children: React.ReactNode; linkingConfig?: typeof linking }) {
  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linkingConfig}
      onReady={() => {
        if (isMonitoringEnabled()) {
          navigationIntegration.registerNavigationContainer(navigationRef);
        }
        const name = getActiveRouteName(navigationRef.getRootState());
        if (name) trackScreen(name);
        const { flushPendingNotificationRoute } = require('../services/notifications/notificationNavigation');
        flushPendingNotificationRoute();
      }}
      onStateChange={(state) => {
        const name = getActiveRouteName(state);
        if (name) trackScreen(name);
      }}
    >
      {children}
    </NavigationContainer>
  );
}

const Stack = createNativeStackNavigator<RootStackParamList>();

function TripBuilderWrapper({ navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/TripBuilderScreen'));
  return <Screen navigation={navigation} />;
}

function VendorRegisterWrapper({ navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/VendorRegisterScreen'));
  return (
    <Screen
      onBack={() => navigation.goBack()}
    />
  );
}

function AITripPlannerWrapper({ navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/AITripPlannerScreen'));
  return <Screen onNavigate={(s: string, params?: any) => navigation.navigate(s, params)} />;
}

function SelectPlacesForTripWrapper() {
  const Screen = useLazyScreen(() => require('../screens/SelectPlacesForTripScreen'));
  return <Screen />;
}

function GenerateLoadingWrapper({ navigation, route }: any) {
  const Screen = useLazyScreen(() => require('../screens/GenerateLoadingScreen'));
  return <Screen navigation={navigation} route={route} />;
}

function ItineraryScreenWrapper({ navigation, route }: any) {
  const Screen = useLazyScreen(() => require('../screens/ItineraryScreen'));
  return (
    <Screen
      addedPlaceId={route.params?.addedPlaceId}
      onBack={() => navigation.goBack()}
      onNavigateToMap={() => navigation.navigate('MainTabs', { screen: 'Map' })}
    />
  );
}

function MyTripsWrapper({ navigation, route }: any) {
  const Screen = useLazyScreen(() => require('../screens/MyTripsScreen'));
  return (
    <Screen
      initialTab={route.params?.initialTab}
      onNavigate={(screen: string, params?: any) => {
        if (screen === 'goBack') {
          navigation.goBack();
        } else {
          navigation.navigate(screen, params);
        }
      }}
    />
  );
}

function CreateTripWrapper({ navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/CreateTripScreen'));
  return (
    <Screen
      onNavigate={(screen: string, params?: any) => {
        if (screen === 'goBack') {
          navigation.goBack();
        } else {
          navigation.navigate(screen, params);
        }
      }}
    />
  );
}

function TripDetailWrapper({ navigation, route }: any) {
  const tripId = route.params?.tripId;
  const warnings = route.params?.warnings;
  const note = route.params?.note;
  const Screen = useLazyScreen(() => require('../screens/TripDetailScreen'));
  return (
    <Screen
      tripId={tripId}
      warnings={warnings}
      note={note}
      onNavigate={(screen: string, params?: any) => {
        if (screen === 'goBack') {
          navigation.goBack();
        } else {
          navigation.navigate(screen, params);
        }
      }}
    />
  );
}

function VendorOffersWrapper({ navigation: _navigation }: any) {
  const { user } = useUserContext();
  const { vendors, vendorOffers, handleRedeemOffer } = useDataContext();
  const Screen = useLazyScreen(() => require('../screens/VendorOffersScreen'));
  return <Screen user={user} vendors={vendors} vendorOffers={vendorOffers} onRedeemOffer={handleRedeemOffer} />;
}


function VendorDashboardWrapper({ navigation }: any) {
  const { user, onLogout } = useUserContext();
  const { currentVendor, logoutVendor } = useDataContext();
  const Screen = useLazyScreen(() => require('../screens/VendorDashboardScreen'));
  const vendorId = (user as any)?.vendor?.id || currentVendor?.id || '';
  const handleLogout = useCallback(async () => {
    logoutVendor();
    await onLogout();
  }, [logoutVendor, onLogout]);

  return (
    <Screen
      onBack={() => navigation.navigate('VendorTabs', { screen: 'Home' })}
      canGoBack
      onLogout={handleLogout}
      onCreateOffer={() => navigation.navigate('CreateOffer', {})}
      onEditOffer={(offerId: string) => navigation.navigate('CreateOffer', { offerId })}
      onCreateReel={() => navigation.navigate('CreateReel')}
      onViewMyOffers={() => navigation.navigate('VendorTabs', { screen: 'Offers' })}
      onViewAnalytics={() => navigation.navigate('VendorTabs', { screen: 'Analytics' })}
      onViewProfile={() =>
        navigation.navigate('VendorProfile', {
          vendorId: vendorId || currentVendor?.id || 'me',
          self: true,
        })
      }
    />
  );
}

function CreateOfferWrapper({ route, navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/CreateOfferScreen'));
  return <Screen onBack={() => navigation.goBack()} offerId={route.params?.offerId} />;
}

function VendorRedemptionWrapper({ navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/VendorRedemptionScreen'));
  return <Screen onBack={() => navigation.goBack()} />;
}

function VendorCustomersWrapper({ navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/VendorCustomersScreen'));
  return <Screen onBack={() => navigation.goBack()} />;
}

function PremiumUpgradeWrapper({ navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/PremiumUpgradeScreen'));
  return <Screen onBack={() => navigation.goBack()} />;
}

function BillingHistoryWrapper({ navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/BillingHistoryScreen'));
  return <Screen onBack={() => navigation.goBack()} />;
}

function VendorSubscriptionWrapper({ navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/VendorSubscriptionScreen'));
  return <Screen onBack={() => navigation.goBack()} />;
}

function RazorpayCheckoutWrapper({ route, navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/RazorpayCheckoutScreen'));
  const p = route.params || {};
  return (
    <Screen
      onBack={() => navigation.goBack()}
      planId={p.planId}
      period={p.period}
      planName={p.planName}
      amountPaise={p.amountPaise}
      orderId={p.orderId}
      keyId={p.keyId}
      currency={p.currency}
      prefillEmail={p.prefillEmail}
      prefillName={p.prefillName}
    />
  );
}

function AdminVerificationWrapper({ navigation }: any) {
  const { onLogout } = useUserContext();
  const Screen = useLazyScreen(() => require('../screens/AdminVendorVerificationScreen'));
  return (
    <Screen
      onBack={() => navigation.goBack()}
      onLogout={onLogout}
      onNavigateHiddenGems={() => navigation.navigate('AdminHiddenGemReview')}
      onNavigatePlaces={() => navigation.navigate('AdminPlacesReview')}
    />
  );
}

function AdminGemReviewWrapper({ navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/AdminHiddenGemReviewScreen'));
  return <Screen onBack={() => navigation.goBack()} />;
}

function AdminPlacesReviewWrapper({ navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/AdminPlacesReviewScreen'));
  return <Screen onBack={() => navigation.goBack()} />;
}

function AddHiddenGemWrapper({ navigation }: any) {
  const { user } = useUserContext();
  const { submitHiddenGem } = useDataContext();
  const Screen = useLazyScreen(() => require('../screens/AddHiddenGemScreen'));
  return <Screen onBack={() => navigation.goBack()} onSubmit={submitHiddenGem} userId={user?.uid} userName={user?.displayName} />;
}

function MyContributionsWrapper({ navigation }: any) {
  const { user } = useUserContext();
  const { hiddenGemSubmissions } = useDataContext();
  const Screen = useLazyScreen(() => require('../screens/MyContributionsScreen'));
  return <Screen onBack={() => navigation.goBack()} userId={user?.uid} submissions={hiddenGemSubmissions} onAddNew={() => navigation.navigate('AddHiddenGem')} />;
}

function RewardsWalletWrapper({ navigation }: any) {
  const { user } = useUserContext();
  const Screen = useLazyScreen(() => require('../screens/RewardsWalletScreen'));
  return <Screen user={user} onBack={() => navigation.goBack()} />;
}

function MemoriesWrapper({ navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/MemoriesScreen'));
  return <Screen onBack={() => navigation.goBack()} />;
}

function TreasureHuntWrapper({ navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/TreasureHuntScreen'));
  return <Screen onBack={() => navigation.goBack()} />;
}

function QuestWrapper({ navigation, route }: any) {
  const Screen = useLazyScreen(() => require('../screens/QuestScreen'));
  return (
    <Screen
      onBack={() => navigation.goBack()}
      initialQuestId={route.params?.questId}
      initialTab={route.params?.tab || 'explore'}
    />
  );
}

function WalletWrapper({ navigation }: any) {
  const { user } = useUserContext();
  const Screen = useLazyScreen(() => require('../screens/WalletScreen'));
  if (!user) return null;
  return (
    <Screen
      user={user}
      onBack={() => navigation.goBack()}
      onNavigateToRewards={() => navigation.navigate('Rewards')}
      onNavigateToScanner={() => navigation.navigate('PayPoints')}
    />
  );
}

function RewardsWrapper({ navigation }: any) {
  const { user } = useUserContext();
  const { handleRedeemOffer } = useDataContext();
  const Screen = useLazyScreen(() => require('../screens/RewardsScreen'));
  if (!user) return null;
  return (
    <Screen
      user={user}
      onBack={() => navigation.goBack()}
      onSelectOffer={(offerId: string) => navigation.navigate('VendorOffers')}
      onRedeemOffer={handleRedeemOffer}
    />
  );
}

function LeaderboardWrapper({ navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/LeaderboardScreen'));
  return (
    <Screen />
  );
}

function PayPointsWrapper({ route, navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/PayPointsScreen'));
  return (
    <Screen
      onBack={() => navigation.goBack()}
      initialVendorCode={route.params?.vendorCode}
    />
  );
}

function VendorAnalyticsWrapper({ route, navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/VendorAnalyticsScreen'));
  return (
    <Screen
      onBack={() => navigation.goBack()}
      vendorId={route.params.vendorId}
      vendorName={route.params.vendorName}
    />
  );
}

function CreateReelWrapper({ navigation }: any) {
  const { handleCreateReel, reelsUploadProgress } = useDataContext();
  const Screen = useLazyScreen(() => require('../screens/CreateReelScreen'));
  return <Screen onBack={() => navigation.goBack()} onSaveReel={handleCreateReel} uploadProgress={reelsUploadProgress} />;
}

function SpotDetailScreen({ route, navigation }: { route: RouteProp<RootStackParamList, 'SpotDetail'>; navigation: any }) {
  const spotId = route.params?.spotId;
  const [spot, setSpot] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const { theme } = useTheme();
  const { user } = useUserContext();

  const SpotDetailComponent = useLazyScreen(() => require('../screens/SpotDetailScreen'));

  React.useEffect(() => {
    if (!spotId) { setLoading(false); return; }
    (async () => {
      try {
        const { placesApi } = require('../services/api');
        const res = await placesApi.getById(spotId);
        setSpot(res);
      } catch {
        setSpot(null);
      }
      setLoading(false);
    })();
  }, [spotId]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <Text style={{ fontSize: 16, color: theme.textSecondary }}>Loading...</Text>
      </View>
    );
  }

  if (!spot) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <Text style={{ fontSize: 16, color: '#666' }}>Spot not found</Text>
      </View>
    );
  }

  return <SpotDetailComponent spot={spot} user={user} onBack={() => navigation.goBack()} />;
}

function ReelDetailWrapper({ route, navigation }: { route: RouteProp<RootStackParamList, 'ReelDetail'>; navigation: any }) {
  const { user } = useUserContext();
  const { reels, handleLikeReel, handleAddReelComment } = useDataContext();
  const ReelDetailScreen = useLazyScreen(() => require('../screens/ReelDetailScreen'));
  const [reel, setReel] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const found = reels.find((r: any) => r.id === route.params.reelId);
    if (found) {
      setReel(found);
      setLoading(false);
    } else {
      const { getReelById } = require('../services/reelService');
      getReelById(route.params.reelId)
        .then((data: any) => {
          setReel(data);
          setLoading(false);
        })
        .catch(() => {
          setReel(null);
          setLoading(false);
        });
    }
  }, [route.params.reelId, reels]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!reel) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Reel not found</Text>
    </View>
  );

  return (
    <ReelDetailScreen
      reel={reel}
      reels={route.params.reels || (reels.length > 0 ? reels : [reel])}
      initialIndex={route.params.initialIndex || 0}
      onBack={() => navigation.goBack()}
      onLike={(reelId: string) => handleLikeReel(reelId)}
      onAddComment={(text: string) => handleAddReelComment(reel.id, text)}
      isLiked={(user.likedReels || []).includes(reel.id)}
    />
  );
}

function VendorReelsWrapper({ route, navigation }: { route: RouteProp<RootStackParamList, 'VendorReels'>; navigation: any }) {
  const Screen = useLazyScreen(() => require('../screens/VendorReelsScreen'));
  return (
    <Screen
      vendorId={route.params.vendorId}
      vendorName={route.params.vendorName}
      onBack={() => navigation.goBack()}
    />
  );
}

function VendorProfileWrapper({ route, navigation }: { route: RouteProp<RootStackParamList, 'VendorProfile'>; navigation: any }) {
  const Screen = useLazyScreen(() => require('../screens/VendorProfileScreen'));
  return (
    <Screen
      vendorId={route.params.vendorId}
      self={!!route.params.self}
      initialTab={route.params.initialTab || 'offers'}
      onNavigate={(screen: string, params?: any) => {
        if (screen === 'goBack') navigation.goBack();
        else navigation.navigate(screen as any, params);
      }}
    />
  );
}

function CreatorProfileWrapper({ route, navigation }: { route: RouteProp<RootStackParamList, 'CreatorProfile'>; navigation: any }) {
  const Screen = useLazyScreen(() => require('../screens/CreatorProfileScreen'));
  return (
    <Screen
      username={route.params.username}
      onBack={() => navigation.goBack()}
    />
  );
}

function CreatorAnalyticsWrapper({ navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/CreatorAnalyticsScreen'));
  return (
    <Screen
      onBack={() => navigation.goBack()}
    />
  );
}

function CreditsWrapper({ navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/CreditsScreen'));
  return <Screen onBack={() => navigation.goBack()} />;
}

function SettingsWrapper({ navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/SettingsScreen'));
  // Logout is owned by UserContext — never reset to a non-existent "Auth" stack route.
  return <Screen navigation={navigation} />;
}

function CrashTestWrapper({ navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/CrashTestScreen'));
  return <Screen navigation={navigation} />;
}

function DevNotificationTestWrapper({ navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/DevNotificationTestScreen'));
  return <Screen navigation={navigation} />;
}

function VendorSettingsWrapper() {
  const Screen = useLazyScreen(() => require('../screens/VendorSettingsScreen'));
  return <Screen />;
}

function ChangePasswordWrapper({ navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/ChangePasswordScreen'));
  return <Screen navigation={navigation} />;
}

function DeleteAccountWrapper({ navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/DeleteAccountScreen'));
  return <Screen navigation={navigation} />;
}

function NotificationsWrapper({ navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/NotificationsScreen'));
  return <Screen onBack={() => navigation.goBack()} />;
}

function LegalHubWrapper({ navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/LegalHubScreen'));
  return (
    <Screen
      onBack={() => navigation.goBack()}
      onSelect={(type: string, label: string) => navigation.navigate('LegalDocument', { type, title: label })}
    />
  );
}

function LegalDocumentWrapper({ navigation, route }: any) {
  const Screen = useLazyScreen(() => require('../screens/LegalDocumentScreen'));
  return (
    <Screen
      type={route.params?.type}
      fallbackTitle={route.params?.title}
      onBack={() => navigation.goBack()}
    />
  );
}

function SearchWrapper({ navigation, route }: any) {
  const Screen = useLazyScreen(() => require('../screens/SearchScreen'));
  return (
    <Screen
      onBack={() => navigation.goBack()}
      initialQuery={route.params?.initialQuery}
      onSelectSpot={(spotId: string) =>
        navigation.navigate('MainTabs', {
          screen: 'Map',
          params: { selectedPlaceId: spotId, selectedPlaceKey: Date.now() },
        })
      }
    />
  );
}

function UserProfileWrapper({ navigation, route }: any) {
  const { user, isGuest, onLogout, handleResetProgress, setActiveMode } = useUserContext();
  const { vendors, vendorOffers, hiddenGemSubmissions } = useDataContext();
  const [places, setPlaces] = useState<any[]>([]);
  const openEdit = !!route?.params?.openEdit;

  useEffect(() => {
    getPlaces().then(setPlaces).catch(err => console.warn(err));
  }, []);

  const ProfileScreenComponent = useLazyScreen(() => require('../screens/ProfileScreen'));

  const handleSelectSpot = useCallback((spot: { id: string }) => {
    navigation.navigate('SpotDetail', { spotId: spot.id });
  }, [navigation]);

  return (
    <ProfileScreenComponent
      user={user}
      places={places}
      vendors={vendors}
      vendorOffers={vendorOffers}
      isGuest={isGuest}
      openEdit={openEdit}
      hiddenGemSubmissions={hiddenGemSubmissions}
      onSelectSpot={handleSelectSpot}
      onSubmitHiddenGem={() => navigation.navigate('AddHiddenGem')}
      onNavigateToHome={() => navigation.navigate('MainTabs', { screen: 'Home' })}
      onNavigateToMap={() => navigation.navigate('MainTabs', { screen: 'Map' })}
      onNavigateToReels={() => navigation.navigate('MainTabs', { screen: 'Explore' })}
      onNavigateToItinerary={() => navigation.navigate('MainTabs', { screen: 'Itinerary' })}
      onNavigateToLeaderboard={() => navigation.navigate('Leaderboard')}
      onResetProgress={handleResetProgress}
      onLogout={onLogout}
      onAdminVerification={() => navigation.navigate('AdminVendorVerification')}
      onAdminHiddenGemReview={() => navigation.navigate('AdminHiddenGemReview')}
      onAdminPlacesReview={() => navigation.navigate('AdminPlacesReview')}
      onOpenCredits={() => navigation.navigate('Credits')}
      onNavigateToWallet={() => navigation.navigate('Wallet')}
      onNavigateToRewards={() => navigation.navigate('Rewards')}
      onRewardsWallet={() => navigation.navigate('RewardsWallet')}
      onMyContributions={() => navigation.navigate('MyContributions')}
      onNavigateToCreateReel={() => navigation.navigate('CreateReel')}
      onRegisterVendor={() => navigation.navigate('VendorRegister')}
      onSwitchRole={setActiveMode}
      onSettingsPress={() => navigation.navigate('Settings')}
      onPremiumPress={() => navigation.navigate('PremiumUpgrade')}
      onBack={() => navigation.goBack()}
    />
  );
}

/** Which app shell to mount — driven only by activeMode, not permission/capability. */
function resolveShellMode(user: { activeMode?: string; activeRole?: string } | null | undefined) {
  const raw = String(user?.activeMode || user?.activeRole || 'USER').toUpperCase();
  if (raw === 'CREATOR' || raw === 'CONTENT_CREATOR') return 'CONTENT_CREATOR';
  if (raw === 'VENDOR') return 'VENDOR';
  if (raw === 'ADMIN') return 'ADMIN';
  return 'USER';
}

/**
 * Shared modal / detail screens — must be a Group *element*, not a custom component.
 * React Navigation only registers Screen/Group as direct navigator children.
 */
const sharedStackScreens = (
  <Stack.Group>
    <Stack.Screen name="TripBuilder" component={TripBuilderWrapper} />
    <Stack.Screen name="AITripPlanner" component={AITripPlannerWrapper} />
    <Stack.Screen name="SelectPlacesForTrip" component={SelectPlacesForTripWrapper} />
    <Stack.Screen name="ItineraryScreen" component={ItineraryScreenWrapper} />
    <Stack.Screen name="GenerateLoading" component={GenerateLoadingWrapper} />
    <Stack.Screen name="MyTrips" component={MyTripsWrapper} />
    <Stack.Screen name="CreateTrip" component={CreateTripWrapper} />
    <Stack.Screen name="TripDetail" component={TripDetailWrapper} />
    <Stack.Screen name="VendorRegister" component={VendorRegisterWrapper} />
    <Stack.Screen name="SpotDetail" component={SpotDetailScreen} />
    <Stack.Screen name="VendorOffers" component={VendorOffersWrapper} />
    <Stack.Screen name="VendorDashboard" component={VendorDashboardWrapper} />
    <Stack.Screen name="CreateOffer" component={CreateOfferWrapper} />
    <Stack.Screen name="VendorRedemption" component={VendorRedemptionWrapper} />
    <Stack.Screen name="VendorCustomers" component={VendorCustomersWrapper} />
    <Stack.Screen name="PremiumUpgrade" component={PremiumUpgradeWrapper} />
    <Stack.Screen name="BillingHistory" component={BillingHistoryWrapper} />
    <Stack.Screen name="VendorSubscription" component={VendorSubscriptionWrapper} />
    <Stack.Screen name="RazorpayCheckout" component={RazorpayCheckoutWrapper} />
    <Stack.Screen name="AdminVendorVerification" component={AdminVerificationWrapper} />
    <Stack.Screen name="AdminHiddenGemReview" component={AdminGemReviewWrapper} />
    <Stack.Screen name="AdminPlacesReview" component={AdminPlacesReviewWrapper} />
    <Stack.Screen name="AddHiddenGem" component={AddHiddenGemWrapper} />
    <Stack.Screen name="MyContributions" component={MyContributionsWrapper} />
    <Stack.Screen name="RewardsWallet" component={RewardsWalletWrapper} />
    <Stack.Screen name="Wallet" component={WalletWrapper} />
    <Stack.Screen name="Rewards" component={RewardsWrapper} />
    <Stack.Screen name="Leaderboard" component={LeaderboardWrapper} />
    <Stack.Screen name="PayPoints" component={PayPointsWrapper} />
    <Stack.Screen name="VendorProfile" component={VendorProfileWrapper} />
    <Stack.Screen name="VendorSettings" component={VendorSettingsWrapper} />
    <Stack.Screen name="VendorAnalytics" component={VendorAnalyticsWrapper} />
    <Stack.Screen name="Memories" component={MemoriesWrapper} />
    <Stack.Screen name="TreasureHunt" component={TreasureHuntWrapper} />
    <Stack.Screen name="Quest" component={QuestWrapper} />
    <Stack.Screen name="CreateReel" component={CreateReelWrapper} />
    <Stack.Screen name="ReelDetail" component={ReelDetailWrapper} />
    <Stack.Screen name="VendorReels" component={VendorReelsWrapper} />
    <Stack.Screen name="CreatorProfile" component={CreatorProfileWrapper} />
    <Stack.Screen name="CreatorAnalytics" component={CreatorAnalyticsWrapper} />
    <Stack.Screen name="Credits" component={CreditsWrapper} />
    <Stack.Screen name="Settings" component={SettingsWrapper} />
    {MONITORING_CONFIG.enableCrashTests ? (
      <Stack.Screen name="CrashTest" component={CrashTestWrapper} options={{ headerShown: false }} />
    ) : null}
    {MONITORING_CONFIG.enableNotificationTests ? (
      <Stack.Screen name="DevNotificationTest" component={DevNotificationTestWrapper} options={{ headerShown: false }} />
    ) : null}
    <Stack.Screen name="ChangePassword" component={ChangePasswordWrapper} />
    <Stack.Screen name="DeleteAccount" component={DeleteAccountWrapper} />
    <Stack.Screen name="Notifications" component={NotificationsWrapper} />
    <Stack.Screen name="LegalHub" component={LegalHubWrapper} />
    <Stack.Screen name="LegalDocument" component={LegalDocumentWrapper} />
    <Stack.Screen name="Search" component={SearchWrapper} />
    <Stack.Screen name="UserProfile" component={UserProfileWrapper} />
  </Stack.Group>
);

/**
 * Completely separate app shells by workspace.
 * User = MainTabs (locked). Creator = CreatorTabs. Vendor = VendorTabs.
 * mode is passed from RootNavigator so the NavigationContainer key and stack always match.
 */
function AuthenticatedStack({ mode }: { mode: string }) {
  const { user } = useUserContext();
  const { currentVendor } = useDataContext();
  const [vendorWaitTimedOut, setVendorWaitTimedOut] = React.useState(false);
  const hasVendorRole = user?.roles?.includes('VENDOR') || user?.permission === 'VENDOR';
  // Auth profile may already carry a vendor stub — enough to mount VendorTabs
  const hasVendorIdentity = !!(currentVendor?.id || (user as any)?.vendor?.id);

  React.useEffect(() => {
    if (mode !== 'VENDOR' || hasVendorIdentity) {
      setVendorWaitTimedOut(false);
      return;
    }
    const t = setTimeout(() => setVendorWaitTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, [mode, hasVendorIdentity]);

  // Brief load while DataContext hydrates getMe — never block forever (Creator has no gate)
  if (mode === 'VENDOR' && hasVendorRole && !hasVendorIdentity && !vendorWaitTimedOut) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF9F2' }}>
        <ActivityIndicator size="large" color="#B9834B" />
        <Text style={{ marginTop: 12, color: '#8B7355' }}>Loading vendor workspace...</Text>
      </View>
    );
  }

  if (mode === 'CONTENT_CREATOR') {
    return (
      <Stack.Navigator
        key="creator-shell"
        initialRouteName="CreatorTabs"
        screenOptions={{ headerShown: false, animation: 'fade' }}
      >
        <Stack.Screen name="CreatorTabs" component={CreatorTabs} />
        {sharedStackScreens}
      </Stack.Navigator>
    );
  }

  if (mode === 'VENDOR') {
    return (
      <Stack.Navigator
        key="vendor-shell"
        initialRouteName="VendorTabs"
        screenOptions={{ headerShown: false, animation: 'fade' }}
      >
        <Stack.Screen name="VendorTabs" component={VendorTabs} />
        {sharedStackScreens}
      </Stack.Navigator>
    );
  }

  if (mode === 'ADMIN') {
    return (
      <Stack.Navigator
        key="admin-shell"
        initialRouteName="AdminVendorVerification"
        screenOptions={{ headerShown: false, animation: 'fade' }}
      >
        <Stack.Screen name="AdminVendorVerification" component={AdminVerificationWrapper} />
        {sharedStackScreens}
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator
      key="user-shell"
      initialRouteName="MainTabs"
      screenOptions={{ headerShown: false, animation: 'fade' }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      {sharedStackScreens}
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  const { theme } = useTheme();
  const { user, isAuthenticated, isStorageLoaded, isInitializing, isLoggingOut } = useUserContext();
  const { isStorageLoaded: dataLoaded } = useDataContext();
  const [splashDone, setSplashDone] = useState(false);
  /** null = still reading AsyncStorage — must NOT treat as "show onboarding" */
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const shellMode = resolveShellMode(user);

  // Load onboarding flag as early as possible (do not wait for splash)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (__DEV__ && DEV_FLAGS.FORCE_SHOW_ONBOARDING) {
          await resetOnboardingCompleted();
          if (!cancelled) setOnboardingDone(false);
          return;
        }
        const done = await isOnboardingCompleted();
        if (!cancelled) setOnboardingDone(done);
      } catch {
        if (!cancelled) setOnboardingDone(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Boot splash runs once per cold start. Logout / auth expiry must NOT replay it.
  const bootReady =
    isStorageLoaded &&
    dataLoaded &&
    !isInitializing &&
    onboardingDone !== null;

  if (!splashDone) {
    return <SplashScreen onFinish={() => setSplashDone(true)} />;
  }

  if (!bootReady) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.background }]}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.background} />
        <ActivityIndicator size="large" color="#B9834B" />
      </View>
    );
  }

  if (isLoggingOut) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.background }]}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.background} />
        <ActivityIndicator size="large" color="#B9834B" />
      </View>
    );
  }

  if (isAuthenticated) {
    return (
      <MonitoredNavigation linkingConfig={linking}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.background} />
        <View style={{ flex: 1 }}>
          <OfflineBanner />
          <AuthenticatedStack mode={shellMode} />
        </View>
      </MonitoredNavigation>
    );
  }

  // Only show onboarding when we KNOW it is incomplete
  if (onboardingDone === false) {
    return (
      <OnboardingScreen
        onDone={async () => {
          await setOnboardingCompleted();
          setOnboardingDone(true);
        }}
      />
    );
  }

  return (
    <MonitoredNavigation linkingConfig={linking}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.background} />
      <AuthNavigator initialRoute="Login" />
    </MonitoredNavigation>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
});
