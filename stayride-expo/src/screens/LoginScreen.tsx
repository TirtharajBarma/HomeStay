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
import * as Linking from 'expo-linking';
import { useOAuth, useUser, useAuth } from '@clerk/expo';
import { useSignIn, useSignUp } from '@clerk/expo/legacy';

import { Colors, Radii, Shadows } from '../theme/colors';
import { useStayRide } from '../data/store';
import { api, DEMO_ENABLED } from '../data/api';
import { vehicleOptions } from '../utils/vehicle';
import { PlatformSelect } from '../components/PlatformSelect';
import { LocationPicker, PickedLocation } from '../components/LocationPicker';
import { LegalScreen, LegalDoc } from './LegalScreen';
import { VehicleType } from '../types';

// Complete any pending auth session (required for Clerk OAuth in Expo)
WebBrowser.maybeCompleteAuthSession();

const useWarmUpBrowser = () => {
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
};

type Role = 'owner' | 'driver';
type Mode = 'signin' | 'signup' | 'verify' | 'reset';
const STEP_TITLES = ['I am joining as', 'Your details', 'Create your login'] as const;

/** What a new account is registered with (sent to the server on first sign-in) */
interface Profile {
  role: Role;
  name: string;
  phone: string;
  homestayName?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  mapQuery?: string;
  vehicleType?: string;
  vehicleNumber?: string;
  area?: string;
  acceptedTerms: true;
}

const GoogleButton: React.FC<{ label: string; onPress: () => void; busy: boolean; loading: boolean }> = ({ label, onPress, busy, loading }) => (
  <TouchableOpacity style={[styles.googleBtn, busy && styles.dim]} onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityLabel={label}>
    {loading ? <ActivityIndicator color={Colors.textPrimary} /> : <Ionicons name="logo-google" size={18} color="#DB4437" />}
    <Text style={styles.googleText}>{label}</Text>
  </TouchableOpacity>
);

const PrimaryButton: React.FC<{ label: string; onPress: () => void; busy: boolean; loading: boolean }> = ({ label, onPress, busy, loading }) => (
  <TouchableOpacity style={[styles.primaryBtn, busy && styles.dim]} onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityLabel={label}>
    {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryText}>{label}</Text>}
  </TouchableOpacity>
);

const clerkMessage = (err: any, fallback: string) =>
  err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || fallback;

/** A profile saved on the Clerk account at email sign-up (survives the verification step). */
const profileFromMetadata = (meta: any): Profile | null =>
  meta && (meta.role === 'owner' || meta.role === 'driver') && meta.acceptedTerms === true ? (meta as Profile) : null;

/**
 * Sign in / create account for homestay owners and drivers.
 * - Create account: choose the role first, fill the details, accept the terms, then use Google or email.
 * - Sign in: Google or email. A Google account that is not registered yet is guided through the
 *   same registration (role + details + consent); a role is never guessed.
 * The server decides whether an account exists (POST /auth/clerk-status), not cached metadata.
 */
