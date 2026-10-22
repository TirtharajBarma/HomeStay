import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStayRide } from '../data/store';
import { api } from '../data/api';
import { Header } from '../components/Header';
import { PlatformSelect } from '../components/PlatformSelect';
import { RangeCalendar } from '../components/RangeCalendar';
import { roomAvailability } from '../utils/rooms';
import { PAYMENT_METHODS } from '../utils/payments';
import { Colors } from '../theme/colors';
import { FormScroll } from '../components/FormScroll';
import { Guest, PaymentMethod, Room } from '../types';

const SOURCE_OPTIONS = [
  { label: 'StayRide Public Web Link', value: 'StayRide link', icon: 'globe-outline' as const },
  { label: 'Walk-in Direct', value: 'Walk-in', icon: 'walk-outline' as const },
  { label: 'Phone Call', value: 'Phone', icon: 'call-outline' as const },
  { label: 'WhatsApp Chat', value: 'WhatsApp', icon: 'chatbubble-ellipses-outline' as const },
  { label: 'Repeat Returning Guest', value: 'Repeat booking', icon: 'repeat-outline' as const },
];

const GUEST_COUNT_OPTIONS = [
  { label: '1 Guest', value: '1', icon: 'person-outline' as const },
  { label: '2 Guests', value: '2', icon: 'people-outline' as const },
  { label: '3 Guests', value: '3', icon: 'people-outline' as const },
  { label: '4 Guests', value: '4', icon: 'people-outline' as const },
  { label: '5+ Guests', value: '5', icon: 'people-outline' as const },
];

