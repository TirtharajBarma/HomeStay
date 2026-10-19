import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Share,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStayRide } from '../data/store';
import { Header } from '../components/Header';
import { Pill } from '../components/Pill';
import { Colors } from '../theme/colors';
import { PaymentMethod, Room } from '../types';
import { reportOutcome } from '../utils/report';
import { bookingClash, canCheckInNow, isPast, checkoutDueAt } from '../utils/rooms';
import { paidOf, balanceOf, PAYMENT_METHODS, methodLabel, receiptText } from '../utils/payments';
import { askGuestForCab as askForCab } from '../utils/askCab';
import { RangeCalendar } from '../components/RangeCalendar';
import { KeyboardAwareOverlay } from '../components/KeyboardAwareOverlay';

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
    changeBookingRoom,
    editBooking,
    addPayment,
    removePayment,
    homestay,
    guests,
    askGuestForCab,
    features,
  } = useStayRide();

  const [assignModalVisible, setAssignModalVisible] = useState(false);
  // Edit stay: draft dates/amount/party size until Save
  const [editVisible, setEditVisible] = useState(false);
  const [draftIn, setDraftIn] = useState(0);
  const [draftOut, setDraftOut] = useState(0);
  const [draftAmount, setDraftAmount] = useState('');
  const [draftGuests, setDraftGuests] = useState('');
  const [saving, setSaving] = useState(false);
  // Record payment
  const [payVisible, setPayVisible] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('UPI');
  const [payNote, setPayNote] = useState('');
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
        if (isPast(booking.checkOut)) return 'The stay dates have passed and the guest never checked in. Cancel the booking if it was a no-show.';
        return 'Next step: check the guest in when they arrive. For an early arrival, use Edit stay to move the check-in to today.';
      case 'CHECKED_IN':
        if (isPast(checkoutDueAt(booking, homestay.checkOutTime))) {
          return `Check-out was due ${fmtLong(booking.checkOut)}${homestay.checkOutTime ? ` at ${homestay.checkOutTime}` : ''}. Check the guest out, or use Edit stay to extend.`;
        }
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
            const outcome = await checkInBooking(booking.id);
            if (!outcome.ok) return reportOutcome(outcome, '', '');
            // Right moment to offer a cab: the guest just arrived and will need rides (StayRide earns on cabs)
            const guest = guests.find((g) => g.id === booking.guestId);
            if (!guest?.phone || features?.guestCabLinks === false) {
              return Alert.alert('Checked in', `${booking.guestName} checked in to room ${booking.roomNumber}`);
            }
            Alert.alert('Checked in', `${booking.guestName} is in room ${booking.roomNumber}. Ask if they need a cab during their stay?`, [
              { text: 'Not now', style: 'cancel' },
              { text: 'Send cab link', onPress: () => askForCab(askGuestForCab, guest) },
            ]);
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
            const outcome = await checkOutBooking(booking.id);
            reportOutcome(outcome, 'Success', `${booking.guestName} checked out`);
          },
        },
      ]
    );
  };

  const handleCancelBooking = () => {
    Alert.alert(
      'Cancel this booking?',
      `Room ${booking.roomNumber} will be free again for these dates. Let the guest know yourself; StayRide does not message them.`,
      [
        { text: 'Keep booking', style: 'cancel' },
        {
          text: 'Cancel booking',
          style: 'destructive',
          onPress: async () => {
            const outcome = await cancelBooking(booking.id);
            reportOutcome(outcome, 'Notice', 'Booking cancelled');
          },
        },
      ]
    );
  };

  const received = paidOf(booking);
  const balance = balanceOf(booking);

  const openPayment = () => {
    setPayAmount(String(balance));
    setPayMethod('UPI');
    setPayNote('');
    setPayVisible(true);
  };

  const handleRecordPayment = async () => {
    const amountNum = parseInt(payAmount, 10);
    if (!(amountNum > 0)) return Alert.alert('Enter amount', 'Type the amount received.');
    if (amountNum > balance) return Alert.alert('Too much', `Only ₹${balance.toLocaleString('en-IN')} is due.`);
    setSaving(true);
    const outcome = await addPayment(booking.id, { amount: amountNum, method: payMethod, note: payNote.trim() });
    setSaving(false);
    if (outcome.ok) setPayVisible(false);
    reportOutcome(
      outcome,
      'Payment recorded',
      amountNum >= balance ? 'Booking is fully paid.' : `₹${(balance - amountNum).toLocaleString('en-IN')} still due.`
    );
  };

  const handleRemovePayment = (paymentId: number, amountNum: number) =>
    Alert.alert('Remove this payment?', `₹${amountNum.toLocaleString('en-IN')} will no longer count as received.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => reportOutcome(await removePayment(booking.id, paymentId), 'Removed', 'Payment removed'),
      },
    ]);

  // Sent from the owner's own phone (WhatsApp, SMS…): a receipt is between owner and guest
  const handleShareReceipt = () => Share.share({ message: receiptText(booking, homestay) }).catch(() => {});

  const roomPrice = rooms.find((r) => r.number === booking.roomNumber)?.price ?? 0;
  const draftNights = Math.max(1, Math.round((draftOut - draftIn) / 86400000));
  const today = (() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  })();

  const openEdit = () => {
    setDraftIn(booking.checkIn);
    setDraftOut(booking.checkOut);
    setDraftAmount(String(booking.amount));
    setDraftGuests(String(booking.guests));
    setEditVisible(true);
  };

  // New dates suggest a new total (room price × nights); the owner can still change it
  const setDates = (inMs: number, outMs: number) => {
    setDraftIn(inMs);
    setDraftOut(outMs);
    if (roomPrice > 0) setDraftAmount(String(roomPrice * Math.max(1, Math.round((outMs - inMs) / 86400000))));
  };

  const handleSaveEdit = async () => {
    const amountNum = Number(draftAmount);
    const guestsNum = Number(draftGuests);
    if (!Number.isFinite(amountNum) || amountNum < 0) return Alert.alert('Invalid', 'Enter a valid amount.');
    if (!Number.isInteger(guestsNum) || guestsNum < 1) return Alert.alert('Invalid', 'Enter the number of guests.');
    setSaving(true);
    const outcome = await editBooking(booking.id, {
      ...(booking.status === 'CONFIRMED' ? { checkIn: draftIn } : {}),
      checkOut: draftOut,
      amount: Math.round(amountNum),
      guests: guestsNum,
    });
    setSaving(false);
    if (outcome.ok) setEditVisible(false);
    reportOutcome(outcome, 'Stay updated', `${fmtLong(draftIn)} → ${fmtLong(draftOut)} · ₹${Math.round(amountNum).toLocaleString()}`);
  };

  const handleSelectRoom = async (room: Room) => {
    setAssignModalVisible(false);
    const outcome = await changeBookingRoom(booking.id, room.number);
    reportOutcome(outcome, 'Room Assigned', `Room ${room.number} assigned`);
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
          {(homestay.checkInTime || homestay.checkOutTime) && (
            <Text style={styles.detailText}>
              Check-in from {homestay.checkInTime || '—'} · Check-out by {homestay.checkOutTime || '—'}
            </Text>
          )}
          {booking.phone ? <Text style={styles.detailText}>{booking.phone}</Text> : null}
          {booking.external && (
            <View style={[styles.externalBox, booking.external.conflict && styles.externalConflict]}>
              <Text style={styles.externalText}>
                {booking.external.conflict
                  ? `⚠ Possible double booking: this ${booking.external.source} stay overlaps another booking in room ${booking.roomNumber}. Move or cancel one of them.`
                  : `Imported from your ${booking.external.source} calendar. Guest details are on ${booking.external.source}; dates update on each sync.`}
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.amountText}>₹{booking.amount.toLocaleString()}</Text>
              <Text style={styles.amountMeta}>
                {nights} nights · {booking.roomNumber}
              </Text>
            </View>
            <Pill type="payment" value={balance === 0 && booking.amount > 0 ? 'PAID' : received > 0 ? 'PENDING' : 'UNPAID'} label={balance === 0 && booking.amount > 0 ? 'PAID' : received > 0 ? 'PART PAID' : 'UNPAID'} />
          </View>
          <View style={styles.payRow}>
            <Text style={styles.payStat}>Received ₹{received.toLocaleString('en-IN')}</Text>
            <Text style={[styles.payStat, balance > 0 && { color: Colors.statusOrange }]}>Balance ₹{balance.toLocaleString('en-IN')}</Text>
          </View>
          {(booking.payments || []).map((p) => (
            <TouchableOpacity key={p.id} onLongPress={() => handleRemovePayment(p.id, p.amount)} delayLongPress={400}>
              <Text style={styles.payLine}>
                + ₹{p.amount.toLocaleString('en-IN')} · {methodLabel(p.method)} · {new Date(p.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                {p.note ? ` · ${p.note}` : ''}
              </Text>
            </TouchableOpacity>
          ))}
          {(booking.payments || []).length > 0 && <Text style={styles.payHint}>Long-press a payment to remove it</Text>}
          <View style={styles.payActions}>
            {booking.status !== 'CANCELLED' && balance > 0 && (
              <TouchableOpacity style={styles.payBtn} onPress={openPayment}>
                <Text style={styles.payBtnText}>Record payment</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.payBtn, styles.payBtnOutline]} onPress={handleShareReceipt}>
              <Text style={[styles.payBtnText, { color: Colors.brandPrimaryDark }]}>Share receipt</Text>
            </TouchableOpacity>
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
        {(booking.status === 'CONFIRMED' || booking.status === 'CHECKED_IN') && !booking.external && (
          <TouchableOpacity style={styles.outlineBtn} onPress={openEdit}>
            <Text style={styles.outlineBtnText}>
              {booking.status === 'CHECKED_IN' ? 'Extend / change check-out' : 'Edit stay (dates, amount, guests)'}
            </Text>
          </TouchableOpacity>
        )}
        {booking.status === 'CONFIRMED' && (
          <>
            {!booking.external && (
              <TouchableOpacity style={styles.outlineBtn} onPress={() => setAssignModalVisible(true)}>
                <Text style={styles.outlineBtnText}>Assign / change room</Text>
              </TouchableOpacity>
            )}

            {canCheckInNow(booking) ? (
              <TouchableOpacity style={styles.solidBtn} onPress={handleCheckIn}>
                <Text style={styles.solidBtnText}>Check in guest</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.solidBtn, { opacity: 0.5 }]}>
                <Text style={styles.solidBtnText}>
                  Check-in opens {new Date(booking.checkIn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </Text>
              </View>
            )}
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
            {balance > 0 && (
              <TouchableOpacity style={styles.outlineBtn} onPress={openPayment}>
                <Text style={styles.outlineBtnText}>Record payment (₹{balance.toLocaleString('en-IN')} due)</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {booking.status === 'CHECKED_OUT' && balance > 0 && (
          <TouchableOpacity style={styles.solidBtn} onPress={openPayment}>
            <Text style={styles.solidBtnText}>Record payment (₹{balance.toLocaleString('en-IN')} due)</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Record Payment Modal */}
      <Modal visible={payVisible} transparent animationType="slide" onRequestClose={() => setPayVisible(false)}>
        <KeyboardAwareOverlay style={{ flex: 1 }}>
          <View style={styles.editOverlay}>
            <View style={[styles.editSheet, { paddingBottom: 24 }]}>
              <Text style={styles.modalTitle}>Record payment</Text>
              <Text style={styles.editSummary}>
                Total ₹{booking.amount.toLocaleString('en-IN')} · received ₹{received.toLocaleString('en-IN')} · due ₹{balance.toLocaleString('en-IN')}
              </Text>
              <Text style={styles.editLabel}>Amount received (₹)</Text>
              <TextInput
                style={styles.editInput}
                value={payAmount}
                onChangeText={(t) => setPayAmount(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
              />
              <Text style={styles.editLabel}>Paid by</Text>
              <View style={styles.payActions}>
                {PAYMENT_METHODS.map((m) => (
                  <TouchableOpacity
                    key={m.value}
                    style={[styles.methodChip, payMethod === m.value && styles.methodChipActive]}
                    onPress={() => setPayMethod(m.value)}
                  >
                    <Text style={[styles.methodChipText, payMethod === m.value && { color: '#FFFFFF' }]}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.editLabel}>Note (optional)</Text>
              <TextInput style={styles.editInput} value={payNote} onChangeText={setPayNote} placeholder="e.g. UPI ref 4821" placeholderTextColor={Colors.textSecondary} />
              <TouchableOpacity style={[styles.solidBtn, { marginTop: 14 }]} disabled={saving} onPress={handleRecordPayment}>
                <Text style={styles.solidBtnText}>{saving ? 'Saving…' : 'Save payment'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => setPayVisible(false)}>
                <Text style={styles.outlineBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAwareOverlay>
      </Modal>

      {/* Edit Stay Modal */}
      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <KeyboardAwareOverlay style={{ flex: 1 }}>
          <View style={styles.editOverlay}>
            <ScrollView style={styles.editSheet} contentContainerStyle={{ paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>
                {booking.status === 'CHECKED_IN' ? 'Change check-out' : 'Edit stay'}
              </Text>
              {booking.status === 'CHECKED_IN' ? (
                <RangeCalendar
                  key={`out-${editVisible}`}
                  mode="single"
                  checkIn={draftOut}
                  checkOut={draftOut}
                  minDate={Math.max(today, booking.checkIn + 86400000)}
                  onChange={(day) => setDates(booking.checkIn, day)}
                />
              ) : (
                <RangeCalendar
                  key={`range-${editVisible}`}
                  checkIn={draftIn}
                  checkOut={draftOut}
                  onChange={(inMs, outMs) => setDates(inMs, outMs)}
                />
              )}
              <Text style={styles.editSummary}>
                {fmtLong(draftIn)} → {fmtLong(draftOut)} · {draftNights} night(s)
              </Text>
              <Text style={styles.editLabel}>Total amount (₹)</Text>
              <TextInput
                style={styles.editInput}
                value={draftAmount}
                onChangeText={(t) => setDraftAmount(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
              />
              <Text style={styles.editLabel}>Number of guests</Text>
              <TextInput
                style={styles.editInput}
                value={draftGuests}
                onChangeText={(t) => setDraftGuests(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
              />
              <TouchableOpacity style={[styles.solidBtn, { marginTop: 14 }]} disabled={saving} onPress={handleSaveEdit}>
                <Text style={styles.solidBtnText}>{saving ? 'Saving…' : 'Save changes'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => setEditVisible(false)}>
                <Text style={styles.outlineBtnText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAwareOverlay>
      </Modal>

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
                // free for THIS stay's dates (not today's status)
                const clash = isCurrent ? undefined : bookingClash(bookings, r.number, booking.checkIn, booking.checkOut, booking.id);
                const blocked = !isCurrent && (r.status === 'MAINTENANCE' || !!clash);
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.roomChoice, isCurrent && styles.roomChoiceActive, blocked && { opacity: 0.45 }]}
                    onPress={() => handleSelectRoom(r)}
                    disabled={blocked}
                  >
                    <Text
                      style={[
                        styles.roomChoiceText,
                        isCurrent && styles.roomChoiceTextActive,
                      ]}
                    >
                      Room {r.number} · {r.type} · ₹{r.price.toLocaleString()}
                      {isCurrent ? ' · current' : r.status === 'MAINTENANCE' ? ' · maintenance' : clash ? ` · booked by ${clash.guestName}` : ' · free'}
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
  payRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  payStat: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  payLine: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  payHint: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  payActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  payBtn: {
    backgroundColor: Colors.brandPrimary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  payBtnOutline: {
    backgroundColor: Colors.brandPrimaryLight,
  },
  payBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  methodChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  methodChipActive: {
    backgroundColor: Colors.brandPrimary,
  },
  methodChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  externalBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: Colors.statusBlueBg,
  },
  externalConflict: {
    backgroundColor: Colors.statusRedBg,
  },
  externalText: {
    fontSize: 12,
    color: Colors.textPrimary,
    lineHeight: 17,
  },
  editOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  editSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 20,
    maxHeight: '92%',
  },
  editSummary: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  editLabel: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.textSecondary,
  },
  editInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: Colors.textPrimary,
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
