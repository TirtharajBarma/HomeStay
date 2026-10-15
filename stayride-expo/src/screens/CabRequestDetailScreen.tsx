import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStayRide } from '../data/store';
import { Header } from '../components/Header';
import { Pill } from '../components/Pill';
import { Colors } from '../theme/colors';
import { Driver } from '../types';
import { formatINR } from '../utils/format';

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
  } = useStayRide();

  const trip = trips.find((t) => t.id === tripId);

  const [overrideStatus, setOverrideStatus] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<'idle' | 'loading_own' | 'own' | 'loading_network' | 'network'>('idle');
  const insets = useSafeAreaInsets();
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (trip && trip.status === 'FINDING_DRIVER') {
      beginOwnSearch();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

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

  const beginOwnSearch = () => {
    setSearchMode('loading_own');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const own = ownMatches();
      if (own.length === 0) {
        beginNetworkSearch();
      } else {
        setSearchMode('own');
      }
    }, 1200);
  };

  const beginNetworkSearch = () => {
    setSearchMode('loading_network');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setSearchMode('network');
    }, 1600);
  };

  const handleAccept = () => {
    setOverrideStatus('FINDING_DRIVER');
    beginOwnSearch();
  };

  const handleAssignDriver = async (driver: Driver, own: boolean) => {
    await assignTripDriver(trip.id, driver.id);
    setOverrideStatus(null);
    setSearchMode('idle');
    Alert.alert('Driver Assigned', `${driver.name} assigned to ${trip.guestName}`);
  };

  const handleConfirmBooking = async () => {
    await acceptTrip(trip.id);
    Alert.alert('Booking Confirmed', `Confirmation sent to ${trip.guestName}`);
  };

  const handleStartTrip = async () => {
    await startTrip(trip.id);
    Alert.alert('Trip Started', 'Driver notified successfully.');
  };

  const handleCompleteTrip = async () => {
    await completeTrip(trip.id);
    Alert.alert('Trip Completed', `Commission Earned: ${formatINR(trip.commission)}`);
  };

  const handleChangeDriver = async () => {
    await reassignTrip(trip.id);
    setOverrideStatus(null);
    beginOwnSearch();
  };

  const handleCancelSearch = () => {
    setOverrideStatus(null);
    setSearchMode('idle');
  };

  const handleConfirmDecline = () => {
    Alert.alert(
      'Decline this request?',
      `${trip.guestName} will be told that no cab is available right now (demo).`,
      [
        { text: 'Keep request', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            await cancelTrip(trip.id);
            setOverrideStatus(null);
            setSearchMode('idle');
            Alert.alert('Notice', 'Request declined');
          },
        },
      ]
    );
  };

  const handleConfirmCancel = () => {
    Alert.alert(
      'Cancel this cab request?',
      'The guest will be notified that no cab could be arranged.',
      [
        { text: 'Keep request', style: 'cancel' },
        {
          text: 'Cancel request',
          style: 'destructive',
          onPress: async () => {
            await cancelTrip(trip.id);
            setOverrideStatus(null);
            setSearchMode('idle');
            Alert.alert('Notice', 'Request cancelled');
          },
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
              {trip.status === 'COMPLETED'
                ? formatINR(trip.fare)
                : `Est. ${formatINR(trip.estFare)}`}
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

        {/* Commission Card if Completed */}
        {trip.status === 'COMPLETED' && (
          <View style={styles.commissionCard}>
            <Text style={styles.commissionTitle}>
              Commission earned: {formatINR(trip.commission)}
            </Text>
            <Text style={styles.commissionMeta}>
              Trip fare {formatINR(trip.fare)} · 12% StayRide commission ·{' '}
              {trip.commissionPaid ? 'Paid to you' : 'Pending payout'}
            </Text>
          </View>
        )}

        {/* Search Area / Banners */}
        {status !== 'FINDING_DRIVER' ? (
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
                  Trip completed. Your commission has been added below.
                </Text>
              </View>
            )}
            {status === 'CANCELLED' && (
              <View style={[styles.banner, { backgroundColor: Colors.statusRedBg }]}>
                <Text style={[styles.bannerText, { color: Colors.statusRed }]}>
                  This request was cancelled.
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.searchSection}>
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
                        {d.vehicle} · {d.seats} seats · {d.vehicleType} · ★ {d.rating}
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
                    Searching 50+ StayRide drivers around you…
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
                        {d.vehicle} · {d.seats} seats · {d.vehicleType} · ★ {d.rating}
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
        {status === 'NEW_REQUEST' && (
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

        {status === 'FINDING_DRIVER' && (
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

        {status === 'DRIVER_ASSIGNED' && (
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

        {status === 'CONFIRMED' && (
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

        {status === 'TRIP_STARTED' && (
          <TouchableOpacity style={styles.solidBtn} onPress={handleCompleteTrip}>
            <Text style={styles.solidBtnText}>Complete trip</Text>
          </TouchableOpacity>
        )}

        {status === 'COMPLETED' && (
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
