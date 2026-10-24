import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Shadows } from '../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStayRide } from '../data/store';
import { formatINR } from '../utils/format';
import { reportOutcome } from '../utils/report';

export const DriverActiveRideScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { driverTrips, driverCompleteTrip, driverStartTrip } = useStayRide();
  const [completing, setCompleting] = useState(false);
  const [starting, setStarting] = useState(false);

  // Active ride: TRIP_STARTED first, then the closest upcoming CONFIRMED ride by date
  const mine = driverTrips.filter((t) => t.assignedToMe);
  const inProgress = mine.find((t) => t.status === 'TRIP_STARTED');
  const upcomingConfirmed = [...mine]
    .filter((t) => t.status === 'CONFIRMED')
    .sort((a, b) => Number(a.date) - Number(b.date))[0];
  const activeRide = inProgress || upcomingConfirmed;

  // Cash the driver collects, exactly as the server reports it
  const cashDue = typeof activeRide?.remainingCashAmount === 'number' ? formatINR(activeRide.remainingCashAmount) : '—';
  const fareText = activeRide?.fare ? formatINR(activeRide.fare) : '—';

  const handleStartTrip = async () => {
    if (!activeRide || starting) return;
    setStarting(true);
    try {
      const outcome = await driverStartTrip(activeRide.reference);
      reportOutcome(outcome, 'Ride Started', 'Navigate safely to pickup.');
    } finally {
      setStarting(false);
    }
  };

  const handleOpenGoogleMaps = () => {
    if (!activeRide) return;
    // Exact pin when the homestay set one, else the pickup text
    const origin =
      typeof activeRide.pickupLat === 'number' && typeof activeRide.pickupLng === 'number'
        ? `${activeRide.pickupLat},${activeRide.pickupLng}`
        : encodeURIComponent(activeRide.pickup);
    const destination = encodeURIComponent(activeRide.destination);
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Map Error', 'Could not open Google Maps navigation.');
    });
  };

  const handleCall = () => {
    if (!activeRide?.phone) return;
    Linking.openURL(`tel:${activeRide.phone}`).catch(() => {
      Alert.alert('Error', 'Calling is not supported on this device.');
    });
  };

  const handleWhatsApp = () => {
    if (!activeRide?.phone) return;
    const cleanPhone = activeRide.phone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
    const msg = `Hello ${activeRide.guestName}, I am on my way to your pickup at ${activeRide.pickup}.`;
    Linking.openURL(`whatsapp://send?phone=${phoneWithCountry}&text=${encodeURIComponent(msg)}`).catch(() => {
      Alert.alert('WhatsApp Error', 'WhatsApp is not installed.');
    });
  };

  const handleFinishTrip = () => {
    if (!activeRide || completing) return;

    Alert.alert(
      'Complete Trip',
      `Did you collect ${cashDue} in cash from ${activeRide.guestName || 'the guest'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Cash & Complete',
          style: 'default',
          onPress: async () => {
            setCompleting(true);
            const outcome = await driverCompleteTrip(activeRide.reference);
            setCompleting(false);
            reportOutcome(outcome, 'Trip Completed!', 'StayRide has recorded this trip as completed.');
          },
        },
      ]
    );
  };

  const handleGuestAbsent = () => {
    Alert.alert(
      'Guest Not at Pickup?',
      'Please call the passenger directly or contact the host. Standard mountain waiting time is 15 minutes before reporting a no-show.',
      [
        activeRide?.phone
          ? {
              text: '📞 Call Passenger',
              onPress: () => {
                Linking.openURL(`tel:${activeRide.phone}`);
              },
            }
          : { text: 'OK' },
        { text: 'Dismiss', style: 'cancel' },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={styles.headerTitle}>Active Ride Navigation</Text>
        <Text style={styles.headerSubtitle}>Live Turn-by-Turn Route & Cash Collection</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!activeRide ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyCircle}>
              <Ionicons name="navigate-circle-outline" size={64} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>No Active Ride in Progress</Text>
            <Text style={styles.emptySubtitle}>
              Go to "My Rides" and tap "Start Ride" on any of your confirmed bookings to begin navigation.
            </Text>
          </View>
        ) : (
          <View style={styles.activeCard}>
            {/* Fix 8: Cash Hero Card — prominent at very top */}
            {typeof activeRide.remainingCashAmount === 'number' && activeRide.remainingCashAmount > 0 && (
              <View style={styles.cashHeroCard}>
                <Text style={styles.cashHeroLabel}>💵  COLLECT FROM PASSENGER</Text>
                <Text style={styles.cashHeroAmount}>{cashDue}</Text>
                <Text style={styles.cashHeroSub}>Pay at drop-off in cash or personal UPI</Text>
              </View>
            )}

            {/* Status Pill */}
            <View style={styles.statusRow}>
              <View style={styles.livePill}>
                <View style={styles.pulseDot} />
                <Text style={styles.liveText}>
                  {activeRide.status === 'TRIP_STARTED' ? 'RIDE IN PROGRESS' : 'AWAITING PICKUP'}
                </Text>
              </View>
              <Text style={styles.fareTag}>Total {fareText}</Text>
            </View>

            {/* Passenger Header */}
            <View style={styles.passengerRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(activeRide.guestName || '—').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.passengerName}>{activeRide.guestName || '—'}</Text>
                <Text style={styles.passengerMeta}>
                  {activeRide.passengers} Passengers • {activeRide.vehicleType}
                </Text>
              </View>
            </View>

            {/* Route Map Card */}
            <View style={styles.routeCard}>
              <View style={styles.stopItem}>
                <Ionicons name="radio-button-on" size={18} color="#2563EB" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.stopLabel}>PICKUP LOCATION</Text>
                  <Text style={styles.stopAddress}>{activeRide.pickup}</Text>
                </View>
              </View>

              {activeRide.destinations && activeRide.destinations.length > 0 ? (
                activeRide.destinations.map((d, i) => (
                  <View key={i} style={styles.stopItem}>
                    <Ionicons name="pin" size={18} color="#0284C7" />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.stopLabel}>STOP {i + 1}</Text>
                      <Text style={styles.stopAddress}>{d.address}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.stopItem}>
                  <Ionicons name="location" size={18} color="#DC2626" />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.stopLabel}>DROP DESTINATION</Text>
                    <Text style={styles.stopAddress}>{activeRide.destination}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Google Maps Button */}
            <TouchableOpacity style={styles.mapBtn} onPress={handleOpenGoogleMaps}>
              <Ionicons name="navigate" size={18} color="#FFFFFF" />
              <Text style={styles.mapBtnText}>🗺️  Navigate to Pickup</Text>
            </TouchableOpacity>
            {/* Fix 8: GPS warning if no pin set */}
            {!(typeof activeRide.pickupLat === 'number') && (
              <View style={styles.gpsWarning}>
                <Ionicons name="warning-outline" size={14} color="#92400E" />
                <Text style={styles.gpsWarningText}>
                  No GPS pin — navigation uses address text only. Ask the owner to pin their exact location in Settings.
                </Text>
              </View>
            )}

            {/* Passenger Contact Action Buttons: guest contact arrives only after the advance is paid */}
            {!activeRide.phone ? (
              <Text style={styles.passengerMeta}>Guest contact shared after advance is paid</Text>
            ) : (
            <View style={styles.contactRow}>
              <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
                <Ionicons name="call" size={18} color="#FFFFFF" />
                <Text style={styles.callBtnText}>Call Passenger</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.wpBtn} onPress={handleWhatsApp}>
                <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                <Text style={styles.wpBtnText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
            )}

            {/* Cash Collection Ledger */}
            <View style={styles.cashLedgerCard}>
              <Text style={styles.cashLedgerTitle}>Mountain Cash Collection</Text>
              <View style={styles.ledgerRow}>
                <Text style={styles.ledgerLabel}>Total Agreed Fare:</Text>
                <Text style={styles.ledgerValue}>{fareText}</Text>
              </View>
              <View style={styles.ledgerRow}>
                <Text style={styles.ledgerLabel}>{activeRide.advancePaid ? 'Advance Paid:' : 'Advance (not paid yet):'}</Text>
                <Text style={styles.ledgerPaid}>
                  {typeof activeRide.advanceAmount === 'number' ? formatINR(activeRide.advanceAmount) : '—'}
                </Text>
              </View>
              <View style={[styles.ledgerRow, styles.ledgerRowTotal]}>
                <Text style={styles.ledgerTotalLabel}>Cash to Collect from Guest:</Text>
                <Text style={styles.ledgerTotalValue}>{cashDue}</Text>
              </View>
              {typeof activeRide.driverNetPayout === 'number' && (
                <View style={styles.ledgerRow}>
                  <Text style={styles.ledgerLabel}>Your net payout:</Text>
                  <Text style={styles.ledgerValue}>{formatINR(activeRide.driverNetPayout)}</Text>
                </View>
              )}
            </View>

            {/* Start Ride Button: when trip is CONFIRMED and waiting to start */}
            {activeRide.status === 'CONFIRMED' && (
              <>
                <TouchableOpacity
                  style={[styles.startBtn]}
                  onPress={handleStartTrip}
                  disabled={starting}
                >
                  <Ionicons name="play-circle" size={22} color="#16A34A" />
                  <Text style={styles.startBtnText}>{starting ? 'Starting…' : '▶  Start Ride'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.waitingBtn}
                  onPress={handleGuestAbsent}
                  activeOpacity={0.7}
                >
                  <Ionicons name="time-outline" size={16} color="#64748B" />
                  <Text style={styles.waitingBtnText}>Guest Absent / Still Waiting?</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Complete Ride Button: only after the server recorded the start */}
            {activeRide.status === 'TRIP_STARTED' && (
              <TouchableOpacity style={styles.completeBtn} onPress={handleFinishTrip} disabled={completing}>
                <Ionicons name="checkmark-done-circle" size={22} color="#FFFFFF" />
                <Text style={styles.completeBtnText}>{completing ? 'Completing…' : '✓  Complete Ride & Collect Cash'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 30,
  },
  emptyCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  activeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.md,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
    marginRight: 6,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },
  fareTag: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  passengerMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  routeCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  stopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  stopLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  stopAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 1,
  },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 14,
  },
  mapBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  contactRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  callBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    borderRadius: 10,
  },
  callBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  wpBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    paddingVertical: 12,
    borderRadius: 10,
  },
  wpBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  cashLedgerCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  cashLedgerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 8,
  },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  ledgerLabel: {
    fontSize: 13,
    color: '#78350F',
  },
  ledgerValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  ledgerPaid: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  ledgerRowTotal: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
    marginTop: 6,
  },
  ledgerTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
  },
  ledgerTotalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#B45309',
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16A34A',
    paddingVertical: 16,
    borderRadius: 14,
  },
  completeBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  // Fix 8: Cash hero at top
  cashHeroCard: {
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#F59E0B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  cashHeroLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  cashHeroAmount: {
    fontSize: 36,
    fontWeight: '900',
    color: '#78350F',
    marginBottom: 4,
  },
  cashHeroSub: {
    fontSize: 11,
    color: '#92400E',
  },
  // Fix 8: GPS warning
  gpsWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  gpsWarningText: {
    flex: 1,
    fontSize: 11,
    color: '#92400E',
    lineHeight: 16,
  },
  // Fix 8: Start ride — outline green
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#16A34A',
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 10,
  },
  startBtnText: {
    color: '#16A34A',
    fontWeight: '800',
    fontSize: 15,
  },
  waitingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 2,
    marginBottom: 6,
  },
  waitingBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textDecorationLine: 'underline',
  },
});
