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
import { roomAvailability, heldUntil } from '../utils/rooms';
import { PAYMENT_METHODS } from '../utils/payments';
import { Colors } from '../theme/colors';
import { FormScroll } from '../components/FormScroll';
import { Guest, PaymentMethod, Room } from '../types';

const SOURCE_OPTIONS = [
  { label: 'Walk-in Direct', value: 'Walk-in', icon: 'walk-outline' as const },
  { label: 'Phone Call / WhatsApp', value: 'Phone / WhatsApp', icon: 'call-outline' as const },
  { label: 'Airbnb', value: 'Airbnb', icon: 'home-outline' as const },
  { label: 'MakeMyTrip / Goibibo', value: 'MakeMyTrip', icon: 'airplane-outline' as const },
  { label: 'Booking.com', value: 'Booking.com', icon: 'business-outline' as const },
  { label: 'Agoda', value: 'Agoda', icon: 'globe-outline' as const },
  { label: 'Homestay Website / Link', value: 'Website link', icon: 'globe-outline' as const },
  { label: 'Repeat Returning Guest', value: 'Repeat booking', icon: 'repeat-outline' as const },
  { label: '➕ Other / Custom Source...', value: 'OTHER', icon: 'create-outline' as const },
];

const GUEST_COUNT_OPTIONS = [
  { label: '1 Guest', value: '1', icon: 'person-outline' as const },
  { label: '2 Guests', value: '2', icon: 'people-outline' as const },
  { label: '3 Guests', value: '3', icon: 'people-outline' as const },
  { label: '4 Guests', value: '4', icon: 'people-outline' as const },
  { label: '5 Guests', value: '5', icon: 'people-outline' as const },
  { label: '6 Guests', value: '6', icon: 'people-outline' as const },
  { label: '7-10 Guests (Group)', value: '8', icon: 'people-outline' as const },
  { label: '➕ Custom Count...', value: 'CUSTOM', icon: 'create-outline' as const },
];