export const NewBookingScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<{ params: { guestId?: number; roomId?: number; checkIn?: number } }, 'params'>>();
  const { guestId, roomId: presetRoomId, checkIn: presetCheckIn } = route.params || {};

  const { guests, rooms, bookings, createBooking } = useStayRide();
  // Leaving this form ends the submission: a reopened form gets a fresh Idempotency-Key
  useEffect(() => () => api.clearIdempotencyKeys('/bookings'), []);

  const initialRoom = presetRoomId ? rooms.find((r) => r.id === presetRoomId) || null : null;
  const initialGuest = guestId ? guests.find((item) => item.id === guestId) || null : null;

  const [guestName, setGuestName] = useState(() => initialGuest?.name || '');
  const [phone, setPhone] = useState(() => initialGuest?.phone || '');
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(() => initialGuest);

  // Opened from the occupancy calendar: that room and night are preselected
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(() => initialRoom);
  const [source, setSource] = useState('StayRide link');
  const [guestsCount, setGuestsCount] = useState('1');

  // Dates: default checkIn = today midnight, checkOut = in 2 days
  const now = new Date();
  const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 86400000;
  const [checkIn, setCheckIn] = useState<number>(presetCheckIn ?? todayMs);
  const [checkOut, setCheckOut] = useState<number>((presetCheckIn ?? todayMs) + (presetCheckIn ? 1 : 2) * dayMs);

  const nights = Math.max(1, Math.round((checkOut - checkIn) / dayMs));
  const [amount, setAmount] = useState(() => (initialRoom ? String(initialRoom.price * (presetCheckIn ? 1 : 2)) : ''));
  // Money received while booking: an advance, the full amount, or nothing yet
  const [received, setReceived] = useState('');
  const [receivedMethod, setReceivedMethod] = useState<PaymentMethod>('UPI');

  const [datesPickerVisible, setDatesPickerVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Synchronize guest info during render without triggering effect waterfalls
  const [syncedGuestId, setSyncedGuestId] = useState<number | undefined>(initialGuest?.id);
  if (guestId && (!selectedGuest || syncedGuestId !== guestId)) {
    const g = guests.find((item) => item.id === guestId);
    if (g) {
      setSyncedGuestId(guestId);
      setSelectedGuest(g);
      setGuestName(g.name);
      setPhone(g.phone);
    }
  }

  const fmtLong = (ms: number) =>
    new Date(ms).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const handleSelectGuest = (g: Guest) => {
    setSelectedGuest(g);
    setGuestName(g.name);
    setPhone(g.phone);
  };

  const clearGuest = () => {
    setSelectedGuest(null);
    setGuestName('');
    setPhone('');
  };

  // Type-ahead over the guest list (name or phone), so a big list never needs scrolling
  const digits = (p: string) => (p || '').replace(/\D/g, '');
  const query = guestName.trim().toLowerCase();
  const phoneQuery = digits(phone).slice(-10);
  const suggestions = selectedGuest
    ? []
    : guests
        .filter(
          (g) =>
            (query.length >= 2 && g.name.toLowerCase().includes(query)) ||
            (phoneQuery.length >= 4 && digits(g.phone).includes(phoneQuery))
        )
        .slice(0, 5);
  // Same phone = same person: offer the existing record instead of creating a duplicate
  const phoneOwner = !selectedGuest && phoneQuery.length === 10 ? guests.find((g) => digits(g.phone).slice(-10) === phoneQuery) : undefined;

  // Only rooms free for these dates can be picked; the rest are listed with the reason
  const availability = roomAvailability(rooms, bookings, checkIn, checkOut);
  const freeRooms = availability.filter((a) => a.free).map((a) => a.room);
  const busyRooms = availability.filter((a) => !a.free);
  // A room picked earlier stops counting once new dates make it unavailable
  const pickedRoom = selectedRoom && freeRooms.some((r) => r.id === selectedRoom.id) ? selectedRoom : null;

  const handleSave = async () => {
    if (submitting) return;
    const trimmedName = guestName.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      Alert.alert('Required', 'Guest name is required');
      return;
    }

    if (!pickedRoom) {
      Alert.alert('Required', 'Please select a room that is free for these dates');
      return;
    }

    // An existing guest is picked from the suggestions; anyone else is new and needs a phone
    // (the server also matches by phone, so the same person is never stored twice).
    if (!selectedGuest && digits(trimmedPhone).length < 10) {
      Alert.alert('Required', 'Enter a 10-digit phone number for a new guest, or pick an existing guest.');
      return;
    }

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid', 'Enter a valid amount');
      return;
    }

    const parsedCount = Math.max(1, parseInt(guestsCount, 10) || 1);
    const receivedNum = received ? parseInt(received, 10) : 0;
    if (receivedNum > parsedAmount) {
      Alert.alert('Check amount', 'The amount received cannot be more than the booking total.');
      return;
    }

    setSubmitting(true);
    try {
      await createBooking({
        guestId: selectedGuest?.id ?? 0,
        guestName: trimmedName,
        phone: trimmedPhone || selectedGuest?.phone || '',
        roomNumber: pickedRoom.number,
        checkIn,
        checkOut,
        guests: parsedCount,
        amount: parsedAmount,
        source: source || 'Walk-in',
        paid: false, // the server marks it paid once the money received covers the total
        advance: receivedNum,
        advanceMethod: receivedMethod,
      });

      Alert.alert(
        'Booking Created',
        `Booking created for ${trimmedName} · Room ${pickedRoom.number}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      Alert.alert('Booking failed', err?.message || 'Could not save the booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="New booking" onBack={() => navigation.goBack()} />

      <FormScroll contentContainerStyle={styles.scrollContent}>
        {/* Guest Input / Picker */}
        <Text style={styles.label}>Guest</Text>
        {selectedGuest ? (
          <View style={styles.selectedGuestCard}>
            <Ionicons name="person-circle-outline" size={26} color={Colors.brandPrimaryDark} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.selectedGuestName}>{selectedGuest.name}</Text>
              <Text style={styles.selectedGuestMeta}>
                {selectedGuest.phone} · existing guest · {selectedGuest.visits} visit(s)
              </Text>
            </View>
            <TouchableOpacity onPress={clearGuest} hitSlop={10}>
              <Text style={styles.pickerTriggerText}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="Type a name or phone to find a guest"
              placeholderTextColor={Colors.textSecondary}
              value={guestName}
              onChangeText={setGuestName}
            />
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={styles.input}
              placeholder="10-digit mobile number"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            {phoneOwner ? (
              <TouchableOpacity style={styles.suggestionRow} onPress={() => handleSelectGuest(phoneOwner)}>
                <Ionicons name="alert-circle-outline" size={18} color={Colors.statusOrange} />
                <Text style={[styles.suggestionText, { flex: 1 }]}>
                  This number belongs to {phoneOwner.name}. Tap to use that guest.
                </Text>
              </TouchableOpacity>
            ) : (
              suggestions.map((g) => (
                <TouchableOpacity key={g.id} style={styles.suggestionRow} onPress={() => handleSelectGuest(g)}>
                  <Ionicons name="person-outline" size={16} color={Colors.brandPrimaryDark} />
                  <Text style={[styles.suggestionText, { flex: 1 }]}>{g.name}</Text>
                  <Text style={styles.selectedGuestMeta}>{g.phone}</Text>
                </TouchableOpacity>
              ))
            )}
            {!phoneOwner && guestName.trim().length >= 2 && (
              <Text style={styles.selectedGuestMeta}>
                {suggestions.length ? 'Tap a guest above, or continue to add a new guest.' : 'New guest: they will be saved with this booking.'}
              </Text>
            )}
          </>
        )}

        {/* Room Picker */}
        <PlatformSelect
          label="Room"
          value={pickedRoom ? String(pickedRoom.id) : ''}
          options={freeRooms.map((r) => ({
            label: `Room ${r.number} · ${r.type}`,
            value: String(r.id),
            icon: 'bed-outline' as const,
            subLabel: `₹${r.price.toLocaleString()}/night · ${r.floor}`,
          }))}
          onSelect={(roomIdStr) => {
            const rm = freeRooms.find((r) => String(r.id) === roomIdStr);
            if (rm) {
              setSelectedRoom(rm);
              setAmount(String(rm.price * nights));
            }
          }}
          placeholder={freeRooms.length ? `${freeRooms.length} room(s) free for these dates` : 'No room is free for these dates'}
        />
        {busyRooms.length > 0 && (
          <Text style={styles.selectedGuestMeta}>
            Not free for these dates: {busyRooms.map((a) => `Room ${a.room.number} (${a.reason})`).join(', ')}
          </Text>
        )}

        {/* Dates */}
        <Text style={styles.label}>Stay Dates</Text>
        <TouchableOpacity
          style={styles.dropdownBtn}
          onPress={() => setDatesPickerVisible(true)}
        >
          <Ionicons name="calendar-outline" size={18} color={Colors.brandPrimaryDark} style={{ marginRight: 10 }} />
          <Text style={[styles.dropdownVal, { flex: 1 }]}>
            Check-in {fmtLong(checkIn)}
            {'\n'}Check-out {fmtLong(checkOut)} · {nights} night(s)
          </Text>
        </TouchableOpacity>

        {/* Number of Guests */}
        <PlatformSelect
          label="Number of Guests"
          value={guestsCount}
          options={GUEST_COUNT_OPTIONS}
          onSelect={setGuestsCount}
        />

        {/* Amount */}
        <Text style={styles.label}>Total Amount (₹)</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          placeholderTextColor={Colors.textSecondary}
          keyboardType="number-pad"
          value={amount}
          onChangeText={setAmount}
        />

        {/* Source */}
        <PlatformSelect
          label="Booking Source"
          value={source}
          options={SOURCE_OPTIONS}
          onSelect={setSource}
        />

        {/* Money received now: advance or full amount */}
        <Text style={styles.label}>Received now (₹)</Text>
        <View style={styles.guestInputRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="0 = nothing yet"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="number-pad"
            value={received}
            onChangeText={(t) => setReceived(t.replace(/[^0-9]/g, ''))}
          />
          <TouchableOpacity style={styles.pickerTriggerBtn} onPress={() => setReceived(amount)}>
            <Text style={styles.pickerTriggerText}>Full amount</Text>
          </TouchableOpacity>
        </View>
        {Number(received) > 0 && (
          <View style={styles.methodRow}>
            {PAYMENT_METHODS.filter((m) => m.value !== 'OTA').map((m) => (
              <TouchableOpacity
                key={m.value}
                style={[styles.methodChip, receivedMethod === m.value && styles.methodChipActive]}
                onPress={() => setReceivedMethod(m.value)}
              >
                <Text style={[styles.methodChipText, receivedMethod === m.value && styles.methodChipTextActive]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {Number(amount) > 0 && (
          <Text style={styles.selectedGuestMeta}>
            {Number(received) >= Number(amount)
              ? 'Fully paid'
              : `Balance due: ₹${(Number(amount) - (Number(received) || 0)).toLocaleString('en-IN')}`}
          </Text>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, submitting && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={submitting}
        >
          <Text style={styles.saveBtnText}>{submitting ? 'Saving…' : 'Create booking'}</Text>
        </TouchableOpacity>
      </FormScroll>

      {/* Quick Dates Picker Modal */}
      <Modal
        visible={datesPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDatesPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDatesPickerVisible(false)}
        >
          {/* inner touchable swallows taps so picking a day does not hit the backdrop's close */}
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Stay Dates</Text>
            <RangeCalendar
              checkIn={checkIn}
              checkOut={checkOut}
              onChange={(inMs, outMs) => {
                setCheckIn(inMs);
                setCheckOut(outMs);
                const n = Math.max(1, Math.round((outMs - inMs) / dayMs));
                if (selectedRoom) {
                  setAmount(String(selectedRoom.price * n));
                }
                setDatesPickerVisible(false);
              }}
            />
          </TouchableOpacity>
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 36,
  },
  label: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  guestInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  pickerTriggerBtn: {
    backgroundColor: Colors.brandPrimaryLight,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
  },
  pickerTriggerText: {
    color: Colors.brandPrimaryDark,
    fontSize: 13,
    fontWeight: 'bold',
  },
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
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
  methodChipTextActive: {
    color: '#FFFFFF',
  },
  selectedGuestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brandPrimaryLight,
    borderRadius: 10,
    padding: 12,
  },
  selectedGuestName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  selectedGuestMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
  },
  suggestionText: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  dropdownBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownVal: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  dropdownPlaceholder: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  saveBtn: {
    backgroundColor: Colors.brandPrimary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  paymentSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  paymentSwitchTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  paymentSwitchSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  modalItem: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  modalItemText: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  modalItemSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
