import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MONITORING_CONFIG } from '../config/monitoringConfig';
import { navigateRoot } from '../navigation/navigationRef';

/** Tiny __DEV__-only entry so crash QA does not require editing locked User Settings. */
export default function DevCrashTestEntry() {
  const insets = useSafeAreaInsets();
  if (!MONITORING_CONFIG.enableCrashTests) return null;

  return (
    <Pressable
      accessibilityLabel="Open crash test screen"
      onPress={() => navigateRoot('CrashTest')}
      style={[styles.fab, { top: insets.top + 8 }]}
      hitSlop={8}
    >
      <Text style={styles.text}>CR</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 10,
    zIndex: 9999,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(220,76,76,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