export const NewBookingScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<{ params: { guestId?: number; roomId?: number; checkIn?: number } }, 'params'>>();
  const { guestId, roomId: presetRoomId, checkIn: presetCheckIn } = route.params || {};

  const { guests, rooms, bookings, createBooking, homestay } = useStayRide();
  // Leaving this form ends the submission: a reopened form gets a fresh Idempotency-Key
  useEffect(() => () => api.clearIdempotencyKeys('/bookings'), []);

  const initialRoom = presetRoomId ? rooms.find((r) => r.id === presetRoomId) || null : null;
  const initialGuest = guestId ? guests.find((item) => item.id === guestId) || null : null;

  const [guestName, setGuestName] = useState(() => initialGuest?.name || '');
  const [phone, setPhone] = useState(() => initialGuest?.phone || '');
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(() => initialGuest);

  // Opened from the occupancy calendar: that room and night are preselected
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(() => initialRoom);
  const [source, setSource] = useState('Walk-in');
  const [customSource, setCustomSource] = useState('');
  const [isCustomSource, setIsCustomSource] = useState(false);

  const [guestsCount, setGuestsCount] = useState('2');
  const [customGuests, setCustomGuests] = useState('');
  const [isCustomGuests, setIsCustomGuests] = useState(false);

  const [pickedBed, setPickedBed] = useState<string>('');
  const [customBed, setCustomBed] = useState<string>('');
  const [isCustomBed, setIsCustomBed] = useState(false);

  // Dates: default checkIn = today midnight (IST Asia/Kolkata), checkOut = in 2 days
  const istTodayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [iY, iM, iD] = istTodayStr.split('-').map(Number);
  const todayMs = new Date(iY, iM - 1, iD).getTime();
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
      timeZone: 'Asia/Kolkata',
    });

  const fmtDateParts = (ms: number) => {
    const d = new Date(ms);
    const day = d.toLocaleDateString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' });
    const weekday = d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' });
    const month = d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' });
    const year = d.toLocaleDateString('en-IN', { year: 'numeric', timeZone: 'Asia/Kolkata' });
    return { day, weekday, month, year, formatted: `${weekday}, ${day} ${month}` };
  };

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

  const dormBeds = pickedRoom?.roomType === 'DORM'
    ? (pickedRoom.beds && pickedRoom.beds.length > 0
        ? pickedRoom.beds
        : Array.from({ length: pickedRoom.bedCount || 4 }, (_, i) => `Bed ${i + 1}`))
    : [];
  const occupiedBedsInDorm = pickedRoom?.roomType === 'DORM'
    ? new Set(
        bookings
          .filter(
            (b) =>
              b.roomNumber === pickedRoom.number &&
              b.status !== 'CANCELLED' &&
              checkIn < heldUntil(b) &&
              checkOut > b.checkIn &&
              b.bedNumber
          )
          .map((b) => b.bedNumber!)
      )
    : new Set<string>();

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

    const parsedCount = isCustomGuests
      ? Math.max(1, parseInt(customGuests.trim() || '1', 10))
      : Math.max(1, parseInt(guestsCount, 10) || 1);

    if (pickedRoom.roomType === 'DORM' && parsedCount !== 1) {
      Alert.alert('Single Bed Allocation', 'A dorm bed accommodates exactly 1 guest per bed. Please set guests count to 1.');
      return;
    }
    const maxPrivateCapacity = Math.max(2, (pickedRoom.bedCount || 1) * 2);
    if (pickedRoom.roomType !== 'DORM' && parsedCount > maxPrivateCapacity) {
      Alert.alert('Capacity Exceeded', `Room ${pickedRoom.number} accommodates at most ${maxPrivateCapacity} guests.`);
      return;
    }

    const receivedNum = received ? parseInt(received, 10) : 0;
    if (receivedNum > parsedAmount) {
      Alert.alert('Check amount', 'The amount received cannot be more than the booking total.');
      return;
    }

    const chosenBed = pickedRoom.roomType === 'DORM'
      ? (isCustomBed
          ? (customBed.trim() || 'Bed 1')
          : (pickedBed || dormBeds.find((b) => !occupiedBedsInDorm.has(b)) || 'Bed 1'))
      : undefined;

    const finalSource = isCustomSource
      ? (customSource.trim() || 'Custom')
      : (source || 'Walk-in');

    setSubmitting(true);
    try {
      await createBooking({
        guestId: selectedGuest?.id ?? 0,
        guestName: trimmedName,
        phone: trimmedPhone || selectedGuest?.phone || '',
        roomNumber: pickedRoom.number,
        bedNumber: chosenBed,
        checkIn,
        checkOut,
        guests: parsedCount,
        amount: parsedAmount,
        source: finalSource,
        paid: false, // the server marks it paid once the money received covers the total
        advance: receivedNum,
        advanceMethod: receivedMethod,
      });

      Alert.alert(
        'Booking Confirmed',
        `Booking confirmed for ${trimmedName} · Room ${pickedRoom.number}${chosenBed ? ` (${chosenBed})` : ''} (${nights} night${nights > 1 ? 's' : ''}).\n\nBooking confirmation & cab link are automatically dispatched to the guest via official WhatsApp.`,
        [
          {
            text: 'Done',
            onPress: () => navigation.goBack(),
          },
        ]
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
        {pickedRoom?.roomType === 'DORM' ? (
          <View style={styles.grid5050}>
            <View style={styles.col50}>
              <PlatformSelect
                label="Room"
                value={pickedRoom ? String(pickedRoom.id) : ''}
                options={freeRooms.map((r) => ({
                  label: `Room ${r.number}`,
                  value: String(r.id),
                  icon: (r.roomType === 'DORM' ? 'people-outline' : 'bed-outline') as any,
                  subLabel: `₹${r.price.toLocaleString()}${r.roomType === 'DORM' ? '/bed' : '/night'} · ${r.floor}`,
                }))}
                onSelect={(roomIdStr) => {
                  const rm = freeRooms.find((r) => String(r.id) === roomIdStr);
                  if (rm) {
                    setSelectedRoom(rm);
                    setAmount(String(rm.price * nights));
                    setPickedBed('');
                  }
                }}
                placeholder={freeRooms.length ? `${freeRooms.length} free` : 'No room free'}
              />
            </View>
            <View style={styles.col50}>
              <PlatformSelect
                label="Dorm Bed"
                value={isCustomBed ? 'CUSTOM' : (pickedBed || dormBeds.find((b) => !occupiedBedsInDorm.has(b)) || 'Bed 1')}
                options={[
                  ...dormBeds.map((bed) => ({
                    label: bed + (occupiedBedsInDorm.has(bed) ? ' (Busy)' : ' (Free)'),
                    value: bed,
                    icon: 'bed-outline' as const,
                  })),
                  { label: '➕ Custom Bed Name...', value: 'CUSTOM', icon: 'create-outline' as const },
                ]}
                onSelect={(val) => {
                  if (val === 'CUSTOM') {
                    setIsCustomBed(true);
                  } else {
                    setIsCustomBed(false);
                    setPickedBed(val);
                  }
                }}
              />
            </View>
          </View>
        ) : (
          <PlatformSelect
            label="Room / Dorm"
            value={pickedRoom ? String(pickedRoom.id) : ''}
            options={freeRooms.map((r) => ({
              label: r.roomType === 'DORM' ? `Room ${r.number} (Dorm - ${r.bedCount || 4} Beds)` : `Room ${r.number}`,
              value: String(r.id),
              icon: (r.roomType === 'DORM' ? 'people-outline' : 'bed-outline') as any,
              subLabel: `₹${r.price.toLocaleString()}${r.roomType === 'DORM' ? '/bed/night' : '/night'} · ${r.floor}`,
            }))}
            onSelect={(roomIdStr) => {
              const rm = freeRooms.find((r) => String(r.id) === roomIdStr);
              if (rm) {
                setSelectedRoom(rm);
                setAmount(String(rm.price * nights));
                setPickedBed('');
                setIsCustomBed(false);
              }
            }}
            placeholder={freeRooms.length ? `${freeRooms.length} room(s) free for these dates` : 'No room is free for these dates'}
          />
        )}
        {isCustomBed && pickedRoom?.roomType === 'DORM' && (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.label}>Custom Dorm Bed Identifier</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Lower Bunk 1, Window Bed, Bunk 2B"
              placeholderTextColor={Colors.textSecondary}
              value={customBed}
              onChangeText={setCustomBed}
            />
          </View>
        )}
        {busyRooms.length > 0 && (
          <Text style={styles.selectedGuestMeta}>
            Not free for these dates: {busyRooms.map((a) => `Room ${a.room.number} (${a.reason})`).join(', ')}
          </Text>
        )}

        {/* Dates */}
        <Text style={styles.label}>Stay Dates</Text>
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.stayDatesCard}
          onPress={() => setDatesPickerVisible(true)}
        >
          <View style={styles.dateSegment}>
            <View style={styles.dateSegmentHeader}>
              <Ionicons name="calendar-outline" size={13} color={Colors.brandPrimary} />
              <Text style={styles.dateSegmentLabel}>CHECK-IN</Text>
            </View>
            <Text style={styles.dateSegmentMain}>{fmtDateParts(checkIn).formatted}</Text>
            <Text style={styles.dateSegmentYear}>{fmtDateParts(checkIn).year}</Text>
          </View>

          <View style={styles.nightsBadgeContainer}>
            <View style={styles.nightsBadge}>
              <Ionicons name="moon" size={11} color={Colors.brandPrimaryDark} style={{ marginRight: 3 }} />
              <Text style={styles.nightsBadgeText}>
                {nights} {nights === 1 ? 'Night' : 'Nights'}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={13} color={Colors.textSecondary} style={{ marginTop: 4 }} />
          </View>

          <View style={[styles.dateSegment, { alignItems: 'flex-end' }]}>
            <View style={[styles.dateSegmentHeader, { alignSelf: 'flex-end' }]}>
              <Ionicons name="calendar-outline" size={13} color={Colors.brandPrimary} />
              <Text style={styles.dateSegmentLabel}>CHECK-OUT</Text>
            </View>
            <Text style={styles.dateSegmentMain}>{fmtDateParts(checkOut).formatted}</Text>
            <Text style={styles.dateSegmentYear}>{fmtDateParts(checkOut).year}</Text>
          </View>
        </TouchableOpacity>

        {/* Row: Guests & Source (50/50 Grid) */}
        <View style={styles.grid5050}>
          <View style={styles.col50}>
            <PlatformSelect
              label="Guests"
              value={isCustomGuests ? 'CUSTOM' : guestsCount}
              options={GUEST_COUNT_OPTIONS}
              onSelect={(val) => {
                if (val === 'CUSTOM') {
                  setIsCustomGuests(true);
                  setGuestsCount('CUSTOM');
                } else {
                  setIsCustomGuests(false);
                  setGuestsCount(val);
                }
              }}
            />
          </View>
          <View style={styles.col50}>
            <PlatformSelect
              label="Source"
              value={isCustomSource ? 'OTHER' : source}
              options={SOURCE_OPTIONS}
              onSelect={(val) => {
                if (val === 'OTHER') {
                  setIsCustomSource(true);
                  setSource('OTHER');
                } else {
                  setIsCustomSource(false);
                  setSource(val);
                }
              }}
            />
          </View>
        </View>

        {/* Dynamic Inputs for Custom Guests / Custom Source */}
        {(isCustomGuests || isCustomSource) && (
          <View style={styles.grid5050}>
            {isCustomGuests ? (
              <View style={styles.col50}>
                <Text style={styles.label}>Guests Count</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 8"
                  keyboardType="numeric"
                  value={customGuests}
                  onChangeText={setCustomGuests}
                />
              </View>
            ) : (
              <View style={styles.col50} />
            )}
            {isCustomSource ? (
              <View style={styles.col50}>
                <Text style={styles.label}>Custom Channel</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Agoda, Tour Agent"
                  value={customSource}
                  onChangeText={setCustomSource}
                />
              </View>
            ) : (
              <View style={styles.col50} />
            )}
          </View>
        )}

        {/* Row: Total Tariff & Advance Collected (50/50 Grid) */}
        <View style={styles.grid5050}>
          <View style={styles.col50}>
            <Text style={styles.label}>Total Tariff (₹)</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="number-pad"
              value={amount}
              onChangeText={setAmount}
            />
          </View>

          <View style={styles.col50}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.label}>Advance (₹)</Text>
              {Boolean(amount) && (
                <TouchableOpacity onPress={() => setReceived(amount)} hitSlop={6}>
                  <Text style={styles.fullAmountLink}>Full</Text>
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={styles.input}
              placeholder="0 = unpaid"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="number-pad"
              value={received}
              onChangeText={(t) => setReceived(t.replace(/[^0-9]/g, ''))}
            />
          </View>
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
  stayDatesCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  dateSegment: {
    flex: 1,
  },
  dateSegmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  dateSegmentLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: Colors.textSecondary,
  },
  dateSegmentMain: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  dateSegmentYear: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  nightsBadgeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  nightsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  nightsBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.brandPrimaryDark,
  },
  grid5050: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  col50: {
    flex: 1,
    minWidth: 0,
  },
  fullAmountLink: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brandPrimary,
    marginBottom: 6,
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
