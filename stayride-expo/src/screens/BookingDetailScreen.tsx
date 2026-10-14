import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStayRide } from '../data/store';
import { Header } from '../components/Header';
import { Pill } from '../components/Pill';
import { Colors } from '../theme/colors';
import { Room } from '../types';

export const BookingDetailScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<{ params: { bookingId: number } }, 'params'>>();
  const { bookingId } = route.params || {};

  const {
    bookings,
    rooms,
    checkInBooking,
    checkOutBooking,
    cancelBooking,
    setBookingPaid,
    changeBookingRoom,
  } = useStayRide();

  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const insets = useSafeAreaInsets();

  const booking = bookings.find((b) => b.id === bookingId);

  if (!booking) {
    return (
      <View style={styles.container}>
        <Header title="Booking details" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.notFoundText}>Booking not found</Text>
        </View>
      </View>
    );
  }

  const nights = Math.max(1, Math.round((booking.checkOut - booking.checkIn) / 86400000));
  const fmtLong = (ms: number) =>
    new Date(ms).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const getStatusNote = () => {
    switch (booking.status) {
      case 'CONFIRMED':
        return 'Next step: check the guest in when they arrive. You can also assign a different room.';
      case 'CHECKED_IN':
        return 'Guest is currently in-house. Remember to settle the payment at check-out.';
      case 'CHECKED_OUT':
        return booking.paid
          ? 'Stay completed. This guest is saved in your guest database for future campaigns.'
          : 'Stay completed, payment is still pending. Mark it as paid once received.';
      default:
        return 'This booking was cancelled. The room is available again.';
    }
  };

  const handleCheckIn = () => {
    Alert.alert(
      `Check in ${booking.guestName}?`,
      `Room ${booking.roomNumber} will be marked occupied and the guest will be checked in.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check in',
          onPress: async () => {
            await checkInBooking(booking.id);
            Alert.alert('Success', `${booking.guestName} checked in to room ${booking.roomNumber}`);
          },
        },
      ]
    );
  };

  const handleCheckOut = () => {
    Alert.alert(
      `Check out ${booking.guestName}?`,
      'The stay will be closed and the room will become available again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check out',
          onPress: async () => {
            await checkOutBooking(booking.id);
            Alert.alert('Success', `${booking.guestName} checked out`);
          },
        },
      ]
    );
  };

  const handleCancelBooking = () => {
    Alert.alert(
      'Cancel this booking?',
      `Room ${booking.roomNumber} will be released and the guest will be notified (demo).`,
      [
        { text: 'Keep booking', style: 'cancel' },
        {
          text: 'Cancel booking',
          style: 'destructive',
          onPress: async () => {
            await cancelBooking(booking.id);
            Alert.alert('Notice', 'Booking cancelled');
          },
        },
      ]
    );
  };

  const handleMarkPaid = async () => {
    await setBookingPaid(booking.id, true);
    Alert.alert('Payment Settled', `Payment of ₹${booking.amount.toLocaleString()} marked as paid`);
  };

  const handleSelectRoom = async (room: Room) => {
    setAssignModalVisible(false);
    await changeBookingRoom(booking.id, room.number);
    Alert.alert('Room Assigned', `Room ${room.number} assigned`);
  };

  return (
    <View style={styles.container}>
      <Header title="Booking details" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Main Details Card */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.guestName}>{booking.guestName}</Text>
            <Pill type="booking" value={booking.status} />
          </View>

          <Text style={styles.detailText}>
            Room {booking.roomNumber} · {booking.guests}{' '}
            {booking.guests === 1 ? 'guest' : 'guests'} · {nights} night(s)
          </Text>
          <Text style={styles.detailText}>
            {fmtLong(booking.checkIn)}  →  {fmtLong(booking.checkOut)}
          </Text>
          <Text style={styles.detailText}>{booking.phone}</Text>

          <View style={styles.divider} />

          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.amountText}>₹{booking.amount.toLocaleString()}</Text>
              <Text style={styles.amountMeta}>
                {nights} nights · {booking.roomNumber}
              </Text>
            </View>
            <Pill type="payment" value={booking.paid ? 'PAID' : 'UNPAID'} />
          </View>

          <Text style={styles.sourceText}>Source: {booking.source}</Text>
        </View>

        {/* Status Note */}
        <View style={styles.statusNote}>
          <Text style={styles.statusNoteText}>{getStatusNote()}</Text>
        </View>

        {/* View Guest Profile Button */}
        {Boolean(booking.guestId && booking.guestId > 0) && (
          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() =>
              navigation.navigate('GuestDetail', { guestId: booking.guestId })
            }
          >
            <Text style={styles.btnSecondaryText}>View guest profile</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Action Buttons Footer */}
      <View style={[styles.footerActions, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        {booking.status === 'CONFIRMED' && (
          <>
            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={() => setAssignModalVisible(true)}
            >
              <Text style={styles.outlineBtnText}>Assign / change room</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.solidBtn} onPress={handleCheckIn}>
              <Text style={styles.solidBtnText}>Check in guest</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.outlineBtn, { borderColor: Colors.statusRed }]}
              onPress={handleCancelBooking}
            >
              <Text style={[styles.outlineBtnText, { color: Colors.statusRed }]}>
                Cancel booking
              </Text>
            </TouchableOpacity>
          </>
        )}

        {booking.status === 'CHECKED_IN' && (
          <>
            <TouchableOpacity style={styles.solidBtn} onPress={handleCheckOut}>
              <Text style={styles.solidBtnText}>Check out guest</Text>
            </TouchableOpacity>
            {!booking.paid && (
              <TouchableOpacity style={styles.outlineBtn} onPress={handleMarkPaid}>
                <Text style={styles.outlineBtnText}>Mark payment as paid</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {booking.status === 'CHECKED_OUT' && !booking.paid && (
          <TouchableOpacity style={styles.solidBtn} onPress={handleMarkPaid}>
            <Text style={styles.solidBtnText}>Mark payment as paid</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Assign Room Modal */}
      <Modal
        visible={assignModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAssignModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setAssignModalVisible(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Assign a room</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {rooms.map((r) => {
                const isCurrent = r.number === booking.roomNumber;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.roomChoice, isCurrent && styles.roomChoiceActive]}
                    onPress={() => handleSelectRoom(r)}
                  >
                    <Text
                      style={[
                        styles.roomChoiceText,
                        isCurrent && styles.roomChoiceTextActive,
                      ]}
                    >
                      Room {r.number} · {r.type} · ₹{r.price.toLocaleString()} · {r.status}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setAssignModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
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
    fontSize: 19,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    flex: 1,
  },
  detailText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: 14,
  },
  amountText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  amountMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sourceText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 12,
  },
  statusNote: {
    backgroundColor: Colors.brandPrimaryLight,
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  statusNoteText: {
    color: Colors.brandPrimaryDark,
    fontSize: 13,
    lineHeight: 18,
  },
  btnSecondary: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  btnSecondaryText: {
    color: Colors.brandPrimary,
    fontWeight: '600',
    fontSize: 14,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 14,
  },
  roomChoice: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  roomChoiceActive: {
    backgroundColor: Colors.brandPrimaryLight,
    borderRadius: 8,
  },
  roomChoiceText: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  roomChoiceTextActive: {
    color: Colors.brandPrimaryDark,
    fontWeight: 'bold',
  },
  modalCancelBtn: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalCancelText: {
    color: Colors.brandPrimary,
    fontWeight: '600',
    fontSize: 15,
  },
});