export const LoginScreen: React.FC = () => {
  useWarmUpBrowser();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { login, syncClerkUser } = useStayRide();

  const { isLoaded: isSignInLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: isSignUpLoaded, signUp } = useSignUp();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const { user, isSignedIn } = useUser();
  const { isLoaded: isAuthLoaded, getToken, signOut } = useAuth();
  const clerkReady = isAuthLoaded && isSignInLoaded && isSignUpLoaded;

  const [mode, setMode] = useState<Mode>('signin');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [resetStage, setResetStage] = useState<'request' | 'confirm'>('request');
  const [newPassword, setNewPassword] = useState('');

  // Registration details (shared by "Create account" and the Google finish-setup sheet)
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [homestayName, setHomestayName] = useState('');
  const [location, setLocation] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType>('SUV');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [area, setArea] = useState('');
  const [consent, setConsent] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  // Create account runs in short steps: 1 role, 2 details, 3 consent + login (the Google sheet: 1, 2)
  const [step, setStep] = useState(1);
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);

  // A Google account with no StayRide account yet: finish registration in a sheet
  const [finishVisible, setFinishVisible] = useState(false);

  // Profile to register with when the Clerk session becomes active (set by the Create account flows)
  const pendingProfile = useRef<Profile | null>(null);
  const syncing = useRef(false);

  const detailsError = (): string | null => {
    if (!role) return 'Choose whether you are a homestay owner or a cab driver.';
    if (!name.trim()) return 'Your full name is required.';
    if (phone.replace(/\D/g, '').length < 10) return 'Enter a 10-digit mobile number.';
    if (role === 'owner' && !homestayName.trim()) return 'Your homestay name is required.';
    if (role === 'driver' && !vehicleNumber.trim()) return 'Your vehicle number is required.';
    if (role === 'driver' && !area.trim()) return 'Enter the area where you drive.';
    return null;
  };
  const validateProfile = (): string | null =>
    detailsError() || (!consent ? 'Please confirm you are 18+ and accept the Terms and Privacy Policy.' : null);

  const goStep = (next: number) => {
    const error = next === 2 && !role ? 'Choose how you will use StayRide.' : next === 3 ? detailsError() : null;
    if (error) return Alert.alert('Almost there', error);
    setStep(next);
  };

  const buildProfile = (): Profile => ({
    role: role as Role,
    name: name.trim(),
    phone: phone.trim(),
    ...(role === 'owner'
      ? {
          homestayName: homestayName.trim(),
          location: location.trim(),
          latitude: coords?.latitude,
          longitude: coords?.longitude,
          mapQuery: coords ? `${coords.latitude},${coords.longitude}` : location.trim(),
        }
      : { vehicleType, vehicleNumber: vehicleNumber.trim().toUpperCase(), area: area.trim() }),
    acceptedTerms: true,
  });

  // ---------------------------------------------------------------------------
  // After Clerk signs someone in: sign into StayRide, or register them properly
  // ---------------------------------------------------------------------------
  const finishSignIn = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Could not get your sign-in session. Please try again.');
      const status = await api.post('/auth/clerk-status', {}, token);
      if (status?.role === 'admin') {
        await signOut().catch(() => {});
        syncing.current = false;
        Alert.alert('Use the admin website', 'Administrator accounts sign in on the StayRide web control panel, not in the app.');
        return;
      }
      if (status?.exists) {
        if (status.blocked) {
          await signOut().catch(() => {});
          syncing.current = false;
          Alert.alert(status.deleted ? 'Account deleted' : 'Account blocked', status.deleted ? 'This account was deleted. Contact StayRide support if this is a mistake.' : 'This account is blocked. Contact StayRide support.');
          return;
        }
        const wasCreating = Boolean(pendingProfile.current);
        await syncClerkUser(user, token, { role: status.role });
        pendingProfile.current = null;
        navigation.replace('Main');
        if (wasCreating) Alert.alert('Welcome back', 'You already had a StayRide account, so we signed you in.');
        return;
      }
      const profile = pendingProfile.current ?? profileFromMetadata(user.unsafeMetadata);
      if (profile) {
        await syncClerkUser(user, token, profile);
        pendingProfile.current = null;
        navigation.replace('Main');
        return;
      }
      // New Google sign-in from the Sign in tab: collect role + details + consent first
      setName((n) => n || user.fullName || user.firstName || '');
      setPhone((p) => p || user.primaryPhoneNumber?.phoneNumber || '');
      setRole(null);
      setConsent(false);
      setStep(1);
      setFinishVisible(true);
    } catch (err: any) {
      await signOut().catch(() => {});
      syncing.current = false;
      pendingProfile.current = null;
      Alert.alert('Sign in failed', clerkMessage(err, 'Could not connect your account to StayRide. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [user, getToken, signOut, syncClerkUser, navigation]);

  useEffect(() => {
    if (isSignedIn && user && !syncing.current) {
      syncing.current = true;
      finishSignIn();
    }
  }, [isSignedIn, user, finishSignIn]);

  const completeFinishSetup = async () => {
    const error = validateProfile();
    if (error) return Alert.alert('Almost there', error);
    if (!user) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Your sign-in expired. Please sign in again.');
      const profile = buildProfile();
      await user.update({ unsafeMetadata: { ...(user.unsafeMetadata || {}), ...profile } }).catch(() => {});
      await syncClerkUser(user, token, profile);
      setFinishVisible(false);
      navigation.replace('Main');
    } catch (err: any) {
      Alert.alert('Could not create your account', clerkMessage(err, 'Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const cancelFinishSetup = async () => {
    setFinishVisible(false);
    await signOut().catch(() => {});
    syncing.current = false;
  };

  // ---------------------------------------------------------------------------
  // Google
  // ---------------------------------------------------------------------------
  const startGoogle = async (forProfile: Profile | null) => {
    if (!clerkReady) return Alert.alert('Please wait', 'Sign-in is still starting. Try again in a moment.');
    pendingProfile.current = forProfile;
    setGoogleLoading(true);
    try {
      const redirectUrl = Linking.createURL('/dashboard', { scheme: 'stayride' });
      const { createdSessionId, setActive: setOAuthActive } = await startOAuthFlow({ redirectUrl });
      const activate = setOAuthActive || setActive;
      if (createdSessionId && activate) await activate({ session: createdSessionId }); // finishSignIn runs next
    } catch (err: any) {
      pendingProfile.current = null;
      Alert.alert('Google sign-in', clerkMessage(err, 'Could not complete Google sign-in.'));
    } finally {
      setGoogleLoading(false);
    }
  };

  const signUpWithGoogle = () => {
    const error = validateProfile();
    if (error) return Alert.alert('Almost there', error);
    startGoogle(buildProfile());
  };

  // ---------------------------------------------------------------------------
  // Email & password
  // ---------------------------------------------------------------------------
  const demoLogin = async (demoEmail: string) => {
    setLoading(true);
    try {
      await login(demoEmail, 'demo123');
      navigation.replace('Main');
    } catch (err: any) {
      Alert.alert('Demo login error', err?.message || 'Could not open the demo.');
    } finally {
      setLoading(false);
    }
  };

  const emailSignIn = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) return Alert.alert('Sign in', 'Enter your email and password.');
    if (DEMO_ENABLED && ['demo@stayride.in', 'driver@stayride.in', 'demo-driver@stayride.in'].includes(cleanEmail.toLowerCase())) {
      return demoLogin(cleanEmail);
    }
    if (!isSignInLoaded || !signIn) return Alert.alert('Please wait', 'Sign-in is still starting.');
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: cleanEmail, password });
      if (result.status === 'complete' && setActive) await setActive({ session: result.createdSessionId });
      else Alert.alert('Sign in', `Additional verification required (${result.status}).`);
    } catch (err: any) {
      // Accounts created before Clerk exist only in StayRide: fall back to its own login
      if (err?.errors?.[0]?.code === 'form_identifier_not_found') {
        try {
          await login(cleanEmail, password);
          navigation.replace('Main');
        } catch (legacyErr: any) {
          Alert.alert('Sign in failed', legacyErr?.message || 'Invalid email or password.');
        }
        return;
      }
      Alert.alert('Sign in failed', clerkMessage(err, 'Invalid email or password.'));
    } finally {
      setLoading(false);
    }
  };

  const emailSignUp = async () => {
    const error = validateProfile();
    if (error) return Alert.alert('Almost there', error);
    if (!email.trim()) return Alert.alert('Create account', 'Enter your email address.');
    if (password.length < 8) return Alert.alert('Weak password', 'Use at least 8 characters.');
    if (!isSignUpLoaded || !signUp) return Alert.alert('Please wait', 'Sign-in is still starting.');
    const profile = buildProfile();
    pendingProfile.current = profile;
    setLoading(true);
    try {
      const result = await signUp.create({ emailAddress: email.trim(), password, firstName: profile.name, unsafeMetadata: profile as any });
      if (result.status === 'complete' && setActive) {
        await setActive({ session: result.createdSessionId });
      } else if (result.status === 'missing_requirements' || result.unverifiedFields?.includes('email_address')) {
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setCode('');
        setMode('verify');
      }
    } catch (err: any) {
      pendingProfile.current = null;
      Alert.alert('Could not create account', clerkMessage(err, 'Please check your details.'));
    } finally {
      setLoading(false);
    }
  };

  const verifyEmail = async () => {
    if (!code.trim()) return Alert.alert('Verify email', 'Enter the 6-digit code.');
    if (!signUp) return;
    setLoading(true);
    try {
      const done = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (done.status === 'complete' && setActive) await setActive({ session: done.createdSessionId });
      else Alert.alert('Not verified', 'The code could not be verified. Please check it and try again.');
    } catch (err: any) {
      Alert.alert('Not verified', clerkMessage(err, 'Invalid or expired code.'));
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    try {
      await signUp?.prepareEmailAddressVerification({ strategy: 'email_code' });
      Alert.alert('Code sent', 'A new code is on its way to your email.');
    } catch (err: any) {
      Alert.alert('Could not resend', clerkMessage(err, 'Please try again.'));
    }
  };

  // Forgot password: a code by email, then a new password
  const requestReset = async () => {
    if (!email.trim()) return Alert.alert('Reset password', 'Enter your account email.');
    if (!signIn) return;
    setLoading(true);
    try {
      await signIn.create({ strategy: 'reset_password_email_code', identifier: email.trim() } as any);
      setResetStage('confirm');
      setCode('');
    } catch (err: any) {
      Alert.alert('Could not send code', clerkMessage(err, 'Check the email address and try again.'));
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = async () => {
    if (!code.trim() || newPassword.length < 8) return Alert.alert('Reset password', 'Enter the code and a new password of at least 8 characters.');
    if (!signIn) return;
    setLoading(true);
    try {
      const result = await signIn.attemptFirstFactor({ strategy: 'reset_password_email_code', code: code.trim(), password: newPassword } as any);
      if (result.status === 'complete' && setActive) await setActive({ session: result.createdSessionId });
      else Alert.alert('Reset password', 'Password changed. Please sign in.');
    } catch (err: any) {
      Alert.alert('Could not reset', clerkMessage(err, 'Invalid or expired code.'));
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // UI pieces
  // ---------------------------------------------------------------------------
  const busy = loading || googleLoading;

  const field = (icon: keyof typeof Ionicons.glyphMap, props: React.ComponentProps<typeof TextInput>, right?: React.ReactNode) => (
    <View style={styles.field}>
      <Ionicons name={icon} size={18} color={Colors.textSecondary} />
      <TextInput style={styles.fieldInput} placeholderTextColor={Colors.textTertiary} {...props} />
      {right}
    </View>
  );

  const divider = (label: string) => (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>{label}</Text>
      <View style={styles.dividerLine} />
    </View>
  );

  const roleCards = (
    <View style={styles.roleRow}>
      {(
        [
          ['owner', 'business', 'Homestay owner', 'Rooms, guests, bookings and cabs for your guests'],
          ['driver', 'car', 'Cab driver', 'Get trip requests from homestays near you'],
        ] as const
      ).map(([value, icon, title, desc]) => {
        const active = role === value;
        return (
          <TouchableOpacity
            key={value}
            style={[styles.roleCard, active && styles.roleCardActive]}
            onPress={() => setRole(value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={title}
          >
            <View style={[styles.roleIcon, active && { backgroundColor: Colors.brandPrimary }]}>
              <Ionicons name={icon} size={22} color={active ? Colors.white : Colors.brandPrimaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.roleTitle}>{title}</Text>
              <Text style={styles.roleDesc}>{desc}</Text>
            </View>
            <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={22} color={active ? Colors.brandPrimary : Colors.textTertiary} />
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const profileFields = role ? (
    <View style={{ gap: 10 }}>
      {field('person-outline', { placeholder: 'Full name', value: name, onChangeText: setName, autoComplete: 'name' })}
      {field('call-outline', { placeholder: 'Mobile number (WhatsApp)', value: phone, onChangeText: setPhone, keyboardType: 'phone-pad' })}
      {role === 'owner' ? (
        <>
          {field('business-outline', { placeholder: 'Homestay name', value: homestayName, onChangeText: setHomestayName })}
          <TouchableOpacity style={styles.pinBtn} onPress={() => setMapVisible(true)} accessibilityRole="button">
            <Ionicons name="location" size={18} color={Colors.brandPrimaryDark} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pinTitle}>{coords ? 'Homestay pinned on map' : 'Pin your homestay on the map'}</Text>
              <Text style={styles.pinSub} numberOfLines={2}>
                {coords ? location || `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : 'So nearby drivers get your cab requests (you can do this later)'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        </>
      ) : (
        <>
          <PlatformSelect
            label="Vehicle (seats)"
            value={vehicleType}
            options={vehicleOptions().map((v) => ({ label: v.label, value: v.value, icon: 'car-outline' as const }))}
            onSelect={(v) => setVehicleType(v as VehicleType)}
          />
          {field('reader-outline', { placeholder: 'Vehicle number, e.g. WB-76-A-1234', value: vehicleNumber, onChangeText: setVehicleNumber, autoCapitalize: 'characters' })}
          {field('map-outline', { placeholder: 'Area you drive in, e.g. Darjeeling, NJP', value: area, onChangeText: setArea })}
          <Text style={styles.hint}>Driver accounts are reviewed by StayRide before you get trip requests.</Text>
        </>
      )}
    </View>
  ) : null;

  // The checkbox and the links are separate taps, so opening a policy never ticks the box
  const consentRow = (
    <View style={styles.consentRow}>
      <TouchableOpacity onPress={() => setConsent((c) => !c)} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: consent }} accessibilityLabel="I am 18 or older and accept the Terms and Privacy Policy">
        <Ionicons name={consent ? 'checkbox' : 'square-outline'} size={24} color={consent ? Colors.brandPrimary : Colors.textSecondary} />
      </TouchableOpacity>
      <Text style={styles.consentText}>
        I am 18 or older and agree to the{' '}
        <Text style={styles.link} onPress={() => setLegalDoc('terms')} accessibilityRole="link">
          Terms of Service
        </Text>{' '}
        and{' '}
        <Text style={styles.link} onPress={() => setLegalDoc('privacy')} accessibilityRole="link">
          Privacy Policy
        </Text>
        .
      </Text>
    </View>
  );

  const stepHeader = (total: number) => (
    <View style={{ gap: 8 }}>
      <View style={styles.progress}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.progressBar, i < step && styles.progressBarOn]} />
        ))}
      </View>
      <View style={styles.stepHead}>
        {step > 1 ? (
          <TouchableOpacity onPress={() => setStep(step - 1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Previous step">
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.stepLabel}>
            Step {step} of {total}
          </Text>
          <Text style={styles.stepTitle}>{STEP_TITLES[step - 1]}</Text>
        </View>
      </View>
    </View>
  );

  const legalSheet = (
    <Modal visible={legalDoc !== null} animationType="slide" onRequestClose={() => setLegalDoc(null)}>
      {legalDoc ? <LegalScreen doc={legalDoc} onClose={() => setLegalDoc(null)} /> : null}
    </Modal>
  );

  const handlePicked = (loc: PickedLocation) => {
    setCoords({ latitude: loc.latitude, longitude: loc.longitude });
    setLocation(loc.address || `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`);
    setMapVisible(false);
  };

  const passwordEye = (
    <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={10} accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { paddingTop: Math.max(insets.top, 24) + 20 }]}>
          <View style={styles.logo}>
            <Ionicons name="business" size={26} color={Colors.brandPrimaryDark} />
          </View>
          <Text style={styles.brand}>StayRide</Text>
          <Text style={styles.tagline}>Homestays and hill rides, in one app</Text>
        </View>

        <View style={styles.card}>
          {mode === 'verify' ? (
            <View style={{ gap: 12 }}>
              <Text style={styles.title}>Check your email</Text>
              <Text style={styles.subtitle}>We sent a 6-digit code to {email.trim()}.</Text>
              {field('keypad-outline', { placeholder: '123456', value: code, onChangeText: setCode, keyboardType: 'number-pad', maxLength: 6 })}
              <PrimaryButton label="Verify and continue" onPress={verifyEmail} busy={busy} loading={loading} />
              <View style={styles.linkRow}>
                <Text style={styles.linkText} onPress={resendCode}>
                  Resend code
                </Text>
                <Text style={styles.linkText} onPress={() => setMode('signup')}>
                  Change email
                </Text>
              </View>
            </View>
          ) : mode === 'reset' ? (
            <View style={{ gap: 12 }}>
              <Text style={styles.title}>Reset your password</Text>
              {resetStage === 'request' ? (
                <>
                  <Text style={styles.subtitle}>We will email you a code.</Text>
                  {field('mail-outline', { placeholder: 'Email', value: email, onChangeText: setEmail, keyboardType: 'email-address', autoCapitalize: 'none' })}
                  <PrimaryButton label="Send code" onPress={requestReset} busy={busy} loading={loading} />
                </>
              ) : (
                <>
                  <Text style={styles.subtitle}>Enter the code sent to {email.trim()} and a new password.</Text>
                  {field('keypad-outline', { placeholder: 'Code', value: code, onChangeText: setCode, keyboardType: 'number-pad', maxLength: 6 })}
                  {field('lock-closed-outline', { placeholder: 'New password (8+ characters)', value: newPassword, onChangeText: setNewPassword, secureTextEntry: !showPassword }, passwordEye)}
                  <PrimaryButton label="Set new password" onPress={confirmReset} busy={busy} loading={loading} />
                </>
              )}
              <Text style={[styles.linkText, { textAlign: 'center' }]} onPress={() => setMode('signin')}>
                Back to sign in
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.tabs}>
                {(['signin', 'signup'] as const).map((m) => (
                  <TouchableOpacity key={m} style={[styles.tab, mode === m && styles.tabActive]} onPress={() => setMode(m)} accessibilityRole="tab" accessibilityState={{ selected: mode === m }}>
                    <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>{m === 'signin' ? 'Sign in' : 'Create account'}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {mode === 'signin' ? (
                <View style={{ gap: 12 }}>
                  <GoogleButton label="Continue with Google" onPress={() => startGoogle(null)} busy={busy} loading={googleLoading} />
                  {divider('or sign in with email')}
                  {field('mail-outline', { placeholder: 'Email', value: email, onChangeText: setEmail, keyboardType: 'email-address', autoCapitalize: 'none', autoComplete: 'email' })}
                  {field('lock-closed-outline', { placeholder: 'Password', value: password, onChangeText: setPassword, secureTextEntry: !showPassword, autoComplete: 'password' }, passwordEye)}
                  <Text style={[styles.linkText, { alignSelf: 'flex-end' }]} onPress={() => { setResetStage('request'); setMode('reset'); }}>
                    Forgot password?
                  </Text>
                  <PrimaryButton label="Sign in" onPress={emailSignIn} busy={busy} loading={loading} />
                  <Text style={styles.footNote}>
                    New here?{' '}
                    <Text style={styles.link} onPress={() => setMode('signup')}>
                      Create an account
                    </Text>
                  </Text>
                  {DEMO_ENABLED && (
                    <View style={styles.demoRow}>
                      <TouchableOpacity style={styles.demoBtn} disabled={busy} onPress={() => demoLogin('demo@stayride.in')}>
                        <Text style={styles.demoText}>Demo host</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.demoBtn} disabled={busy} onPress={() => demoLogin('driver@stayride.in')}>
                        <Text style={styles.demoText}>Demo driver</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ) : (
                <View style={{ gap: 14 }}>
                  {stepHeader(3)}
                  {step === 1 ? (
                    <>
                      {roleCards}
                      <PrimaryButton label="Continue" onPress={() => goStep(2)} busy={busy} loading={false} />
                    </>
                  ) : step === 2 ? (
                    <>
                      {profileFields}
                      <PrimaryButton label="Continue" onPress={() => goStep(3)} busy={busy} loading={false} />
                    </>
                  ) : (
                    <>
                      {consentRow}
                      <GoogleButton label="Sign up with Google" onPress={signUpWithGoogle} busy={busy} loading={googleLoading} />
                      {divider('or use email')}
                      {field('mail-outline', { placeholder: 'Email', value: email, onChangeText: setEmail, keyboardType: 'email-address', autoCapitalize: 'none', autoComplete: 'email' })}
                      {field('lock-closed-outline', { placeholder: 'Password (8+ characters)', value: password, onChangeText: setPassword, secureTextEntry: !showPassword }, passwordEye)}
                      <PrimaryButton label="Create account" onPress={emailSignUp} busy={busy} loading={loading} />
                    </>
                  )}
                </View>
              )}
            </>
          )}
        </View>

        <Text style={styles.legalFoot}>
          <Text style={styles.link} onPress={() => setLegalDoc('privacy')}>
            Privacy
          </Text>
          {'  ·  '}
          <Text style={styles.link} onPress={() => setLegalDoc('terms')}>
            Terms
          </Text>
          {'  ·  '}
          <Text style={styles.link} onPress={() => setLegalDoc('refunds')}>
            Refunds
          </Text>
        </Text>
      </ScrollView>

      {!finishVisible && legalSheet}
      {/* Create account (email/Google): the picker opens over the screen */}
      <LocationPicker visible={mapVisible && !finishVisible} title="Pin your homestay" initial={coords} onConfirm={handlePicked} onClose={() => setMapVisible(false)} />

      {/* Google account without a StayRide account: register with a role, details and consent */}
      <Modal visible={finishVisible} animationType="slide" onRequestClose={cancelFinishSetup}>
        <View style={[styles.sheet, { paddingTop: Math.max(insets.top, 16) }]}>
          {/* iOS shows one modal at a time: the map opens inside this sheet */}
          <LocationPicker visible={mapVisible && finishVisible} title="Pin your homestay" initial={coords} onConfirm={handlePicked} onClose={() => setMapVisible(false)} />
          {finishVisible && legalSheet}
          <View style={styles.sheetHeader}>
            <Text style={styles.title}>Finish setting up</Text>
            <TouchableOpacity onPress={cancelFinishSetup} hitSlop={10} accessibilityLabel="Cancel and sign out">
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
            <Text style={styles.subtitle}>
              Signed in with Google as {user?.primaryEmailAddress?.emailAddress}. Tell us how you will use StayRide.
            </Text>
            {stepHeader(2)}
            {step === 1 ? (
              <>
                {roleCards}
                <PrimaryButton label="Continue" onPress={() => goStep(2)} busy={busy} loading={false} />
              </>
            ) : (
              <>
                {profileFields}
                {consentRow}
                <PrimaryButton label="Create my account" onPress={completeFinishSetup} busy={busy} loading={loading} />
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPage },
  hero: { backgroundColor: Colors.brandPrimaryDark, alignItems: 'center', paddingBottom: 56, paddingHorizontal: 24 },
  logo: { width: 52, height: 52, borderRadius: 16, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  brand: { color: Colors.white, fontSize: 28, fontWeight: '800', marginTop: 12, letterSpacing: 0.3 },
  tagline: { color: '#E2DAFF', fontSize: 14, marginTop: 4 },
  card: { marginHorizontal: 16, marginTop: -36, backgroundColor: Colors.bgCard, borderRadius: Radii.dialog, padding: 18, ...Shadows.hover },
  tabs: { flexDirection: 'row', backgroundColor: Colors.bgPage, borderRadius: 12, padding: 4, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.bgCard, ...Shadows.sm },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.brandPrimaryDark, fontWeight: '800' },
  title: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  stepLabel: { fontSize: 12, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: Colors.divider, borderRadius: 12, paddingHorizontal: 12, backgroundColor: Colors.white },
  fieldInput: { flex: 1, paddingVertical: 13, fontSize: 15, color: Colors.textPrimary },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: Colors.divider, borderRadius: 12, paddingVertical: 13, backgroundColor: Colors.white },
  googleText: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.divider },
  dividerText: { fontSize: 12, color: Colors.textTertiary },
  primaryBtn: { backgroundColor: Colors.brandPrimary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: Colors.white, fontSize: 15, fontWeight: '800' },
  dim: { opacity: 0.6 },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between' },
  linkText: { fontSize: 13, fontWeight: '700', color: Colors.brandPrimaryDark },
  link: { color: Colors.brandPrimaryDark, fontWeight: '700' },
  footNote: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  demoRow: { flexDirection: 'row', gap: 8 },
  demoBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.bgPage, alignItems: 'center' },
  demoText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  roleRow: { gap: 10 },
  roleCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: Colors.divider, borderRadius: 14, padding: 14, backgroundColor: Colors.white },
  progress: { flexDirection: 'row', gap: 6 },
  progressBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.divider },
  progressBarOn: { backgroundColor: Colors.brandPrimary },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginTop: 2 },
  roleCardActive: { borderColor: Colors.brandPrimary, backgroundColor: '#FAF8FF' },
  roleIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.brandPrimaryLight, alignItems: 'center', justifyContent: 'center' },
  roleTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  roleDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 3, lineHeight: 16 },
  pinBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: Colors.brandPrimaryLight },
  pinTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  pinSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  hint: { fontSize: 12, color: Colors.textSecondary },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  consentText: { flex: 1, fontSize: 13, color: Colors.textPrimary, lineHeight: 19 },
  legalFoot: { textAlign: 'center', fontSize: 12, marginTop: 18, color: Colors.textSecondary },
  sheet: { flex: 1, backgroundColor: Colors.bgCard, paddingHorizontal: 18 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
});
