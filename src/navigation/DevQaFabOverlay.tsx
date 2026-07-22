import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import type { NavigationState, PartialState } from '@react-navigation/native';
import DevCrashTestEntry from '../components/DevCrashTestEntry';
import DevNotificationTestEntry from '../components/DevNotificationTestEntry';
import { navigationRef } from './navigationRef';

function getActiveRouteName(
  state: NavigationState | PartialState<NavigationState> | undefined,
): string | undefined {
  if (!state || !state.routes?.length) return undefined;
  const index = state.index ?? state.routes.length - 1;
  const route = state.routes[index];
  if (route.state) return getActiveRouteName(route.state as NavigationState);
  return route.name;
}

const QA_ROUTES = new Set(['CrashTest', 'DevNotificationTest']);

/**
 * Dev FAB overlay — child of NavigationContainer (not a screen).
 * Uses navigationRef listeners; do NOT use useNavigationState here.
 */
export default function DevQaFabOverlay() {
  const [routeName, setRouteName] = useState<string | undefined>();

  useEffect(() => {
    const sync = () => {
      if (!navigationRef.isReady()) return;
      setRouteName(getActiveRouteName(navigationRef.getRootState()));
    };

    sync();
    const waitReady = setInterval(() => {
      if (navigationRef.isReady()) {
        sync();
        clearInterval(waitReady);
      }
    }, 50);

    const unsub = navigationRef.addListener('state', sync);
    return () => {
      clearInterval(waitReady);
      unsub();
    };
  }, []);

  if (routeName && QA_ROUTES.has(routeName)) return null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <DevNotificationTestEntry />
      <DevCrashTestEntry />
    </View>
  );
}
