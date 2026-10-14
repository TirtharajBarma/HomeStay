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

export const GuestDetailScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<{ params: { guestId: number } }, 'params'>>();
  const { guestId } = route.params || {};

  const { guests, bookings, updateGuest } = useStayRide();
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
  const isRepeat = guest.visits > 1;

  const fmtDate = (ms: number) =>
    new Date(ms).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const handleConsentToggle = async (value: boolean) => {
    await updateGuest(guest.id, { marketingConsent: value });
    Alert.alert(
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
    await updateGuest(guest.id, { notes: editedNotes });
    setNotesModalVisible(false);
    Alert.alert('Saved', 'Notes saved');
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
            <Text style={styles.actionBtnText}>+ Create booking</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnOutline]}
            onPress={() => navigation.navigate('NewGuest', { guestId: guest.id })}
          >
            <Text style={styles.actionBtnOutlineText}>Edit profile</Text>
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
      </ScrollView>

      {/* Edit Notes Modal */}
      <Modal
        visible={notesModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNotesModalVisible(false)}
      >
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
