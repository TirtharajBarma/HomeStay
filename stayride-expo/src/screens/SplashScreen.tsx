import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  Easing,
  ActivityIndicator,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import { useStayRide } from '../data/store';

const { width } = Dimensions.get('window');

export const SplashScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { session, loading } = useStayRide();

  // Animation values
  const logoScale = useRef(new Animated.Value(0.4)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const auraScale = useRef(new Animated.Value(0.8)).current;
  const auraOpacity = useRef(new Animated.Value(0)).current;
  const aura2Scale = useRef(new Animated.Value(0.7)).current;
  const aura2Opacity = useRef(new Animated.Value(0)).current;

  const brandSlideY = useRef(new Animated.Value(24)).current;
  const brandOpacity = useRef(new Animated.Value(0)).current;
  const taglineSlideY = useRef(new Animated.Value(18)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const bottomOpacity = useRef(new Animated.Value(0)).current;

  const animFinishedRef = useRef(false);

  useEffect(() => {
    // 1. Entrance sequence inspired by modern Razorpay style
    Animated.parallel([
      // Outer aura ring 1
      Animated.timing(auraOpacity, {
        toValue: 0.35,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(auraScale, {
        toValue: 1.25,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Outer aura ring 2
      Animated.timing(aura2Opacity, {
        toValue: 0.2,
        duration: 800,
        delay: 150,
        useNativeDriver: true,
      }),
      Animated.timing(aura2Scale, {
        toValue: 1.45,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Logo bounce reveal
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      // Brand Name slide-up
      Animated.sequence([
        Animated.delay(260),
        Animated.parallel([
          Animated.timing(brandOpacity, {
            toValue: 1,
            duration: 450,
            useNativeDriver: true,
          }),
          Animated.timing(brandSlideY, {
            toValue: 0,
            duration: 450,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        // Tagline slide-up
        Animated.parallel([
          Animated.timing(taglineOpacity, {
            toValue: 1,
            duration: 450,
            useNativeDriver: true,
          }),
          Animated.timing(taglineSlideY, {
            toValue: 0,
            duration: 450,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(bottomOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start(() => {
      animFinishedRef.current = true;
    });

    // Gentle continuous aura pulse
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(auraScale, {
          toValue: 1.35,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(auraScale, {
          toValue: 1.2,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    return () => {
      pulseLoop.stop();
    };
  }, []);

  // Smooth navigation once ready
  useEffect(() => {
    const minDelay = setTimeout(() => {
      if (!loading) {
        if (session?.accessToken) {
          navigation.replace('MainTabs');
        } else {
          navigation.replace('Login');
        }
      }
    }, 1200);

    return () => clearTimeout(minDelay);
  }, [loading, session, navigation]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Ambient Glow Aura Rings */}
      <Animated.View
        style={[
          styles.auraRingOuter,
          {
            opacity: aura2Opacity,
            transform: [{ scale: aura2Scale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.auraRing,
          {
            opacity: auraOpacity,
            transform: [{ scale: auraScale }],
          },
        ]}
      />

      {/* Main Brand Logo Card */}
      <Animated.View
        style={[
          styles.logoCard,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Brand Typography */}
      <Animated.View
        style={[
          styles.brandContainer,
          {
            opacity: brandOpacity,
            transform: [{ translateY: brandSlideY }],
          },
        ]}
      >
        <Text style={styles.brandTitle}>STAYCABS</Text>
        <View style={styles.accentBar} />
      </Animated.View>

      {/* Tagline */}
      <Animated.View
        style={[
          styles.taglineContainer,
          {
            opacity: taglineOpacity,
            transform: [{ translateY: taglineSlideY }],
          },
        ]}
      >
        <Text style={styles.tagline}>Your Stay. Your Ride. Your Hills.</Text>
      </Animated.View>

      {/* Minimal Footer */}
      <Animated.View style={[styles.bottomContainer, { opacity: bottomOpacity }]}>
        <ActivityIndicator color="#C084FC" size="small" />
        <Text style={styles.footerText}>Mountain Hospitality Platform</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1435', // Premium StayCabs deep royal purple
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  auraRingOuter: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#7C3AED',
  },
  auraRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#9333EA',
  },
  logoCard: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  logoImage: {
    width: 76,
    height: 76,
  },
  brandContainer: {
    alignItems: 'center',
    marginTop: 26,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 3.5,
    textAlign: 'center',
  },
  accentBar: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#C084FC',
    marginTop: 8,
  },
  taglineContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E9D5FF',
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 46,
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#A855F7',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
