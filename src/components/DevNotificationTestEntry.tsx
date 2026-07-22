import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MONITORING_CONFIG } from '../config/monitoringConfig';
import { navigateRoot } from '../navigation/navigationRef';

/** Tiny __DEV__-only entry for notification QA without Firebase Console. */
export default function DevNotificationTestEntry() {
  const insets = useSafeAreaInsets();
  if (!MONITORING_CONFIG.enableNotificationTests) return null;

  return (
    <Pressable
      accessibilityLabel="Open notification test screen"
      onPress={() => navigateRoot('DevNotificationTest')}
      style={[styles.fab, { top: insets.top + 8 }]}
      hitSlop={8}
    >
      <Text style={styles.text}>NT</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    left: 10,
    zIndex: 9998,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(46,125,95,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
