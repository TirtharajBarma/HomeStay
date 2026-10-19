import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Linking,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii, Shadows } from '../theme/colors';
import { useStayRide } from '../data/store';
import { TripItem } from '../components/TripItem';
import { Header } from '../components/Header';
import { FeatureLocked } from '../components/FeatureLocked';
import { plusDays } from '../data/seeder';
import { CabTrip, Guest } from '../types';
import { askGuestForCab as askForCab } from '../utils/askCab';

export const CabsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { trips, guests, bookings, createTrip, homestay, isDemoMode, confirmTripQuote, askGuestForCab, features } =
    useStayRide();
  const linksLocked = features?.guestCabLinks === false;

  const [activeTab, setActiveTab] = useState<'requested' | 'trips' | 'guest_requests'>('requested');
  const [askCabModalVisible, setAskCabModalVisible] = useState(false);
  const [selectedGuestForCab, setSelectedGuestForCab] = useState<Guest | null>(null);

  const requestedStatuses = ['NEW_REQUEST', 'FINDING_DRIVER', 'QUOTE_RECEIVED', 'AWAITING_ADVANCE', 'DRIVER_ASSIGNED'];
  const tripStatuses = ['CONFIRMED', 'TRIP_STARTED', 'COMPLETED', 'CANCELLED', 'EXPIRED'];

  // Filtered lists
  const requestedTrips = trips.filter((t) => requestedStatuses.includes(t.status) && t.source !== 'GUEST_WEB_LINK');
  const confirmedTrips = trips.filter((t) => tripStatuses.includes(t.status));
  const guestWebTrips = trips.filter((t) => t.source === 'GUEST_WEB_LINK');
  // Ask-for-cab links are only for guests currently checked in
  const checkedInGuests = guests.filter((g) =>
    bookings.some((b) => b.status === 'CHECKED_IN' && (b.guestId === g.id || b.phone === g.phone))
  );

  const currentList =
    activeTab === 'requested'
      ? requestedTrips
      : activeTab === 'trips'
      ? confirmedTrips
      : guestWebTrips;

  const handleSimulateRequest = async () => {
    const homestayTitle = homestay.name || 'My Homestay';
    const randomGuests = guests.length
      ? guests
      : [{ name: homestay.ownerName ? `${homestay.ownerName} (Guest)` : 'Guest Rider', phone: homestay.phone || '+91 98000 00000' }];
    const g = randomGuests[Math.floor(Math.random() * randomGuests.length)];
    const routes = [
      { pickup: 'Bagdogra Airport', destination: homestayTitle },
      { pickup: 'NJP Station', destination: homestayTitle },
      { pickup: homestayTitle, destination: 'Nathula Pass Sightseeing' },
      { pickup: homestayTitle, destination: 'Darjeeling Mall' },
    ];
    const r = routes[Math.floor(Math.random() * routes.length)];
    const vehicles: ('SUV' | 'Sedan' | '7-seater' | '9-seater')[] = ['SUV', 'Sedan', '7-seater', '9-seater'];
    const v = vehicles[Math.floor(Math.random() * vehicles.length)];

    try {
      await createTrip({
        guestName: g.name,
        phone: g.phone,
        pickup: r.pickup,
        destination: r.destination,
        date: plusDays(Math.floor(Math.random() * 2)),
        time: '11:30 AM',
        passengers: 2 + Math.floor(Math.random() * 4),
        vehicleType: v,
        source: 'MANUAL_OWNER',
      });
      Alert.alert('Request Simulated', `New cab request created for ${g.name}`);
    } catch (e: any) {
      Alert.alert('Not saved', e?.message || 'Please try again.');
    }
  };

  const [confirmingTripId, setConfirmingTripId] = useState<number | null>(null);

  // The server takes the fare from the chosen quote; the client sends only the quote's driverId
  const handleAcceptDriverQuote = async (trip: CabTrip, driverId: number | string) => {
    if (confirmingTripId !== null) return;
    setConfirmingTripId(trip.id);
    let result: Awaited<ReturnType<typeof confirmTripQuote>>;
    try {
      result = await confirmTripQuote(trip.id, driverId);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not confirm driver quote.');
      return;
    } finally {
      setConfirmingTripId(null);
    }
    if (!result.ok) {
      Alert.alert('Error', result.error || 'Could not confirm driver quote.');
      return;
    }
    if (!result.trip) {
      Alert.alert('Driver confirmed', 'Refresh Cabs to see the updated trip.');
      return;
    }
    const confirmed = result.trip;
    Alert.alert(
      'Driver Confirmed',
      confirmed.platform && confirmed.status === 'AWAITING_ADVANCE'
        ? `Driver confirmed${confirmed.fare ? ` at ₹${confirmed.fare.toLocaleString()}` : ''}. Waiting for the guest advance (collected by StayRide).`
        : `Driver confirmed${confirmed.fare ? ` at ₹${confirmed.fare.toLocaleString()}` : ''}. You can now send the trip details to ${confirmed.guestName} via WhatsApp.`,
      [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Share WhatsApp',
          style: 'default',
          onPress: () => handleShareTripToGuest(confirmed),
        },
      ]
    );
  };

  const platformNote = (t: CabTrip) => {
    if (t.refundStatus === 'PENDING') return 'Refund pending';
    if (t.refundStatus === 'REFUNDED') return 'Advance refunded';
    if (t.status === 'FINDING_DRIVER') return 'Request sent to StayRide. Driver quotes will appear here.';
    if (t.status === 'AWAITING_ADVANCE') return 'Waiting for guest advance (collected by StayRide)';
    if (t.status === 'CONFIRMED' && t.advancePaid) return 'Advance paid to StayRide';
    return null;
  };

  const handleShareTripToGuest = (trip: CabTrip) => {
    const cleanPhone = trip.phone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
    const snap = trip.financialSnapshot || {};
    const fare = snap.agreedFare ?? trip.fare;
    const advance = snap.advanceAmount ?? trip.advanceAmount;
    const remainingCash = snap.remainingCashToDriver ?? trip.remainingCashAmount;
    const advancePaid = Boolean(snap.advancePaid ?? trip.advancePaid);
    const rupees = (n?: number) => (typeof n === 'number' ? `₹${n.toLocaleString()}` : 'to be confirmed');

    const msg =
      `*STAYRIDE CAB BOOKING CONFIRMED* 🏔️🚗\n` +
      `Dear ${trip.guestName},\n` +
      `Your cab arranged by ${homestay.name || 'your homestay'} is confirmed!\n\n` +
      `• Pickup: ${trip.pickup}\n` +
      `• Destination: ${trip.destination}\n` +
      `• Date & Time: ${new Date(trip.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at ${trip.time}\n` +
      `• Driver: ${trip.driverName || trip.assignedDriverName || 'Verified Mountain Driver'}\n` +
      `• Vehicle: ${trip.vehicleType}\n\n` +
      `💰 *Fare Details:*\n` +
      `• Total Fare: ${rupees(fare)}\n` +
      `• Advance: ${rupees(advance)} (${advancePaid ? 'Paid' : 'Pending'})\n` +
      `• Balance Cash to Driver on Arrival: ${rupees(remainingCash)}\n\n` +
      `Have a wonderful journey through the hills!`;

    const url = `whatsapp://send?phone=${phoneWithCountry}&text=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('WhatsApp Error', 'WhatsApp is not installed on this device.');
    });
  };

  // StayRide's server sends the link from the company WhatsApp number
  const handleSendAskCabLink = async (guest: Guest) => {
    setAskCabModalVisible(false);
    await askForCab(askGuestForCab, guest);
  };

  return (
    <View style={styles.container}>
      <Header title="Cabs & Drivers" />

      {/* Top 4 Quick Nav Buttons */}
      <View style={styles.topBtnRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnPrimary]}
          onPress={() => navigation.navigate('FindDriver')}
          activeOpacity={0.75}
        >
          <Ionicons name="add-circle" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.actionBtnTextPrimary}>Book Cab</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setAskCabModalVisible(true)}
          activeOpacity={0.75}
        >
          <Ionicons name="logo-whatsapp" size={14} color="#16A34A" style={{ marginRight: 4 }} />
          <Text style={styles.actionBtnText}>Ask Guest</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('MyDrivers')}
          activeOpacity={0.75}
        >
          <Ionicons name="car" size={14} color={Colors.brandPrimaryDark} style={{ marginRight: 4 }} />
          <Text style={styles.actionBtnText}>My Drivers</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('Commission')}
          activeOpacity={0.75}
        >
          <Ionicons name="stats-chart" size={14} color={Colors.brandPrimaryDark} style={{ marginRight: 4 }} />
          <Text style={styles.actionBtnText}>Rates</Text>
        </TouchableOpacity>
      </View>

      {/* Segmented 3-Tab Toggle: Requested vs Trips vs Guest Requests */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, activeTab === 'requested' && styles.toggleBtnActive]}
          onPress={() => setActiveTab('requested')}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleBtnText, activeTab === 'requested' && styles.toggleBtnTextActive]}>
            Requested ({requestedTrips.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleBtn, activeTab === 'trips' && styles.toggleBtnActive]}
          onPress={() => setActiveTab('trips')}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleBtnText, activeTab === 'trips' && styles.toggleBtnTextActive]}>
            Trips ({confirmedTrips.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleBtn, activeTab === 'guest_requests' && styles.toggleBtnActive]}
          onPress={() => setActiveTab('guest_requests')}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleBtnText, activeTab === 'guest_requests' && styles.toggleBtnTextActive]}>
            Guest Inquiries ({guestWebTrips.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Subheader: Count + Simulate Request */}
      <View style={styles.subHeaderRow}>
        <Text style={styles.countText}>
          {currentList.length}{' '}
          {activeTab === 'requested'
            ? 'requests awaiting driver or quote'
            : activeTab === 'trips'
            ? 'confirmed & active trips'
            : 'inquiries submitted by guests'}
        </Text>
        {isDemoMode && (
          <TouchableOpacity onPress={handleSimulateRequest} activeOpacity={0.7}>
            <Text style={styles.simulateText}>+ Simulate request</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Trip Cards List */}
      <ScrollView contentContainerStyle={styles.listContent}>
        {currentList.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="car-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>
              {activeTab === 'requested'
                ? 'No pending cab requests'
                : activeTab === 'trips'
                ? 'No active or confirmed trips'
                : 'No incoming guest inquiries'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'requested'
                ? 'Tap "+ Book Cab" above to request a mountain ride.'
                : activeTab === 'trips'
                ? 'Accepted quotes and booked rides appear here.'
                : 'Share your cab booking link with guests via WhatsApp.'}
            </Text>
          </View>
        ) : (
          currentList.map((t) => {
            const hasQuotes = t.quotes && t.quotes.length > 0;
            return (
              <View key={t.id} style={styles.tripCardWrap}>
                <TripItem
                  trip={t}
                  onPress={() => navigation.navigate('CabRequestDetail', { tripId: t.id })}
                />

                {/* Platform trip state, exactly as reported by the server */}
                {t.platform && platformNote(t) && <Text style={styles.platformNote}>{platformNote(t)}</Text>}

                {/* Driver Quote Received Card */}
                {hasQuotes && t.status === 'QUOTE_RECEIVED' && (
                  <View style={styles.quoteNotificationBox}>
                    <View style={styles.quoteNotifHeader}>
                      <Ionicons name="sparkles" size={16} color="#059669" />
                      <Text style={styles.quoteNotifTitle}>Driver Quotes Received ({t.quotes!.length})</Text>
                    </View>

                    {t.quotes!.map((q, idx) => {
                      return (
                        <View key={idx} style={styles.quoteItemCard}>
                          <View style={styles.quoteItemHeader}>
                            <Text style={styles.quoteDriverName}>{q.driverName}</Text>
                            <Text style={styles.quoteFareText}>Fare: ₹{q.quotedFare.toLocaleString()}</Text>
                          </View>

                          {typeof q.homestayCommission === 'number' ? (
                            <View style={styles.quoteFinancialRow}>
                              <Text style={styles.quoteFinItem}>
                                You earn ₹{q.homestayCommission.toLocaleString()}
                                {typeof q.advanceAmount === 'number' ? ` · Guest pays ₹${q.advanceAmount.toLocaleString()} advance` : ''}
                              </Text>
                            </View>
                          ) : null}

                          {(q.driverVehicle || q.notes) ? (
                            <View style={styles.quoteFinancialRow}>
                              <Text style={styles.quoteFinItem}>
                                {[q.driverVehicle, q.notes].filter(Boolean).join(' · ')}
                              </Text>
                            </View>
                          ) : null}

                          <TouchableOpacity
                            style={[styles.acceptQuoteBtn, confirmingTripId !== null && { opacity: 0.6 }]}
                            disabled={confirmingTripId !== null}
                            onPress={() => handleAcceptDriverQuote(t, q.driverId)}
                          >
                            <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                            <Text style={styles.acceptQuoteBtnText}>Accept &amp; Confirm Driver</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Own-driver trips only: for StayRide trips the server messages guest and driver itself */}
                {t.status === 'CONFIRMED' && !t.platform && (
                  <TouchableOpacity
                    style={styles.shareGuestBtn}
                    onPress={() => handleShareTripToGuest(t)}
                  >
                    <Ionicons name="logo-whatsapp" size={15} color="#16A34A" />
                    <Text style={styles.shareGuestBtnText}>Send Driver Details to Guest on WhatsApp</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal: Ask Guest for Cab (WhatsApp Share) */}
      <Modal visible={askCabModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Ask Guest for Cab 💬</Text>
                <Text style={styles.modalSub}>Send direct booking link via WhatsApp</Text>
              </View>
              <TouchableOpacity onPress={() => setAskCabModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {linksLocked ? (
              <FeatureLocked feature="guestCabLinks" title="Ask-for-Cab guest links" />
            ) : (
            <>
            <Text style={styles.selectGuestLabel}>Select Guest to Send Link:</Text>
            <ScrollView style={{ maxHeight: 280 }}>
              {checkedInGuests.length === 0 ? (
                <Text style={styles.noGuestsText}>No guests are currently checked in.</Text>
              ) : (
                checkedInGuests.map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    style={styles.guestPickRow}
                    onPress={() => handleSendAskCabLink(g)}
                  >
                    <View style={styles.guestAvatar}>
                      <Text style={styles.guestAvatarText}>{g.name.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.guestPickName}>{g.name}</Text>
                      <Text style={styles.guestPickPhone}>{g.phone}</Text>
                    </View>
                    <Ionicons name="logo-whatsapp" size={20} color="#16A34A" />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPage,
  },
  topBtnRow: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginTop: 10,
    gap: 6,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  actionBtnPrimary: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
  actionBtnTextPrimary: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  toggleBtnActive: {
    backgroundColor: '#2563EB',
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  toggleBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  subHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 6,
  },
  platformNote: {
    fontSize: 12,
    color: '#92400E',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
  },
  countText: {
    fontSize: 12,
    color: '#64748B',
  },
  simulateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 40,
  },
  tripCardWrap: {
    marginBottom: 12,
  },
  quoteNotificationBox: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    padding: 12,
    marginTop: -4,
  },
  quoteNotifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  quoteNotifTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065F46',
  },
  quoteItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    marginBottom: 6,
  },
  quoteItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  quoteDriverName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  quoteFareText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#059669',
  },
  quoteFinancialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 6,
    borderRadius: 6,
    marginVertical: 6,
  },
  quoteFinItem: {
    fontSize: 11,
    color: '#475569',
  },
  acceptQuoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 9,
    borderRadius: 8,
    marginTop: 4,
  },
  acceptQuoteBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  shareGuestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    paddingVertical: 9,
    marginTop: -4,
  },
  shareGuestBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
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
    marginTop: 4,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  selectGuestLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 10,
  },
  noGuestsText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 20,
  },
  guestPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  guestAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563EB',
  },
  guestPickName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  guestPickPhone: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
});
