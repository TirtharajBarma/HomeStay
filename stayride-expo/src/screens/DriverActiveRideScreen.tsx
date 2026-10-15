import React from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../theme/colors';
import { useStayRide } from '../data/store';

export const DriverActiveRideScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { trips, session, completeTrip } = useStayRide();

  const driverId = Number(session?.driver?.id) || 1;
  const driverName = session?.driver?.name || 'Local Driver';

  // Find active ride: status TRIP_STARTED first, then CONFIRMED
  const activeRide = trips.find(
    (t) =>
      (t.driverId === driverId || (t.driverName && t.driverName.toLowerCase().includes(driverName.toLowerCase()))) &&
      (t.status === 'TRIP_STARTED' || t.status === 'CONFIRMED')
  );

  const handleOpenGoogleMaps = () => {
    if (!activeRide) return;
    const origin = encodeURIComponent(activeRide.pickup);
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
    if (!activeRide) return;
    const cashDue = Math.max(0, (activeRide.fare || 0) - (activeRide.advancePaid ? activeRide.advanceAmount || 0 : 0));

    Alert.alert(
      'Complete Trip',
      `Did you collect ₹${cashDue.toLocaleString()} in cash from ${activeRide.guestName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Cash & Complete',
          style: 'default',
          onPress: async () => {
            try {
              await completeTrip(activeRide.id, activeRide.fare);
              Alert.alert('Trip Completed!', `₹${cashDue.toLocaleString()} cash collected successfully.`);
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Could not complete trip.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
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
            {/* Status Pill */}
            <View style={styles.statusRow}>
              <View style={styles.livePill}>
                <View style={styles.pulseDot} />
                <Text style={styles.liveText}>
                  {activeRide.status === 'TRIP_STARTED' ? 'RIDE IN PROGRESS' : 'AWAITING PICKUP'}
                </Text>
              </View>
              <Text style={styles.fareTag}>Total ₹{activeRide.fare}</Text>
            </View>

            {/* Passenger Header */}
            <View style={styles.passengerRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {activeRide.guestName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.passengerName}>{activeRide.guestName}</Text>
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
              <Text style={styles.mapBtnText}>Open Google Maps Navigation ↗</Text>
            </TouchableOpacity>

            {/* Passenger Contact Action Buttons */}
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

            {/* Cash Collection Ledger */}
            <View style={styles.cashLedgerCard}>
              <Text style={styles.cashLedgerTitle}>Mountain Cash Collection</Text>
              <View style={styles.ledgerRow}>
                <Text style={styles.ledgerLabel}>Total Agreed Fare:</Text>
                <Text style={styles.ledgerValue}>₹{activeRide.fare}</Text>
              </View>
              <View style={styles.ledgerRow}>
                <Text style={styles.ledgerLabel}>{activeRide.advancePaid ? 'Advance Paid:' : 'Advance (not paid yet):'}</Text>
                <Text style={styles.ledgerPaid}>{activeRide.advancePaid ? `- ₹${activeRide.advanceAmount || 0}` : '₹0'}</Text>
              </View>
              <View style={[styles.ledgerRow, styles.ledgerRowTotal]}>
                <Text style={styles.ledgerTotalLabel}>Cash to Collect from Guest:</Text>
                <Text style={styles.ledgerTotalValue}>
                  ₹{Math.max(0, (activeRide.fare || 0) - (activeRide.advancePaid ? activeRide.advanceAmount || 0 : 0)).toLocaleString()}
                </Text>
              </View>
            </View>

            {/* Complete Ride Button */}
            <TouchableOpacity style={styles.completeBtn} onPress={handleFinishTrip}>
              <Ionicons name="checkmark-done-circle" size={22} color="#FFFFFF" />
              <Text style={styles.completeBtnText}>Complete Ride & Collect Cash</Text>
            </TouchableOpacity>
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
});
