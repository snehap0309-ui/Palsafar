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

interface RewardsWalletCTAProps {
  onPress?: () => void;
  onExploreRewards?: () => void;
  palPoints?: number;
}

export default function RewardsWalletCTA({
  onPress,
  onExploreRewards,
  palPoints = 0,
}: RewardsWalletCTAProps) {
  const cardWidth = useCardWidth(40);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.97, tension: 200, friction: 12, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, tension: 150, friction: 8, useNativeDriver: true }).start();
  };

  const openWallet = () => onPress?.();
  const openRewards = () => (onExploreRewards || onPress)?.();

  return (
    <TouchableOpacity activeOpacity={1} onPress={openWallet} onPressIn={onPressIn} onPressOut={onPressOut}>
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
                <Icon name="star" size={12} color="#B9834B" />
                <Text style={styles.badgeText}>Pal Rewards</Text>
              </View>

              <Text style={styles.title}>Rewards & Wallet</Text>
              <Text style={styles.subtitle}>
                Earn Pal Points and redeem travel rewards, vouchers, and partner offers.
              </Text>

              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.button} activeOpacity={0.85} onPress={openWallet}>
                  <LinearGradient
                    colors={['#8B6B3A', '#B9834B']}
                    style={styles.buttonGrad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.buttonText}>Open Wallet</Text>
                    <Icon name="arrow-forward" size={14} color="#FFF9F2" />
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.85} onPress={openRewards}>
                  <Text style={styles.secondaryBtnText}>Rewards</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.right}>
              <Image
                source={require('../assets/ear-removebg-preview.png')}
                style={styles.image}
              />
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
    alignItems: 'center',
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
  subtitle: {
    fontSize: 11,
    color: '#8B7355',
    lineHeight: 15,
    fontWeight: '500',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  button: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  buttonGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  buttonText: {
    color: '#FFF9F2',
    fontSize: 11,
    fontWeight: '800',
  },
  secondaryBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(185,131,75,0.35)',
  },
  secondaryBtnText: {
    color: '#B9834B',
    fontSize: 11,
    fontWeight: '700',
  },
  right: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
  },
});
