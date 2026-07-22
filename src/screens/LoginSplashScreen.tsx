import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  StatusBar,
  Image,
  TouchableWithoutFeedback,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useUserContext } from '../context/UserContext';

const ORBIT_ICONS = [
  'compass-outline', 'location-outline', 'business-outline', 'shield-checkmark-outline',
  'water-outline', 'diamond-outline', 'restaurant-outline', 'flag-outline',
];
const ORBIT_ANGLE_START = 195;
const ORBIT_ANGLE_END = 345;
const ORBIT_COUNT = ORBIT_ICONS.length;

const DRIFT_COUNT = 15;
/** Ratio-seeded (0–1) so resize scales positions without re-randomizing. */
const DRIFT_SEEDS = Array.from({ length: DRIFT_COUNT }, () => ({
  x: Math.random(),
  y: Math.random(),
  sz: 1 + Math.random() * 1.5,
  dur: 8000 + Math.random() * 8000,
  del: Math.random() * 5000,
  dx: (Math.random() - 0.5) * 15,
  dy: -3 - Math.random() * 6,
}));

export default function LoginSplashScreen({ navigation }: any) {
  const { onGuestContinue } = useUserContext();
  const { width: W, height: H } = useWindowDimensions();

  const { ORBIT_CX, ORBIT_CY, ORBIT_R } = useMemo(
    () => ({
      ORBIT_CX: W / 2,
      ORBIT_CY: H * 0.44,
      ORBIT_R: W * 0.34,
    }),
    [W, H],
  );

  const driftParticles = useMemo(
    () =>
      DRIFT_SEEDS.map((p) => ({
        ...p,
        x: p.x * W,
        y: p.y * H,
      })),
    [W, H],
  );

  const bgFade = useRef(new Animated.Value(0)).current;
  const lS = useRef(new Animated.Value(0.5)).current;
  const lF = useRef(new Animated.Value(0)).current;
  const lB = useRef(new Animated.Value(0)).current;

  const rR1 = useRef(new Animated.Value(0)).current;
  const rR2 = useRef(new Animated.Value(0)).current;

  const cloud1 = useRef(new Animated.Value(0)).current;
  const cloud2 = useRef(new Animated.Value(0)).current;
  const waveA = useRef(new Animated.Value(0)).current;
  const orbitA = useRef(new Animated.Value(0)).current;
  const iconApps = useRef(ORBIT_ICONS.map(() => new Animated.Value(0))).current;

  const dAnims = useRef(DRIFT_SEEDS.map(() => new Animated.Value(0))).current;

  const tF = useRef(new Animated.Value(0)).current;
  const tgF = useRef(new Animated.Value(0)).current;
  const tS = useRef(new Animated.Value(0.8)).current;
  const tLS = useRef(new Animated.Value(0)).current;

  const planeA = useRef(new Animated.Value(0)).current;
  const planeB = useRef(new Animated.Value(0)).current;
  const planeC = useRef(new Animated.Value(0)).current;

  const skipR = useRef(false);
  const navR = useRef(false);

  const go = useCallback(() => {
    if (navR.current) return;
    navR.current = true;
    navigation.replace('Login');
  }, [navigation]);

  useEffect(() => {
    const anims: Animated.CompositeAnimation[] = [];

    Animated.timing(bgFade, { toValue: 1, duration: 600, useNativeDriver: false }).start();

    Animated.parallel([
      Animated.spring(lS, { toValue: 1, friction: 6, tension: 40, useNativeDriver: false }),
      Animated.timing(lF, { toValue: 1, duration: 500, useNativeDriver: false }),
    ]).start();

    const loop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(lB, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(lB, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    );
    loop1.start();
    anims.push(loop1);

    const loop2 = Animated.loop(Animated.timing(rR1, { toValue: 1, duration: 20000, easing: Easing.linear, useNativeDriver: false }));
    loop2.start();
    anims.push(loop2);

    const loop3 = Animated.loop(Animated.timing(rR2, { toValue: 1, duration: 28000, easing: Easing.linear, useNativeDriver: false }));
    loop3.start();
    anims.push(loop3);

    const loop4 = Animated.loop(
      Animated.sequence([
        Animated.timing(cloud1, { toValue: 1, duration: 35000, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(cloud1, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    );
    loop4.start();
    anims.push(loop4);

    const loop5 = Animated.loop(
      Animated.sequence([
        Animated.timing(cloud2, { toValue: 1, duration: 45000, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(cloud2, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    );
    loop5.start();
    anims.push(loop5);

    const loop6 = Animated.loop(
      Animated.sequence([
        Animated.timing(waveA, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(waveA, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    );
    loop6.start();
    anims.push(loop6);

    const loop7 = Animated.loop(Animated.timing(orbitA, { toValue: 1, duration: 30000, easing: Easing.linear, useNativeDriver: false }));
    loop7.start();
    anims.push(loop7);

    iconApps.forEach((a, i) => {
      Animated.sequence([
        Animated.delay(200 + i * 120),
        Animated.parallel([
          Animated.timing(a, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        ]),
      ]).start();
    });

    const driftLoops = dAnims.map((a, i) => {
      const p = DRIFT_SEEDS[i];
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(p.del),
          Animated.timing(a, { toValue: 1, duration: p.dur, easing: Easing.out(Easing.sin), useNativeDriver: false }),
          Animated.timing(a, { toValue: 0, duration: p.dur * 0.3, useNativeDriver: false }),
        ])
      );
      loop.start();
      anims.push(loop);
      return loop;
    });

    Animated.timing(tLS, { toValue: 1, duration: 600, delay: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();

    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.spring(tS, { toValue: 1, friction: 6, tension: 40, useNativeDriver: false }),
        Animated.timing(tF, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      ]),
      Animated.delay(60),
      Animated.timing(tgF, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();

    const loop8 = Animated.loop(
      Animated.sequence([
        Animated.delay(1500),
        Animated.timing(planeA, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(planeA, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    );
    loop8.start();
    anims.push(loop8);

    const loop9 = Animated.loop(
      Animated.sequence([
        Animated.delay(3500),
        Animated.timing(planeB, { toValue: 1, duration: 5500, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(planeB, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    );
    loop9.start();
    anims.push(loop9);

    const loop10 = Animated.loop(
      Animated.sequence([
        Animated.delay(5000),
        Animated.timing(planeC, { toValue: 1, duration: 4500, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(planeC, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    );
    loop10.start();
    anims.push(loop10);

    const t = setTimeout(() => { if (!skipR.current) go(); }, 3200);
    return () => {
      clearTimeout(t);
      anims.forEach(a => a.stop());
      driftLoops.forEach(l => l.stop());
    };
  }, [go]);

  const handleSkip = useCallback(() => {
    if (navR.current) return;
    skipR.current = true;
    go();
  }, [go]);

  const bS = lB.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  const fS = Animated.multiply(lS, bS);
  const r1 = rR1.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const r2 = rR2.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });

  const c1X = cloud1.interpolate({ inputRange: [0, 1], outputRange: [-W * 0.3, W * 1.3] });
  const c2X = cloud2.interpolate({ inputRange: [0, 1], outputRange: [-W * 0.5, W * 1.5] });

  const wY = waveA.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -4, 0] });

  const oIconPositions = ORBIT_ICONS.map((_, i) => {
    const baseDeg = ORBIT_ANGLE_START + ((ORBIT_ANGLE_END - ORBIT_ANGLE_START) / (ORBIT_COUNT - 1)) * i;
    const baseRad = (baseDeg * Math.PI) / 180;

    const tx = orbitA.interpolate({
      inputRange: [0, 1],
      outputRange: [
        ORBIT_R * Math.cos(baseRad),
        ORBIT_R * Math.cos(baseRad + Math.PI * 2),
      ],
    });
    const ty = orbitA.interpolate({
      inputRange: [0, 1],
      outputRange: [
        ORBIT_R * Math.sin(baseRad),
        ORBIT_R * Math.sin(baseRad + Math.PI * 2),
      ],
    });
    return { tx, ty, baseDeg };
  });

  const tLet = tLS.interpolate({ inputRange: [0, 1], outputRange: [14, 6] });

  const pX = planeA.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
    outputRange: [-40, W * 0.15, W * 0.5, W * 0.7, W * 0.85, W + 40],
  });
  const pY = planeA.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
    outputRange: [H * 0.08, H * 0.04, H * 0.07, H * 0.03, H * 0.06, H * 0.1],
  });
  const pR = planeA.interpolate({
    inputRange: [0, 0.3, 0.5, 0.7, 1],
    outputRange: ['20deg', '-15deg', '5deg', '-10deg', '25deg'],
  });

  const pBX = planeB.interpolate({
    inputRange: [0, 0.3, 0.55, 0.8, 1],
    outputRange: [-50, W * 0.2, W * 0.55, W * 0.75, W + 50],
  });
  const pBY = planeB.interpolate({
    inputRange: [0, 0.3, 0.55, 0.8, 1],
    outputRange: [H * 0.14, H * 0.09, H * 0.12, H * 0.08, H * 0.16],
  });
  const pBR = planeB.interpolate({
    inputRange: [0, 0.3, 0.55, 0.8, 1],
    outputRange: ['15deg', '-20deg', '10deg', '-15deg', '20deg'],
  });

  const pCX = planeC.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [-30, W * 0.1, W * 0.45, W * 0.8, W + 30],
  });
  const pCY = planeC.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [H * 0.2, H * 0.15, H * 0.19, H * 0.14, H * 0.22],
  });
  const pCR = planeC.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: ['10deg', '-25deg', '5deg', '-20deg', '15deg'],
  });

  return (
    <TouchableWithoutFeedback onPress={handleSkip}>
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgFade }]}>
          <Image
            source={require('../assets/splash-bg.jpg')}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        </Animated.View>

        {/* Dark overlay */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]} pointerEvents="none" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,27,58,0.15)' }]} pointerEvents="none" />

        {/* Spotlight vignette */}
        <LinearGradient
          colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.3)']}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.35)', 'transparent', 'rgba(0,0,0,0.4)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.5)']}
          locations={[0.4, 1]}
          style={[StyleSheet.absoluteFill, { height: H * 0.5, top: H * 0.5 }]}
          pointerEvents="none"
        />

        {/* Slow moving clouds */}
        <Animated.View style={[StyleSheet.absoluteFill, {
          width: W * 0.5, top: H * 0.1, height: H * 0.15,
          opacity: 0.04,
          transform: [{ translateX: c1X }],
        }]} pointerEvents="none">
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.06)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, {
          width: W * 0.6, top: H * 0.18, height: H * 0.1,
          opacity: 0.025,
          transform: [{ translateX: c2X }],
        }]} pointerEvents="none">
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.04)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Gentle ocean wave */}
        <Animated.View style={[StyleSheet.absoluteFill, {
          top: H * 0.45, height: H * 0.08,
          transform: [{ translateY: wY }],
          opacity: 0.03,
        }]} pointerEvents="none">
          <LinearGradient
            colors={['transparent', 'rgba(239,203,135,0.05)', 'transparent']}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Drift particles */}
        {driftParticles.map((p, i) => {
          const o = dAnims[i].interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.08, 0] });
          const px = dAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] });
          const py = dAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0, p.dy] });
          return (
            <View key={`dp${i}`} style={{ position: 'absolute', left: p.x, top: p.y }} pointerEvents="none">
              <Animated.View style={{
                width: p.sz, height: p.sz, borderRadius: p.sz / 2,
                backgroundColor: '#EFCB87', opacity: o,
                transform: [{ translateX: px }, { translateY: py }],
              }} pointerEvents="none" />
            </View>
          );
        })}

        {/* Orbital lines */}
        {ORBIT_ICONS.slice(0, -1).map((_, i) => {
          const lineO = iconApps[i];
          const p1 = oIconPositions[i];
          const p2 = oIconPositions[i + 1];
          const dx = (ORBIT_ANGLE_END - ORBIT_ANGLE_START) / (ORBIT_COUNT - 1);
          const midDeg = (p1.baseDeg + p2.baseDeg) / 2;
          const _midRad = (midDeg * Math.PI) / 180;
          const chordLen = 2 * ORBIT_R * Math.sin(((dx * Math.PI) / 180) / 2);
          const lineTx = orbitA.interpolate({
            inputRange: [0, 1],
            outputRange: [
              ORBIT_R * Math.cos((midDeg * Math.PI) / 180) - chordLen / 2,
              ORBIT_R * Math.cos((midDeg * Math.PI) / 180 + Math.PI * 2) - chordLen / 2,
            ],
          });
          const lineTy = orbitA.interpolate({
            inputRange: [0, 1],
            outputRange: [
              ORBIT_R * Math.sin((midDeg * Math.PI) / 180),
              ORBIT_R * Math.sin((midDeg * Math.PI) / 180 + Math.PI * 2),
            ],
          });
          return (
            <View key={`ol${i}`} style={{ position: 'absolute', left: ORBIT_CX, top: ORBIT_CY, zIndex: 4 }} pointerEvents="none">
              <Animated.View style={{
                width: chordLen, height: 0.5,
                backgroundColor: 'rgba(239,203,135,0.08)',
                opacity: lineO,
                transform: [{ translateX: lineTx }, { translateY: lineTy }, { rotate: `${midDeg - 90}deg` }],
              }} pointerEvents="none" />
            </View>
          );
        })}

        {/* Orbit icons - semi-circle building effect */}
        {ORBIT_ICONS.map((icon, i) => {
          const pos = oIconPositions[i];
          const app = iconApps[i];
          return (
            <View key={`oi${i}`} style={{ position: 'absolute', left: ORBIT_CX - 18, top: ORBIT_CY - 18, zIndex: 6 }} pointerEvents="none">
              <Animated.View style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderWidth: 0.8, borderColor: 'rgba(239,203,135,0.12)',
                justifyContent: 'center', alignItems: 'center',
                opacity: app,
                transform: [
                  { translateX: pos.tx },
                  { translateY: pos.ty },
                  { scale: app.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) },
                  { translateY: app.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
                ],
              }} pointerEvents="none">
                <Icon name={icon} size={16} color="rgba(239,203,135,0.6)" />
              </Animated.View>
            </View>
          );
        })}

        {/* Paper planes */}
        <View style={{ position: 'absolute', left: 0, top: 0, zIndex: 5 }} pointerEvents="none">
          <Animated.View style={{
            transform: [{ translateX: pX }, { translateY: pY }, { rotate: pR }],
          }} pointerEvents="none">
            <Icon name="paper-plane" size={22} color="rgba(239,203,135,0.6)" />
          </Animated.View>
        </View>
        <View style={{ position: 'absolute', left: 0, top: 0, zIndex: 5 }} pointerEvents="none">
          <Animated.View style={{
            transform: [{ translateX: pBX }, { translateY: pBY }, { rotate: pBR }],
          }} pointerEvents="none">
            <Icon name="paper-plane" size={18} color="rgba(239,203,135,0.35)" />
          </Animated.View>
        </View>
        <View style={{ position: 'absolute', left: 0, top: 0, zIndex: 5 }} pointerEvents="none">
          <Animated.View style={{
            transform: [{ translateX: pCX }, { translateY: pCY }, { rotate: pCR }],
          }} pointerEvents="none">
            <Icon name="paper-plane" size={14} color="rgba(239,203,135,0.25)" />
          </Animated.View>
        </View>

        <View style={styles.center}>
          {/* Rings */}
          <Animated.View style={[styles.ring1, { transform: [{ rotate: r1 }] }]} />
          <Animated.View style={[styles.ring2, { transform: [{ rotate: r2 }] }]} />

          {/* Logo */}
          <Animated.View style={[styles.logoWrap, { transform: [{ scale: fS }], opacity: lF }]}>
            <Image source={require('../assets/logo-removebg-preview.png')} style={styles.logoImg} resizeMode="contain" />
          </Animated.View>

          {/* Text */}
          <Animated.View style={{
            opacity: tF,
            transform: [
              { scale: tS },
              { translateY: tF.interpolate({ inputRange: [0, 1], outputRange: [25, 0] }) },
            ],
          }}>
            <Animated.Text style={[styles.title, { letterSpacing: tLet }]}>PAL SAFAR</Animated.Text>
          </Animated.View>

          <Animated.View style={{
            opacity: tgF,
            transform: [{ translateY: tgF.interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }],
          }}>
            <Text style={styles.tagline}>Explore • Experience • Belong</Text>
          </Animated.View>
        </View>

        {/* Quick Login Buttons */}
        <View style={styles.quickButtons}>
          <TouchableOpacity
            onPress={onGuestContinue}
            activeOpacity={0.7}
            style={styles.quickBtn}
          >
            <Icon name="person-outline" size={13} color="rgba(239,203,135,0.7)" />
            <Text style={styles.quickBtnText}>Login as Guest</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.7}
            style={styles.quickBtn}
          >
            <Icon name="log-in-outline" size={13} color="rgba(239,203,135,0.7)" />
            <Text style={styles.quickBtnText}>Sign in to your account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.skipHint} pointerEvents="none">
          <Animated.View style={{ opacity: Animated.multiply(tgF, 0.2) }}>
            <Text style={styles.skipText}>Tap anywhere</Text>
          </Animated.View>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center', zIndex: 10,
  },
  ring1: {
    position: 'absolute',
    width: 300, height: 300, borderRadius: 150,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.04)',
    borderTopColor: 'rgba(239,203,135,0.2)',
    borderBottomColor: 'rgba(239,203,135,0.06)',
  },
  ring2: {
    position: 'absolute',
    width: 260, height: 260, borderRadius: 130,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.03)',
    borderLeftColor: 'rgba(239,203,135,0.15)',
    borderRightColor: 'rgba(239,203,135,0.05)',
  },
  logoWrap: {
    width: 380, height: 380,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#EFCB87', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 8,
  },
  logoImg: {
    width: '100%', height: '100%', borderRadius: 20,
  },
  title: {
    fontSize: 34, fontWeight: '900',
    fontFamily: 'serif', color: '#EFCB87',
    letterSpacing: 6, marginTop: 16,
    textShadowColor: 'rgba(239,203,135,0.15)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  tagline: {
    fontSize: 15, fontWeight: '400',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 3, marginTop: 16,
  },
  skipHint: {
    position: 'absolute', bottom: 40, left: 0, right: 0,
    alignItems: 'center', zIndex: 20,
  },
  skipText: {
    fontSize: 9, color: 'rgba(255,255,255,0.2)',
    letterSpacing: 1.5,
  },
  quickButtons: {
    position: 'absolute', bottom: 90, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 16,
    zIndex: 20,
  },
  quickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(239,203,135,0.15)',
  },
  quickBtnText: {
    fontSize: 11,
    color: 'rgba(239,203,135,0.7)',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});
