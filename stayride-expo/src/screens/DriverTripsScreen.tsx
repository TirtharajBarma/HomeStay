import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii, Shadows } from '../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStayRide } from '../data/store';
import { CabTrip } from '../types';

export const DriverTripsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { trips, session, quoteTrip, startTrip } = useStayRide();

  const [activeTab, setActiveTab] = useState<'requests' | 'assigned' | 'completed'>('requests');
  const [quoteInputs, setQuoteInputs] = useState<Record<number, string>>({});
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  const driverId = Number(session?.driver?.id) || 1;
  const driverName = session?.driver?.name || 'Local Driver';

  // Available requests in the mountain pool
  const incomingRequests = trips.filter(
    (t) => t.status === 'NEW_REQUEST' || t.status === 'FINDING_DRIVER' || t.status === 'QUOTE_RECEIVED'
  );

  // Rides assigned or confirmed for this specific driver
  const assignedRides = trips.filter(
    (t) =>
      (t.driverId === driverId || (t.driverName && t.driverName.toLowerCase().includes(driverName.toLowerCase()))) &&
      (t.status === 'DRIVER_ASSIGNED' || t.status === 'CONFIRMED' || t.status === 'TRIP_STARTED')
  );

  // Completed rides
  const completedRides = trips.filter(
    (t) =>
      (t.driverId === driverId || (t.driverName && t.driverName.toLowerCase().includes(driverName.toLowerCase()))) &&
      t.status === 'COMPLETED'
  );

  const handleQuoteChange = (tripId: number, val: string) => {
    setQuoteInputs((prev) => ({ ...prev, [tripId]: val }));
  };

  const handleSendQuote = async (trip: CabTrip) => {
    const rawVal = quoteInputs[trip.id] || String(trip.estFare || 3000);
    const amount = parseInt(rawVal.replace(/[^0-9]/g, ''), 10);
    if (!amount || amount < 500) {
      Alert.alert('Invalid Fare', 'Please enter a valid quoted fare of at least ₹500.');
      return;
    }

    setSubmittingId(trip.id);
    try {
      await quoteTrip(trip.id, driverId, amount);
      Alert.alert('Quote Submitted', `Your quote of ₹${amount.toLocaleString()} was sent to the homestay host!`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not send quote. Please try again.');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleCallPassenger = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Error', 'Calling is not supported on this device.');
    });
  };

  const handleWhatsAppPassenger = (phone: string, guestName: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
    const msg = `Hello ${guestName}, this is ${driverName}, your StayRide cab driver. I am getting ready for your pickup.`;
    Linking.openURL(`whatsapp://send?phone=${phoneWithCountry}&text=${encodeURIComponent(msg)}`).catch(() => {
      Alert.alert('WhatsApp Error', 'WhatsApp is not installed.');
    });
  };

  const handleStartRide = async (tripId: number) => {
    try {
      await startTrip(tripId);
      Alert.alert('Trip Started', 'Ride is now active! Drive safely through the mountain roads.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not start trip.');
    }
  };

  const insets = useSafeAreaInsets();
  const driverStatus = session?.driver?.status || 'ACTIVE';
  const statusReason = session?.driver?.statusReason || '';
  const isOnline = session?.driver?.available !== false;

  return (
    <View style={styles.container}>
      {/* Top Banner */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <View>
          <Text style={styles.headerTitle}>Driver Console</Text>
          <Text style={styles.headerSubtitle}>{driverName} • {session?.driver?.vehicle || 'SUV'}</Text>
        </View>
        <View style={[
          styles.statusBadge,
          driverStatus === 'BLOCKED'
            ? { backgroundColor: '#FEE2E2' }
            : driverStatus === 'PENDING_APPROVAL'
            ? { backgroundColor: '#FEF3C7' }
            : !isOnline
            ? { backgroundColor: '#F1F5F9' }
            : { backgroundColor: '#DCFCE7' }
        ]}>
          <View style={[
            styles.statusDot,
            driverStatus === 'BLOCKED'
              ? { backgroundColor: '#EF4444' }
              : driverStatus === 'PENDING_APPROVAL'
              ? { backgroundColor: '#F59E0B' }
              : !isOnline
              ? { backgroundColor: '#94A3B8' }
              : { backgroundColor: '#16A34A' }
          ]} />
          <Text style={[
            styles.statusText,
            driverStatus === 'BLOCKED'
              ? { color: '#B91C1C' }
              : driverStatus === 'PENDING_APPROVAL'
              ? { color: '#B45309' }
              : !isOnline
              ? { color: '#64748B' }
              : { color: '#15803D' }
          ]}>
            {driverStatus === 'BLOCKED' ? 'Suspended' : driverStatus === 'PENDING_APPROVAL' ? 'Under Review' : isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Offline Status Notice Banner */}
      {driverStatus === 'ACTIVE' && !isOnline && (
        <View style={{ backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 16, paddingVertical: 9, flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="pause-circle-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />
          <Text style={{ fontSize: 12, color: '#64748B', flex: 1 }}>
            You are currently Offline. Turn availability ON in Profile to receive new ride dispatches.
          </Text>
        </View>
      )}

      {/* Account Status Notice Banner */}
      {driverStatus === 'PENDING_APPROVAL' && (
        <View style={{ backgroundColor: '#FFFBEB', borderBottomWidth: 1, borderColor: '#FDE68A', paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="time-outline" size={18} color="#D97706" style={{ marginRight: 8 }} />
          <Text style={{ fontSize: 13, color: '#92400E', flex: 1 }}>
            Your driver profile is currently under review by StayRide. Once approved, you can receive trip dispatches and submit quotes.
          </Text>
        </View>
      )}

      {driverStatus === 'BLOCKED' && (
        <View style={{ backgroundColor: '#FEF2F2', borderBottomWidth: 1, borderColor: '#FECACA', paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="alert-circle-outline" size={18} color="#DC2626" style={{ marginRight: 8 }} />
          <Text style={{ fontSize: 13, color: '#991B1B', flex: 1 }}>
            Account Suspended: {statusReason || 'Please contact StayRide admin support.'}
          </Text>
        </View>
      )}

      {/* Segmented Tab Row */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'requests' && styles.tabBtnActive]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
            Requests ({incomingRequests.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'assigned' && styles.tabBtnActive]}
          onPress={() => setActiveTab('assigned')}
        >
          <Text style={[styles.tabText, activeTab === 'assigned' && styles.tabTextActive]}>
            My Rides ({assignedRides.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'completed' && styles.tabBtnActive]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>
            History ({completedRides.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.listContainer}>
        {/* TAB 1: INCOMING REQUESTS TO QUOTE */}
        {activeTab === 'requests' && (
          <>
            {incomingRequests.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="car-sport-outline" size={48} color={Colors.textTertiary} />
                <Text style={styles.emptyTitle}>No pending ride requests</Text>
                <Text style={styles.emptySubtitle}>You will be notified as soon as homestays or guests request a cab nearby.</Text>
              </View>
            ) : (
              incomingRequests.map((t) => {
                const myQuote = t.quotes?.find((q) => Number(q.driverId) === driverId);
                const hasQuoted = !!myQuote;
                const inputValue = quoteInputs[t.id] ?? (t.estFare ? String(t.estFare) : '3200');

                return (
                  <View key={t.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.badgeNew}>
                        <Text style={styles.badgeNewText}>
                          {t.isRoundTrip ? '🔄 Round Trip' : '🚗 One-Way'}
                        </Text>
                      </View>
                      <Text style={styles.fareEst}>Est. ₹{t.estFare || 3000}</Text>
                    </View>

                    <View style={styles.routeContainer}>
                      <View style={styles.routeRow}>
                        <Ionicons name="radio-button-on" size={16} color={Colors.brandPrimary} />
                        <Text style={styles.routeText} numberOfLines={1}>
                          From: {t.pickup}
                        </Text>
                      </View>

                      {t.destinations && t.destinations.length > 0 ? (
                        t.destinations.map((d, i) => (
                          <View key={i} style={[styles.routeRow, { paddingLeft: 16 }]}>
                            <Ionicons name="pin" size={14} color="#0284c7" />
                            <Text style={styles.routeSubText} numberOfLines={1}>
                              Stop {i + 1}: {d.address}
                            </Text>
                          </View>
                        ))
                      ) : (
                        <View style={styles.routeRow}>
                          <Ionicons name="location" size={16} color="#ef4444" />
                          <Text style={styles.routeText} numberOfLines={1}>
                            To: {t.destination}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.metaRow}>
                      <Text style={styles.metaText}>
                        📅 {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at {t.time}
                      </Text>
                      <Text style={styles.metaText}>👥 {t.passengers} Pax • {t.vehicleType}</Text>
                    </View>

                    {/* Quotation Section */}
                    {hasQuoted ? (
                      <View style={styles.quotedBox}>
                        <Ionicons name="checkmark-circle" size={18} color="#059669" />
                        <Text style={styles.quotedText}>
                          Quoted ₹{myQuote?.quotedFare.toLocaleString()} — Awaiting Host Confirmation
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.quoteRow}>
                        <View style={styles.inputWrap}>
                          <Text style={styles.rupeePrefix}>₹</Text>
                          <TextInput
                            style={styles.quoteInput}
                            keyboardType="numeric"
                            value={inputValue}
                            onChangeText={(val) => handleQuoteChange(t.id, val)}
                            placeholder="Fare"
                          />
                        </View>
                        <TouchableOpacity
                          style={styles.quoteBtn}
                          onPress={() => handleSendQuote(t)}
                          disabled={submittingId === t.id}
                        >
                          <Text style={styles.quoteBtnText}>
                            {submittingId === t.id ? 'Sending…' : 'Send Quote'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}

        {/* TAB 2: MY ASSIGNED & CONFIRMED RIDES */}
        {activeTab === 'assigned' && (
          <>
            {assignedRides.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="calendar-outline" size={48} color={Colors.textTertiary} />
                <Text style={styles.emptyTitle}>No confirmed rides assigned</Text>
                <Text style={styles.emptySubtitle}>Submit quotes on pending requests to win bookings.</Text>
              </View>
            ) : (
              assignedRides.map((t) => (
                <View key={t.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.badgeConfirmed}>
                      <Text style={styles.badgeConfirmedText}>
                        {t.status === 'TRIP_STARTED' ? '🟢 TRIP IN PROGRESS' : 'CONFIRMED RIDE'}
                      </Text>
                    </View>
                    <Text style={styles.fareConfirmed}>Fare: ₹{t.fare || t.estFare}</Text>
                  </View>

                  <Text style={styles.passengerName}>Passenger: {t.guestName}</Text>
                  <Text style={styles.pickupDetail}>Pickup: {t.pickup}</Text>
                  <Text style={styles.dropDetail}>Destination: {t.destination}</Text>
                  <Text style={styles.timeDetail}>
                    📅 {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at {t.time}
                  </Text>

                  {/* Cash breakdown */}
                  <View style={styles.cashBox}>
                    <Text style={styles.cashLabel}>Collect Cash from Passenger:</Text>
                    <Text style={styles.cashValue}>₹{Math.max(0, (t.fare || 0) - (t.advancePaid ? t.advanceAmount || 0 : 0))}</Text>
                  </View>

                  {/* Action buttons */}
                  <View style={styles.actionBtnRow}>
                    <TouchableOpacity
                      style={styles.callBtn}
                      onPress={() => handleCallPassenger(t.phone)}
                    >
                      <Ionicons name="call" size={16} color="#FFFFFF" />
                      <Text style={styles.callBtnText}>Call</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.wpBtn}
                      onPress={() => handleWhatsAppPassenger(t.phone, t.guestName)}
                    >
                      <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
                      <Text style={styles.wpBtnText}>WhatsApp</Text>
                    </TouchableOpacity>
                    {t.status !== 'TRIP_STARTED' && (
                      <TouchableOpacity
                        style={styles.startBtn}
                        onPress={() => handleStartRide(t.id)}
                      >
                        <Text style={styles.startBtnText}>Start Ride</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* TAB 3: COMPLETED RIDES */}
        {activeTab === 'completed' && (
          <>
            {completedRides.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="time-outline" size={48} color={Colors.textTertiary} />
                <Text style={styles.emptyTitle}>No completed trips yet</Text>
                <Text style={styles.emptySubtitle}>Completed trips and payouts will be archived here.</Text>
              </View>
            ) : (
              completedRides.map((t) => (
                <View key={t.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.completedTag}>COMPLETED</Text>
                    <Text style={styles.fareEst}>₹{t.fare || t.estFare}</Text>
                  </View>
                  <Text style={styles.passengerName}>{t.guestName}</Text>
                  <Text style={styles.routeSubText}>{t.pickup} ➔ {t.destination}</Text>
                  <Text style={styles.metaText}>
                    {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
              ))
            )}
          </>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: '#EFF6FF',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgeNew: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeNewText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  badgeConfirmed: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeConfirmedText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  fareEst: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  fareConfirmed: {
    fontSize: 16,
    fontWeight: '800',
    color: '#059669',
  },
  routeContainer: {
    marginBottom: 10,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 3,
  },
  routeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  routeSubText: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginBottom: 12,
  },
  metaText: {
    fontSize: 12,
    color: '#64748B',
  },
  quoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  rupeePrefix: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
    marginRight: 4,
  },
  quoteInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  quoteBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 18,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quoteBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  quotedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    padding: 10,
    borderRadius: 8,
  },
  quotedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#047857',
    flex: 1,
  },
  passengerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  pickupDetail: {
    fontSize: 13,
    color: '#334155',
    marginVertical: 2,
  },
  dropDetail: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 4,
  },
  timeDetail: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
  },
  cashBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cashLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  cashValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#B45309',
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  callBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    borderRadius: 8,
  },
  callBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  wpBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    paddingVertical: 10,
    borderRadius: 8,
  },
  wpBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  startBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 8,
  },
  startBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  completedTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
