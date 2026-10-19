import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import { useOAuth, useUser, useAuth } from '@clerk/expo';
import { useSignIn, useSignUp } from '@clerk/expo/legacy';

import { Colors, Radii, Shadows } from '../theme/colors';
import { useStayRide } from '../data/store';
import { DEMO_ENABLED } from '../data/api';
import { vehicleLabel } from '../utils/vehicle';
import { KeyboardAwareOverlay } from '../components/KeyboardAwareOverlay';

// Complete any pending auth session (required for Clerk OAuth in Expo)
WebBrowser.maybeCompleteAuthSession();

// Warm up Android browser for smooth OAuth popup
const useWarmUpBrowser = () => {
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
};

export const LoginScreen: React.FC = () => {
  useWarmUpBrowser();

  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { login, syncClerkUser } = useStayRide();

  // Clerk hooks
  const { isLoaded: isSignInLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: isSignUpLoaded, signUp } = useSignUp();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const { user, isSignedIn } = useUser();
  const { isLoaded: isAuthLoaded, getToken, signOut } = useAuth();
  // Clerk may still be loading (or unreachable offline); the app renders without waiting for it
  const clerkReady = isAuthLoaded && isSignInLoaded && isSignUpLoaded;

  // Mode: 'signin' | 'signup' | 'verify'
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'verify'>('signin');
  const [signupRole, setSignupRole] = useState<'owner' | 'driver'>('owner');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [homestayName, setHomestayName] = useState('');
  const [location, setLocation] = useState('');
  const [vehicleType, setVehicleType] = useState<'SUV' | 'Sedan' | '7-seater' | '9-seater'>('SUV');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [area, setArea] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  // Live GPS Coordinates for Homestay Pinning
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const handleDetectGPS = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please allow location access so StayRide can pinpoint your exact homestay GPS location for cab pickups.'
        );
        return;
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      setCoords({ latitude, longitude });

      try {
        const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geo) {
          const parts = [
            geo.name,
            geo.street,
            geo.district || geo.subregion,
            geo.city || geo.region,
            geo.postalCode,
          ].filter(Boolean);
          const formatted = parts.join(', ');
          setLocation(formatted);
        } else {
          setLocation(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        }
      } catch {
        setLocation(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      }

      Alert.alert(
        'GPS Location Pinned!',
        `Your homestay is pinned at:\n${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E.\n\nAll future cab pickups will use this exact GPS location.`
      );
    } catch (err: any) {
      Alert.alert('GPS Notice', 'Could not detect live GPS automatically. You can type your location manually.');
    } finally {
      setLocating(false);
    }
  };

  // Google OAuth Onboarding State
  const [showRoleSelectModal, setShowRoleSelectModal] = useState(false);
  const [googleOnboardingStep, setGoogleOnboardingStep] = useState<'role' | 'details'>('role');
  const [googleRole, setGoogleRole] = useState<'owner' | 'driver'>('owner');
  const [pendingGoogleUser, setPendingGoogleUser] = useState<any>(null);

  // Form inputs for Google onboarding
  const [googlePhone, setGooglePhone] = useState('');
  const [googleHomestayName, setGoogleHomestayName] = useState('');
  const [googleLocation, setGoogleLocation] = useState('');
  const [googleVehicleType, setGoogleVehicleType] = useState<'SUV' | 'Sedan' | '7-seater' | '9-seater'>('SUV');
  const [googleVehicleNumber, setGoogleVehicleNumber] = useState('');
  const [googleArea, setGoogleArea] = useState('');

  // Mountain GPS Fine-Tuner & Pin Modal
  const [showGpsModal, setShowGpsModal] = useState(false);
  const [calibratingCoords, setCalibratingCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: 27.3389,
    longitude: 88.6065,
  });

  // One-tap demo sign-in (dev builds or EXPO_PUBLIC_ENABLE_DEMO=true only)
  const handleDemoLogin = async (demoEmail: string) => {
    setLoading(true);
    try {
      await login(demoEmail, 'demo123');
      navigation.replace('Main');
    } catch (err: any) {
      Alert.alert('Demo Login Error', err?.message || 'Could not open the demo.');
    } finally {
      setLoading(false);
    }
  };

  // Sync state tracking to prevent duplicate backend sync runs
  const hasSyncedRef = useRef(false);

  // Exchange the Clerk session for a StayRide session whenever a Clerk user is authenticated
  useEffect(() => {
    if (isSignedIn && user && !hasSyncedRef.current) {
      const existingRole = (user.unsafeMetadata?.role as string) || '';

      // Direct check: If admin, reject access immediately on mobile
      if (existingRole === 'admin') {
        (async () => {
          try {
            await signOut();
            hasSyncedRef.current = false;
          } catch {}
          Alert.alert(
            'Access Denied',
            'You are an Administrator. The mobile app is strictly for Homestay Hosts and Cab Drivers. Please use the Web Control Tower.'
          );
        })();
        return;
      }

      // If brand new Google OAuth user who hasn't chosen role yet, display role selection modal
      if (!existingRole && !user.unsafeMetadata?.homestayName && !user.unsafeMetadata?.vehicleType && authMode !== 'signup') {
        setPendingGoogleUser(user);
        setGoogleHomestayName(`${user.firstName || 'My'} Homestay`);
        const p = user.primaryPhoneNumber?.phoneNumber || user.phoneNumbers?.[0]?.phoneNumber || '';
        setGooglePhone(p);
        setGoogleLocation('');
        setGoogleArea('');
        setGoogleOnboardingStep('role');
        setShowRoleSelectModal(true);
        return;
      }

      hasSyncedRef.current = true;
      setLoading(true);

      const determinedRole = (existingRole || signupRole || 'owner') as 'owner' | 'driver';
      const homestayMeta =
        (user.unsafeMetadata?.homestayName as string) ||
        homestayName.trim() ||
        `${user.firstName || 'My'} Homestay`;
      const locationMeta =
        (user.unsafeMetadata?.location as string) || location.trim();
      const phoneMeta =
        (user.unsafeMetadata?.phone as string) || phone.trim() || '';

      (async () => {
        try {
          const clerkToken = await getToken();
          if (!clerkToken) throw new Error('Could not get your sign-in session. Please try again.');
          await syncClerkUser(user, clerkToken, {
            role: determinedRole,
            homestayName: homestayMeta,
            location: locationMeta,
            phone: phoneMeta,
            name: user.fullName || user.firstName || name.trim() || undefined,
            vehicleType: (user.unsafeMetadata?.vehicleType as string) || vehicleType,
            vehicleNumber: (user.unsafeMetadata?.vehicleNumber as string) || vehicleNumber,
            area: (user.unsafeMetadata?.area as string) || area,
            latitude: (user.unsafeMetadata?.latitude as number) || coords?.latitude,
            longitude: (user.unsafeMetadata?.longitude as number) || coords?.longitude,
            mapQuery: (user.unsafeMetadata?.mapQuery as string) || (coords ? `${coords.latitude},${coords.longitude}` : locationMeta),
          });
          setLoading(false);
          navigation.replace('Main');
        } catch (err: any) {
          console.error('[StayRide] Clerk account sync failed:', err);
          try {
            await signOut();
            hasSyncedRef.current = false;
          } catch (signOutErr) {
            console.error('[StayRide] Clerk signOut failed:', signOutErr);
          }
          setLoading(false);
          Alert.alert(
            'Sign In Failed',
            err?.message || 'Could not connect your account to StayRide. Please try again.'
          );
        }
      })();
    }
  }, [isSignedIn, user, homestayName, location, phone, name, signupRole, vehicleType, vehicleNumber, area, authMode, navigation, syncClerkUser, getToken, signOut, coords]);

  // Google OAuth Flow with Clerk
  const handleGoogleAuth = useCallback(async () => {
    if (!clerkReady) return;
    setGoogleLoading(true);
    try {
      const redirectUrl = Linking.createURL('/dashboard', { scheme: 'stayride' });
      const { createdSessionId, setActive: setOAuthActive } = await startOAuthFlow({
        redirectUrl,
      });

      if (createdSessionId && (setOAuthActive || setActive)) {
        const activeSetter = setOAuthActive || setActive;
        await activeSetter!({ session: createdSessionId });
        // Handled reactively by the useEffect on isSignedIn + user
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        'Could not complete Google authentication.';
      Alert.alert('Google Sign-In', msg);
    } finally {
      setGoogleLoading(false);
    }
  }, [startOAuthFlow, setActive, clerkReady]);

  const handleStartGoogleOnboarding = (chosenRole: 'owner' | 'driver') => {
    setGoogleRole(chosenRole);
    setGoogleOnboardingStep('details');
  };

  const handleCompleteGoogleOnboarding = async () => {
    if (!pendingGoogleUser) return;
    const cleanPhone = googlePhone.trim();
    if (!cleanPhone) {
      Alert.alert('Phone Required', 'Please enter your contact phone number for guest and cab coordination.');
      return;
    }

    if (googleRole === 'driver') {
      if (!googleVehicleNumber.trim()) {
        Alert.alert('Vehicle Plate Required', 'Please enter your vehicle registration / plate number (e.g. SK-01-A-4488).');
        return;
      }
      if (!googleArea.trim()) {
        Alert.alert('Operating Area Required', 'Please enter the area where you drive (e.g. your town or route).');
        return;
      }
    } else {
      if (!googleHomestayName.trim()) {
        Alert.alert('Homestay Name Required', 'Please enter your homestay or property name.');
        return;
      }
    }

    setShowRoleSelectModal(false);
    hasSyncedRef.current = true;
    setLoading(true);

    try {
      const metadataPayload = {
        role: googleRole,
        phone: cleanPhone,
        homestayName: googleHomestayName.trim(),
        location: googleLocation.trim(),
        vehicleType: googleVehicleType,
        vehicleNumber: googleVehicleNumber.trim().toUpperCase(),
        area: googleArea.trim(),
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        mapQuery: coords ? `${coords.latitude},${coords.longitude}` : googleLocation.trim(),
      };

      if (pendingGoogleUser.update) {
        await pendingGoogleUser.update({
          unsafeMetadata: {
            ...pendingGoogleUser.unsafeMetadata,
            ...metadataPayload,
          },
        });
      }

      const clerkToken = await getToken();
      if (!clerkToken) throw new Error('Could not get your sign-in session. Please try again.');

      await syncClerkUser(pendingGoogleUser, clerkToken, {
        name: pendingGoogleUser.fullName || pendingGoogleUser.firstName || undefined,
        ...metadataPayload,
      });

      setLoading(false);
      navigation.replace('Main');
    } catch (err: any) {
      console.error('[StayRide] Clerk Google onboarding sync failed:', err);
      try {
        await signOut();
        hasSyncedRef.current = false;
      } catch (signOutErr) {
        console.error('[StayRide] Clerk signOut failed:', signOutErr);
      }
      setLoading(false);
      Alert.alert('Setup Error', err?.message || 'Could not complete registration.');
    }
  };

  const handleOpenGoogleMaps = () => {
    const lat = calibratingCoords.latitude;
    const lng = calibratingCoords.longitude;
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Google Maps Error', 'Could not open Google Maps app.');
    });
  };

  const handleNudgeCoords = (deltaLat: number, deltaLng: number) => {
    setCalibratingCoords((prev) => ({
      latitude: parseFloat((prev.latitude + deltaLat).toFixed(6)),
      longitude: parseFloat((prev.longitude + deltaLng).toFixed(6)),
    }));
  };

  const handleConfirmCalibratedCoords = async () => {
    setCoords(calibratingCoords);
    try {
      const [geo] = await Location.reverseGeocodeAsync(calibratingCoords);
      if (geo) {
        const parts = [
          geo.name,
          geo.street,
          geo.district || geo.subregion,
          geo.city || geo.region,
        ].filter(Boolean);
        const formatted = parts.join(', ');
        setLocation(formatted);
        setGoogleLocation(formatted);
      }
    } catch {}
    setShowGpsModal(false);
    Alert.alert(
      'Mountain GPS Pin Saved!',
      `Homestay gate pinned at:\n${calibratingCoords.latitude.toFixed(4)}° N, ${calibratingCoords.longitude.toFixed(4)}° E.`
    );
  };

  // Email & Password Sign In
  const handleEmailSignIn = async () => {
    const cleanEmail = email.trim();
    const cleanPass = password.trim();

    if (!cleanEmail) {
      Alert.alert('Validation Error', 'Please enter your email address.');
      return;
    }
    if (!cleanPass) {
      Alert.alert('Validation Error', 'Please enter your password.');
      return;
    }

    // Direct bypass for Demo Accounts (demo-enabled builds only)
    if (
      DEMO_ENABLED &&
      (cleanEmail.toLowerCase() === 'demo@stayride.in' ||
      cleanEmail.toLowerCase() === 'driver@stayride.in' ||
      cleanEmail.toLowerCase() === 'demo-driver@stayride.in')
    ) {
      setLoading(true);
      try {
        await login(cleanEmail, cleanPass);
        navigation.replace('Main');
      } catch (err: any) {
        Alert.alert('Demo Login Error', err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!isSignInLoaded || !signIn) {
      Alert.alert('Please Wait', 'Authentication service is initializing...');
      return;
    }

    setLoading(true);
    try {
      const result = await signIn.create({
        identifier: cleanEmail,
        password: cleanPass,
      });

      if (result.status === 'complete') {
        if (setActive) {
          await setActive({ session: result.createdSessionId });
        }
      } else {
        console.warn('Unhandled sign-in status:', result.status);
        Alert.alert('Sign In', `Additional verification required (${result.status}).`);
      }
    } catch (err: any) {
      // Legacy accounts (created before Clerk) only exist in StayRide: fall back to its login
      if (err?.errors?.[0]?.code === 'form_identifier_not_found') {
        try {
          await login(cleanEmail, cleanPass);
          navigation.replace('Main');
        } catch (legacyErr: any) {
          Alert.alert('Sign In Failed', legacyErr?.message || 'Invalid email or password.');
        }
        return;
      }
      console.error('Clerk SignIn error:', err);
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        'Invalid email or password.';
      Alert.alert('Sign In Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  // Email & Password Sign Up
  const handleEmailSignUp = async () => {
    const cleanEmail = email.trim();
    const cleanPass = password.trim();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanHomestay = homestayName.trim();
    const cleanLocation = location.trim();
    const cleanPlate = vehicleNumber.trim();
    const cleanArea = area.trim();

    if (!cleanName) return Alert.alert('Validation Error', 'Your full name is required.');
    if (!cleanPhone) return Alert.alert('Validation Error', 'Phone number is required.');
    if (!cleanEmail) return Alert.alert('Validation Error', 'Email address is required.');
    if (!cleanPass) return Alert.alert('Validation Error', 'Password is required.');
    if (cleanPass.length < 8) {
      return Alert.alert('Weak Password', 'Password must be at least 8 characters long.');
    }

    if (signupRole === 'owner') {
      if (!cleanHomestay) return Alert.alert('Validation Error', 'Homestay name is required.');
    } else {
      if (!cleanPlate) return Alert.alert('Validation Error', 'Vehicle plate number is required.');
      if (!cleanArea) return Alert.alert('Validation Error', 'Please enter the area where you drive.');
    }

    if (!isSignUpLoaded || !signUp) {
      Alert.alert('Please Wait', 'Authentication service is initializing...');
      return;
    }

    setLoading(true);
    try {
      const metadata =
        signupRole === 'owner'
          ? {
              phone: cleanPhone,
              role: 'owner',
              homestayName: cleanHomestay,
              location: cleanLocation,
              latitude: coords?.latitude,
              longitude: coords?.longitude,
              mapQuery: coords ? `${coords.latitude},${coords.longitude}` : cleanLocation,
            }
          : {
              phone: cleanPhone,
              role: 'driver',
              vehicleType,
              vehicleNumber: cleanPlate,
              area: cleanArea,
            };

      const result = await signUp.create({
        emailAddress: cleanEmail,
        password: cleanPass,
        firstName: cleanName,
        unsafeMetadata: metadata,
      });

      if (result.status === 'complete') {
        if (setActive) {
          await setActive({ session: result.createdSessionId });
        }
      } else if (
        result.status === 'missing_requirements' ||
        result.unverifiedFields?.includes('email_address')
      ) {
        // Send email OTP verification code
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setAuthMode('verify');
        Alert.alert(
          'Verification Code Sent',
          `We sent a 6-digit confirmation code to ${cleanEmail}. Please enter it to complete setup.`
        );
      } else {
        console.warn('Unhandled sign-up status:', result.status);
      }
    } catch (err: any) {
      console.error('Clerk SignUp error:', err);
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        'Could not create account. Please verify your details.';
      Alert.alert('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  // Verify Email OTP Code
  const handleVerifyCode = async () => {
    const cleanCode = verificationCode.trim();
    if (!cleanCode) {
      Alert.alert('Verification', 'Please enter the 6-digit verification code.');
      return;
    }

    if (!isSignUpLoaded || !signUp) return;

    setLoading(true);
    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code: cleanCode,
      });

      if (completeSignUp.status === 'complete') {
        if (setActive) {
          await setActive({ session: completeSignUp.createdSessionId });
        }
      } else {
        Alert.alert('Verification Incomplete', 'Code could not be verified. Please check and retry.');
      }
    } catch (err: any) {
      console.error('Clerk verify error:', err);
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        'Invalid or expired code.';
      Alert.alert('Verification Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP Code
  const handleResendCode = async () => {
    if (!signUp) return;
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      Alert.alert('Code Resent', 'A new verification code was sent to your email.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not resend verification code.');
    }
  };

  const topPad = Math.max(insets.top, Platform.OS === 'android' ? 24 : 16) + 12;
  const bottomPad = Math.max(insets.bottom, 24);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      // Android 15+ is edge-to-edge: the system no longer resizes the window, so the view must
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: topPad, paddingBottom: bottomPad },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.headerBox}>
          <View style={styles.badgeRow}>
            <View style={styles.mountainIconWrap}>
              <Ionicons name="business" size={24} color={Colors.brandPrimary} />
            </View>
          </View>
          <Text style={styles.brandTitle}>StayRide</Text>
          <Text style={styles.subtitle}>Homestay Management & Mountain Mobility</Text>
        </View>

        {/* Auth Card */}
        <View style={styles.card}>
          {authMode === 'verify' ? (
            /* EMAIL VERIFICATION SCREEN */
            <View>
              <View style={styles.verifyIconBox}>
                <Ionicons name="mail-unread-outline" size={42} color={Colors.brandPrimary} />
              </View>
              <Text style={styles.verifyTitle}>Verify your email</Text>
              <Text style={styles.verifySubtitle}>
                We sent a 6-digit confirmation code to{' '}
                <Text style={{ fontWeight: 'bold', color: Colors.textPrimary }}>{email.trim()}</Text>
              </Text>

              <Text style={styles.label}>Verification Code</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={6}
                value={verificationCode}
                onChangeText={setVerificationCode}
                placeholderTextColor={Colors.textSecondary}
                autoFocus
              />

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleVerifyCode}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.submitBtnText}>Verify & Launch StayRide</Text>
                )}
              </TouchableOpacity>

              <View style={styles.verifyActionsRow}>
                <TouchableOpacity onPress={handleResendCode} activeOpacity={0.7}>
                  <Text style={styles.resendText}>Resend code</Text>
                </TouchableOpacity>
                <Text style={{ color: Colors.textSecondary }}>•</Text>
                <TouchableOpacity onPress={() => setAuthMode('signup')} activeOpacity={0.7}>
                  <Text style={styles.resendText}>Edit info</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* SIGN IN & SIGN UP SCREENS */
            <View>
              {/* Google OAuth Button */}
              <TouchableOpacity
                style={styles.googleBtn}
                onPress={handleGoogleAuth}
                disabled={googleLoading || loading || !clerkReady}
                activeOpacity={0.8}
              >
                {googleLoading || !clerkReady ? (
                  <ActivityIndicator size="small" color={Colors.brandPrimary} />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={18} color="#EA4335" style={{ marginRight: 10 }} />
                    <Text style={styles.googleBtnText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Or Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or with password</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Mode Switcher Tabs */}
              <View style={styles.tabContainer}>
                <TouchableOpacity
                  style={[styles.tabBtn, authMode === 'signin' && styles.tabBtnActive]}
                  onPress={() => setAuthMode('signin')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.tabBtnText,
                      authMode === 'signin' && styles.tabBtnTextActive,
                    ]}
                  >
                    Sign In
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabBtn, authMode === 'signup' && styles.tabBtnActive]}
                  onPress={() => setAuthMode('signup')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.tabBtnText,
                      authMode === 'signup' && styles.tabBtnTextActive,
                    ]}
                  >
                    Create Account
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Signup Role Switcher */}
              {authMode === 'signup' && (
                <View style={styles.roleSelectorRow}>
                  <TouchableOpacity
                    style={[styles.roleSelectBtn, signupRole === 'owner' && styles.roleSelectBtnActive]}
                    onPress={() => setSignupRole('owner')}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="home"
                      size={16}
                      color={signupRole === 'owner' ? Colors.brandPrimaryDark : Colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.roleSelectText,
                        signupRole === 'owner' && styles.roleSelectTextActive,
                      ]}
                    >
                      Homestay Host
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.roleSelectBtn, signupRole === 'driver' && styles.roleSelectBtnActiveDriver]}
                    onPress={() => setSignupRole('driver')}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="car"
                      size={16}
                      color={signupRole === 'driver' ? '#2563EB' : Colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.roleSelectText,
                        signupRole === 'driver' && styles.roleSelectTextActiveDriver,
                      ]}
                    >
                      Cab Driver
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Signup Fields for Homestay Host */}
              {authMode === 'signup' && signupRole === 'owner' && (
                <>
                  <Text style={styles.label}>Owner Full Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Karma Bhutia"
                    value={name}
                    onChangeText={setName}
                    placeholderTextColor={Colors.textSecondary}
                  />

                  <Text style={styles.label}>Contact Phone</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="+91 98000 00000"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                    placeholderTextColor={Colors.textSecondary}
                  />

                  <Text style={styles.label}>Homestay Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Pine Ridge Homestay"
                    value={homestayName}
                    onChangeText={setHomestayName}
                    placeholderTextColor={Colors.textSecondary}
                  />

                  <Text style={styles.label}>Homestay Location / Town</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Upper Sichey, Gangtok, Sikkim"
                    value={location}
                    onChangeText={setLocation}
                    placeholderTextColor={Colors.textSecondary}
                  />

                  <TouchableOpacity
                    style={styles.gpsDetectBtn}
                    onPress={handleDetectGPS}
                    disabled={locating}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="navigate-circle" size={18} color="#2563EB" style={{ marginRight: 6 }} />
                    <Text style={styles.gpsDetectBtnText}>
                      {locating ? 'Acquiring GPS Satellite Pin…' : '📍 Auto-Pin Homestay Live GPS Location'}
                    </Text>
                  </TouchableOpacity>

                  {coords && (
                    <View style={styles.gpsBadge}>
                      <Ionicons name="location" size={14} color="#16A34A" style={{ marginRight: 4 }} />
                      <Text style={styles.gpsBadgeText}>
                        GPS: {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)} (Pinned on Google Maps)
                      </Text>
                    </View>
                  )}
                </>
              )}

              {/* Signup Fields for Cab Driver */}
              {authMode === 'signup' && signupRole === 'driver' && (
                <>
                  <Text style={styles.label}>Driver Full Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Pemba Lepcha"
                    value={name}
                    onChangeText={setName}
                    placeholderTextColor={Colors.textSecondary}
                  />

                  <Text style={styles.label}>Driver Phone Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="+91 98000 11223"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                    placeholderTextColor={Colors.textSecondary}
                  />

                  <Text style={styles.label}>Vehicle Type</Text>
                  <View style={styles.vehicleTypeRow}>
                    {(['SUV', 'Sedan', '7-seater', '9-seater'] as const).map((v) => (
                      <TouchableOpacity
                        key={v}
                        style={[styles.vehicleChip, vehicleType === v && styles.vehicleChipActive]}
                        onPress={() => setVehicleType(v)}
                      >
                        <Text style={[styles.vehicleChipText, vehicleType === v && styles.vehicleChipTextActive]}>
                          {vehicleLabel(v)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.label}>Vehicle Plate / Reg Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. SK-01-A-4488"
                    autoCapitalize="characters"
                    value={vehicleNumber}
                    onChangeText={setVehicleNumber}
                    placeholderTextColor={Colors.textSecondary}
                  />

                  <Text style={styles.label}>Operating Area *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Gangtok & North Sikkim"
                    value={area}
                    onChangeText={setArea}
                    placeholderTextColor={Colors.textSecondary}
                  />
                </>
              )}

              {/* Common Credentials */}
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder={signupRole === 'driver' ? 'driver@stayride.in' : 'host@stayride.in'}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                placeholderTextColor={Colors.textSecondary}
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                placeholderTextColor={Colors.textSecondary}
              />

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitBtn, loading && { opacity: 0.6 }]}
                onPress={authMode === 'signin' ? handleEmailSignIn : handleEmailSignUp}
                disabled={loading || googleLoading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {authMode === 'signin'
                      ? 'Sign In to StayRide'
                      : signupRole === 'owner'
                      ? 'Create Homestay Account'
                      : 'Register as Cab Driver'}
                  </Text>
                )}
              </TouchableOpacity>

              {DEMO_ENABLED && authMode === 'signin' && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <TouchableOpacity
                    style={[styles.submitBtn, { flex: 1, backgroundColor: '#F1F5F9' }]}
                    disabled={loading}
                    onPress={() => handleDemoLogin('demo@stayride.in')}
                  >
                    <Text style={[styles.submitBtnText, { color: '#475569' }]}>Demo Host</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitBtn, { flex: 1, backgroundColor: '#F1F5F9' }]}
                    disabled={loading}
                    onPress={() => handleDemoLogin('driver@stayride.in')}
                  >
                    <Text style={[styles.submitBtnText, { color: '#475569' }]}>Demo Driver</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Google OAuth Multi-Step Onboarding Modal */}
        <Modal visible={showRoleSelectModal} transparent animationType="fade">
          <KeyboardAwareOverlay style={styles.modalOverlay}>
            <View style={[styles.modalCard, googleOnboardingStep === 'details' && { maxHeight: '88%' }]}>
              {googleOnboardingStep === 'role' ? (
                <>
                  <View style={styles.modalHeaderIcon}>
                    <Ionicons name="sparkles" size={28} color="#2563EB" />
                  </View>
                  <Text style={styles.modalTitle}>Welcome to StayRide!</Text>
                  <Text style={styles.modalSubtitle}>
                    Choose how you want to use StayRide with your account:
                  </Text>

                  <TouchableOpacity
                    style={styles.modalChoiceCard}
                    onPress={() => handleStartGoogleOnboarding('owner')}
                  >
                    <View style={styles.modalChoiceIconWrap}>
                      <Ionicons name="home" size={24} color="#0F172A" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalChoiceTitle}>Homestay Host / Owner</Text>
                      <Text style={styles.modalChoiceDesc}>
                        Manage rooms, bookings, guests, and dispatch mountain cabs for homestay riders.
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalChoiceCard, { borderColor: '#BFDBFE', backgroundColor: '#F0F9FF' }]}
                    onPress={() => handleStartGoogleOnboarding('driver')}
                  >
                    <View style={[styles.modalChoiceIconWrap, { backgroundColor: '#DBEAFE' }]}>
                      <Ionicons name="car" size={24} color="#2563EB" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modalChoiceTitle, { color: '#1E40AF' }]}>Cab Driver / Operator</Text>
                      <Text style={styles.modalChoiceDesc}>
                        Receive nearby ride requests, quote fares, navigate routes, and collect cash.
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#2563EB" />
                  </TouchableOpacity>
                </>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 10 }}>
                  <TouchableOpacity
                    style={styles.onboardingBackBtn}
                    onPress={() => setGoogleOnboardingStep('role')}
                  >
                    <Ionicons name="arrow-back" size={16} color="#64748B" style={{ marginRight: 4 }} />
                    <Text style={styles.onboardingBackText}>Back to Role Selection</Text>
                  </TouchableOpacity>

                  <Text style={styles.modalTitle}>
                    {googleRole === 'owner' ? 'Homestay Host Details' : 'Driver & Vehicle Details'}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {googleRole === 'owner'
                      ? 'Add your phone, property name, and pin your mountain GPS.'
                      : 'Add your WhatsApp contact and vehicle registration plate.'}
                  </Text>

                  {/* Contact Phone (Required for both) */}
                  <Text style={styles.label}>WhatsApp / Phone Number *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="+91 98000 11223"
                    keyboardType="phone-pad"
                    value={googlePhone}
                    onChangeText={setGooglePhone}
                    placeholderTextColor={Colors.textSecondary}
                  />

                  {googleRole === 'owner' ? (
                    <>
                      <Text style={styles.label}>Homestay / Property Name *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Kanchenjunga View Homestay"
                        value={googleHomestayName}
                        onChangeText={setGoogleHomestayName}
                        placeholderTextColor={Colors.textSecondary}
                      />

                      <Text style={styles.label}>Location / Village / Town</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Upper Pelling, West Sikkim"
                        value={googleLocation}
                        onChangeText={setGoogleLocation}
                        placeholderTextColor={Colors.textSecondary}
                      />

                      <View style={{ marginTop: 8, marginBottom: 12 }}>
                        <TouchableOpacity
                          style={styles.gpsDetectBtn}
                          onPress={handleDetectGPS}
                          disabled={locating}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="navigate-circle" size={18} color="#2563EB" style={{ marginRight: 6 }} />
                          <Text style={styles.gpsDetectBtnText}>
                            {locating ? 'Detecting Satellite GPS…' : '📍 Auto-Detect Live GPS'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.gpsDetectBtn, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', marginTop: 8 }]}
                          onPress={() => setShowGpsModal(true)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="map" size={18} color="#16A34A" style={{ marginRight: 6 }} />
                          <Text style={[styles.gpsDetectBtnText, { color: '#15803D' }]}>
                            {coords ? `📍 Calibrate Mountain Pin (${coords.latitude.toFixed(4)}°, ${coords.longitude.toFixed(4)}°)` : '📍 Calibrate Pin & Google Map'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.label}>Vehicle Type</Text>
                      <View style={styles.vehicleTypeRow}>
                        {(['SUV', 'Sedan', '7-seater', '9-seater'] as const).map((v) => (
                          <TouchableOpacity
                            key={v}
                            style={[styles.vehicleChip, googleVehicleType === v && styles.vehicleChipActive]}
                            onPress={() => setGoogleVehicleType(v)}
                          >
                            <Text style={[styles.vehicleChipText, googleVehicleType === v && styles.vehicleChipTextActive]}>
                              {vehicleLabel(v)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text style={styles.label}>Vehicle Plate / Reg Number *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. SK-01-A-4488"
                        autoCapitalize="characters"
                        value={googleVehicleNumber}
                        onChangeText={setGoogleVehicleNumber}
                        placeholderTextColor={Colors.textSecondary}
                      />

                      <Text style={styles.label}>Operating Area *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Gangtok & North Sikkim"
                        value={googleArea}
                        onChangeText={setGoogleArea}
                        placeholderTextColor={Colors.textSecondary}
                      />
                    </>
                  )}

                  <TouchableOpacity
                    style={[styles.submitBtn, { marginTop: 14 }]}
                    onPress={handleCompleteGoogleOnboarding}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.submitBtnText}>Complete Setup & Enter StayRide</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </KeyboardAwareOverlay>
        </Modal>

        {/* Mountain GPS Fine-Tuner & Pin Modal */}
        <Modal visible={showGpsModal} transparent animationType="slide">
          <KeyboardAwareOverlay style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxWidth: 420 }]}>
              <View style={[styles.modalHeaderIcon, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="location" size={28} color="#16A34A" />
              </View>
              <Text style={styles.modalTitle}>Mountain GPS Calibration</Text>
              <Text style={styles.modalSubtitle}>
                Signals drift in mountain valleys. Use D-Pad controls or open in Google Maps to drop your exact gate pin.
              </Text>

              {/* Coordinates Readout */}
              <View style={styles.coordsBox}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.coordsBoxTitle}>Latitude</Text>
                  <Text style={styles.coordsBoxVal}>{calibratingCoords.latitude.toFixed(5)}° N</Text>
                </View>
                <View style={{ width: 1, backgroundColor: '#CBD5E1', marginHorizontal: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.coordsBoxTitle}>Longitude</Text>
                  <Text style={styles.coordsBoxVal}>{calibratingCoords.longitude.toFixed(5)}° E</Text>
                </View>
              </View>

              {/* Fine-Tuning D-Pad */}
              <View style={styles.dpadBox}>
                <Text style={styles.dpadLabel}>Nudge Pin (~50m Offset):</Text>
                <View style={{ alignItems: 'center', marginTop: 8 }}>
                  <TouchableOpacity
                    style={styles.dpadBtn}
                    onPress={() => handleNudgeCoords(0.00045, 0)}
                  >
                    <Ionicons name="chevron-up" size={18} color="#1E293B" />
                    <Text style={styles.dpadBtnText}>North</Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', gap: 16, marginVertical: 6, alignItems: 'center' }}>
                    <TouchableOpacity
                      style={styles.dpadBtn}
                      onPress={() => handleNudgeCoords(0, -0.0005)}
                    >
                      <Ionicons name="chevron-back" size={18} color="#1E293B" />
                      <Text style={styles.dpadBtnText}>West</Text>
                    </TouchableOpacity>

                    <View style={styles.dpadPinCenter}>
                      <Ionicons name="pin" size={24} color="#EF4444" />
                    </View>

                    <TouchableOpacity
                      style={styles.dpadBtn}
                      onPress={() => handleNudgeCoords(0, 0.0005)}
                    >
                      <Ionicons name="chevron-forward" size={18} color="#1E293B" />
                      <Text style={styles.dpadBtnText}>East</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.dpadBtn}
                    onPress={() => handleNudgeCoords(-0.00045, 0)}
                  >
                    <Ionicons name="chevron-down" size={18} color="#1E293B" />
                    <Text style={styles.dpadBtnText}>South</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Open in Google Maps */}
              <TouchableOpacity
                style={styles.googleMapsBtn}
                onPress={handleOpenGoogleMaps}
                activeOpacity={0.8}
              >
                <Ionicons name="navigate" size={16} color="#1D4ED8" style={{ marginRight: 6 }} />
                <Text style={styles.googleMapsBtnText}>Verify Pin on Google Maps</Text>
              </TouchableOpacity>

              {/* Actions */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  style={[styles.submitBtn, { flex: 1, backgroundColor: '#F1F5F9' }]}
                  onPress={() => setShowGpsModal(false)}
                >
                  <Text style={[styles.submitBtnText, { color: '#475569' }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, { flex: 2 }]}
                  onPress={handleConfirmCalibratedCoords}
                >
                  <Text style={styles.submitBtnText}>Confirm Coordinates</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAwareOverlay>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPage,
  },
  scrollContent: {
    paddingHorizontal: 20,
    justifyContent: 'center',
    flexGrow: 1, // grows to center short forms, but scrolls instead of overflowing when the keyboard is up
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 20,
  },
  badgeRow: {
    marginBottom: 10,
  },
  mountainIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.brandPrimaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.brandPrimaryDark,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.card,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Shadows.card,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radii.button,
    paddingVertical: 13,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.divider,
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.bgPage,
    borderRadius: Radii.button,
    padding: 3,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: Radii.button - 2,
  },
  tabBtnActive: {
    backgroundColor: Colors.white,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabBtnTextActive: {
    color: Colors.brandPrimaryDark,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 5,
    marginTop: 10,
  },
  input: {
    backgroundColor: Colors.bgPage,
    borderRadius: Radii.button,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  codeInput: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: 14,
  },
  submitBtn: {
    backgroundColor: Colors.brandPrimary,
    borderRadius: Radii.button,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    ...Shadows.hover,
  },
  submitBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: 'bold',
  },
  verifyIconBox: {
    alignItems: 'center',
    marginBottom: 12,
  },
  verifyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  verifySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 18,
  },
  verifyActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  resendText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.brandPrimary,
  },
  roleSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  roleSelectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  roleSelectBtnActive: {
    borderColor: Colors.brandPrimaryDark,
    backgroundColor: '#EFF6FF',
  },
  roleSelectBtnActiveDriver: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  roleSelectText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  roleSelectTextActive: {
    color: Colors.brandPrimaryDark,
    fontWeight: '700',
  },
  roleSelectTextActiveDriver: {
    color: '#2563EB',
    fontWeight: '700',
  },
  vehicleTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  vehicleChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  vehicleChipActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  vehicleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  vehicleChipTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    ...Shadows.md,
  },
  modalHeaderIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 18,
    lineHeight: 18,
  },
  modalChoiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  modalChoiceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalChoiceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalChoiceDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  gpsDetectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  gpsDetectBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  gpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
  },
  gpsBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#15803D',
  },
  onboardingBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  onboardingBackText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  coordsBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  coordsBoxTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  coordsBoxVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  dpadBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dpadLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  dpadBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
    ...Shadows.sm,
  },
  dpadBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
  },
  dpadPinCenter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  googleMapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 12,
  },
  googleMapsBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
  },
});
