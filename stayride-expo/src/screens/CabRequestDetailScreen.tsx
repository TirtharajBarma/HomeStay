import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStayRide } from '../data/store';
import type { ActionOutcome } from '../data/store';
import { Header } from '../components/Header';
import { Pill } from '../components/Pill';
import { Colors } from '../theme/colors';
import { Driver } from '../types';
import { formatINR } from '../utils/format';
import { ownFleetFeeFor } from '../data/platformConfig';
import { api } from '../data/api';
import { Ionicons } from '@expo/vector-icons';

export const CabRequestDetailScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<{ params: { tripId: number } }, 'params'>>();
  const { tripId } = route.params || {};

  const {
    trips,
    drivers,
    networkDrivers,
    acceptTrip,
    assignTripDriver,
    startTrip,
    completeTrip,
    cancelTrip,
    reassignTrip,
    confirmTripQuote,
    dispatchTrip,
    rateTrip,
    config,
  } = useStayRide();

  const trip = trips.find((t) => t.id === tripId);

  const [overrideStatus, setOverrideStatus] = useState<string | null>(null);
  // Opening a trip that is already searching starts in the right list (same rule as beginOwnSearch below)
  const [searchMode, setSearchMode] = useState<'idle' | 'loading_own' | 'own' | 'loading_network' | 'network'>(() => {
    if (!trip || trip.status !== 'FINDING_DRIVER' || trip.platform) return 'idle';
    const hasOwn = drivers.some((d) => d.active && d.available);
    return !hasOwn && networkDrivers.length > 0 ? 'network' : 'own';
  });
  const [busy, setBusy] = useState(false);
  const [showOwnPicker, setShowOwnPicker] = useState(false);
  // Fare agreed with the owner's own driver; StayRide's own-fleet fee comes out of it as the guest advance
  const [ownFare, setOwnFare] = useState('');
  const [stars, setStars] = useState(0);
  const insets = useSafeAreaInsets();

  // Leaving the screen ends this rating "form": a later rating attempt gets a fresh Idempotency-Key
  useEffect(() => () => api.clearIdempotencyKeys(`/trips/${tripId}/rate`), [tripId]);

  if (!trip) {
    return (
      <View style={styles.container}>
        <Header title="Cab request" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.notFoundText}>Trip not found</Text>
        </View>
      </View>
    );
  }

  const status = overrideStatus || trip.status;

  const stepOf = (s: string) => {
    switch (s) {
      case 'NEW_REQUEST':
        return 1;
      case 'FINDING_DRIVER':
        return 2;
      case 'DRIVER_ASSIGNED':
        return 3;
      case 'CONFIRMED':
        return 4;
      case 'TRIP_STARTED':
        return 5;
      case 'COMPLETED':
        return 6;
      default:
        return 0;
    }
  };

  const step = stepOf(status);
  const statusLabel =
    status === 'NEW_REQUEST'
      ? 'New request'
      : status === 'FINDING_DRIVER'
      ? 'Finding driver'
      : status === 'DRIVER_ASSIGNED'
      ? 'Driver assigned'
      : status === 'CONFIRMED'
      ? 'Trip confirmed'
      : status === 'TRIP_STARTED'
      ? 'Trip in progress'
      : status === 'COMPLETED'
      ? 'Trip completed'
      : status === 'EXPIRED'
      ? 'Expired'
      : 'Cancelled';

  const fmtLong = (ms: number) =>
    new Date(ms).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const ownMatches = () => {
    const available = drivers.filter((d) => d.active && d.available);
    const exact = available.filter((d) => d.vehicleType === trip.vehicleType);
    return exact.length > 0 ? exact : available;
  };

  const networkMatches = () => {
    const exact = networkDrivers.filter((d) => d.vehicleType === trip.vehicleType && d.available);
    return (exact.length > 0 ? exact : networkDrivers).slice(0, 8);
  };

  // Lists come straight from the store; no simulated search delay
  const beginOwnSearch = () => {
    setSearchMode(ownMatches().length === 0 && networkDrivers.length > 0 ? 'network' : 'own');
  };

  const beginNetworkSearch = () => {
    setSearchMode('network');
  };

  // Every server write below awaits the response and reports failures
  const run = async (fn: () => Promise<ActionOutcome | void>) => {
    if (busy) return;
    setBusy(true);
    try {
      const outcome = await fn();
      if (outcome && !outcome.ok) {
        Alert.alert('Not saved', outcome.error || 'Please try again.');
      }
    } catch (e: any) {
      Alert.alert('Not saved', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = () => {
    setOverrideStatus('FINDING_DRIVER');
    beginOwnSearch();
  };

  const fareNum = Math.round(Number(ownFare));
  const ownFee = fareNum > 0 ? ownFleetFeeFor(config, fareNum) : 0;

  const handleAssignDriver = (driver: Driver, own: boolean) =>
    run(async () => {
      if (!(fareNum > 0)) return { ok: false, synced: false, error: 'Enter the fare agreed with the driver first.' };
      const outcome = await assignTripDriver(trip.id, driver.id, fareNum);
      if (!outcome.ok) return outcome;
      setOverrideStatus(null);
      setSearchMode('idle');
      setShowOwnPicker(false);
      Alert.alert(
        'Driver assigned',
        ownFee > 0
          ? `StayRide sent ${trip.guestName} a link to pay the ₹${ownFee.toLocaleString('en-IN')} advance. Phones are shared with ${driver.name} and the guest once it is paid.`
          : `${driver.name} and ${trip.guestName} got the trip details on WhatsApp.`
      );
      return outcome;
    });

  const fareField = (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.assignName}>Fare agreed with the driver (₹)</Text>
      <TextInput
        style={styles.fareInput}
        placeholder="e.g. 3000"
        value={ownFare}
        onChangeText={(t) => setOwnFare(t.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        placeholderTextColor={Colors.textSecondary}
      />
      <Text style={styles.assignMeta}>
        {fareNum > 0
          ? `Guest pays StayRide ₹${ownFee.toLocaleString('en-IN')} advance · ₹${(fareNum - ownFee).toLocaleString('en-IN')} cash to the driver`
          : `StayRide fee: ${config.ownFleetFeePercent}% of the fare (min ₹${config.ownFleetMinFee}), paid by the guest as the advance.`}
      </Text>
    </View>
  );

  const handleConfirmBooking = () =>
    run(async () => {
      const outcome = await acceptTrip(trip.id);
      if (!outcome.ok) return outcome;
      Alert.alert('Booking Confirmed', `Saved. Remember to inform ${trip.guestName}.`);
      return outcome;
    });

  const handleStartTrip = () =>
    run(async () => {
      const outcome = await startTrip(trip.id);
      if (!outcome.ok) return outcome;
      Alert.alert('Trip Started', 'Trip marked as started.');
      return outcome;
    });

  const handleCompleteTrip = () =>
    run(async () => {
      const outcome = await completeTrip(trip.id);
      if (!outcome.ok) return outcome;
      Alert.alert('Trip Completed', 'Trip marked as completed.');
      return outcome;
    });

  const handleChangeDriver = async () => {
    const outcome = await reassignTrip(trip.id);
    if (!outcome.ok) {
      Alert.alert('Not saved', outcome.error || 'Please try again.');
      return;
    }
    setOverrideStatus(null);
    beginOwnSearch();
  };

  // Platform trip: the fare comes from the chosen quote on the server
  const handleConfirmQuote = (driverId: number | string) =>
    run(async () => {
      const outcome = await confirmTripQuote(trip.id, driverId);
      if (!outcome.ok) return outcome;
      Alert.alert('Driver Confirmed', 'StayRide will collect the guest advance.');
      return outcome;
    });

  // Guest inquiry: the owner sends it to nearby StayRide drivers (they quote; StayRide earns its fee)
  const handleDispatch = () =>
    run(async () => {
      const outcome = await dispatchTrip(trip.id);
      if (!outcome.ok) return outcome;
      Alert.alert('Sent to nearby drivers', 'Drivers with a matching vehicle can now quote. Quotes will appear here.');
      return outcome;
    });

  const handleCancelSearch = () => {
    setOverrideStatus(null);
    setSearchMode('idle');
  };

  const handleConfirmDecline = () => {
    Alert.alert(
      'Decline this request?',
      'This cab request will be cancelled. Please let the guest know no cab is available.',
      [
        { text: 'Keep request', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
            onPress: () =>
              run(async () => {
                const outcome = await cancelTrip(trip.id, 'Declined by homestay');
                if (!outcome.ok) return outcome;
                setOverrideStatus(null);
                setSearchMode('idle');
                Alert.alert('Notice', 'Request declined');
                return outcome;
              }),
        },
      ]
    );
  };

  const handleRate = () =>
    run(async () => {
      if (stars < 1) return { ok: false, synced: false, error: 'Tap 1 to 5 stars first.' };
      const outcome = await rateTrip(trip.id, stars);
      if (outcome.ok) Alert.alert('Thank you', 'Your rating was saved.');
      return outcome;
    });

  const handleConfirmCancel = () => {
    Alert.alert(
      'Cancel this cab request?',
      'The guest will be notified that no cab could be arranged.',
      [
        { text: 'Keep request', style: 'cancel' },
        {
          text: 'Cancel request',
          style: 'destructive',
            onPress: () =>
              run(async () => {
                const outcome = await cancelTrip(trip.id);
                if (!outcome.ok) return outcome;
                setOverrideStatus(null);
                setSearchMode('idle');
                Alert.alert('Notice', 'Request cancelled');
                return outcome;
              }),
        },
      ]
    );
  };

  const assignedDriver =
    trip.driverId !== null
      ? drivers.find((d) => d.id === trip.driverId) ||
        networkDrivers.find((d) => d.id === trip.driverId)
      : null;

  return (
    <View style={styles.container}>
      <Header title="Cab request" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Stepper Progress Card */}
        <View style={styles.stepperCard}>
          <Text style={styles.stepTitle}>
            Step {Math.max(step, 1)} of 6 · {statusLabel}
          </Text>
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${(Math.max(step, 1) / 6) * 100}%` },
              ]}
            />
          </View>
        </View>

        {/* Main Trip Card */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.guestName}>{trip.guestName}</Text>
            <Pill type="trip" value={status} />
          </View>

          <Text style={styles.phoneText}>{trip.phone}</Text>

          <View style={styles.routeContainer}>
            <Text style={styles.routeText}>
              <Text style={{ fontWeight: 'bold' }}>From: </Text>
              {trip.pickup}
            </Text>
            <Text style={styles.routeText}>
              <Text style={{ fontWeight: 'bold' }}>To: </Text>
              {trip.destination}
            </Text>
          </View>

          <Text style={styles.detailText}>
            {fmtLong(trip.date)} · {trip.time}
          </Text>
          <Text style={styles.detailText}>
            {trip.passengers} passengers · {trip.vehicleType}
          </Text>

          <View style={styles.divider} />

          <View style={styles.rowBetween}>
            <Text style={styles.fareText}>
              {trip.fare > 0 ? formatINR(trip.fare) : '—'}
            </Text>
            <Text style={styles.driverTagText}>
              {trip.driverName
                ? `${trip.driverName} ${trip.ownerDriver ? '(your driver)' : '(StayRide)'}`
                : 'No driver assigned'}
            </Text>
          </View>
        </View>

        {/* Driver Card if Assigned */}
        {trip.driverId !== null && (
          <View style={styles.driverCard}>
            <Text style={styles.driverSectionTitle}>Assigned Driver</Text>
            <Text style={styles.driverName}>
              {trip.driverName}{' '}
              <Text style={styles.driverTypeTag}>
                · {trip.ownerDriver ? 'Your driver' : 'StayRide network'}
              </Text>
            </Text>
            {assignedDriver ? (
              <Text style={styles.driverMeta}>
                {assignedDriver.vehicle} · {assignedDriver.vehicleType} ·{' '}
                {assignedDriver.seats} seats · {assignedDriver.phone}
                {'\n'}
                {assignedDriver.area}
              </Text>
            ) : (
              <Text style={styles.driverMeta}>Driver details unavailable</Text>
            )}
          </View>
        )}

        {/* Commission Card: platform trips only, values from the server */}
        {trip.platform && trip.status === 'COMPLETED' && (
          <View style={styles.commissionCard}>
            <Text style={styles.commissionTitle}>
              Commission earned: {formatINR(trip.commission)}
            </Text>
            <Text style={styles.commissionMeta}>
              Trip fare {formatINR(trip.fare)} ·{' '}
              {trip.commission > 0 ? (trip.commissionPaid ? 'Paid to you' : 'Pending payout') : 'No commission on this trip'}
            </Text>
          </View>
        )}

        {/* Platform trip: StayRide manages drivers and money; show server state only */}
        {trip.platform ? (
          <View style={styles.bannerContainer}>
            <View style={[styles.banner, { backgroundColor: Colors.statusOrangeBg }]}>
              <Text style={[styles.bannerText, { color: Colors.statusOrange }]}>
                {trip.refundStatus === 'PENDING'
                  ? 'Refund pending'
                  : trip.refundStatus === 'REFUNDED'
                  ? 'Advance refunded'
                  : status === 'NEW_REQUEST'
                  ? 'New guest request. Choose how to find a driver.'
                  : status === 'FINDING_DRIVER'
                  ? 'Request sent to StayRide. Driver quotes will appear here.'
                  : status === 'QUOTE_RECEIVED'
                  ? 'Choose a driver quote below.'
                  : status === 'AWAITING_ADVANCE'
                  ? `${trip.ownerDriver ? `Your driver ${trip.driverName || ''} · w` : 'W'}aiting for the guest's ${formatINR(trip.advanceAmount || 0)} advance (collected by StayRide)${
                      trip.advanceDueAt
                        ? ` · due by ${new Date(trip.advanceDueAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}, otherwise the driver is released`
                        : ''
                    }`
                  : status === 'CONFIRMED'
                  ? `Advance ${trip.advancePaid ? 'paid' : 'pending'} · Cash to driver: ${formatINR(trip.remainingCashAmount || 0)}`
                  : status === 'TRIP_STARTED'
                  ? 'Trip in progress (managed by StayRide).'
                  : status === 'COMPLETED'
                  ? 'Trip completed.'
                  : status === 'EXPIRED'
                  ? 'No driver was confirmed before the pickup time, so this request expired.'
                  : 'This request was cancelled.'}
              </Text>
            </View>
            {status === 'NEW_REQUEST' && trip.dispatched === false && (
              <View style={[styles.card, { marginTop: 8 }]}>
                <Text style={styles.assignName}>How do you want to find a driver?</Text>
                <Text style={[styles.assignMeta, { marginBottom: 12 }]}>
                  Nearby drivers send you quotes and you earn commission on the trip. Your own driver is assigned directly.
                </Text>
                <TouchableOpacity style={styles.solidBtn} disabled={busy} onPress={handleDispatch}>
                  <Text style={styles.solidBtnText}>{busy ? 'Sending…' : 'Send to nearby drivers'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.outlineBtn} disabled={busy} onPress={() => setShowOwnPicker((v) => !v)}>
                  <Text style={styles.outlineBtnText}>{showOwnPicker ? 'Hide my drivers' : 'Assign my own driver'}</Text>
                </TouchableOpacity>
                {showOwnPicker && ownMatches().length > 0 && fareField}
                {showOwnPicker &&
                  (ownMatches().length === 0 ? (
                    <Text style={styles.assignMeta}>No driver from your fleet is available right now.</Text>
                  ) : (
                    ownMatches().map((d) => (
                      <View key={d.id} style={styles.assignRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.assignName}>{d.name}</Text>
                          <Text style={styles.assignMeta}>
                            {d.vehicle} · {d.seats} seats · {d.phone}
                          </Text>
                        </View>
                        <TouchableOpacity style={styles.assignBtn} disabled={busy} onPress={() => handleAssignDriver(d, true)}>
                          <Text style={styles.assignBtnText}>Assign</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  ))}
              </View>
            )}
            {trip.needsReassignment && (
              <View style={[styles.banner, { backgroundColor: Colors.statusRedBg, marginTop: 8 }]}>
                <Text style={[styles.bannerText, { color: Colors.statusRed }]}>
                  Needs a new driver: your driver is no longer available. StayRide is assigning a new driver at the
                  same agreed fare.
                </Text>
              </View>
            )}
            {status === 'COMPLETED' && trip.driverName && !trip.ownerDriver && (
              <View style={[styles.card, { marginTop: 8 }]}>
                {trip.driverRated ? (
                  <Text style={styles.assignMeta}>You rated {trip.driverName}. Thank you!</Text>
                ) : (
                  <>
                    <Text style={styles.assignName}>Rate {trip.driverName}</Text>
                    <View style={{ flexDirection: 'row', marginVertical: 8 }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <TouchableOpacity
                          key={n}
                          onPress={() => setStars(n)}
                          accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}
                          style={{ padding: 4 }}
                        >
                          <Ionicons name={n <= stars ? 'star' : 'star-outline'} size={28} color="#F59E0B" />
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity style={styles.assignBtn} disabled={busy || stars < 1} onPress={handleRate}>
                      <Text style={styles.assignBtnText}>{busy ? 'Saving…' : 'Submit rating'}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
            {(status === 'FINDING_DRIVER' || status === 'QUOTE_RECEIVED') &&
              (trip.quotes || []).map((q) => (
                <View key={String(q.driverId)} style={[styles.assignRow, { marginTop: 8 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.assignName}>{q.driverName}</Text>
                    <Text style={styles.assignMeta}>
                      {formatINR(q.quotedFare)}
                      {q.driverVehicle ? ` · ${q.driverVehicle}` : ''}
                      {typeof q.driverRating === 'number' ? ` · ★ ${q.driverRating} (${q.driverRatingCount ?? 0})` : ''}
                      {q.notes ? ` · ${q.notes}` : ''}
                    </Text>
                    {typeof q.homestayCommission === 'number' && (
                      <Text style={styles.assignArea}>
                        You earn {formatINR(q.homestayCommission)}
                        {typeof q.advanceAmount === 'number' ? ` · Guest pays ${formatINR(q.advanceAmount)} advance` : ''}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity style={styles.assignBtn} disabled={busy} onPress={() => handleConfirmQuote(q.driverId)}>
                    <Text style={styles.assignBtnText}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              ))}
          </View>
        ) : status !== 'FINDING_DRIVER' ? (
          <View style={styles.bannerContainer}>
            {status === 'NEW_REQUEST' && (
              <View style={[styles.banner, { backgroundColor: Colors.brandPrimaryLight }]}>
                <Text style={[styles.bannerText, { color: Colors.brandPrimaryDark }]}>
                  Accept the request to start finding a driver.
                </Text>
              </View>
            )}
            {(status === 'DRIVER_ASSIGNED' || status === 'CONFIRMED' || status === 'TRIP_STARTED') && (
              <View style={[styles.banner, { backgroundColor: Colors.statusBlueBg }]}>
                <Text style={[styles.bannerText, { color: Colors.statusBlue }]}>
                  Driver assigned · Trip confirmed with driver and guest.
                </Text>
              </View>
            )}
            {status === 'COMPLETED' && (
              <View style={[styles.banner, { backgroundColor: Colors.statusGreenBg }]}>
                <Text style={[styles.bannerText, { color: Colors.statusGreen }]}>
                  Trip completed.
                </Text>
              </View>
            )}
            {(status === 'CANCELLED' || status === 'EXPIRED') && (
              <View style={[styles.banner, { backgroundColor: Colors.statusRedBg }]}>
                <Text style={[styles.bannerText, { color: Colors.statusRed }]}>
                  {status === 'EXPIRED' ? 'This request expired after the pickup time.' : 'This request was cancelled.'}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.searchSection}>
            {(searchMode === 'own' || searchMode === 'network') && fareField}
            {searchMode === 'loading_own' && (
              <View style={[styles.banner, { backgroundColor: Colors.brandPrimaryLight }]}>
                <ActivityIndicator size="small" color={Colors.brandPrimaryDark} style={{ marginRight: 8 }} />
                <Text style={[styles.bannerText, { color: Colors.brandPrimaryDark }]}>
                  Checking your own drivers first…
                </Text>
              </View>
            )}

            {searchMode === 'loading_network' && (
              <View style={[styles.banner, { backgroundColor: Colors.statusPurpleBg }]}>
                <ActivityIndicator size="small" color={Colors.statusPurple} style={{ marginRight: 8 }} />
                <Text style={[styles.bannerText, { color: Colors.statusPurple }]}>
                  Finding a driver from the StayRide network…
                </Text>
              </View>
            )}

            {searchMode === 'own' && (
              <>
                <View style={[styles.banner, { backgroundColor: Colors.statusGreenBg, marginBottom: 12 }]}>
                  <Text style={[styles.bannerText, { color: Colors.statusGreen }]}>
                    Your driver is available.
                  </Text>
                </View>
                <Text style={styles.resultsHeader}>
                  Your drivers ({ownMatches().length})
                </Text>
                {ownMatches().map((d) => (
                  <View key={d.id} style={styles.assignRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.assignName}>{d.name} (yours)</Text>
                      <Text style={styles.assignMeta}>
                        {d.vehicle} · {d.seats} seats · {d.vehicleType}
                        {d.rating ? ` · ★ ${d.rating}` : ''}
                      </Text>
                      <Text style={styles.assignArea}>{d.area} · {d.phone}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.assignBtn}
                      onPress={() => handleAssignDriver(d, true)}
                    >
                      <Text style={styles.assignBtnText}>Assign</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            {searchMode === 'network' && (
              <>
                <View style={[styles.banner, { backgroundColor: Colors.statusPurpleBg, marginBottom: 12 }]}>
                  <Text style={[styles.bannerText, { color: Colors.statusPurple }]}>
                    StayRide network drivers
                  </Text>
                </View>
                <Text style={styles.resultsHeader}>
                  StayRide drivers near you ({networkMatches().length})
                </Text>
                {networkMatches().map((d) => (
                  <View key={d.id} style={styles.assignRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.assignName}>{d.name}</Text>
                      <Text style={styles.assignMeta}>
                        {d.vehicle} · {d.seats} seats · {d.vehicleType}
                        {d.rating ? ` · ★ ${d.rating}` : ''}
                      </Text>
                      <Text style={styles.assignArea}>
                        {d.area} · {d.trips?.join(' · ')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.assignBtn}
                      onPress={() => handleAssignDriver(d, false)}
                    >
                      <Text style={styles.assignBtnText}>Assign</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Action Buttons Footer */}
      <View style={[styles.footerActions, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        {trip.platform && ['NEW_REQUEST', 'FINDING_DRIVER', 'QUOTE_RECEIVED', 'AWAITING_ADVANCE', 'CONFIRMED'].includes(status) && (
          <TouchableOpacity
            style={[styles.outlineBtn, { borderColor: Colors.statusRed }]}
            disabled={busy}
            onPress={handleConfirmCancel}
          >
            <Text style={[styles.outlineBtnText, { color: Colors.statusRed }]}>Cancel request</Text>
          </TouchableOpacity>
        )}

        {/* Own-fleet trips: the owner records start/finish (own drivers may not have the app) */}
        {trip.platform && trip.ownerDriver && status === 'CONFIRMED' && (
          <TouchableOpacity style={styles.solidBtn} disabled={busy} onPress={handleStartTrip}>
            <Text style={styles.solidBtnText}>Start trip</Text>
          </TouchableOpacity>
        )}
        {trip.platform && trip.ownerDriver && status === 'TRIP_STARTED' && (
          <TouchableOpacity style={styles.solidBtn} disabled={busy} onPress={handleCompleteTrip}>
            <Text style={styles.solidBtnText}>Complete trip</Text>
          </TouchableOpacity>
        )}

        {!trip.platform && status === 'NEW_REQUEST' && (
          <>
            <TouchableOpacity style={styles.solidBtn} onPress={handleAccept}>
              <Text style={styles.solidBtnText}>Accept / Find Driver</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.outlineBtn, { borderColor: Colors.statusRed }]}
              onPress={handleConfirmDecline}
            >
              <Text style={[styles.outlineBtnText, { color: Colors.statusRed }]}>
                Decline request
              </Text>
            </TouchableOpacity>
          </>
        )}

        {!trip.platform && status === 'FINDING_DRIVER' && (
          <>
            {searchMode === 'own' && (
              <TouchableOpacity
                style={styles.outlineBtn}
                onPress={beginNetworkSearch}
              >
                <Text style={styles.outlineBtnText}>Search StayRide network instead</Text>
              </TouchableOpacity>
            )}
            {searchMode === 'network' && (
              <TouchableOpacity
                style={styles.outlineBtn}
                onPress={beginNetworkSearch}
              >
                <Text style={styles.outlineBtnText}>Search again</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.outlineBtn, { borderColor: Colors.textSecondary }]}
              onPress={handleCancelSearch}
            >
              <Text style={[styles.outlineBtnText, { color: Colors.textSecondary }]}>
                Cancel search
              </Text>
            </TouchableOpacity>
          </>
        )}

        {!trip.platform && status === 'DRIVER_ASSIGNED' && (
          <>
            <TouchableOpacity style={styles.solidBtn} onPress={handleConfirmBooking}>
              <Text style={styles.solidBtnText}>Confirm booking</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.outlineBtn} onPress={handleChangeDriver}>
              <Text style={styles.outlineBtnText}>Change driver</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.outlineBtn, { borderColor: Colors.statusRed }]}
              onPress={handleConfirmCancel}
            >
              <Text style={[styles.outlineBtnText, { color: Colors.statusRed }]}>
                Cancel request
              </Text>
            </TouchableOpacity>
          </>
        )}

        {!trip.platform && status === 'CONFIRMED' && (
          <>
            <TouchableOpacity style={styles.solidBtn} onPress={handleStartTrip}>
              <Text style={styles.solidBtnText}>Start trip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.outlineBtn, { borderColor: Colors.statusRed }]}
              onPress={handleConfirmCancel}
            >
              <Text style={[styles.outlineBtnText, { color: Colors.statusRed }]}>
                Cancel trip
              </Text>
            </TouchableOpacity>
          </>
        )}

        {!trip.platform && status === 'TRIP_STARTED' && (
          <TouchableOpacity style={styles.solidBtn} onPress={handleCompleteTrip}>
            <Text style={styles.solidBtnText}>Complete trip</Text>
          </TouchableOpacity>
        )}

        {trip.platform && status === 'COMPLETED' && (
          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={() => navigation.navigate('Commission')}
          >
            <Text style={styles.outlineBtnText}>View commission dashboard</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.pageBackground,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 24,
  },
  stepperCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.brandPrimaryDark,
    marginBottom: 8,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.brandPrimaryLight,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.brandPrimary,
    borderRadius: 3,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  guestName: {
    fontSize: 19,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    flex: 1,
  },
  phoneText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  routeContainer: {
    marginVertical: 10,
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 8,
  },
  routeText: {
    fontSize: 13,
    color: Colors.textPrimary,
    marginVertical: 2,
  },
  detailText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: 12,
  },
  fareText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  driverTagText: {
    fontSize: 12,
    color: Colors.brandPrimaryDark,
    fontWeight: '600',
  },
  driverCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  driverSectionTitle: {
    fontSize: 11,
    textTransform: 'uppercase',
    color: Colors.textSecondary,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  driverName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  driverTypeTag: {
    fontSize: 13,
    fontWeight: 'normal',
    color: Colors.brandPrimary,
  },
  driverMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 6,
    lineHeight: 18,
  },
  commissionCard: {
    backgroundColor: Colors.statusGreenBg,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.statusGreen,
  },
  commissionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.statusGreen,
  },
  commissionMeta: {
    fontSize: 12,
    color: '#065F46',
    marginTop: 4,
  },
  bannerContainer: {
    marginTop: 12,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  searchSection: {
    marginTop: 12,
  },
  resultsHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  assignRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  assignName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  assignMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  assignArea: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  assignBtn: {
    backgroundColor: Colors.brandPrimary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 10,
  },
  assignBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  footerActions: {
    paddingHorizontal: 14,
    paddingBottom: 24,
    backgroundColor: Colors.pageBackground,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: 10,
  },
  fareInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.textPrimary,
    marginVertical: 6,
  },
  solidBtn: {
    backgroundColor: Colors.brandPrimary,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  solidBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  outlineBtn: {
    borderWidth: 1,
    borderColor: Colors.brandPrimary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  outlineBtnText: {
    color: Colors.brandPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
});
