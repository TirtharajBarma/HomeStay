import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useUser, useAuth } from '@clerk/expo';
import { Header } from '../components/Header';
import { KeyboardAwareOverlay } from '../components/KeyboardAwareOverlay';
import { Colors, Radii, Shadows } from '../theme/colors';
import { useStayRide } from '../data/store';
import { api } from '../data/api';
import { confirmLogoutAll } from '../utils/report';

type IconName = keyof typeof Ionicons.glyphMap;

// Account & privacy (owners and drivers): sign-in methods (connect Google), legal pages, delete account.
export const AccountScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { session, logout, logoutAllDevices } = useStayRide();
  const { user, isSignedIn } = useUser();
  const { signOut } = useAuth();
  const [busy, setBusy] = useState<'google' | 'unlink' | 'delete' | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const email = session?.owner?.email || session?.driver?.email || user?.primaryEmailAddress?.emailAddress || '';
  const isDemo = email.toLowerCase() === 'demo@stayride.in';
  const google = (user as any)?.externalAccounts?.find((a: any) => a.provider === 'google' || a.provider === 'oauth_google');
  const hasPassword = Boolean((user as any)?.passwordEnabled);

  // Link Google to this account: Clerk opens Google, then the account can sign in with either method
  const connectGoogle = async () => {
    if (!user) return;
    setBusy('google');
    try {
      const redirectUrl = Linking.createURL('/dashboard', { scheme: 'stayride' });
      const ext: any = await (user as any).createExternalAccount({ strategy: 'oauth_google', redirectUrl });
      const url = ext?.verification?.externalVerificationRedirectURL?.toString();
      if (!url) throw new Error('Google did not return a sign-in page.');
      await WebBrowser.openAuthSessionAsync(url, redirectUrl);
      await user.reload();
      const linked = (user as any).externalAccounts?.some((a: any) => (a.provider === 'google' || a.provider === 'oauth_google') && a.verification?.status === 'verified');
      Alert.alert(linked ? 'Google connected' : 'Not connected', linked ? 'You can now sign in with Google too.' : 'Google sign-in was not completed.');
    } catch (err: any) {
      Alert.alert('Could not connect Google', err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const disconnectGoogle = () => {
    if (!google) return;
    if (!hasPassword) {
      Alert.alert('Set a password first', 'Google is your only way to sign in. Set a password in More → Change / Set Password before disconnecting Google.');
      return;
    }
    Alert.alert('Disconnect Google?', 'You will sign in with your email and password.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          setBusy('unlink');
          try {
            await google.destroy();
            await user?.reload();
          } catch (err: any) {
            Alert.alert('Could not disconnect', err?.errors?.[0]?.message || err?.message || 'Please try again.');
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const deleteAccount = async () => {
    setBusy('delete');
    try {
      await api.post('/account/delete', { confirm: 'DELETE' });
      setDeleteOpen(false);
      try {
        await signOut();
      } catch {
        // the sign-in account is already removed on the server
      }
      await logout();
      Alert.alert('Account deleted', 'Your account and personal details were removed. Trip and payment records are kept only as the law requires.');
    } catch (err: any) {
      Alert.alert('Could not delete', err?.message || 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const row = (icon: IconName, title: string, subtitle: string, onPress?: () => void, right?: React.ReactNode, danger = false) => (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={title}>
      <View style={[styles.rowIcon, danger && { backgroundColor: Colors.statusRedBg }]}>
        <Ionicons name={icon} size={18} color={danger ? Colors.statusRed : Colors.brandPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, danger && { color: Colors.statusRed }]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} /> : null)}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Header title="Account & privacy" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.idCard}>
          <Ionicons name="person-circle" size={44} color={Colors.brandPrimary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.idName}>{session?.owner?.name || session?.driver?.name || user?.fullName || 'Your account'}</Text>
            <Text style={styles.idEmail}>{email}</Text>
            <Text style={styles.idRole}>{session?.role === 'driver' ? 'Cab driver' : 'Homestay owner'}</Text>
          </View>
        </View>

        <Text style={styles.group}>Sign-in methods</Text>
        <View style={styles.card}>
          {isSignedIn && user ? (
            <>
              {row('mail', 'Email & password', hasPassword ? 'Password set' : 'No password yet: set one in More → Change / Set Password')}
              {row(
                'logo-google',
                'Google',
                google ? `Connected · ${google.emailAddress || ''}` : 'Not connected',
                google ? disconnectGoogle : connectGoogle,
                busy === 'google' || busy === 'unlink' ? (
                  <ActivityIndicator size="small" color={Colors.brandPrimary} />
                ) : (
                  <Text style={[styles.action, google && { color: Colors.statusRed }]}>{google ? 'Disconnect' : 'Connect'}</Text>
                )
              )}
            </>
          ) : (
            <Text style={styles.muted}>
              {isDemo ? 'The demo account has no sign-in methods to manage.' : 'Sign-in methods appear here for accounts created with email or Google.'}
            </Text>
          )}
        </View>

        {session?.role === 'driver' ? (
          <>
            <Text style={styles.group}>Security</Text>
            <View style={styles.card}>
              {row('phone-portrait-outline', 'Sign out of all devices', 'Use this if you lost a phone or someone else used your account', () =>
                confirmLogoutAll(logoutAllDevices, () => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }))
              )}
            </View>
          </>
        ) : null}

        <Text style={styles.group}>Privacy & legal</Text>
        <View style={styles.card}>
          {row('shield-checkmark', 'Privacy Policy', 'What we collect and why', () => navigation.navigate('Legal', { doc: 'privacy' }))}
          {row('document-text', 'Terms of Service', 'Rules for using StayRide', () => navigation.navigate('Legal', { doc: 'terms' }))}
          {row('cash', 'Refund & Cancellation Policy', 'Advances, refunds, room bookings', () => navigation.navigate('Legal', { doc: 'refunds' }))}
        </View>

        <Text style={styles.group}>Danger zone</Text>
        <View style={styles.card}>
          {row(
            'trash',
            'Delete my account',
            isDemo ? 'Not available for the demo account' : 'Removes your sign-in and personal details',
            isDemo ? undefined : () => setDeleteOpen(true),
            undefined,
            true
          )}
        </View>
      </ScrollView>

      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
        <KeyboardAwareOverlay style={{ flex: 1 }}>
          <View style={styles.overlay}>
            <View style={styles.dialog}>
              <Ionicons name="warning" size={32} color={Colors.statusRed} />
              <Text style={styles.dialogTitle}>Delete your account?</Text>
              <Text style={styles.dialogText}>
                • You will be signed out everywhere and cannot sign in again with this account.{'\n'}
                • Your name, phone, photo and notifications are erased now.{'\n'}
                • Trip, payment and payout records are kept only as long as tax law requires.{'\n'}
                • Withdraw any commission you are owed before deleting.{'\n'}
                This cannot be undone.
              </Text>
              <Text style={styles.dialogLabel}>Type DELETE to confirm</Text>
              <TextInput style={styles.input} value={confirmText} onChangeText={setConfirmText} autoCapitalize="characters" autoCorrect={false} accessibilityLabel="Type DELETE to confirm" />
              <TouchableOpacity
                style={[styles.deleteBtn, (confirmText !== 'DELETE' || busy === 'delete') && { opacity: 0.4 }]}
                disabled={confirmText !== 'DELETE' || busy === 'delete'}
                onPress={deleteAccount}
                accessibilityRole="button"
              >
                <Text style={styles.deleteText}>{busy === 'delete' ? 'Deleting…' : 'Delete my account'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteOpen(false)} accessibilityRole="button">
                <Text style={styles.cancelText}>Keep my account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAwareOverlay>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPage },
  content: { padding: 16, paddingBottom: 40 },
  idCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.bgCard, borderRadius: Radii.card, padding: 16, ...Shadows.card },
  idName: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  idEmail: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  idRole: { fontSize: 12, fontWeight: '700', color: Colors.brandPrimaryDark, marginTop: 4 },
  group: { fontSize: 12, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 22, marginBottom: 8 },
  card: { backgroundColor: Colors.bgCard, borderRadius: Radii.card, paddingHorizontal: 12, ...Shadows.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider },
  rowIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.brandPrimaryLight, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  rowSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  action: { fontSize: 14, fontWeight: '700', color: Colors.brandPrimaryDark },
  muted: { fontSize: 13, color: Colors.textSecondary, paddingVertical: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: Colors.bgCard, borderRadius: Radii.dialog, padding: 20, alignItems: 'stretch' },
  dialogTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginTop: 8 },
  dialogText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginTop: 8 },
  dialogLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginTop: 14 },
  input: { borderWidth: 1, borderColor: Colors.divider, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginTop: 6, color: Colors.textPrimary },
  deleteBtn: { marginTop: 14, paddingVertical: 13, borderRadius: Radii.button, backgroundColor: Colors.statusRed, alignItems: 'center' },
  deleteText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  cancelBtn: { marginTop: 8, paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: Colors.textSecondary, fontWeight: '600' },
});
