import React, { useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { VendorTabParamList, RootStackParamList } from './types';
import { useUserContext } from '../context/UserContext';
import { useDataContext } from '../context/DataContext';
import { useLazyScreen } from '../utils/useLazyScreen';
import {
  VENDOR_TAB_BAR_BOTTOM_GAP,
  VENDOR_TAB_BAR_HEIGHT,
  VendorUI,
} from '../design/vendorLayout';
import { MIN_TOUCH } from '../design/responsive';

const Tab = createBottomTabNavigator<VendorTabParamList>();
type RootNav = NativeStackNavigationProp<RootStackParamList>;
type VendorTabName = keyof VendorTabParamList;

const TAB_ICONS: Record<VendorTabName, { active: string; inactive: string; label: string }> = {
  Home: { active: 'home', inactive: 'home-outline', label: 'Home' },
  Points: { active: 'diamond', inactive: 'diamond-outline', label: 'Points' },
  Offers: { active: 'pricetag', inactive: 'pricetag-outline', label: 'Offers' },
  Analytics: { active: 'stats-chart', inactive: 'stats-chart-outline', label: 'Stats' },
  Profile: { active: 'storefront', inactive: 'storefront-outline', label: 'Profile' },
};

function useVendorIds() {
  const { user, onLogout } = useUserContext();
  const { currentVendor, logoutVendor } = useDataContext();
  const vendorId = (user as any)?.vendor?.id || currentVendor?.id || '';
  const vendorName = (user as any)?.vendor?.businessName || currentVendor?.businessName || 'My Business';
  const handleLogout = useCallback(async () => {
    logoutVendor();
    await onLogout();
  }, [logoutVendor, onLogout]);
  return { vendorId, vendorName, currentVendor, handleLogout, user };
}

function VendorHomeTab() {
  const navigation = useNavigation<RootNav>();
  const { vendorId, vendorName, currentVendor, handleLogout } = useVendorIds();
  const Screen = useLazyScreen(() => require('../screens/VendorDashboardScreen'));

  return (
    <Screen
      forcedTab="Home"
      hideBottomNav
      onBack={() => {}}
      canGoBack={false}
      onLogout={handleLogout}
      onCreateOffer={() => navigation.navigate('CreateOffer', {})}
      onEditOffer={(offerId: string) => navigation.navigate('CreateOffer', { offerId })}
      onCreateReel={() => navigation.navigate('CreateReel')}
      onViewMyOffers={() => navigation.navigate('VendorTabs', { screen: 'Offers' })}
      onViewAnalytics={() => navigation.navigate('VendorAnalytics', { vendorId, vendorName })}
      onViewProfile={() =>
        navigation.navigate('VendorProfile', {
          vendorId: vendorId || currentVendor?.id || 'me',
          self: true,
        })
      }
    />
  );
}

function VendorPointsTab() {
  const { vendorName } = useVendorIds();
  const Screen = useLazyScreen(() => require('../screens/VendorScannerScreen'));
  return <Screen vendorName={vendorName} />;
}

function VendorOffersTab() {
  const navigation = useNavigation<RootNav>();
  const { vendorId, vendorName, currentVendor, handleLogout } = useVendorIds();
  const Screen = useLazyScreen(() => require('../screens/VendorDashboardScreen'));

  return (
    <Screen
      forcedTab="Offers"
      hideBottomNav
      onBack={() => {}}
      canGoBack={false}
      onLogout={handleLogout}
      onCreateOffer={() => navigation.navigate('CreateOffer', {})}
      onEditOffer={(offerId: string) => navigation.navigate('CreateOffer', { offerId })}
      onCreateReel={() => navigation.navigate('CreateReel')}
      onViewMyOffers={() => {}}
      onViewAnalytics={() => navigation.navigate('VendorAnalytics', { vendorId, vendorName })}
      onViewProfile={() =>
        navigation.navigate('VendorProfile', {
          vendorId: vendorId || currentVendor?.id || 'me',
          self: true,
        })
      }
    />
  );
}

function VendorAnalyticsTab() {
  const navigation = useNavigation<RootNav>();
  const { vendorId, vendorName } = useVendorIds();
  const Screen = useLazyScreen(() => require('../screens/VendorAnalyticsScreen'));
  return (
    <Screen
      vendorId={vendorId}
      vendorName={vendorName}
      onBack={() => navigation.navigate('VendorTabs', { screen: 'Home' })}
    />
  );
}

function VendorProfileTab() {
  const Screen = useLazyScreen(() => require('../screens/VendorStudioProfileScreen'));
  return <Screen />;
}

function VendorTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.customTabBar,
        { bottom: Math.max(insets.bottom, VENDOR_TAB_BAR_BOTTOM_GAP) },
      ]}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const name = route.name as VendorTabName;
        const config = TAB_ICONS[name] || { active: 'ellipse', inactive: 'ellipse-outline', label: name };

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity key={route.key} style={styles.tabItem} onPress={onPress} activeOpacity={0.85}>
            <Icon
              name={isFocused ? config.active : config.inactive}
              size={21}
              color={isFocused ? '#A67C52' : '#8B7355'}
            />
            <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>{config.label}</Text>
            {isFocused ? <View style={styles.tabIndicator} /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function VendorTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <VendorTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={VendorHomeTab} />
      <Tab.Screen name="Points" component={VendorPointsTab} />
      <Tab.Screen name="Offers" component={VendorOffersTab} />
      <Tab.Screen name="Analytics" component={VendorAnalyticsTab} />
      <Tab.Screen name="Profile" component={VendorProfileTab} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  customTabBar: {
    position: 'absolute',
    left: 18,
    right: 18,
    height: VENDOR_TAB_BAR_HEIGHT,
    borderRadius: VendorUI.radius.tabBar,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderColor: '#E9D4BE',
    borderWidth: 1,
    shadowColor: '#63300E',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: MIN_TOUCH,
  },
  tabLabel: {
    fontSize: 10,
    color: '#8B7355',
    fontWeight: '700',
  },
  tabLabelActive: {
    color: '#A67C52',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 6,
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#A67C52',
  },
});
