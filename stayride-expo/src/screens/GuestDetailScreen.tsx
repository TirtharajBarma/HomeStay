import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStayRide } from '../data/store';
import { Header } from '../components/Header';
import { Pill } from '../components/Pill';
import { BookingItem } from '../components/BookingItem';
import { Colors } from '../theme/colors';
import { KeyboardAwareOverlay } from '../components/KeyboardAwareOverlay';
import { reportOutcome } from '../utils/report';

export const GuestDetailScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<{ params: { guestId: number } }, 'params'>>();
  const { guestId } = route.params || {};

  const { guests, bookings, trips, updateGuest, deleteGuest } = useStayRide();
  const guest = guests.find((g) => g.id === guestId);

  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');

  if (!guest) {
    return (
      <View style={styles.container}>
        <Header title="Guest profile" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.notFoundText}>Guest not found</Text>
        </View>
      </View>
    );
  }

  const guestBookings = bookings.filter((b) => b.guestId === guest.id);
  // Fix 17: Cab history for this guest
  const guestTrips = trips.filter(
    (t) => (t.guestName && t.guestName.toLowerCase() === guest.name.toLowerCase()) ||
           (t.phone && guest.phone && t.phone.replace(/\D/g, '') === guest.phone.replace(/\D/g, ''))
  );
  const isRepeat = guest.visits > 1;

  const handleRequestCab = () => {
    const todayStr = new Date().toDateString();
    const hasOpenTripToday = guestTrips.some(
      (t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && t.status !== 'EXPIRED' && new Date(t.date).toDateString() === todayStr
    );
    if (hasOpenTripToday) {
      Alert.alert(
        'Active Cab Request Exists',
        `${guest.name} already has a pending or active cab request today. Do you want to create another one?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => navigation.navigate('FindDriver') },
        ]
      );
    } else {
      navigation.navigate('FindDriver');
    }
  };

  const handleDeleteGuest = () => {
    Alert.alert(
      'Delete Guest Record',
      `Are you sure you want to delete ${guest.name}? This will remove them from your guest database.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const outcome = await deleteGuest(guest.id);
            reportOutcome(outcome, 'Guest Deleted', `${guest.name} was removed from the database.`);
            if (outcome.ok) {
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  const fmtDate = (ms: number) =>
    new Date(ms).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const handleConsentToggle = async (value: boolean) => {
    const outcome = await updateGuest(guest.id, { marketingConsent: value });
    reportOutcome(
      outcome,
      'Marketing Preference',
      value
        ? `${guest.name} can receive WhatsApp offers`
        : `${guest.name} will not receive marketing messages`
    );
  };

  const openNotesModal = () => {
    setEditedNotes(guest.notes || '');
    setNotesModalVisible(true);
  };

  const handleSaveNotes = async () => {
    const outcome = await updateGuest(guest.id, { notes: editedNotes });
    setNotesModalVisible(false);
    reportOutcome(outcome, 'Saved', 'Notes saved');
  };

  return (
    <View style={styles.container}>
      <Header title="Guest profile" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Main Guest Card */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.guestName}>{guest.name}</Text>
            <Pill type="guest" value={isRepeat ? 'REPEAT GUEST' : 'NEW GUEST'} />
          </View>

          <Text style={styles.contactText}>{guest.phone}</Text>
          <Text style={styles.contactText}>
            {guest.email ? guest.email : 'No email on file'}
          </Text>

          {/* Quick Metrics */}
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>{guest.visits}</Text>
              <Text style={styles.metricLabel}>Stays</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>₹{guest.totalSpending.toLocaleString()}</Text>
              <Text style={styles.metricLabel}>Total Spend</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>
                {guest.lastVisit ? fmtDate(guest.lastVisit) : '—'}
              </Text>
              <Text style={styles.metricLabel}>Last Visit</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('NewBooking', { guestId: guest.id })}
          >
            <Text style={styles.actionBtnText}>+ Booking</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnCab]}
            onPress={handleRequestCab}
          >
            <Text style={styles.actionBtnCabText}>🚗 Ask Cab</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnOutline]}
            onPress={() => navigation.navigate('NewGuest', { guestId: guest.id })}
          >
            <Text style={styles.actionBtnOutlineText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Notes Card */}
        <View style={styles.sectionCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <TouchableOpacity onPress={openNotesModal}>
              <Text style={styles.editLink}>Edit notes</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.notesText}>
            {guest.notes ? guest.notes : 'No notes yet. Tap Edit notes to add one.'}
          </Text>
        </View>

        {/* Marketing Consent Card */}
        <View style={styles.sectionCard}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.sectionTitle}>Marketing consent</Text>
              <Text style={styles.consentSubtext}>
                {guest.marketingConsent
                  ? 'Allowed for WhatsApp offers'
                  : 'Opted out of marketing'}
              </Text>
            </View>
            <Switch
              value={guest.marketingConsent}
              onValueChange={handleConsentToggle}
              trackColor={{ false: '#D1D5DB', true: Colors.brandPrimaryLight }}
              thumbColor={guest.marketingConsent ? Colors.brandPrimary : '#9CA3AF'}
            />
          </View>
        </View>

        {/* Stay History Section */}
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>
            Stay history ({guestBookings.length}{' '}
            {guestBookings.length === 1 ? 'stay' : 'stays'})
          </Text>
          {guestBookings.length === 0 ? (
            <View style={styles.emptyHistoryCard}>
              <Text style={styles.emptyHistoryText}>No stay history on record</Text>
            </View>
          ) : (
            guestBookings.map((b) => (
              <BookingItem
                key={b.id}
                booking={b}
                onPress={() => navigation.navigate('BookingDetail', { bookingId: b.id })}
              />
            ))
          )}
        </View>

        {/* Fix 17: Cab History Section */}
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>
            Cab rides & requests ({guestTrips.length}{' '}
            {guestTrips.length === 1 ? 'trip' : 'trips'})
          </Text>
          {guestTrips.length === 0 ? (
            <View style={styles.emptyHistoryCard}>
              <Text style={styles.emptyHistoryText}>No cab rides requested yet</Text>
            </View>
          ) : (
            guestTrips.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={styles.cabHistoryCard}
                onPress={() => navigation.navigate('CabRequestDetail', { tripId: t.id })}
                activeOpacity={0.7}
              >
                <View style={styles.rowBetween}>
                  <Text style={styles.cabRouteText} numberOfLines={1}>
                    {t.pickup} → {t.destination}
                  </Text>
                  <Pill label={t.status} />
                </View>
                <View style={[styles.rowBetween, { marginTop: 6 }]}>
                  <Text style={styles.cabDateText}>
                    {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} {t.time}
                  </Text>
                  {t.fare ? (
                    <Text style={styles.cabFareText}>₹{t.fare.toLocaleString('en-IN')}</Text>
                  ) : t.estFare ? (
                    <Text style={styles.cabEstFareText}>Est. ₹{t.estFare.toLocaleString('en-IN')}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Fix 10: Explicit Delete Guest Button */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDeleteGuest}
          activeOpacity={0.7}
        >
          <Text style={styles.deleteBtnText}>Delete Guest Record</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Notes Modal */}
      <Modal
        visible={notesModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNotesModalVisible(false)}
      >
        <KeyboardAwareOverlay style={{ flex: 1 }}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setNotesModalVisible(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Notes for {guest.name}</Text>
            <TextInput
              style={styles.notesInput}
              multiline
              numberOfLines={4}
              placeholder="Add dietary preferences, room requests, notes..."
              placeholderTextColor={Colors.textSecondary}
              value={editedNotes}
              onChangeText={setEditedNotes}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setNotesModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleSaveNotes}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
        </KeyboardAwareOverlay>
      </Modal>
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
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  contactText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    justifyContent: 'space-around',
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricVal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    backgroundColor: Colors.divider,
    height: '80%',
    alignSelf: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: Colors.brandPrimary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  actionBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.brandPrimary,
  },
  actionBtnOutlineText: {
    color: Colors.brandPrimary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  actionBtnCab: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  actionBtnCabText: {
    color: '#1D4ED8',
    fontWeight: 'bold',
    fontSize: 14,
  },
  cabHistoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  cabRouteText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  cabDateText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  cabFareText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.brandPrimaryDark,
  },
  cabEstFareText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  deleteBtn: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  editLink: {
    fontSize: 13,
    color: Colors.brandPrimary,
    fontWeight: '600',
  },
  notesText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
    lineHeight: 20,
  },
  consentSubtext: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  historySection: {
    marginTop: 20,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  emptyHistoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  emptyHistoryText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: Colors.textPrimary,
    textAlignVertical: 'top',
    minHeight: 90,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 12,
  },
  modalCancel: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalCancelText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  modalSave: {
    backgroundColor: Colors.brandPrimary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
