import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../theme/colors';
import { useStayRide } from '../data/store';
import { reportOutcome } from '../utils/report';

export const DriverProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { session, logout, setDriverOnline, pushEnabled } = useStayRide();

  const isOnline = session?.driver?.available !== false;

  // Only what the server returned for this driver; '—' when a field is missing
  const driver = session?.driver;
  const show = (v?: string | number | null) => (v === undefined || v === null || v === '' ? '—' : String(v));

  const handleToggleOnline = async (val: boolean) => {
    const outcome = await setDriverOnline(val);
    reportOutcome(
      outcome,
      val ? 'You are Online' : 'You are Offline',
      val
        ? pushEnabled
          ? 'New StayRide ride requests will reach you here and as notifications.'
          : 'New StayRide ride requests will appear in My Rides.'
        : 'You will not receive any new ride requests until you go online again.'
    );
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of your driver account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          navigation.replace('Login');
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 10, Platform.OS === 'ios' ? 54 : 38) }]}>
        <Text style={styles.headerTitle}>Driver Profile</Text>
        <Text style={styles.headerSubtitle}>Vehicle &amp; Network Availability</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(driver?.name || '—').charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.driverName}>{show(driver?.name)}</Text>
          <Text style={styles.driverContact}>{show(driver?.phone)} • {show(driver?.email)}</Text>
          <View style={styles.ratingBadge}>
            <Ionicons name="shield-checkmark" size={14} color="#F59E0B" />
            <Text style={styles.ratingText}>
              {driver?.status === 'ACTIVE' ? 'Approved by StayRide' : driver?.status === 'BLOCKED' ? 'Blocked' : driver?.status === 'PENDING_APPROVAL' ? 'Awaiting approval' : '—'}
            </Text>
          </View>
        </View>

        {/* Availability Toggle */}
        <View style={styles.statusToggleCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>
              {isOnline ? '🟢 Available for Nearby Rides' : '🔴 Currently Offline'}
            </Text>
            <Text style={styles.toggleSub}>
              {isOnline
                ? 'Visible to mountain homestays looking for cabs'
                : 'Paused: You will not receive any booking requests'}
            </Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={handleToggleOnline}
            trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
            thumbColor={isOnline ? '#16A34A' : '#94A3B8'}
          />
        </View>

        {/* Vehicle Information */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Vehicle Details</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Vehicle Model:</Text>
            <Text style={styles.infoVal}>{show(driver?.vehicle)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Registration / Plate:</Text>
            <Text style={[styles.infoVal, styles.plateText]}>{show(driver?.plate)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Operating Base:</Text>
            <Text style={styles.infoVal}>{show(driver?.area)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Vehicle Type:</Text>
            <Text style={styles.infoVal}>{show(driver?.vehicleType)}</Text>
          </View>
        </View>

        {/* App Info & Safety */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>App &amp; Support</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Network Version:</Text>
            <Text style={styles.infoVal}>StayRide Driver v2.0</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Seats:</Text>
            <Text style={styles.infoVal}>{show(driver?.seats)}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.accountBtn} onPress={() => navigation.navigate('Account')} accessibilityRole="button">
          <Ionicons name="person-circle-outline" size={20} color={Colors.brandPrimaryDark} />
          <View style={{ flex: 1 }}>
            <Text style={styles.accountText}>Account & privacy</Text>
            <Text style={styles.accountSub}>Google sign-in, devices, privacy, terms, delete account</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
        </TouchableOpacity>

        {/* One sign-out here; "sign out of all devices" lives in Account & privacy → Security */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} accessibilityRole="button">
          <Ionicons name="log-out-outline" size={20} color={Colors.white} />
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  accountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  accountText: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  accountSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 54 : 38,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  driverName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  driverContact: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 10,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
  },
  statusToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  toggleSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    paddingRight: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  infoVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  plateText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    color: '#2563EB',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#DC2626',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 24,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
});
