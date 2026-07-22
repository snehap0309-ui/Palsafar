import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  STUDIO_TAB_BAR_HEIGHT,
  STUDIO_TAB_BAR_BOTTOM_GAP,
} from '../design/tabBarLayout';
import { MIN_TOUCH } from '../design/responsive';
import { CreatorTabParamList } from './types';
import CreatorDashboardScreen from '../screens/CreatorDashboardScreen';
import CreatorReelsScreen from '../screens/CreatorReelsScreen';
import CreatorStudioProfileScreen from '../screens/CreatorStudioProfileScreen';

const Tab = createBottomTabNavigator<CreatorTabParamList>();

const ICONS: Record<keyof CreatorTabParamList, { icon: string; active: string; label: string }> = {
  Dashboard: { icon: 'grid-outline', active: 'grid', label: 'Studio' },
  Reels: { icon: 'play-circle-outline', active: 'play-circle', label: 'Reels' },
  Profile: { icon: 'settings-outline', active: 'settings', label: 'Settings' },
};
function CreatorTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.tabBar,
        {
          bottom: Math.max(insets.bottom, STUDIO_TAB_BAR_BOTTOM_GAP),
          height: STUDIO_TAB_BAR_HEIGHT,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const focused = index === state.index;
        const item = ICONS[route.name as keyof CreatorTabParamList];
        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tab}
            onPress={() => navigation.navigate(route.name)}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: focused }}
          >
            <Icon name={focused ? item.active : item.icon} color={focused ? '#A67C52' : '#8B7355'} size={21} />
            <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1}>
              {item.label}
            </Text>
            {focused ? <View style={styles.tabIndicator} /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function CreatorTabs() {
  return <Tab.Navigator tabBar={(props) => <CreatorTabBar {...props} />} screenOptions={{ headerShown: false }}>
    <Tab.Screen name="Dashboard" component={CreatorDashboardScreen} />
    <Tab.Screen name="Reels" component={CreatorReelsScreen} />
    <Tab.Screen name="Profile" component={CreatorStudioProfileScreen} />
  </Tab.Navigator>;
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 18,
    right: 18,
    borderRadius: 26,
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
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: MIN_TOUCH },
  tabLabel: { fontSize: 10, color: '#8B7355', fontWeight: '700' },
  tabLabelActive: { color: '#A67C52' },
  tabIndicator: {
    position: 'absolute',
    bottom: 6,
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#A67C52',
  },
});
