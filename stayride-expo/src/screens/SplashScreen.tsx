import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Animated, Easing, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import { useStayRide } from '../data/store';

export const SplashScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { session, loading } = useStayRide();

  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoAlpha = useRef(new Animated.Value(0)).current;
  const contentAlpha = useRef(new Animated.Value(0)).current;
  const contentY = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
      Animated.timing(logoAlpha, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(400),
        Animated.parallel([
          Animated.timing(contentAlpha, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(contentY, {
            toValue: 0,
            duration: 600,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();

    const timer = setTimeout(() => {
      if (!loading) {
        if (session?.accessToken) {
          navigation.replace('MainTabs');
        } else {
          navigation.replace('Login');
        }
      }
    }, 2200);

    return () => clearTimeout(timer);
  }, [loading, session]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [{ scale: logoScale }],
            opacity: logoAlpha,
          },
        ]}
      >
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.textContainer,
          {
            opacity: contentAlpha,
            transform: [{ translateY: contentY }],
          },
        ]}
      >
        <Text style={styles.appName}>StayRide</Text>
        <Text style={styles.tagline}>Cosy stays in the clouds. Mountain cabs, zero hassle.</Text>
      </Animated.View>

      <View style={styles.loaderContainer}>
        <ActivityIndicator color={Colors.white} size="small" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brandPrimaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  logo: {
    width: 80,
    height: 80,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 14,
    color: '#E0E7FF',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    maxWidth: 280,
  },
  loaderContainer: {
    position: 'absolute',
    bottom: 50,
  },
});
