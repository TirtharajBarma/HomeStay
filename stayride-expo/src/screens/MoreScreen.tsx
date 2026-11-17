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
  Linking,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useClerk, useUser } from '@clerk/expo';
import * as Updates from 'expo-updates';
import { Colors, Radii, Shadows } from '../theme/colors';
import { KeyboardAwareOverlay } from '../components/KeyboardAwareOverlay';
import { useStayRide } from '../data/store';
import { api, DEFAULT_BASE_URL, VERCEL_CLOUD_URL } from '../data/api';
import { Header } from '../components/Header';
import { CURRENT_RELEASE_VERSION } from '../constants/version';
import { useAppUpdateManager } from '../services/updates/updateManager';
import { confirmLogoutAll } from '../utils/report';

export const MoreScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const updateInfo = useAppUpdateManager();
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

  // Clerk users without a password yet (e.g. Google sign-in) set one without entering a current password
  const needsCurrentPassword = !clerkUser || clerkUser.passwordEnabled;

  // Public guest booking link
  const [copiedLink, setCopiedLink] = useState(false);
  const rawLink = homestay.link?.trim() || '';
  const hasLink = Boolean(rawLink);
  const resolveFullUrl = (link: string): string => {
    if (!link) return '';
    if (link.startsWith('http://') || link.startsWith('https://')) return link;
    if (link.startsWith('/')) return `https://staycabs.in${link}`;
    return `https://${link}`;
  };
  const fullLink = resolveFullUrl(rawLink);
  const cleanLink = hasLink
    ? fullLink.replace(/^https?:\/\//, '')
    : 'Not yet assigned (set up in Homestay Profile)';

  const handleCopyLink = async () => {
    if (!fullLink) return;
    await Clipboard.setStringAsync(fullLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareWhatsApp = () => {
    if (!fullLink) return;
    const msg = `Hi! You can view rooms & book directly at our homestay here: ${fullLink}`;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`).catch(() => {
      Share.share({ message: msg, url: fullLink });
    });
  };

  const handleOpenWeb = () => {
    if (!fullLink) return;
    Linking.openURL(fullLink).catch(() => {
      Alert.alert('Cannot open link', fullLink);
    });
  };

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
    session?.owner?.email?.toLowerCase().trim() === (process.env.EXPO_PUBLIC_DEMO_HOST_EMAIL || 'demo@stayride.in').toLowerCase() ||
    session?.owner?.email?.toLowerCase().trim().startsWith('demo@');

  useEffect(() => {
    api.checkHealth().then((live) => setBackendLive(live));
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
      `Status: ${backendLive ? 'Online / Connected' : 'Offline / Unreachable'}\n\nCurrent Endpoint:\n${api.getBaseUrl()}\n\n• Vercel Cloud: Live internet server for field testing.\n• Local Wi-Fi: Developer PC LAN (from .env).`,
      [
        { text: 'Close', style: 'cancel' },
        {
          text: 'Connect Vercel Cloud',
          onPress: async () => {
            api.setBaseUrl(VERCEL_CLOUD_URL);
            const live = await api.checkHealth();
            setBackendLive(live);
            Alert.alert('Switched to Vercel Cloud', `Endpoint set to: ${VERCEL_CLOUD_URL}\nStatus: ${live ? 'Online' : 'Offline (check Vercel env keys)'}`);
          },
        },
        {
          text: 'Reset to Local / .env',
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
    isDestructive = false,
    badge?: React.ReactNode
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
        {badge ? (
          <View style={styles.rowRightBadgeContainer}>
            {badge}
            <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Settings" />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: 14 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Highlight Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileTopRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.profileName}>{homestay.name || 'My Homestay'}</Text>
              {homestay.location ? (
                <View style={styles.profileLocationRow}>
                  <Ionicons name="location-outline" size={13} color="#DDD6FE" />
                  <Text style={styles.profileLocationText} numberOfLines={1}>
                    {homestay.location}
                  </Text>
                </View>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.openProfileBtn}
              onPress={() => navigation.navigate('HomestayProfile')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Open homestay profile"
            >
              <Text style={styles.openProfileBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>

          {/* Guest Booking Link Section */}
          <View style={styles.publicLinkContainer}>
            <View style={styles.publicLinkHeader}>
              <View style={styles.publicLinkHeaderLeft}>
                <Ionicons name="globe-outline" size={13} color="#DDD6FE" />
                <Text style={styles.publicLinkLabel}>GUEST BOOKING LINK</Text>
              </View>
              {hasLink && (
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveBadgeText}>LIVE</Text>
                </View>
              )}
            </View>

            {/* URL Display with Open Action */}
            <TouchableOpacity
              style={styles.urlBoxRow}
              onPress={handleOpenWeb}
              activeOpacity={hasLink ? 0.75 : 1}
              disabled={!hasLink}
            >
              <Text style={styles.publicLinkUrl} numberOfLines={1}>
                {cleanLink}
              </Text>
              {hasLink && (
                <View style={styles.openExternalPill}>
                  <Text style={styles.openExternalText}>Open</Text>
                  <Ionicons name="open-outline" size={11} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>

            {/* 2 Clean Balanced Action Buttons: 50% / 50% */}
            {hasLink && (
              <View style={styles.linkActionsRow}>
                <TouchableOpacity
                  style={[styles.linkActionBtn, styles.linkActionCopy]}
                  onPress={handleCopyLink}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={copiedLink ? 'checkmark-circle' : 'copy-outline'}
                    size={14}
                    color={copiedLink ? '#86EFAC' : '#FFFFFF'}
                  />
                  <Text style={[styles.linkActionText, copiedLink && { color: '#86EFAC' }]}>
                    {copiedLink ? 'Copied' : 'Copy Link'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.linkActionBtn, styles.linkActionWhatsApp]}
                  onPress={handleShareWhatsApp}
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-whatsapp" size={14} color="#FFFFFF" />
                  <Text style={styles.linkActionText}>Share WhatsApp</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Business Group */}
        <Text style={styles.groupHeader}>Business</Text>
        <View style={styles.cardGroup}>
          {renderRow(
            'sparkles',
            'Promote with Influencers',
            'Collaborate with top travel creators in Darjeeling & Sikkim',
            () => navigation.navigate('Promote')
          )}
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
        </View>

        {/* Cabs & Mobility Group */}
        <Text style={styles.groupHeader}>Cabs & Mobility</Text>
        <View style={styles.cardGroup}>
          {renderRow(
            'car',
            'Find a Driver',
            'Your own drivers or regional drivers',
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
            'How it works',
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
            updateInfo.isUpdatePending
              ? 'Update downloaded · Restart required'
              : updateInfo.isUpdateAvailable
              ? `New ${updateInfo.availableRelease?.version || 'update'} available for download`
              : `Version ${updateInfo.activeVersion} · Check & install OTA updates`,
            () => navigation.navigate('Updates'),
            false,
            updateInfo.isUpdatePending ? (
              <View style={styles.badgeReady}>
                <View style={styles.badgeDotGreen} />
                <Text style={styles.badgeTextGreen}>READY</Text>
              </View>
            ) : updateInfo.isUpdateAvailable ? (
              <View style={styles.badgeAvail}>
                <Text style={styles.badgeTextPeach}>NEW</Text>
              </View>
            ) : (
              <View style={styles.badgeVersion}>
                <Text style={styles.badgeTextVersion}>{updateInfo.activeVersion}</Text>
              </View>
            )
          )}

          {/* App Version & Channel Row */}
          <View style={styles.versionRowItem}>
            <View style={styles.rowIconCircle}>
              <Ionicons name="phone-portrait-outline" size={18} color={Colors.brandPrimary} />
            </View>
            <View style={styles.rowTextContainer}>
              <Text style={styles.rowTitle}>App Version</Text>
              <Text style={styles.rowSubtitle} numberOfLines={1}>
                {updateInfo.activeVersion} {updateInfo.isEmbeddedLaunch ? '(Base)' : '(OTA)'} · Channel {updateInfo.channel || 'preview'}
              </Text>
            </View>
            {updateInfo.updateId ? (
              <View style={styles.otaHashBadge}>
                <Text style={styles.otaHashText}>#{updateInfo.updateId.substring(0, 8)}</Text>
              </View>
            ) : null}
          </View>
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
            'End your login session on every phone',
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
                `${backendLive === null ? 'Checking...' : backendLive ? 'Online' : 'Offline'} · ${api.getBaseUrl()}`,
                handleServerConfig
              )}
            </View>
          </>
        )}

        {/* Footer Credit & Version */}
        <View style={styles.footerWrap}>
          <Text style={styles.footerBrandTitle}>
            {process.env.EXPO_PUBLIC_APP_NAME ? `${process.env.EXPO_PUBLIC_APP_NAME.toUpperCase()} PARTNER` : 'PARTNER PORTAL'}
          </Text>
          <Text style={styles.footerVersionText}>
            Version {updateInfo.activeVersion} {updateInfo.isEmbeddedLaunch ? '· Base' : '· OTA'}
          </Text>
          <Text style={styles.footerSubText}>
            Partner App for Homestay Hosts & Drivers
          </Text>
        </View>
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
    padding: 16,
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
  },
  profileLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  profileLocationText: {
    fontSize: 12,
    color: '#DDD6FE',
    flexShrink: 1,
  },
  openProfileBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.button,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  openProfileBtnText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  publicLinkContainer: {
    marginTop: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  publicLinkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  publicLinkHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  publicLinkLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DDD6FE',
    letterSpacing: 0.5,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#86EFAC',
    letterSpacing: 0.5,
  },
  urlBoxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
  },
  publicLinkUrl: {
    fontSize: 12,
    color: Colors.white,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  openExternalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  openExternalText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.white,
  },
  linkActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  linkActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
  },
  linkActionCopy: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  linkActionWhatsApp: {
    backgroundColor: '#16A34A',
  },
  linkActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
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
  rowRightBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeReady: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
  },
  badgeDotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  badgeTextGreen: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
    letterSpacing: 0.5,
  },
  badgeAvail: {
    backgroundColor: '#FFEDD5',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeTextPeach: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EA580C',
    letterSpacing: 0.5,
  },
  badgeVersion: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeTextVersion: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  versionRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  otaHashBadge: {
    backgroundColor: Colors.brandPrimaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  otaHashText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
    color: Colors.brandPrimary,
  },
  footerWrap: {
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 16,
    gap: 4,
  },
  footerBrandTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: Colors.textSecondary,
  },
  footerVersionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  footerSubText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
});
