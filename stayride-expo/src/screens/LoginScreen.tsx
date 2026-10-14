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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useOAuth, useUser, useClerk } from '@clerk/expo';
import { useSignIn, useSignUp } from '@clerk/expo/legacy';

import { Colors, Radii, Shadows } from '../theme/colors';
import { useStayRide } from '../data/store';

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
  const clerk = useClerk();

  // Mode: 'signin' | 'signup' | 'verify'
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'verify'>('signin');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [homestayName, setHomestayName] = useState('');
  const [location, setLocation] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  // Sync state tracking to prevent duplicate MongoDB sync runs
  const hasSyncedRef = useRef(false);

  // Synchronize Clerk user with MongoDB Atlas whenever a user is authenticated
  useEffect(() => {
    if (isSignedIn && user && !hasSyncedRef.current) {
      hasSyncedRef.current = true;
      setLoading(true);

      const homestayMeta =
        (user.unsafeMetadata?.homestayName as string) ||
        homestayName.trim() ||
        `${user.firstName || 'My'} Homestay`;
      const locationMeta =
        (user.unsafeMetadata?.location as string) || location.trim() || 'Gangtok, Sikkim';
      const phoneMeta =
        (user.unsafeMetadata?.phone as string) || phone.trim() || '';

      syncClerkUser(user, undefined, {
        homestayName: homestayMeta,
        location: locationMeta,
        phone: phoneMeta,
        name: user.fullName || user.firstName || name.trim() || 'Host',
      })
        .then(() => {
          setLoading(false);
          navigation.replace('MainTabs');
        })
        .catch((err) => {
          hasSyncedRef.current = false;
          setLoading(false);
          console.error('[StayRide] Clerk MongoDB sync failed:', err);
          Alert.alert(
            'Sync Warning',
            'Signed in to Clerk, but database sync had an issue. Continuing to workspace.',
            [{ text: 'Continue', onPress: () => navigation.replace('MainTabs') }]
          );
        });
    }
  }, [isSignedIn, user, homestayName, location, phone, name, navigation, syncClerkUser]);

  // Google OAuth Flow with Clerk
  const handleGoogleAuth = useCallback(async () => {
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
  }, [startOAuthFlow, setActive]);

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

    // Direct bypass for Demo Account
    if (cleanEmail.toLowerCase() === 'demo@stayride.in') {
      setLoading(true);
      try {
        await login(cleanEmail, cleanPass);
        navigation.replace('MainTabs');
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

    if (!cleanName) return Alert.alert('Validation Error', 'Your name is required.');
    if (!cleanPhone) return Alert.alert('Validation Error', 'Phone number is required.');
    if (!cleanHomestay) return Alert.alert('Validation Error', 'Homestay name is required.');
    if (!cleanEmail) return Alert.alert('Validation Error', 'Email address is required.');
    if (!cleanPass) return Alert.alert('Validation Error', 'Password is required.');
    if (cleanPass.length < 8) {
      return Alert.alert('Weak Password', 'Password must be at least 8 characters long.');
    }

    if (!isSignUpLoaded || !signUp) {
      Alert.alert('Please Wait', 'Authentication service is initializing...');
      return;
    }

    setLoading(true);
    try {
      const result = await signUp.create({
        emailAddress: cleanEmail,
        password: cleanPass,
        firstName: cleanName,
        unsafeMetadata: {
          phone: cleanPhone,
          homestayName: cleanHomestay,
          location: cleanLocation || 'Gangtok, Sikkim',
        },
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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: topPad, paddingBottom: bottomPad },
        ]}
        keyboardShouldPersistTaps="handled"
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
                disabled={googleLoading || loading}
                activeOpacity={0.8}
              >
                {googleLoading ? (
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

              {/* Signup Additional Fields */}
              {authMode === 'signup' && (
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

                  <Text style={styles.label}>Location / Town</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Gangtok, Sikkim"
                    value={location}
                    onChangeText={setLocation}
                    placeholderTextColor={Colors.textSecondary}
                  />
                </>
              )}

              {/* Common Credentials */}
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="host@stayride.in"
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
                style={styles.submitBtn}
                onPress={authMode === 'signin' ? handleEmailSignIn : handleEmailSignUp}
                disabled={loading || googleLoading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {authMode === 'signin' ? 'Sign In to StayRide' : 'Create Homestay Account'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
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
    minHeight: '100%',
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
});
