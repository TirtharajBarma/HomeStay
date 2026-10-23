import React, { useEffect, useState } from 'react';
import * as Location from 'expo-location';
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
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii, Shadows } from '../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStayRide } from '../data/store';
import { DriverTrip } from '../types';
import { reportOutcome } from '../utils/report';

export const DriverTripsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { driverTrips, session, driverQuote, driverStartTrip, driverAcceptCounter, sync, syncing, pushEnabled, reportDriverLocation } = useStayRide();

  const [activeTab, setActiveTab] = useState<'requests' | 'assigned' | 'completed'>('requests');
  const [quoteInputs, setQuoteInputs] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  // References whose quote the driver is revising (allowed while the request is still open)
  const [revising, setRevising] = useState<Record<string, boolean>>({});

  const driverName = session?.driver?.name || '—';

  // The server decides what this driver sees: open requests (no guest details) and trips assigned to them
  // driverView (when the server sends it) is authoritative; lost trips (CANCELLED/REASSIGNED/EXPIRED) go to history.
  const isLost = (t: DriverTrip) =>
    t.driverView === 'CANCELLED' || t.driverView === 'REASSIGNED' || t.driverView === 'EXPIRED' ||
    (!t.driverView && (t.status === 'CANCELLED' || t.status === 'EXPIRED'));
  const incomingRequests = driverTrips.filter(
    (t) =>
      !isLost(t) &&
      !t.assignedToMe &&
      (t.status === 'NEW_REQUEST' || t.status === 'FINDING_DRIVER' || t.status === 'QUOTE_RECEIVED')
  );
  const assignedRides = driverTrips.filter(
    (t) => !isLost(t) && t.assignedToMe && (t.status === 'AWAITING_ADVANCE' || t.status === 'CONFIRMED' || t.status === 'TRIP_STARTED')
  );
  const completedRides = driverTrips.filter((t) => !isLost(t) && t.assignedToMe && t.status === 'COMPLETED');
  const lostRides = driverTrips.filter(isLost);

  const handleQuoteChange = (reference: string, val: string) => {
    setQuoteInputs((prev) => ({ ...prev, [reference]: val }));
  };

  const handleSendQuote = async (trip: DriverTrip) => {
    const raw = (quoteInputs[trip.reference] || '').replace(/[₹,\s]/g, '');
    const amount = /^\d+$/.test(raw) ? parseInt(raw, 10) : 0;
    if (!amount || amount <= 0) {
      Alert.alert('Invalid Fare', 'Please enter the in-hand cash fare you want to collect.');
      return;
    }

    const cash = amount;
    const fee = Math.max(200, Math.round(cash * 0.10));
    const total = cash + fee;

    setSubmittingId(trip.reference);
    const outcome = await driverQuote(trip.reference, total);
    setSubmittingId(null);
    if (outcome.ok) setRevising((prev) => ({ ...prev, [trip.reference]: false }));
    reportOutcome(
      outcome,
      'Quote Submitted',
      `Your quote of ₹${cash.toLocaleString()} in-hand cash was sent (Passenger total bill: ₹${total.toLocaleString()}).`
    );
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

  // Queues offline and reports honestly: server-confirmed shows success, queued shows "saved offline"
  const [pinModalRef, setPinModalRef] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');

  const handleStartRide = async (reference: string, otp?: string) => {
    if (submittingId) return;
    setSubmittingId(reference);
    const outcome = await driverStartTrip(reference, otp);
    setSubmittingId(null);
    if (outcome.ok) {
      setPinModalRef(null);
      setPinInput('');
    }
    reportOutcome(outcome, 'Trip Started', 'Ride is now active! Drive safely through the mountain roads.');
  };

  const insets = useSafeAreaInsets();
  const driverStatus = session?.driver?.status || 'ACTIVE';
  const statusReason = session?.driver?.statusReason || '';
  const isOnline = session?.driver?.available !== false;

  // While online, tell StayRide where the driver is so only nearby requests reach them.
  // Asked once, foreground only, refreshed every 10 minutes while this screen is open.
  useEffect(() => {
    if (!isOnline || driverStatus !== 'ACTIVE') return;
    let cancelled = false;
    const report = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) await reportDriverLocation(pos.coords.latitude, pos.coords.longitude);
      } catch {
        // no GPS fix in a valley is normal: the last known position stays on the server
      }
    };
    report();
    const timer = setInterval(report, 10 * 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isOnline, driverStatus, reportDriverLocation]);

  return (
    <View style={styles.container}>
      {/* Top Banner */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <View>
          <Text style={styles.headerTitle}>Driver Console</Text>
          <Text style={styles.headerSubtitle}>{driverName} • {session?.driver?.vehicle || '—'}</Text>
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
            History ({completedRides.length + lostRides.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={sync} />}
      >
        {/* TAB 1: INCOMING REQUESTS TO QUOTE */}
        {activeTab === 'requests' && (
          <>
            {incomingRequests.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="car-sport-outline" size={48} color={Colors.textTertiary} />
                <Text style={styles.emptyTitle}>No pending ride requests</Text>
                <Text style={styles.emptySubtitle}>
                  {pushEnabled
                    ? 'You will be notified as soon as a new cab request comes in.'
                    : 'Check back here for new cab requests. Pull down to refresh.'}
                </Text>
              </View>
            ) : (
              incomingRequests.map((t) => {
                const myQuote = t.myQuote;
                const hasQuoted = !!myQuote;
                const canRevise = hasQuoted && myQuote?.status !== 'REJECTED';
                const showInput = !hasQuoted || !!revising[t.reference];
                const inputValue = quoteInputs[t.reference] ?? '';

                return (
                  <View key={t.reference} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.badgeNew}>
                        <Text style={styles.badgeNewText}>
                          {t.isRoundTrip ? '🔄 Round Trip' : '🚗 One-Way'}
                        </Text>
                      </View>
                      <Text style={styles.fareEst}>{t.homestayName || ''}</Text>
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

                    {/* Homestay's counter-offer: accept = trip confirmed at that fare */}
                    {myQuote?.status === 'PENDING' && typeof myQuote.counterFare === 'number' && myQuote.counterFare > 0 && (
                      <View style={styles.counterBox}>
                        <Text style={styles.counterText}>Homestay offers ₹{myQuote.counterFare.toLocaleString('en-IN')}</Text>
                        <TouchableOpacity
                          style={styles.counterAccept}
                          disabled={submittingId === t.reference}
                          onPress={async () => {
                            setSubmittingId(t.reference);
                            const outcome = await driverAcceptCounter(t.reference);
                            setSubmittingId(null);
                            reportOutcome(outcome, 'Trip is yours', 'You accepted the offer. The trip is confirmed once the guest pays the advance.');
                          }}
                        >
                          <Text style={styles.counterAcceptText}>{submittingId === t.reference ? 'Accepting…' : 'Accept'}</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Quotation Section */}
                    {!showInput ? (
                      <View style={styles.quotedBox}>
                        <Ionicons name="checkmark-circle" size={18} color="#059669" />
                        <Text style={styles.quotedText}>
                          Quoted ₹{Math.round((myQuote?.quotedFare ?? 0) * 0.90).toLocaleString()} in-hand (Passenger bill: ₹{myQuote?.quotedFare.toLocaleString()}) —{' '}
                          {myQuote?.status === 'REJECTED' ? 'Not selected' : myQuote?.status === 'EXPIRED' ? 'Expired, quote again' : 'Awaiting Host Confirmation'}
                        </Text>
                        {canRevise && (
                          <TouchableOpacity
                            onPress={() => {
                              handleQuoteChange(t.reference, String(Math.round((myQuote?.quotedFare ?? 0) * 0.90)));
                              setRevising((prev) => ({ ...prev, [t.reference]: true }));
                            }}
                          >
                            <Text style={styles.reviseText}>Revise</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : (
                      <View>
                        <View style={styles.chipRow}>
                          {[1800, 2200, 2800, 3500].map((amt) => (
                            <TouchableOpacity
                              key={amt}
                              style={[styles.chip, Number(inputValue) === amt && styles.chipActive]}
                              onPress={() => handleQuoteChange(t.reference, String(amt))}
                            >
                              <Text style={[styles.chipText, Number(inputValue) === amt && styles.chipTextActive]}>
                                ₹{amt.toLocaleString('en-IN')}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <View style={styles.quoteRow}>
                          <View style={styles.inputWrap}>
                            <Text style={styles.rupeePrefix}>₹</Text>
                            <TextInput
                              style={styles.quoteInput}
                              keyboardType="numeric"
                              value={inputValue}
                              onChangeText={(val) => handleQuoteChange(t.reference, val)}
                              placeholder="In-hand cash"
                            />
                          </View>
                          <TouchableOpacity
                            style={styles.quoteBtn}
                            onPress={() => handleSendQuote(t)}
                            disabled={submittingId === t.reference || !(Number(inputValue) > 0)}
                          >
                            <Text style={styles.quoteBtnText}>
                              {submittingId === t.reference ? 'Sending…' : hasQuoted ? 'Update' : 'Send Quote'}
                            </Text>
                          </TouchableOpacity>
                          {hasQuoted && (
                            <TouchableOpacity onPress={() => setRevising((prev) => ({ ...prev, [t.reference]: false }))}>
                              <Text style={styles.reviseText}>Cancel</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        {Number(inputValue) > 0 && (
                          <View style={styles.quoteLiveBreakdown}>
                            <View style={styles.breakdownRow}>
                              <Text style={styles.breakdownLabel}>Cash you collect at drop-off:</Text>
                              <Text style={styles.breakdownCash}>₹{Number(inputValue).toLocaleString('en-IN')}</Text>
                            </View>
                            <View style={styles.breakdownRow}>
                              <Text style={styles.breakdownSub}>Online Booking Fee (guest pays StayRide):</Text>
                              <Text style={styles.breakdownSub}>+₹{Math.max(200, Math.round(Number(inputValue) * 0.10)).toLocaleString('en-IN')}</Text>
                            </View>
                          </View>
                        )}
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
                <View key={t.reference} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.badgeConfirmed}>
                      <Text style={styles.badgeConfirmedText}>
                        {t.status === 'TRIP_STARTED'
                          ? '🟢 TRIP IN PROGRESS'
                          : t.status === 'AWAITING_ADVANCE'
                          ? 'AWAITING GUEST ADVANCE'
                          : 'CONFIRMED RIDE'}
                      </Text>
                    </View>
                    <Text style={styles.fareConfirmed}>Fare: {t.fare ? `₹${t.fare.toLocaleString()}` : '—'}</Text>
                  </View>
                  {typeof t.driverNetPayout === 'number' && (
                    <Text style={styles.netPayout}>Your net payout: ₹{t.driverNetPayout.toLocaleString()}</Text>
                  )}

                  {t.guestName ? (
                    <Text style={styles.passengerName}>Passenger: {t.guestName}</Text>
                  ) : (
                    <Text style={styles.metaText}>Guest contact shared after advance is paid</Text>
                  )}
                  <Text style={styles.pickupDetail}>Pickup: {t.pickup}</Text>
                  <Text style={styles.dropDetail}>Destination: {t.destination}</Text>
                  <Text style={styles.timeDetail}>
                    📅 {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at {t.time}
                  </Text>

                  {/* Cash breakdown (server sends it only after the advance is paid) */}
                  {typeof t.remainingCashAmount === 'number' && (
                    <View style={styles.cashBox}>
                      <Text style={styles.cashLabel}>Collect Cash from Passenger:</Text>
                      <Text style={styles.cashValue}>₹{t.remainingCashAmount.toLocaleString()}</Text>
                    </View>
                  )}

                  {/* Action buttons */}
                  <View style={styles.actionBtnRow}>
                    {!!t.phone && (
                      <>
                        <TouchableOpacity style={styles.callBtn} onPress={() => handleCallPassenger(t.phone!)}>
                          <Ionicons name="call" size={16} color="#FFFFFF" />
                          <Text style={styles.callBtnText}>Call</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.wpBtn}
                          onPress={() => handleWhatsAppPassenger(t.phone!, t.guestName || '')}
                        >
                          <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
                          <Text style={styles.wpBtnText}>WhatsApp</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {t.status === 'CONFIRMED' && t.advancePaid && (
                      <TouchableOpacity
                        style={styles.startBtn}
                        disabled={submittingId === t.reference}
                        onPress={() => {
                          setPinModalRef(t.reference);
                          setPinInput('');
                        }}
                      >
                        <Text style={styles.startBtnText}>{submittingId === t.reference ? 'Starting…' : 'Start Ride'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {pinModalRef === t.reference && (
                    <View style={styles.pinModalBox}>
                      <Text style={styles.pinModalTitle}>Enter Passenger Boarding PIN</Text>
                      <Text style={styles.pinModalSub}>Ask passenger for 4-digit PIN on their booking screen:</Text>
                      <View style={styles.pinInputRow}>
                        <TextInput
                          style={styles.pinTextInput}
                          value={pinInput}
                          onChangeText={(text) => setPinInput(text.replace(/\D/g, '').slice(0, 4))}
                          placeholder="PIN"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="number-pad"
                          maxLength={4}
                        />
                        <TouchableOpacity
                          style={[styles.pinConfirmBtn, pinInput.length < 4 && { opacity: 0.5 }]}
                          disabled={pinInput.length < 4 || submittingId === t.reference}
                          onPress={() => handleStartRide(t.reference, pinInput)}
                        >
                          <Text style={styles.pinConfirmText}>{submittingId === t.reference ? 'Verifying…' : 'Start'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.pinCancelBtn} onPress={() => setPinModalRef(null)}>
                          <Text style={styles.pinCancelText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              ))
            )}
          </>
        )}

        {/* TAB 3: COMPLETED RIDES */}
        {activeTab === 'completed' && (
          <>
            {completedRides.length === 0 && lostRides.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="time-outline" size={48} color={Colors.textTertiary} />
                <Text style={styles.emptyTitle}>No completed trips yet</Text>
                <Text style={styles.emptySubtitle}>Completed trips and payouts will be archived here.</Text>
              </View>
            ) : (
              completedRides.map((t) => (
                <View key={t.reference} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.completedTag}>COMPLETED</Text>
                    <Text style={styles.fareEst}>{t.fare ? `₹${t.fare.toLocaleString()}` : '—'}</Text>
                  </View>
                  {!!t.guestName && <Text style={styles.passengerName}>{t.guestName}</Text>}
                  <Text style={styles.routeSubText}>{t.pickup} ➔ {t.destination}</Text>
                  <Text style={styles.metaText}>
                    {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {typeof t.driverNetPayout === 'number' ? ` • Net payout ₹${t.driverNetPayout.toLocaleString()}` : ''}
                  </Text>
                </View>
              ))
            )}
            {lostRides.length > 0 && <Text style={styles.sectionLabel}>Cancelled</Text>}
            {lostRides.map((t) => (
              <View key={t.reference} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.completedTag, { color: '#B91C1C' }]}>
                    {t.driverView === 'REASSIGNED'
                      ? 'REASSIGNED TO ANOTHER DRIVER'
                      : t.driverView === 'EXPIRED' || t.status === 'EXPIRED'
                      ? 'EXPIRED'
                      : 'CANCELLED'}
                  </Text>
                  <Text style={styles.metaText}>{t.homestayName || ''}</Text>
                </View>
                <Text style={styles.routeSubText}>{t.pickup} ➔ {t.destination}</Text>
                <Text style={styles.metaText}>
                  {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at {t.time}
                </Text>
                {!!t.cancellationReason && <Text style={styles.metaText}>Reason: {t.cancellationReason}</Text>}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  counterBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: Colors.brandPrimaryLight,
  },
  counterText: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.brandPrimaryDark },
  counterAccept: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.brandPrimary },
  counterAcceptText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
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
  reviseText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
    paddingHorizontal: 4,
  },
  netPayout: {
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
    marginBottom: 6,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 8,
    marginBottom: 8,
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  chipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  chipTextActive: {
    color: '#047857',
  },
  quoteLiveBreakdown: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#064E3B',
  },
  breakdownCash: {
    fontSize: 13,
    fontWeight: '800',
    color: '#047857',
  },
  breakdownSub: {
    fontSize: 10,
    color: '#64748B',
  },
  pinModalBox: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  pinModalTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  pinModalSub: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
    marginBottom: 8,
  },
  pinInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pinTextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 4,
    color: '#111827',
    width: 90,
    textAlign: 'center',
  },
  pinConfirmBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pinConfirmText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  pinCancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pinCancelText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
  },
});
