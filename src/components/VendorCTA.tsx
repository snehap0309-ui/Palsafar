import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { LinearGradient } from '../utils/LinearGradient';
import { useCardWidth } from '../design/responsive';

interface VendorCTAProps {
  onApply?: () => void;
  isSwitch?: boolean;
}

export default function VendorCTA({ onApply, isSwitch = false }: VendorCTAProps) {
  const cardWidth = useCardWidth(40);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.97, tension: 200, friction: 12, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, tension: 150, friction: 8, useNativeDriver: true }).start();
  };

  return (
    <TouchableOpacity activeOpacity={1} onPress={onApply} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[styles.wrapper, { transform: [{ scale: scaleAnim }] }]}>
        <LinearGradient
          colors={['#FBEFE2', '#F5E6D0']}
          style={[styles.card, { width: cardWidth }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.glow} />
          <View style={styles.content}>
            <View style={styles.badge}>
              <Icon name={isSwitch ? 'swap-horizontal' : 'storefront'} size={12} color="#B9834B" />
              <Text style={styles.badgeText}>{isSwitch ? 'Role Switch' : 'Local Business'}</Text>
            </View>

            <Text style={styles.title}>
              {isSwitch ? (
                <>Switch to <Text style={styles.titleAccent}>Vendor</Text></>
              ) : (
                <>Become a <Text style={styles.titleAccent}>Vendor</Text></>
              )}
            </Text>

            <Text style={styles.subtitle}>
              {isSwitch
                ? 'One professional role per account — switching retires your Creator profile.'
                : 'List your business, run offers, and reach travelers nearby.'}
            </Text>

            <TouchableOpacity activeOpacity={0.85} onPress={onApply}>
              <LinearGradient
                colors={['#8B6B3A', '#B9834B']}
                style={styles.button}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.buttonText}>{isSwitch ? 'Switch Now' : 'Apply Now'}</Text>
                <Icon name="arrow-forward" size={14} color="#FFF9F2" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
}

const SHADOW = Platform.OS === 'ios'
  ? {
      shadowColor: '#B9834B',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
    }
  : { elevation: 4 };

const styles = StyleSheet.create({
  wrapper: { borderRadius: 18 },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(185,131,75,0.18)',
    ...SHADOW,
  },
  glow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(185,131,75,0.08)',
  },
  content: {
    padding: 14,
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(185,131,75,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B9834B',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2C1810',
    letterSpacing: -0.4,
  },
  titleAccent: {
    color: '#B9834B',
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 11,
    color: '#8B7355',
    lineHeight: 15,
    fontWeight: '500',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignSelf: 'flex-start',
    marginTop: 3,
  },
  buttonText: {
    color: '#FFF9F2',
    fontSize: 11,
    fontWeight: '800',
  },
});
