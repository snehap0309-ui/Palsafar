import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Onboarding: undefined;
  LoginSplash: undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Explore: undefined;
  Map: {
    selectedPlaceId?: string;
    selectedPlaceKey?: number;
    /** Open Map on Places or Vendors layer (e.g. Home → Local Vendors) */
    initialMapTab?: 'places' | 'vendors';
    mapTabKey?: number;
  } | undefined;
  Itinerary: undefined;
  Profile: undefined;
};

/** Vendor app shell — same chrome pattern as MainTabs, different business features */
export type VendorTabParamList = {
  Home: undefined;
  Points: undefined;
  Offers: undefined;
  Analytics: undefined;
  Profile: undefined;
};

export type CreatorTabParamList = {
  Dashboard: undefined;
  Reels: { initialTab?: 'HIDDEN' | 'PENDING' | 'REJECTED' | 'APPROVED' } | undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  VendorTabs: NavigatorScreenParams<VendorTabParamList> | undefined;
  CreatorTabs: NavigatorScreenParams<CreatorTabParamList> | undefined;
  TripBuilder: undefined;
  AITripPlanner: undefined;
  SelectPlacesForTrip: {
    destination: string;
    days: number;
    pace?: string;
    travelers?: string;
    budget?: string;
    customBudgetAmount?: number;
    interests?: string[];
    timePreference?: string;
    avoid?: string[];
    prompt?: string;
    tripId?: string;
  };
  ItineraryScreen: { addedPlaceId?: string } | undefined;
  GenerateLoading: {
    destination: string;
    days: number;
    pace?: string;
    travelers?: string;
    budget?: string;
    customBudgetAmount?: number;
    interests?: string[];
    timePreference?: string;
    avoid?: string[];
    prompt?: string;
    tripId?: string;
    manualPlaceIds?: string[];
    fillWithAi?: boolean;
  } | undefined;
  MyTrips: { initialTab?: 'UPCOMING' | 'DRAFT' | 'COMPLETED' } | undefined;
  CreateTrip: undefined;
  TripDetail: { tripId: string; warnings?: string[]; note?: string };
  VendorRegister: undefined;
  UserProfile: { openEdit?: boolean } | undefined;
  SpotDetail: { spotId: string };
  VendorOffers: undefined;
  VendorDashboard: undefined;
  CreateOffer: { offerId?: string };
  VendorRedemption: undefined;
  VendorCustomers: undefined;
  PremiumUpgrade: undefined;
  BillingHistory: undefined;
  VendorSubscription: undefined;
  RazorpayCheckout: {
    planId: string;
    period: 'MONTHLY' | 'SEMIANNUAL' | 'YEARLY';
    planName?: string;
    amountPaise?: number;
    orderId: string;
    keyId: string;
    currency?: string;
    prefillEmail?: string;
    prefillName?: string;
  };
  AdminVendorVerification: undefined;
  AdminHiddenGemReview: undefined;
  AdminPlacesReview: undefined;
  AddHiddenGem: undefined;
  MyContributions: undefined;
  RewardsWallet: undefined;
  Memories: undefined;
  TreasureHunt: undefined;
  CreateReel: undefined;
  ReelDetail: { reelId: string; reels?: any[]; initialIndex?: number };
  VendorReels: { vendorId: string; vendorName: string };
  CreatorProfile: { username: string };
  CreatorAnalytics: undefined;
  Credits: undefined;
  Wallet: undefined;
  Rewards: undefined;
  Leaderboard: undefined;
  VendorAnalytics: { vendorId: string; vendorName: string };
  PayPoints: { vendorCode?: string };
  VendorProfile: { vendorId: string; self?: boolean; initialTab?: 'offers' | 'reels' | 'info' };
  VendorSettings: undefined;
  Settings: undefined;
  /** Dev-only crash reporting QA screen */
  CrashTest: undefined;
  DevNotificationTest: undefined;
  ChangePassword: undefined;
  DeleteAccount: undefined;
  Notifications: undefined;
  Search: { initialQuery?: string } | undefined;
  Quest: { questId?: string; tab?: 'explore' | 'active' | 'completed' } | undefined;
  LegalHub: undefined;
  LegalDocument: {
    type: 'PRIVACY_POLICY' | 'TERMS_CONDITIONS' | 'REWARDS_POLICY' | 'COMMUNITY_GUIDELINES' | 'VENDOR_TERMS' | 'CREATOR_TERMS' | 'REFUND_POLICY' | 'ABOUT_US' | 'CONTACT_INFO' | 'FAQ';
    title?: string;
  };
};

/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-empty-object-type */
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
