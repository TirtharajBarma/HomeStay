import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useClerk, useUser } from '@clerk/expo';
import * as Updates from 'expo-updates';
import { Colors, Radii, Shadows } from '../theme/colors';
import { KeyboardAwareOverlay } from '../components/KeyboardAwareOverlay';
import { useStayRide } from '../data/store';
import { api, DEFAULT_BASE_URL } from '../data/api';
import { Header } from '../components/Header';
import { CURRENT_RELEASE_VERSION } from '../constants/version';
import { getActiveAppVersion } from '../services/updates/updateManager';
import { confirmLogoutAll } from '../utils/report';

export const MoreScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {
    homestay,
    campaigns,
    drivers,
    commissionEarned,
    payoutSummary,
    features,
    isDemoMode,
    session,
    logout,
    logoutAllDevices,
  } = useStayRide();

  const { signOut } = useClerk();
  const { user: clerkUser, isLoaded: isClerkUserLoaded } = useUser();
  const [backendLive, setBackendLive] = useState<boolean | null>(null);
  const [activeVersion, setActiveVersion] = useState(CURRENT_RELEASE_VERSION);

  // Clerk users without a password yet (e.g. Google sign-in) set one without entering a current password
  const needsCurrentPassword = !clerkUser || clerkUser.passwordEnabled;

  // Password management modal
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const closePasswordModal = () => {
    setPasswordModalVisible(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSavePassword = async () => {
    if (!isClerkUserLoaded) {
      Alert.alert('Please Wait', 'Account service is still loading. Try again in a moment.');
      return;
    }
    if (needsCurrentPassword && !currentPassword) {
      Alert.alert('Validation Error', 'Please enter your current password.');
      return;
    }
    if (!newPassword || newPassword.trim().length < 8) {
      Alert.alert('Validation Error', 'Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'Passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      if (clerkUser) {
        // Clerk-managed account: Clerk owns the password
        await clerkUser.updatePassword({
          newPassword: newPassword.trim(),
          ...(clerkUser.passwordEnabled ? { currentPassword } : {}),
          signOutOfOtherSessions: true,
        });
        closePasswordModal();
        Alert.alert('Success', 'Password updated successfully.');
      } else {
        // Legacy StayRide-only account
        const res = await api.post('/auth/set-password', {
          currentPassword,
          newPassword: newPassword.trim(),
        });
        closePasswordModal();
        Alert.alert('Success', res?.message || 'Password updated successfully.');
      }
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Failed to update password.'
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const isDemoAccount =
    session?.owner?.email?.toLowerCase().trim() === 'demo@stayride.in';

  useEffect(() => {
    api.checkHealth().then((live) => setBackendLive(live));
  }, []);

  // Show the version actually running (OTA-aware), mirroring the Updates screen
  useEffect(() => {
    if (Updates.isEmbeddedLaunch || !Updates.updateId) return;
    getActiveAppVersion().then(setActiveVersion).catch(() => {});
  }, []);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (e) {
            console.log('[Clerk] signOut note:', e);
          }
          await logout(); // App-level session watcher resets navigation to Login
        },
      },
    ]);
  };

  const handleServerConfig = () => {
    Alert.alert(
      'Backend Server Configuration',
      `Status: ${backendLive ? '🟢 Connected' : '🔴 Unreachable / Offline'}\n\nEndpoint:\n${api.getBaseUrl()}\n\n• For physical phone on Wi-Fi: use your PC LAN IP (e.g. http://192.168.0.111:5050/v1)\n• For production cloud: set your HTTPS domain URL.`,
      [
        { text: 'OK', style: 'cancel' },
        {
          text: 'Reset to LAN Default',
          onPress: async () => {
            api.setBaseUrl(DEFAULT_BASE_URL);
            const live = await api.checkHealth();
            setBackendLive(live);
            Alert.alert('Server Reset', `Endpoint set to: ${DEFAULT_BASE_URL}\nStatus: ${live ? 'Online' : 'Offline'}`);
          },
        },
      ]
    );
  };

  const renderRow = (
    icon: keyof typeof Ionicons.glyphMap,
    title: string,
    subtitle: string,
    onPress: () => void,
    isDestructive = false
  ) => {
    return (
      <TouchableOpacity style={styles.rowItem} onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.rowIconCircle, isDestructive && styles.rowIconDestructive]}>
          <Ionicons
            name={icon}
            size={18}
            color={isDestructive ? Colors.statusRed : Colors.brandPrimary}
          />
        </View>
        <View style={styles.rowTextContainer}>
          <Text style={[styles.rowTitle, isDestructive && { color: Colors.statusRed }]}>
            {title}
          </Text>
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Header title="More" />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: 14 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Highlight Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileTopRow}>
            <Text style={styles.profileName}>{homestay.name || 'My Homestay'}</Text>
          </View>
          <Text style={styles.profileLink}>
            {(homestay.link || 'stayride.in/h/my-homestay').replace('https://', '')}
          </Text>
          <TouchableOpacity
            style={styles.openProfileBtn}
            onPress={() => navigation.navigate('HomestayProfile')}
            activeOpacity={0.8}
          >
            <Text style={styles.openProfileBtnText}>Open homestay profile</Text>
          </TouchableOpacity>
        </View>

        {/* Business Group */}
        <Text style={styles.groupHeader}>Business</Text>
        <View style={styles.cardGroup}>
          {renderRow(
            'bar-chart',
            'Analytics',
            'Property, guest and cab performance',
            () => navigation.navigate('Analytics')
          )}
          {renderRow(
            'send',
            'Guest marketing',
            features?.campaigns === false ? 'Not enabled • request access' : `${campaigns.length} WhatsApp campaigns`,
            () => navigation.navigate('Campaign')
          )}
          {renderRow(
            'card',
            'Cab commission',
            `₹${commissionEarned().toLocaleString()} earned • ${payoutSummary ? `₹${payoutSummary.available.toLocaleString()}` : '—'} to withdraw`,
            () => navigation.navigate('Commission')
          )}
          {renderRow(
            'home',
            'Homestay profile',
            'Photos, amenities and location',
            () => navigation.navigate('HomestayProfile')
          )}
        </View>

        {/* StayRide Group */}
        <Text style={styles.groupHeader}>StayRide</Text>
        <View style={styles.cardGroup}>
          {renderRow(
            'car',
            'Find a Driver',
            'Your own drivers or StayRide drivers',
            () => navigation.navigate('FindDriver')
          )}
          {renderRow(
            'people',
            'My Drivers',
            `${drivers.length} own drivers in your fleet`,
            () => navigation.navigate('MyDrivers')
          )}
          {renderRow(
            'information-circle',
            'How StayRide works',
            'Bookings, the 3 cab options and your earnings',
            () => navigation.navigate('HowItWorks')
          )}
        </View>

        {/* System & App Updates Group */}
        <Text style={styles.groupHeader}>System & App</Text>
        <View style={styles.cardGroup}>
          {renderRow(
            'cloud-download-outline',
            'Software Updates',
            `Version ${activeVersion} · Check & install OTA updates`,
            () => navigation.navigate('Updates')
          )}
        </View>

        {/* Account & Security Group */}
        <Text style={styles.groupHeader}>Account & Security</Text>
        <View style={styles.cardGroup}>
          {renderRow(
            'person-circle-outline',
            'Account & privacy',
            'Sign-in methods (Google), privacy, terms, delete account',
            () => navigation.navigate('Account')
          )}
          {renderRow(
            'key-outline',
            'Change / Set Password',
            'Update your account password',
            () => setPasswordModalVisible(true)
          )}
          {renderRow(
            'phone-portrait-outline',
            'Sign out of all devices',
            'End your StayRide session on every phone',
            () =>
              confirmLogoutAll(logoutAllDevices, async () => {
                try {
                  await signOut();
                } catch (e) {
                  console.log('[Clerk] signOut note:', e);
                }
              })
          )}
          {renderRow(
            'log-out-outline',
            'Log out',
            'Sign out of your homestay account',
            handleLogout,
            true
          )}
        </View>

        {/* Demo / Developer Controls (Only visible to the demo account) */}
        {isDemoAccount && (
          <>
            <Text style={styles.groupHeader}>Developer Tools</Text>
            <View style={styles.cardGroup}>
              {renderRow(
                'server-outline',
                'Backend server',
                `${backendLive === null ? 'Checking...' : backendLive ? '🟢 Online' : '🔴 Offline'} · ${api.getBaseUrl()}`,
                handleServerConfig
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Set Password Modal */}
      <Modal
        visible={passwordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closePasswordModal}
      >
        <KeyboardAwareOverlay style={{ flex: 1 }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Account Password</Text>
            <Text style={styles.modalSubtitle}>
              {needsCurrentPassword
                ? 'Enter your current password and choose a new one.'
                : 'Set a password so you can also sign in with your email.'}
            </Text>

            {needsCurrentPassword && (
              <>
                <Text style={styles.modalLabel}>Current Password</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Your current password"
                  secureTextEntry
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholderTextColor={Colors.textSecondary}
                />
              </>
            )}

            <Text style={styles.modalLabel}>New Password</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Min 8 characters"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              placeholderTextColor={Colors.textSecondary}
            />

            <Text style={styles.modalLabel}>Confirm Password</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Re-enter password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholderTextColor={Colors.textSecondary}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={closePasswordModal}
                disabled={savingPassword}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSavePassword}
                disabled={savingPassword}
                activeOpacity={0.8}
              >
                {savingPassword ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Save Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAwareOverlay>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPage,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: Colors.brandPrimary,
    borderRadius: Radii.card,
    padding: 18,
    ...Shadows.card,
  },
  profileTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.white,
    flex: 1,
  },
  profileLink: {
    fontSize: 12,
    color: '#EDE9FE',
    marginTop: 4,
  },
  openProfileBtn: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radii.button,
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  openProfileBtnText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  groupHeader: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    marginTop: 18,
    marginBottom: 6,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardGroup: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.divider,
    overflow: 'hidden',
    ...Shadows.card,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  rowIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.brandPrimaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowIconDestructive: {
    backgroundColor: Colors.statusRedBg,
  },
  rowTextContainer: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  rowSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.card,
    padding: 22,
    ...Shadows.hover,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: Colors.bgPage,
    borderRadius: Radii.button,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginBottom: 14,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  modalSaveBtn: {
    backgroundColor: Colors.brandPrimary,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: Radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  modalSaveBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.white,
  },
});
