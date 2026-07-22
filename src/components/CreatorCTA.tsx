import React, { useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { LinearGradient } from '../utils/LinearGradient';
import { useCardWidth } from '../design/responsive';

interface CreatorCTAProps {
  onApply?: () => void;
  /** True when applying retires an existing Vendor workspace (XOR specialty). */
  isSwitch?: boolean;
}

export default function CreatorCTA({ onApply, isSwitch = false }: CreatorCTAProps) {
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
          <View style={styles.contentRow}>
            <View style={styles.left}>
              <View style={styles.badge}>
                <Icon name={isSwitch ? 'swap-horizontal' : 'videocam'} size={12} color="#B9834B" />
                <Text style={styles.badgeText}>{isSwitch ? 'Role Switch' : 'Pal Creators'}</Text>
              </View>

              <Text style={styles.title}>
                {isSwitch ? (
                  <>Switch to <Text style={styles.titleAccent}>Creator</Text></>
                ) : (
                  <>Become a <Text style={styles.titleAccent}>Creator</Text></>
                )}
              </Text>

              <Text style={styles.subtitle}>
                {isSwitch
                  ? 'One professional role per account — switching retires your Vendor profile.'
                  : 'Share travel stories, inspire travelers, and earn exclusive rewards.'}
              </Text>

              <View style={styles.featureList}>
                <View style={styles.featureRow}>
                  <View style={styles.featureIcon}>
                    <Icon name="images-outline" size={12} color="#B9834B" />
                  </View>
                  <Text style={styles.featureText}>Upload Reels & Photos</Text>
                </View>
                <View style={styles.featureRow}>
                  <View style={styles.featureIcon}>
                    <Icon name="people-outline" size={12} color="#B9834B" />
                  </View>
                  <Text style={styles.featureText}>Build Your Community</Text>
                </View>
              </View>

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

            <View style={styles.right}>
              <Image source={require('../assets/reel.png')} style={styles.reelImage} />
            </View>
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
  contentRow: {
    flexDirection: 'row',
    padding: 14,
    minHeight: 120,
  },
  left: {
    flex: 1,
    justifyContent: 'center',
    gap: 5,
    paddingRight: 6,
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
  featureList: { gap: 4, marginTop: 1 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featureIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(185,131,75,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8B7355',
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
  right: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reelImage: {
    width: 110,
    height: 110,
    resizeMode: 'contain',
  },
});
